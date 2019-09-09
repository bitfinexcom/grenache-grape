const tapenet = require('tapenet')
const bootstrap = require('./helpers/bootstrap')

const { 
  NODES = 12,
  RTS = 10
} = process.env

const topology = tapenet.topologies.basic(NODES)
const { h1: main, h2: bootstrapper } = topology 


tapenet(`1 bootstrap, 1 lookup, ${NODES - 2} announcing peers, ${RTS} lookups`, (t) => {
  const nodeCount = +NODES
  bootstrap({t, h: bootstrapper, nodeCount, rts: +RTS})

  t.run(main, function () {
    tapenet.on('bootstrap', ({bootstrap, bsPort, nodeCount, rts}) => {
      var count = 0
      const announcingNodeCount = nodeCount - 2
      tapenet.on('host-ready', ({topic}) => {
        count++
        if (count === announcingNodeCount) {
          tapenet.emit('all-hosts-ready', {topic})
        }
      })
      tapenet.on('all-hosts-ready', ({topic}) => {
        const dht = require('@hyperswarm/dht')
        const peer = dht({ bootstrap, ephemeral: true })
        tapenet.on('done', () => {
          try { peer.destroy() } catch (e) {}
        })
        peer.on('listening', () => {
          const started = Date.now()

          lookups(rts)

          function lookups (n) {
            if (n === 0) {
              t.pass(`${rts} round trips took ${Date.now() - started} ms`)
              tapenet.emit('done')
              t.end()
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
              lookups(n - 1)
            })
          }
        })
      })
    })
  })

  for (const id in topology) {
    if (id[0] !== 'h') continue
    if (id === 'h1' || id === 'h2') continue
    const host = topology[id]

    t.run(host, function () {
    
      tapenet.on('bootstrap', ({bootstrap, bsPort, nodeCount, rts}) => {
        const crypto = require('crypto')
        const dht = require('@hyperswarm/dht')
        const topic = crypto.randomBytes(32)
        const peer = dht({ bootstrap })
        peer.on('listening', () => {
          // const { port } = peer.address()
          peer.announce(topic, (err) => {
            t.error(err, 'no announce error')
            tapenet.emit('host-ready', {bootstrap, topic, bsPort, rts})
          })
        })
        tapenet.on('done', () => {
          try { peer.destroy() } catch (e) { }
        })
  
      })
    })

  }

  
})
