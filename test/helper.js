'use strict'

const { Grape } = require('./../')
const portbase = 20000
const knownPort = portbase + 1
const knownHost = '127.0.0.1'
var count = 0
var grapes = []

exports.addGrape = (onstart, done, initSize = 2) => {
  if (count === 0) return init(onstart, done, initSize)
  add1more(onstart, done)
}
function init (onstart, done, size) {
  if (size) return add1more(init, done, onstart, size)
  add1more(onstart, done)
}
function add1more (cb, done, onstart, size = 0) {
  var grape

  count++
  grape = new Grape({
    host: knownHost,
    dht_port: portbase + count,
    dht_bootstrap: count === 1 ? [] : [ knownHost + ':' + knownPort ],
    api_port: portbase + 10000 + count
  })
  grapes.push(grape)
  grape.start(size ? () => cb(onstart, done, --size) : () => cb(grapes, grape, stop, done))
}
function stop (done) {
  var grape = grapes.pop()

  grape.stop(grapes.length ? () => stop(done) : done)
}

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
