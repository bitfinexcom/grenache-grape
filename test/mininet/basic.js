const tapenet = require('tapenet')
const bootstrap = require('./helpers/bootstrap')

const { h1, h2 } = tapenet.topologies.basic(4)

tapenet('4 grapes, worker + client, 1000 requests', function (t) {
  bootstrap(tapenet, t)

  t.run(h1, function () {
    tapenet.on('bootstrap', function (bootstrap) {
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

        link.startAnnouncing('rpc_test', service.port, null, (err) => {
          t.error(err, 'no announce error')
          h1.emit('service', bootstrap)
        })

        service.on('request', (rid, key, payload, handler) => {
          handler.reply(null, payload + ': world')
        })
      })
    })
  })

  t.run(h2, function () {
    h1.on('service', function (bootstrap) {
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

          peer.request('rpc_test', payload, { timeout: 10000 }, (err, data) => {
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
