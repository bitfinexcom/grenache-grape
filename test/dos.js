/* eslint-env mocha */

'use strict'

const assert = require('assert')
const { PassThrough } = require('stream')

const {
  createTwoGrapes
} = require('./helper.js')

const request = require('request')

describe('dos vector', () => {
  it('rejects too large payloads', (done) => {
    const {grape1, grape2, stop} = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('rest:util:net', 1337, () => {})
    })

    grape2.on('announce', () => {
      const req = request({
        uri: 'http://127.0.0.1:40001',
        method: 'POST'
      }).on('error', () => {
        stop(done)
      })

      const writer = new PassThrough()
      writer
        .pipe(req)

      for (let i = 0; i < 999999; i++) {
        writer.push('"pl":"blerg;blerg;blerg;blerg;blerg;blerg;blerg;blerg;blerg;')
      }
    })
  }).timeout(10000)

  it('does not crash on invalid payloads', (done) => {
    const {grape1, grape2, stop} = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('rest:util:net', 1337, () => {})
    })

    grape2.on('announce', () => {
      const req = request({
        uri: 'http://127.0.0.1:40001',
        method: 'POST'
      }).on('data', (data) => {
        assert.equal(data.toString(), 'ERR_GRAPE_PAYLOAD_INVALID')
        stop(done)
      })
      const writer = new PassThrough()
      writer.pipe(req)

      writer.push('garbage')
      writer.end('')
    })
  }).timeout(5000)
})
