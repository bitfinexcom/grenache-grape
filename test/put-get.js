/* eslint-env mocha */

'use strict'

const assert = require('assert')
const fetch = require('node-fetch')

const {
  createTwoGrapes
} = require('./helper.js')

async function jsonPost (url, data, cb) {
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    let res = await resp.text()
    try {
      res = JSON.parse(res)
    } catch (err) {
      // noop
    }

    if (!resp.ok) {
      const err = new Error(res)
      err.code = resp.status
      throw err
    }

    return cb(null, res)
  } catch (err) {
    console.log(err)
    return cb(err)
  }
}

function getValue (h, cb) {
  return jsonPost('http://127.0.0.1:40001/get', { rid: 'test', data: h }, cb)
}

describe('put-get-bep44', () => {
  it('works with hashes', (done) => {
    const { grape1, grape2, stop } = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('rest:util:net', 1337, () => { })
    })

    grape2.on('announce', () => {
      const data = {
        v: 'hello world'
      }

      jsonPost('http://127.0.0.1:40001/put', { rid: 'test', data }, (err, hash) => {
        if (err) throw err

        getValue(hash, (err, res) => {
          if (err) throw err

          assert.strictEqual(res.v, 'hello world')

          getValue({ hash }, (err, res) => {
            if (err) throw err

            assert.strictEqual(res.v, 'hello world')

            stop(done)
          })
        })
      })
    })
  }).timeout(5000)
})
