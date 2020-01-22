/* eslint-env mocha */

'use strict'

const { test } = require('tap')
const { when, once } = require('nonsynchronous')
const { sampleSize } = require('lodash')
const supertest = require('supertest')
const {
  createGrape,
  createGrapes,
  createTwoGrapes
} = require('./helper.js')

const port = (grape) => grape.conf.api_port
const request = (grape) => supertest(`http://127.0.0.1:${port(grape)}`)

test('service unannounce', async () => {
  test('should remove unannounced services', { timeout: 5000 }, async ({ error, strictSame }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    grape1.announce('rest:util:net', 1337, () => {})

    await once(grape2, 'announce')

    const until = when()

    grape2.lookup('rest:util:net', (err, res) => {
      error(err)
      strictSame(res, ['127.0.0.1:1337'])
      grape1.unannounce('rest:util:net', 1337, nextLookup)
    })

    function nextLookup (err) {
      error(err)
      grape2.lookup('rest:util:net', (err, res) => {
        error(err)
        strictSame(res, [])
        until()
      })
    }

    await until.done()
    await stop()
  })

  test('should remove unannounced services (lots of grapes)', { timeout: 20000 }, async ({ error, strictSame }) => {
    const until = when()
    await createGrapes(100, (grapes, stop) => {
      const sample = sampleSize(grapes, 3)
      sample[0].announce('B', 2000, (err) => {
        error(err)
        setTimeout(() => {
          sample[1].lookup('B', (err, l) => {
            error(err)
            strictSame(l, ['127.0.0.1:2000'])
            setTimeout(() => {
              sample[2].unannounce('B', 2000, (err) => {
                error(err)
                setTimeout(() => {
                  sample[1].lookup('B', (err, l) => {
                    error(err)
                    strictSame(l, [])
                    stop(until)
                  })
                }, 100)
              })
            }, 100)
          })
        }, 100)
      })
    })
    await until.done()
  })

  test('unannounce own port', { timeout: 5000 }, async ({ error, strictSame }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    const until = when()

    grape1.announce('rest:util:net', (err) => {
      error(err)
      grape2.lookup('rest:util:net', (err, res) => {
        error(err)
        strictSame(res, [`127.0.0.1:${grape1.conf.dht_port}`])
        grape1.unannounce('rest:util:net', (err) => {
          error(err)
          grape2.lookup('rest:util:net', (err, res) => {
            error(err)
            strictSame(res, [])
            until()
          })
        })
      })
    })

    await until.done()
    await stop()
  })

  test('unannounce own port – fire and forget', { timeout: 5000 }, async ({ error, strictSame }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    const until = when()

    grape1.announce('rest:util:net')
    await once(grape2, 'announce')

    grape2.lookup('rest:util:net', async (err, res) => {
      error(err)
      strictSame(res, [`127.0.0.1:${grape1.conf.dht_port}`])
      grape1.unannounce('rest:util:net')
      await once(grape2, 'unannounce')
      grape2.lookup('rest:util:net', (err, res) => {
        error(err)
        strictSame(res, [])
        until()
      })
    })

    await until.done()
    await stop()
  })

  test('invalid port', async ({ is }) => {
    const { grape1, stop } = await createTwoGrapes()
    const until = when()
    grape1.unannounce('rest:util:net', '1337', (err) => {
      is(!!err, true)
      is(err.message, 'ERR_GRAPE_SERVICE_PORT')
      until()
    })

    await until.done()
    await stop()
  })

  test('rpc: should remove unannounced services', { timeout: 5000 }, async () => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    await request(grape1).post('/announce').send({
      data: ['rest:util:net', 1337]
    }).expect(200)

    await request(grape2).post('/lookup').send({
      data: 'rest:util:net'
    }).expect(200, ['127.0.0.1:1337'])

    await request(grape1).post('/unannounce').send({
      data: ['rest:util:net', 1337]
    }).expect(200)

    await request(grape2).post('/lookup').send({
      data: 'rest:util:net'
    }).expect(200, [])

    await stop()
  })

  test('rpc: unannounce invalid port', async () => {
    const { grape, stop } = await createGrape()
    const { post } = request(grape)
    await post('/unannounce').send({ data: ['rest:util:net', '1337'] }).expect(400, '"ERR_GRAPE_SERVICE_PORT"')
    await stop()
  })

  test('rpc: unannounce invalid data', async () => {
    const { grape, stop } = await createGrape()
    const { post } = request(grape)
    await post('/unannounce').send({ data: '"invalid"' }).expect(400, '"ERR_GRAPE_UNANNOUNCE"')
    await stop()
  })
})
