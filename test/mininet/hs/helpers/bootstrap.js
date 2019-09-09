function bootstrap ({t, h, nodeCount, rts}) {
  t.run(h, `
    const dht = require('@hyperswarm/dht')
    const node = dht({
      boostrap: [],
    })
    node.once('listening', () => {
      const { port } = node.address()
      tapenet.emit('bootstrap', {
        nodeCount: ${nodeCount},
        rts: ${rts},
        bsPort: port,
        bootstrap: [ip + ':' + port]
      })
    })
    node.once('error', (err) => {
      throw err
    })
    tapenet.on('done', () => {
      try { peer.destroy() } catch (e) { }
    })
  `)
}

module.exports = bootstrap