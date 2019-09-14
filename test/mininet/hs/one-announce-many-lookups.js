const tapenet = require('tapenet')
const bootstrap = require('./helpers/bootstrap')
const { 
  NODES = 1002,
  RTS = 1
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
      peer.ready(() => {
        const { port } = peer.address()
        h1.emit('bootstrap', {bootstrap, topic, bsPort, h1Port: port, rts})
        var started = 0
        const lookupNodeCount = nodeCount - 2
        var doneCount = 0
        var readyCount = 0
        var rebootstrapCount = 0
        tapenet.on('peer-ready', () => {
          readyCount++
          if (readyCount === lookupNodeCount) {
            tapenet.emit('rebootstrap')
            peer.bootstrap(() => {
              tapenet.emit('peer-rebootstrapped')
            })
          }
        })
        tapenet.on('peer-rebootstrapped', () => {
          if (rebootstrapCount === nodeCount) {
            started = Date.now()
            tapenet.emit('ready')
          } else { 
            rebootstrapCount++
          }      
        })
        tapenet.on('host-done', () => {
          doneCount++
          if (doneCount === lookupNodeCount) {
            t.pass(`scenario took ${Date.now() - started} ms`)
            tapenet.emit('done')
            peer.destroy()
            t.end()
          }
        })
        peer.announce(topic, (err) => {
          t.error(err, 'no announce error')
          h1.emit('ready')
        })
      })

    })
  })

  for (const id in topology) {
    if (id[0] !== 'h') continue
    if (id === 'h1' || id === 'h2') continue
    const host = topology[id]
    t.run(host, function () {
      const announcer = h1
      announcer.on('bootstrap', ({bootstrap, topic, bsPort, h1Port, rts}) => {
        const dht = require('@hyperswarm/dht')
        const peer = dht({ bootstrap, ephemeral: false })
        tapenet.on('done', () => {
          peer.destroy()
        })
        peer.ready(() => tapenet.emit('peer-ready'))
        announcer.on('ready', () => {
          tapenet.once('rebootstrap', () => {
            peer.bootstrap(() => {
              tapenet.emit('peer-rebootstrapped')
            })
          })
          tapenet.on('ready', () => {
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
    })
  }

  
})

