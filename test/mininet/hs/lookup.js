const tapenet = require('tapenet')
const nodes = 1002
const topology = tapenet.topologies.basic(nodes)
const { h1: announcer, h2: bootstrapper } = topology 

function bootstrap ({t, h, nodeCount}) {
  t.run(h, `
    const dht = require('@hyperswarm/dht')
    const node = dht({
      boostrap: [],
    })
    node.once('listening', () => {
      const { port } = node.address()
      tapenet.emit('bootstrap', {
        nodeCount: ${nodeCount},
        port,
        bootstrap: [ip + ':' + port]
      })
    })
    node.once('error', (err) => {
      throw err
    })
    tapenet.on('done', () => {
      node.destroy()
    })
  `)
}

tapenet(`1 bootstrap, 1 announcing, ${nodes-2} lookup peers, 1000 lookups per peer`, (t) => {
  bootstrap({t, h: bootstrapper, nodeCount: nodes})

  t.run(announcer, function () {
    
    tapenet.on('bootstrap', ({bootstrap, port, nodeCount}) => {
      const crypto = require('crypto')
      const dht = require('@hyperswarm/dht')
      const topic = crypto.randomBytes(32)
      const peer = dht({ bootstrap })
      var started = Date.now()
      peer.on('listening', () => {
        peer.announce(topic, { port }, (err) => {
          t.error(err, 'no announce error')
          h1.emit('ready', {bootstrap, topic, port})
        })
      })
      const lookupNodeCount = nodeCount - 2
      var count = 0
      tapenet.on('host-done', () => {
        count++
        if (count === lookupNodeCount) {
          t.pass(`scenario took ${Date.now() - started} ms`)
          tapenet.emit('done')
          setImmediate(() => {
            peer.destroy()
          })
        }
      })

    })
  })

  for (const id in topology) {
    if (id[0] !== 'h') continue
    if (id === 'h1' || id === 'h2') continue
    const host = topology[id]
    t.run(host, function () {
      h1.on('ready', ({bootstrap, topic, port}) => {
        const dht = require('@hyperswarm/dht')
        const peer = dht({ bootstrap, ephemeral: true })
        tapenet.on('done', () => {
          peer.destroy()
        })
        peer.on('listening', () => {
          const started = Date.now()
          const expected = []
          const actual = []
          const rts = 1000
          lookups(rts)
  
          function lookups (n) {
            if (n === 0) {
              t.same(actual, expected, 'correct data returned in correct order')
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
              const { node } = result[0]
              t.is(node.port, port)
              lookups(n - 1)
            })
          }
        })
      })
    })
  }

  
})
