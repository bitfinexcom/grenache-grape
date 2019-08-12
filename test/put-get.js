/* eslint-env mocha */

'use strict'

const assert = require('assert')
const request = require('request')
const once = require('events.once')
const { promisify } = require('util')

const {
  createTwoGrapes
} = require('./helper.js')

const post = promisify(request.post)

async function getValue (h) {
  const { body } = await post({
    uri: 'http://127.0.0.1:40001/get',
    json: true,
    body: { rid: 'test', data: h }
  })
  return body
}

describe('put-get', () => {
  it('works with hashes', async () => {
    const { grape1, grape2, stop } = createTwoGrapes()
    await once(grape1, 'ready')
    grape1.announce('rest:util:net', 1337, () => {})
    await once(grape2, 'announce')
    const data = {
      'v': 'hello world'
    }
    const { body: hash } = await post({
      uri: 'http://127.0.0.1:40001/put',
      json: true,
      body: { rid: 'test', data: data }    })

    const normative = await getValue(hash)
    assert.strictEqual(typeof normative.id, 'string')
    assert.strictEqual(normative.id.length, 64)
    assert.strictEqual(typeof normative.k, 'string')
    assert.strictEqual(normative.k.length, 64)
    assert.strictEqual(normative.v, 'hello world')
    assert.strictEqual(normative.m, false)
    assert.strictEqual(normative.seq, null)

    const explicit = await getValue({ hash, m: false })
    assert.strictEqual(typeof explicit.id, 'string')
    assert.strictEqual(explicit.id.length, 64)
    assert.strictEqual(typeof explicit.k, 'string')
    assert.strictEqual(explicit.k.length, 64)
    assert.strictEqual(explicit.v, 'hello world')
    assert.strictEqual(explicit.m, false)
    assert.strictEqual(explicit.seq, null)
    assert.strictEqual(explicit.sig, null)

    const legacy = await getValue({ hash })
    assert.strictEqual(typeof legacy.id, 'string')
    assert.strictEqual(legacy.id.length, 64)
    assert.strictEqual(typeof legacy.k, 'string')
    assert.strictEqual(legacy.k.length, 64)
    assert.strictEqual(legacy.v, 'hello world')
    assert.strictEqual(legacy.m, false)
    assert.strictEqual(legacy.seq, null)
    assert.strictEqual(legacy.sig, null)

    stop()
  }).timeout(5000)
})
