/* eslint-env mocha */

'use strict'

const assert = require('assert')
const request = require('request')

const {
  createTwoGrapes
} = require('./helper.js')

function getValue (h, cb) {
  request.post({
    uri: 'http://127.0.0.1:40001/get',
    json: true,
    body: { rid: 'test', data: h }
  }, (err, res, body) => {
    if (err) return cb(err)

    cb(null, body)
  })
}

describe('put-get-bep44', () => {
  it('works with hashes', (done) => {
    const {grape1, grape2, stop} = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('rest:util:net', 1337, () => {})
    })

    grape2.on('announce', () => {
      const data = {
        'v': 'hello world'
      }

      request.post({
        uri: 'http://127.0.0.1:40001/put',
        json: true,
        body: { rid: 'test', data: data }
      }, (err, res, hash) => {
        if (err) throw err

        getValue(hash, (err, res) => {
          if (err) throw err

          assert.strictEqual(res.v, 'hello world')

          getValue({ hash: hash }, (err, res) => {
            if (err) throw err

            assert.strictEqual(res.v, 'hello world')

            stop(done)
          })
        })
      })
    })
  }).timeout(5000)
})
