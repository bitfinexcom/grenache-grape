function bootstrap ({t, h, nodeCount, rts}) {
  t.run(h, `
    const DHT = require('bittorrent-dht')
    const { verify } = require('crypto')
    const node = new DHT({
      verify,
      boostrap: false,
    })
    const nodeCount = ${nodeCount}
    node.once('ready', () => {
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
    // tapenet.once('rebootstrap', () => {
    //   node.bootstrap(() => {
    //     tapenet.emit('peer-rebootstrapped')
    //   })
    // })

  `)
}

module.exports = bootstrap