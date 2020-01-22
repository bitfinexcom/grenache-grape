'use strict'
const { test } = require('tap')
const { once } = require('nonsynchronous')
const http = require('http')
const supertest = require('supertest')
const {
  createGrape,
  createTwoGrapes
} = require('./helper.js')
const { Grape } = require('..')

test('rpc', async () => {
  test('rejects oversized payloads', { timeout: 10000 }, async () => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    grape1.announce('rest:util:net', 1337, () => {})
    await once(grape2, 'announce')
    const port = grape2.conf.api_port
    const { post } = supertest(`http://127.0.0.1:${port}`)
    await post('/').send(Buffer.alloc(8193)).expect(
      413,
      '"ERR_GRAPE_PAYLOAD_SIZE"'
    )

    await stop()
  })

  test('does not crash on invalid payloads', { timeout: 5000 }, async () => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    grape1.announce('rest:util:net', 1337, () => {})
    await once(grape2, 'announce')
    const port = grape2.conf.api_port
    const { post } = supertest(`http://127.0.0.1:${port}`)
    await post('/').send('garbage').expect(
      400,
      '"ERR_GRAPE_PAYLOAD_INVALID"'
    )

    await stop()
  })

  test('does not crash on invalid request route', { timeout: 5000 }, async () => {
    const { grape, stop } = await createGrape()

    const data = {
      v: 'hello world'
    }
    const port = grape.conf.api_port
    const { post } = supertest(`http://127.0.0.1:${port}`)
    await post('/garbage').send({ data }).expect(
      404,
      '"ERR_REQ_NOTFOUND"'
    )

    await stop()
  })

  test('handles request aborting', { timeout: 5000 }, async () => {
    // reliably simulate aborted request
    const { createServer } = http
    http.createServer = (fn) => {
      return createServer((req, res) => {
        process.nextTick(() => req.emit('aborted'))
        http.createServer = createServer
        return fn(req, res)
      })
    }

    const { grape, stop } = await createGrape()

    const data = {
      v: 'hello world'
    }
    const port = grape.conf.api_port
    const { post } = await supertest(`http://127.0.0.1:${port}`)
    await post('/put')
      .send({ rid: 'test', data: data })
      .expect(400, '"ERR_GRAPE_GENERIC: request aborted"')

    await stop()
  })

  test('handles empty JSON request', { timeout: 5000 }, async () => {
    const { grape, stop } = await createGrape()

    const port = grape.conf.api_port
    const { post } = await supertest(`http://127.0.0.1:${port}`)
    await post('/put')
      .send({})
      .expect(400, '"ERR_GRAPE_DATA_KEY_REQUIRED"')

    await stop()
  })

  test('wraps any potential generic errors during request', { timeout: 5000 }, async () => {
    const { onRequest } = Grape.prototype
    Grape.prototype.onRequest = (type, data, cb) => {
      cb(Error('test'))
      Grape.prototype.onRequest = onRequest
    }
    const { grape, stop } = await createGrape()
    const data = {
      v: 'hello world'
    }
    const port = grape.conf.api_port
    const { post } = await supertest(`http://127.0.0.1:${port}`)
    await post('/put')
      .send({ rid: 'test', data: data })
      .expect(500, '"ERR_GRAPE_GENERIC: test"')

    await stop()
  })
})
