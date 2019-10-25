/* eslint-env mocha */

'use strict'
const { test } = require('tap')
const getPort = require('get-port')
const { promisifyOf } = require('nonsynchronous')
const { Grape } = require('./../')
const stop = promisifyOf('stop')
const start = promisifyOf('start')

test('Grape integration', async () => {
  test('should emit a ready event', { timeout: 5000 }, async ({ pass }) => {
    const g1Port = await getPort()
    const g2Port = await getPort()
    const grape1 = new Grape({
      dht_port: g1Port,
      dht_bootstrap: [`127.0.0.1:${g2Port}`],
      api_port: await getPort()
    })

    await start(grape1)()

    const grape2 = new Grape({
      dht_port: g2Port,
      dht_bootstrap: [`127.0.0.1:${g1Port}`],
      api_port: await getPort()
    })

    await start(grape2)()

    await stop(grape1)()
    await stop(grape2)()
    pass('grape ready')
  })
})
