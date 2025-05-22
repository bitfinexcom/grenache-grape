/* eslint-env mocha */

'use strict'

const assert = require('assert')
const duplexify = require('duplexify')
const http = require('http')
const pump = require('pump')
const { PassThrough } = require('stream')

const {
  createTwoGrapes
} = require('./helper.js')

function streamRequest (uri) {
  const reqStream = new PassThrough()
  const resStream = new PassThrough()

  const reqUrl = new URL(uri)
  const httpReq = http.request({
    hostname: reqUrl.hostname,
    port: reqUrl.port,
    protocol: reqUrl.protocol,
    path: reqUrl.pathname,
    method: 'POST'
  }, (res) => {
    pump(res, resStream)
  })

  httpReq.on('error', (err) => {
    reqStream.destroy(err)
    resStream.destroy(err)
  })
  pump(reqStream, httpReq)
  return duplexify(reqStream, resStream)
}

describe('dos vector', () => {
  it('rejects too large payloads', (done) => {
    const { grape1, grape2, stop } = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('rest:util:net', 1337, () => { })
    })

    grape2.on('announce', () => {
      const req = streamRequest('http://127.0.0.1:40001')
      req.on('error', () => {
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
    const { grape1, grape2, stop } = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('rest:util:net', 1337, () => { })
    })

    grape2.on('announce', () => {
      const req = streamRequest('http://127.0.0.1:40001')
      req.on('data', (data) => {
        assert.strictEqual(data.toString(), 'ERR_GRAPE_PAYLOAD_INVALID')
        stop(done)
      })
      const writer = new PassThrough()
      writer.pipe(req)

      writer.push('garbage')
      writer.end('')
    })
  }).timeout(5000)
})
