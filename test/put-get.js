/* eslint-env mocha */

'use strict'

const assert = require('assert')
const request = require('request')
const once = require('events.once')
const { promisify } = require('util')
const hypersign = require('@hyperswarm/hypersign')()
const {
  createTwoGrapes
} = require('./helper.js')

const post = promisify(request.post)

async function getValue (h) {
  const res = await post({
    uri: 'http://127.0.0.1:40001/get',
    json: true,
    body: { rid: 'test', data: h }
  })
  if (/2.?.?/.test(res.statusCode) === false) {
    throw Error(`${res.statusCode}: ${res.body}`)
  }
  return res.body
}

describe('put-get', () => {
  it('stores and retrieves immutable data', async () => {
    const { grape1, grape2, stop } = createTwoGrapes()
    await once(grape1, 'ready')
    grape1.announce('rest:util:net', 1337, () => {})
    await once(grape2, 'announce')
    const data = {
      v: 'hello world'
    }
    const { body: hash } = await post({
      uri: 'http://127.0.0.1:40001/put',
      json: true,
      body: { rid: 'test', data: data }
    })

    const normative = await getValue(hash)
    assert.strictEqual(typeof normative.id, 'string')
    assert.strictEqual(normative.id.length, 64)
    assert.strictEqual(typeof normative.k, 'string')
    assert.strictEqual(normative.k.length, 64)
    assert.strictEqual(normative.v, 'hello world')
    assert.strictEqual(normative.m, false)
    assert.strictEqual(normative.seq, null)
    assert.strictEqual(normative.sig, null)

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

  it('stores and retrieves mutable data', async () => {
    const { grape1, grape2, stop } = createTwoGrapes()
    await once(grape1, 'ready')
    grape1.announce('rest:util:net', 1337, () => {})
    await once(grape2, 'announce')
    const keypair = hypersign.keypair()
    const { publicKey: key } = keypair
    const value = 'hello world'
    const sig = hypersign.sign(Buffer.from(value), { keypair })

    const data = {
      v: value,
      k: key,
      sig
    }

    const { body: hexKey } = await post({
      uri: 'http://127.0.0.1:40001/put',
      json: true,
      body: { rid: 'test', data: data }
    })

    assert.strictEqual(hexKey, key.toString('hex'))

    const normative = await getValue({ key: hexKey })
    assert.strictEqual(typeof normative.id, 'string')
    assert.strictEqual(normative.id.length, 64)
    assert.strictEqual(normative.k, hexKey)
    assert.strictEqual(normative.v, 'hello world')
    assert.strictEqual(normative.m, true)
    assert.strictEqual(normative.seq, 0)
    assert.strictEqual(normative.sig, sig.toString('hex'))
    assert.strictEqual(normative.salt, null)

    const explicit = await getValue({ hash: hexKey, m: true })
    assert.strictEqual(typeof explicit.id, 'string')
    assert.strictEqual(explicit.id.length, 64)
    assert.strictEqual(explicit.k, hexKey)
    assert.strictEqual(explicit.v, 'hello world')
    assert.strictEqual(explicit.m, true)
    assert.strictEqual(explicit.seq, 0)
    assert.strictEqual(explicit.sig, sig.toString('hex'))
    assert.strictEqual(explicit.salt, null)

    const legacy = await getValue({ hash: hexKey })
    assert.strictEqual(typeof legacy.id, 'string')
    assert.strictEqual(legacy.id.length, 64)
    assert.strictEqual(typeof legacy.k, 'string')
    assert.strictEqual(legacy.k.length, 64)
    assert.strictEqual(legacy.v, 'hello world')
    assert.strictEqual(legacy.m, true)
    assert.strictEqual(legacy.seq, 0)
    assert.strictEqual(legacy.sig, sig.toString('hex'))
    assert.strictEqual(legacy.salt, null)

    stop()
  }).timeout(5000)
})
