function bootstrap ({t, h, nodeCount, rts}) {
  t.run(h, `
    const dht = require('@hyperswarm/dht')
    const node = dht({
      boostrap: [],
    })
    const nodeCount = ${nodeCount}
    node.ready(() => {
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
    tapenet.once('rebootstrap', () => {
      node.bootstrap(() => {
        tapenet.emit('peer-rebootstrapped')
      })
    })

  `)
}

module.exports = bootstrap