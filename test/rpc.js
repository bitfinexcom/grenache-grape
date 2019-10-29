'use strict'
const { test } = require('tap')
const { once } = require('nonsynchronous')
const supertest = require('supertest')
const {
  createTwoGrapes
} = require('./helper.js')

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

  // test('does not crash on invalid payloads', { timeout: 5000 }, async ({ is }) => {
  //   const { grape1, grape2, stop } = await createTwoGrapes()

  //   grape1.announce('rest:util:net', 1337, () => {})
  //   await once(grape2, 'announce')
  //   const port = grape2.conf.api_port
  //   const { post } = supertest(`http://127.0.0.1:${port}`)
  //   await post('/').send('garbage').expect(
  //     500,
  //     '"ERR_GRAPE_PAYLOAD_INVALID"'
  //   )

  //   await stop()
  // })

  // test('does not crash on invalid request route', { timeout: 5000 }, async ({ is }) => {
  //   const { grape1, grape2, stop } = await createTwoGrapes()

  //   grape1.announce('rest:util:net', 1337, () => {})
  //   await once(grape2, 'announce')
  //   const port = grape2.conf.api_port
  //   const { post } = supertest(`http://127.0.0.1:${port}`)
  //   await post('/garbage').send({}).expect(
  //     500,
  //     '"ERR_REQ_NOTFOUND"'
  //   )

  //   await stop()
  // })
})
