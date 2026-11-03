'use strict'

const test = require('brittle')
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

test('dos vector', async (t) => {
  await t.test('rejects too large payloads', { timeout: 10000 }, async (t) => {
    const { grape1, grape2, stop } = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('rest:util:net', 1337, () => { })
    })

    await new Promise(resolve => {
      grape2.on('announce', () => {
        const req = streamRequest('http://127.0.0.1:40001')
        let done = false
        const finish = () => {
          if (done) return
          done = true
          stop(resolve)
        }
        req.on('error', finish) // caught by node < 18
        req.on('close', finish) // caught by node >= 18

        const writer = new PassThrough()
        writer
          .pipe(req)

        for (let i = 0; i < 999999; i++) {
          writer.push('"pl":"blerg;blerg;blerg;blerg;blerg;blerg;blerg;blerg;blerg;')
        }
      })
    })
    t.pass()
  })

  await t.test('does not crash on invalid payloads', { timeout: 5000 }, async (t) => {
    const { grape1, grape2, stop } = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('rest:util:net', 1337, () => { })
    })

    await new Promise(resolve => {
      grape2.on('announce', () => {
        const req = streamRequest('http://127.0.0.1:40001')
        req.on('data', (data) => {
          t.is(data.toString(), 'ERR_GRAPE_PAYLOAD_INVALID')
          stop(resolve)
        })
        const writer = new PassThrough()
        writer.pipe(req)

        writer.push('garbage')
        writer.end('')
      })
    })
  })
})
