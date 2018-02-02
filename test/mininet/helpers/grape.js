module.exports = grape

function grape (bootstrap, cb) {
  const { Grape } = require('../../../')

  const grape = new Grape({
    dht_port: 20001,
    dht_bootstrap: bootstrap,
    api_port: 40001
  })

  grape.start(cb)
}
