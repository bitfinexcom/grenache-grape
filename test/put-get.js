/* eslint-env mocha */

'use strict'

const { test } = require('tap')
const request = require('request')
const once = require('events.once')
const { promisify } = require('util')
const hypersign = require('@hyperswarm/hypersign')()
const {
  createTwoGrapes
} = require('./helper.js')

const post = promisify(request.post)

async function getValue (h, port) {
  const res = await post({
    uri: `http://127.0.0.1:${port}/get`,
    json: true,
    body: { rid: 'test', data: h }
  })
  if (/2.?.?/.test(res.statusCode) === false) {
    throw Error(`${res.statusCode}: ${res.body}`)
  }
  return res.body
}

test('put-get', async () => {
  test('stores and retrieves immutable data', { timeout: 5000 }, async ({ is }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    grape1.announce('rest:util:net', 1337, () => {})
    await once(grape2, 'announce')
    const data = {
      v: 'hello world'
    }
    const port = grape2.conf.api_port
    const { body: hash } = await post({
      uri: `http://127.0.0.1:${port}/put`,
      json: true,
      body: { rid: 'test', data: data }
    })

    const normative = await getValue(hash, port)
    is(typeof normative.id, 'string')
    is(normative.id.length, 64)
    is(typeof normative.k, 'string')
    is(normative.k.length, 64)
    is(normative.v, 'hello world')
    is(normative.m, false)
    is(normative.seq, null)
    is(normative.sig, null)

    const explicit = await getValue({ hash, m: false }, port)
    is(typeof explicit.id, 'string')
    is(explicit.id.length, 64)
    is(typeof explicit.k, 'string')
    is(explicit.k.length, 64)
    is(explicit.v, 'hello world')
    is(explicit.m, false)
    is(explicit.seq, null)
    is(explicit.sig, null)

    const legacy = await getValue({ hash }, port)
    is(typeof legacy.id, 'string')
    is(legacy.id.length, 64)
    is(typeof legacy.k, 'string')
    is(legacy.k.length, 64)
    is(legacy.v, 'hello world')
    is(legacy.m, false)
    is(legacy.seq, null)
    is(legacy.sig, null)

    await stop()
  })

  test('stores and retrieves mutable data', { timeout: 5000 }, async ({ is }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

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
    const port = grape2.conf.api_port
    const { body: hexKey } = await post({
      uri: `http://127.0.0.1:${port}/put`,
      json: true,
      body: { rid: 'test', data: data }
    })

    is(hexKey, key.toString('hex'))

    const normative = await getValue({ key: hexKey }, port)
    is(typeof normative.id, 'string')
    is(normative.id.length, 64)
    is(normative.k, hexKey)
    is(normative.v, 'hello world')
    is(normative.m, true)
    is(normative.seq, 0)
    is(normative.sig, sig.toString('hex'))
    is(normative.salt, null)

    const explicit = await getValue({ hash: hexKey, m: true }, port)
    is(typeof explicit.id, 'string')
    is(explicit.id.length, 64)
    is(explicit.k, hexKey)
    is(explicit.v, 'hello world')
    is(explicit.m, true)
    is(explicit.seq, 0)
    is(explicit.sig, sig.toString('hex'))
    is(explicit.salt, null)

    const legacy = await getValue({ hash: hexKey }, port)
    is(typeof legacy.id, 'string')
    is(legacy.id.length, 64)
    is(typeof legacy.k, 'string')
    is(legacy.k.length, 64)
    is(legacy.v, 'hello world')
    is(legacy.m, true)
    is(legacy.seq, 0)
    is(legacy.sig, sig.toString('hex'))
    is(legacy.salt, null)

    await stop()
  })

  test('stores and retrieves salted mutable data', { timeout: 5000 }, async ({ is }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    grape1.announce('rest:util:net', 1337, () => {})
    await once(grape2, 'announce')
    const keypair = hypersign.keypair()
    const salt = 'test salt'
    const { publicKey: key } = keypair
    const value = 'hello world'
    const sig = hypersign.sign(Buffer.from(value), {
      keypair,
      salt: Buffer.from(salt)
    })

    const data = {
      v: value,
      k: key,
      sig,
      salt
    }
    const port = grape2.conf.api_port
    const { body: hexKey } = await post({
      uri: `http://127.0.0.1:${port}/put`,
      json: true,
      body: { rid: 'test', data: data }
    })
    is(hexKey, key.toString('hex'))

    const normative = await getValue({ key: hexKey, salt }, port)

    is(typeof normative.id, 'string')
    is(normative.id.length, 64)
    is(normative.k, hexKey)
    is(normative.v, 'hello world')
    is(normative.m, true)
    is(normative.seq, 0)
    is(normative.sig, sig.toString('hex'))
    is(normative.salt, salt.toString('hex'))

    const explicit = await getValue({ hash: hexKey, m: true, salt }, port)
    is(typeof explicit.id, 'string')
    is(explicit.id.length, 64)
    is(explicit.k, hexKey)
    is(explicit.v, 'hello world')
    is(explicit.m, true)
    is(explicit.seq, 0)
    is(explicit.sig, sig.toString('hex'))
    is(explicit.salt, salt.toString('hex'))

    const legacy = await getValue({ hash: hexKey, salt }, port)
    is(typeof legacy.id, 'string')
    is(legacy.id.length, 64)
    is(typeof legacy.k, 'string')
    is(legacy.k.length, 64)
    is(legacy.v, 'hello world')
    is(legacy.m, true)
    is(legacy.seq, 0)
    is(legacy.sig, sig.toString('hex'))
    is(legacy.salt, salt.toString('hex'))

    await stop()
  })
})
