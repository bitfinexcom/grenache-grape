const test = require('tapenet')
const bootstrap = require('./helpers/bootstrap')

const {h1, h2, h3, h4} = test.topologies.basic(4)

test('4 grapes, worker + client, 1000 requests', function (t) {
  bootstrap(t, h1, h2)

  t.run(h3, function () {
    h2.on('ready', function (bootstrap) {
      const grape = require('./helpers/grape')
      const { PeerRPCServer } = require('grenache-nodejs-http')
      const Link = require('grenache-nodejs-link')

      grape(bootstrap, () => {
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
      const grape = require('./helpers/grape')
      const { PeerRPCClient } = require('grenache-nodejs-http')
      const Link = require('grenache-nodejs-link')

      grape(bootstrap, () => {
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
