'use strict'

function bootstrap ({ t, hosts, state = {}, size }) {
  const [h] = hosts // currently only supporting one bootstrap host
  t.run(h, `
    const dht = require('@hyperswarm/dht')
    const node = dht({ boostrap: [], ephemeral: true})
    node.ready(() => {
      const { port } = node.address()
      tapenet.emit('bootstrap', {
        ...${JSON.stringify(state)},
        bootstrap: [ip + ':' + port]
      }, ${size})
    })
    node.once('error', (err) => {
      throw err
    })
    tapenet.once('done', () => {
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
