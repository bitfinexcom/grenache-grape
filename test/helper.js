'use strict'
const { Grape } = require('./../')

exports.createGrapes = createGrapes
function createGrapes (n, onstart) {
  const grapes = []
  let missing = n

  const bootstrap = new Grape({
    dht_port: 20000,
    dht_bootstrap: false,
    api_port: 40000,
    dht_peer_maxAge: 200
  })
  bootstrap.start()

  for (let i = 0; i < n; i++) {
    const grape = new Grape({
      dht_port: 20001 + i,
      dht_bootstrap: ['127.0.0.1:20000'],
      api_port: 40001 + i,
      dht_peer_maxAge: 200
    })
    grape.start(() => {
      if (--missing) return
      if (onstart) onstart(grapes, stop)
    })
    grapes.push(grape)
  }
  grapes.stop = stop
  return grapes

  function stop (done = () => {}) {
    bootstrap.stop(loop)
    function loop () {
      if (!grapes.length) return done()
      grapes.pop().stop(loop)
    }
  }
}

exports.createTwoGrapes = createTwoGrapes
function createTwoGrapes () {
  const grapes = createGrapes(2)
  const { stop } = grapes
  const [grape1, grape2] = grapes
  return { grape1, grape2, stop }
}
