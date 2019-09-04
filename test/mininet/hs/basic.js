const tapenet = require('tapenet')

const rts = 10
const nodes = 3
const { h1, h2, h3 } = tapenet.topologies.basic(nodes)

function bootstrap ({t, h}) {
  t.run(h, () => {
    const dht = require('@hyperswarm/dht')
    const node = dht()
    node.once('listening', () => {
      const { port } = node.address()
      tapenet.emit('bootstrap', {
        port,
        bootstrap: [`${ip}:${port}`],
        closeDht: () => node.destroy()
      })
    })
    node.once('error', (err) => {
      throw err
    })
  })
}

tapenet(`${nodes} peers, ${rts} lookups`, (t) => {
  bootstrap({t, h: h3})

  t.run(h1, function () {
    
    tapenet.on('bootstrap', ({bootstrap, port, closeDht}) => {
      const crypto = require('crypto')
      const dht = require('@hyperswarm/dht')
      const topic = crypto.randomBytes(32)
      const peer = dht({ bootstrap })

      peer.on('listening', () => {
        peer.announce(topic, { port }, (err) => {
          t.error(err, 'no announce error')
          h1.emit('ready', {bootstrap, topic, port})
        })
      })

      tapenet.on('done', () => {
        peer.destroy()
        closeDht()
        t.end()
      })


    })
  })

  t.run(h2, function () {
    h1.on('ready', ({bootstrap, topic, port}) => {
      const dht = require('@hyperswarm/dht')
      const peer = dht({ bootstrap })

      peer.on('listening', () => {
        const started = Date.now()
        const expected = []
        const actual = []

        requestTimes(rts)

        function requestTimes (n) {
          if (n === 0) {
            t.same(actual, expected, 'correct data returned in correct order')
            t.pass(`${rts} round trips took ${Date.now() - started} ms`)
            peer.destroy()
            tapenet.emit('done')
            return
          }
          peer.lookup(topic, topic, (err, [{node}]) => {
            t.error(err, 'no lookup error')
            t.is(node.port, port)
            requestTimes(n - 1)
          })
        }
      })
    })
  })
})
