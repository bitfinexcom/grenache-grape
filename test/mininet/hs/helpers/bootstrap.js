function bootstrap ({t, h, nodeCount, rts}) {
  t.run(h, `
    const dht = require('@hyperswarm/dht')
    const node = dht({
      boostrap: [],
    })
    const nodeCount = ${nodeCount}
    node.once('listening', () => {
      const { port } = node.address()
      tapenet.emit('bootstrap', {
        nodeCount,
        rts: ${rts},
        bsPort: port,
        bootstrap: [ip + ':' + port]
      })
    })
    node.once('error', (err) => {
      throw err
    })
    tapenet.on('done', () => {
      node.destroy()
    })
    var total = 1 // 1 for bootstrap
    node.on('add-node', () => {
      total += 1
      if (total === nodeCount) {
        tapenet.emit('dht-ready')
      }
    })
  `)
}

module.exports = bootstrap