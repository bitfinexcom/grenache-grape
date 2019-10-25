/* eslint-env mocha */

'use strict'

const { test } = require('tap')
const { PassThrough } = require('stream')
const { once, when } = require('nonsynchronous')
const {
  createTwoGrapes
} = require('./helper.js')

const request = require('request')

test('dos vector', async () => {
  test('rejects too large payloads', { timeout: 10000 }, async () => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    grape1.announce('rest:util:net', 1337, () => {})
    await once(grape2, 'announce')
    const until = when()
    const port = grape2.conf.api_port
    const req = request({
      uri: `http://127.0.0.1:${port}`,
      method: 'POST'
    }).on('error', () => {
      until()
    })

    const writer = new PassThrough()
    writer.pipe(req)

    for (let i = 0; i < 999999; i++) {
      writer.push('"pl":"blerg;blerg;blerg;blerg;blerg;blerg;blerg;blerg;blerg;')
    }

    await until.done()
    await stop()
  })

  test('does not crash on invalid payloads', { timeout: 5000 }, async ({ is }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    grape1.announce('rest:util:net', 1337, () => {})
    await once(grape2, 'announce')
    const until = when()
    const port = grape2.conf.api_port
    const req = request({
      uri: `http://127.0.0.1:${port}`,
      method: 'POST'
    }).on('data', (data) => {
      is(data.toString(), 'ERR_GRAPE_PAYLOAD_INVALID')
      until()
    })
    const writer = new PassThrough()
    writer.pipe(req)
    writer.push('garbage')
    writer.end('')
    await until.done()
    await stop()
  })
})
