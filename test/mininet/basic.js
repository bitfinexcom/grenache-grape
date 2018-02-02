const test = require('tapenet')

const {h1, h2, h3, h4} = test.topologies.basic(4)

test('4 grapes, worker + client, 1000 requests', function (t) {
  t.run(h1, function () {
    const { Grape } = require('../../')

    const grape = new Grape({
      dht_port: 20001,
      dht_bootstrap: [],
      api_port: 40001
    })

    grape.start(() => {
      t.pass('grape 1 bootstrapped and ready')
      h1.emit('bootstrap', `${global.ip}:20001`)
    })
  })

  t.run(h2, function () {
    h1.on('bootstrap', function (node) {
      const { Grape } = require('../../')

      const grape = new Grape({
        dht_port: 20001,
        dht_bootstrap: [ node ],
        api_port: 40001
      })

      grape.start(() => {
        t.pass('grape 2 bootstrapped and ready')
        h2.emit('ready', [node, `${global.ip}:20001`])
      })
    })
  })

  t.run(h3, function () {
    h2.on('ready', function (bootstrap) {
      const { Grape } = require('../../')
      const { PeerRPCServer } = require('grenache-nodejs-http')
      const Link = require('grenache-nodejs-link')

      const grape = new Grape({
        dht_port: 20001,
        dht_bootstrap: bootstrap,
        api_port: 40001
      })

      grape.start(() => {
        const link = new Link({ grape: 'http://127.0.0.1:40001' })
        link.start()

        const peer = new PeerRPCServer(link, {})
        peer.init()

        const service = peer.transport('server')
        service.listen(5000)
        
        link.startAnnouncing('rpc_test', service.port, null, () => {
          h3.emit('service', bootstrap)
        })

        service.on('request', (rid, key, payload, handler) => {
          handler.reply(null, payload + ': world')
        })
      })
    })
  })

  t.run(h4, function () {
    h3.on('service', function (bootstrap) {
      const { Grape } = require('../../')
      const { PeerRPCClient } = require('grenache-nodejs-http')
      const Link = require('grenache-nodejs-link')

      const grape = new Grape({
        dht_port: 20001,
        dht_bootstrap: bootstrap,
        api_port: 40001
      })

      grape.start(() => {
        const link = new Link({ grape: 'http://127.0.0.1:40001' })
        link.start()

        const peer = new PeerRPCClient(link, {})
        const started = Date.now()
        const rts = 1000
        const expected = []
        const actual = []

        peer.init()
        requestTimes(rts)  

        function requestTimes (n) {
          if (n === 0) {
            t.same(actual, expected, 'correct data returned in correct order')
            t.pass(`${rts} round trips took ${Date.now() - started} ms`)
            return t.end()
          }

          const payload = 'hello-' + n
          expected.push(payload + ': world')

          peer.request('rpc_test', payload, {timeout: 10000}, (err, data) => {
            if (err) {
              t.error(err, 'no error')
              t.end()
              return
            }
            actual.push(data)
            requestTimes(n - 1)
          })
        }
      })
    })
  })
})
