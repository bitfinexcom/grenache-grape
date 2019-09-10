const tapenet = require('tapenet')
const bootstrap = require('./helpers/bootstrap')
const { 
  NODES = 102,
  RTS = 100
} = process.env

const topology = tapenet.topologies.basic(NODES)
const { h1: announcer, h2: bootstrapper } = topology 

tapenet(`1 bootstrap, 1 announcing, ${NODES - 2} lookup peers, ${RTS} lookups per peer`, (t) => {
  bootstrap({t, h: bootstrapper, nodeCount: +NODES, rts: +RTS})

  t.run(announcer, function () {
    
    tapenet.on('bootstrap', ({bootstrap, bsPort, nodeCount, rts}) => {
      const crypto = require('crypto')
      const dht = require('@hyperswarm/dht')
      const topic = crypto.randomBytes(32)
      const peer = dht({ bootstrap })
      var started = Date.now()
      peer.on('listening', () => {
        const { port } = peer.address()
        peer.announce(topic, (err) => {
          t.error(err, 'no announce error')
          h1.emit('ready', {bootstrap, topic, bsPort, h1Port: port, rts})
        })
      })
      const lookupNodeCount = nodeCount - 2
      var count = 0
      tapenet.on('host-done', () => {
        count++
        if (count === lookupNodeCount) {
          t.pass(`scenario took ${Date.now() - started} ms`)
          tapenet.emit('done')
          peer.destroy()
          t.end()
        }
      })

    })
  })

  for (const id in topology) {
    if (id[0] !== 'h') continue
    if (id === 'h1' || id === 'h2') continue
    const host = topology[id]
    t.run(host, function () {
      h1.on('ready', ({bootstrap, topic, bsPort, h1Port, rts}) => {
        const dht = require('@hyperswarm/dht')
        const peer = dht({ bootstrap, ephemeral: false })
        tapenet.on('done', () => {
          peer.destroy()
        })
        tapenet.on('dht-ready', () => {
          const started = Date.now()

          lookups(rts)
  
          function lookups (n) {
            if (n === 0) {
              t.pass(`${rts} round trips took ${Date.now() - started} ms`)
              tapenet.emit('host-done')
              return
            }
            peer.lookup(topic, (err, result) => {
              t.error(err, 'no lookup error')
              if (err) return
              const hasResult = result.length > 0
              t.is(hasResult, true, 'lookup has a result')
              if (hasResult === false) return
              const [{node, peers}] = result
              t.is(node.port, bsPort)
              t.is(peers[0].port, h1Port)
              lookups(n - 1)
            })
          }
        })
      })
    })
  }

  
})

