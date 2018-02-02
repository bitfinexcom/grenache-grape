module.exports = createGrape

function createGrape (bootstrap, opts = {}, cb) {
  if (typeof opts === 'function') return createGrape(bootstrap, undefined, opts)
  const { Grape } = require('../../../')

  const grape = new Grape({
    dht_port: 20001,
    dht_bootstrap: bootstrap,
    api_port: 40001
  })

  if (opts.ready) {
    grape.on('ready', cb)
    grape.start(() => {})
  } else {
    grape.start(cb)
  }
}
