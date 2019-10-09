'use strict'

function bootstrap ({ t, hosts, state = {}, size }) {
  const [ h ] = hosts // currently only supporting one bootstrap host
  t.run(h, `
    const { Grape } = require('../..')
    const node = new Grape({ 
      dht_bootstrap: [],
      dht_ephemeral: true,
      api_port: 40001
    })
    node.start()
    node.on('ready', () => {
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
      node.stop()
    })
    tapenet.once('rebootstrap', () => {
      node.dht.bootstrap(() => {
        tapenet.emit('peer-rebootstrapped')
      })
    })

  `)
}

module.exports = bootstrap
