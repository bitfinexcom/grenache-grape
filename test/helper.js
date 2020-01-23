'use strict'
const { Grape } = require('./../')
const { when, once } = require('nonsynchronous')
const getPort = require('get-port')
const { teardown } = require('tap')
exports.createGrapes = createGrapes

async function createBootstrap (ephemeral = false) {
  const bsPort = await getPort()
  const bs = new Grape({
    dht_ephemeral: ephemeral,
    dht_port: bsPort,
    dht_bootstrap: false,
    api_port: await getPort(bsPort + 1),
    dht_peer_maxAge: 200
  })
  bs.start()
  await once(bs, 'ready')
  bs.dht_bootstrap = [`127.0.0.1:${bsPort}`]
  return bs
}

exports.createBootstrap = createBootstrap

async function createGrapes (n, onstart = () => {}) {
  const grapes = []
  const bootstrap = await createBootstrap()

  const ports = async (n, offset = 0) => {
    const result = new Array(n)
    result[0] = await getPort(offset)
    for (var i = 1; i < n; i++) {
      result[i] = await getPort(result[i - 1] + 1 + offset)
    }
    return result
  }

  const dhtPorts = await ports(n)
  const apiPorts = await ports(n, n + 1)
  for (const [i, port] of dhtPorts.entries()) {
    const grape = new Grape({
      dht_port: port,
      dht_bootstrap: bootstrap.dht_bootstrap,
      api_port: apiPorts[i],
      dht_peer_maxAge: 200
    })
    grape.start()
    await once(grape, 'ready')
    grapes.push(grape)
  }
  onstart(grapes, stop)
  grapes.stop = stop
  teardown(stop)
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

exports.createGrape = createGrape

async function createGrape () {
  const grapes = await createGrapes(1)
  const { stop } = grapes
  const [grape] = grapes
  return { grape, stop }
}
