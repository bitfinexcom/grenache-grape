/* eslint-env mocha */

'use strict'

const { test } = require('tap')
const { when, once, timeout } = require('nonsynchronous')
const { sampleSize } = require('lodash')
const {
  createGrapes,
  createTwoGrapes
} = require('./helper.js')

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
      const sample = sampleSize(grapes, 4)
      sample[0].announce('B', 2000, (err) => {
        error(err)
        timeout(100)
        sample[1].lookup('B', (err, l) => {
          error(err)
          strictSame(l, ['127.0.0.1:2000'])
          timeout(100)
          sample[2].unannounce('B', 2000, (err) => {
            error(err)
            timeout(100)
            sample[3].lookup('B', (err, l) => {
              error(err)
              strictSame(l, [])
              stop(until)
            })
          })
        })
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
})
