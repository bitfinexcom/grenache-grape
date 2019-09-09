const tapenet = require('tapenet')
const bootstrap = require('./helpers/bootstrap')
const nodes = 3
const rts = 10
const { h1, h2, h3 } = tapenet.topologies.basic(nodes)

tapenet(`${nodes} peers, 1000 lookups`, (t) => {
  bootstrap({t, h: h3, rts})

  t.run(h1, function () {
    
    tapenet.on('bootstrap', ({bootstrap, bsPort, rts}) => {
      const crypto = require('crypto')
      const dht = require('@hyperswarm/dht')
      const topic = crypto.randomBytes(32)
      const started = Date.now()
      const peer = dht({ bootstrap })
      peer.on('listening', () => {
        const { port } = peer.address()
        peer.announce(topic, (err) => {
          t.error(err, 'no announce error')
          h1.emit('ready', {bootstrap, topic, h1Port: port, bsPort, rts})
        })
      })

      tapenet.on('done', () => {
        peer.destroy()
        t.pass(`scenario took ${Date.now() - started} ms`)
      })

    })
  })

  t.run(h2, function () {
    h1.on('ready', ({bootstrap, topic, h1Port, bsPort, rts}) => {
      const dht = require('@hyperswarm/dht')
      console.log(bootstrap, port)
      const peer = dht({ bootstrap, ephemeral: true })

      peer.on('listening', () => {
        const started = Date.now()
        const expected = []
        const actual = []
        
        lookups(rts)

        function lookups (n) {
          if (n === 0) {
            t.same(actual, expected, 'correct data returned in correct order')
            t.pass(`${rts} round trips took ${Date.now() - started} ms`)
            peer.destroy()
            tapenet.emit('done')
            t.end()
            return
          }
          peer.lookup(topic, topic, (err, result) => {
            t.error(err, 'no lookup error')
            const [{node, peers}] = result
            t.is(node.port, bsPort)
            t.is(peers[0].port, h1Port)
            lookups(n - 1)
          })
        }
      })
    })
  })
})
