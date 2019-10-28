'use strict'
const Events = require('events')
const { promisifyOf, when } = require('nonsynchronous')
const { test } = require('tap')
const getPort = require('get-port')
const Grape = require('./../lib/Grape')
const stop = promisifyOf('stop')
const start = promisifyOf('start')

test('Grape', async () => {
  test('should be an instance of Events', async ({ ok }) => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })

    ok(grape instanceof Events)
    await stop(grape)()
  })

  test('start may be called multiple times', async ({ doesNotThrow, error }) => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    await start(grape)()
    doesNotThrow(() => {
      grape.start((err) => {
        error(err)
      })
    })
    await stop(grape)()
  })

  test('should accept callback on starting a grape', async ({ error }) => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    const until = when()
    grape.start((err) => {
      error(err)

      grape.stop((err) => {
        error(err)
        until()
      })
    })
    await until.done()
  })

  test('calling stop on an unstarted Grape will not throw', async () => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    await stop(grape)()
  })

  test('stop event', async ({ pass }) => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    const until = when()
    await start(grape)()
    grape.once('close', () => {
      pass('close event fired')
      until()
    })
    grape.stop()
    await until.done()
  })

  test('requires an api port', async ({ ok, is }) => {
    const grape = new Grape({
      dht_port: await getPort()
    })
    const until = when()
    grape.start((err) => {
      ok(err)
      is(err.message, 'ERR_NO_PORT')
      grape.stop(until)
    })
    await until.done()
  })

  test('dht port collision', async ({ ok, is }) => {
    const grape1 = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    const grape2 = new Grape({
      dht_port: grape1.conf.dht_port,
      api_port: await getPort()
    })
    const until = when()
    await start(grape1)()
    grape2.start((err) => {
      ok(err)
      const { code } = err
      is(code, 'EADDRINUSE')
      grape1.stop(() => {
        grape2.stop(() => {
          until()
        })
      })
    })
    await until.done()
  })

  test('keeps running on invalid put payload', async ({ ok }) => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    await start(grape)()
    const until = when()
    grape.put({ foo: 'bar' }, (err) => {
      ok(err)
      until()
    })
    await until.done()
    await stop(grape)()
  })

  test('address', async ({ throws, is }) => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    throws(() => { grape.address() })
    await start(grape)()
    const { port } = grape.address()
    is(port, grape.conf.dht_port)
    await stop(grape)()
  })
})
