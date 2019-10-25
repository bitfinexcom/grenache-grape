'use strict'
const { Grape } = require('./../')
const { when, once } = require('nonsynchronous')
const getPort = require('get-port')
exports.createGrapes = createGrapes

async function createGrapes (n, onstart = () => {}) {
  const grapes = []
  const bsPort = await getPort()
  const bootstrap = new Grape({
    dht_port: bsPort,
    dht_bootstrap: false,
    api_port: await getPort(),
    dht_peer_maxAge: 200
  })
  bootstrap.start()
  await once(bootstrap, 'ready')
  const dhtPorts = await Promise.all([...Array(n)].map(() => getPort()))
  const apiPorts = await Promise.all([...Array(n)].map(() => getPort()))
  for (const [i, port] of dhtPorts.entries()) {
    const grape = new Grape({
      dht_port: port,
      dht_bootstrap: [`127.0.0.1:${bsPort}`],
      api_port: apiPorts[i],
      dht_peer_maxAge: 200
    })
    grape.start()
    await once(grape, 'ready')
    grapes.push(grape)
  }
  onstart(grapes, stop)
  grapes.stop = stop
  return grapes

  function stop (done = () => {}) {
    const until = when()
    bootstrap.stop(loop)
    function loop () {
      if (!grapes.length) {
        until()
        done()
        return
      }
      grapes.pop().stop(loop)
    }
    return until.done()
  }
}

exports.createTwoGrapes = createTwoGrapes

async function createTwoGrapes () {
  const grapes = await createGrapes(2)
  const { stop } = grapes
  const [grape1, grape2] = grapes
  return { grape1, grape2, stop }
}
