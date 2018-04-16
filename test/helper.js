'use strict'

const { Grape } = require('./../')

exports.createGrapes = createGrapes
function createGrapes (n, onstart) {
  const grapes = []
  let missing = n

  for (let i = 0; i < n; i++) {
    const grape = new Grape({
      dht_port: 20001 + i,
      dht_bootstrap: [ '127.0.0.1:' + (20001 + (i + 1) % 2) ],
      api_port: 40001 + i,
      dht_peer_maxAge: 200
    })

    grape.start(() => {
      if (--missing) return
      if (onstart) onstart(grapes, stop)
    })
    grapes.push(grape)
  }

  return grapes

  function stop (done) {
    loop()

    function loop () {
      if (!grapes.length) return done()
      grapes.pop().stop(loop)
    }
  }
}

exports.createTwoGrapes = createTwoGrapes
function createTwoGrapes () {
  const [grape1, grape2] = createGrapes(2)
  return {grape1, grape2, stop}

  function stop (done) {
    grape1.stop(_ => {
      grape2.stop(_ => {
        done()
      })
    })
  }
}
