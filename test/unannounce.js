/* eslint-env mocha */

'use strict'

const { test } = require('tap')
const { when, once } = require('nonsynchronous')
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
        sample[1].lookup('B', (err, l) => {
          error(err)
          strictSame(l, ['127.0.0.1:2000'])
          sample[2].unannounce('B', 2000, (err) => {
            error(err)
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
})
