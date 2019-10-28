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

  test('requires an api port', async ({ ok }) => {
    const grape = new Grape({
      dht_port: await getPort()
    })
    const until = when()
    grape.start((err) => {
      ok(err)
      grape.stop(until)
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
