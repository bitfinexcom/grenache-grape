/* eslint-env mocha */

'use strict'

const { test } = require('tap')
const supertest = require('supertest')
const { when, promisifyOf, timeout } = require('nonsynchronous')
const hypersign = require('@hyperswarm/hypersign')()
const getPort = require('get-port')
const {
  createGrape,
  createTwoGrapes
} = require('./helper.js')
const { Grape } = require('..')
const stop = promisifyOf('stop')
const start = promisifyOf('start')

async function getValue (h, port) {
  const { post } = supertest(`http://127.0.0.1:${port}`)
  const res = await post('/get')
    .send({ rid: 'test', data: h })
    .expect(200)

  return res.body
}

test('put-get', async () => {
  test('stores and retrieves immutable data', { timeout: 5000 }, async ({ is, error }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    const until = when()
    const data = {
      v: 'hello world'
    }

    grape2.put(data, async (err, hash) => {
      error(err)
      const untilNormative = when()
      const untilExplicit = when()
      const untilLegacy = when()
      grape1.get(hash, (err, normative) => {
        error(err)
        is(typeof normative.id, 'string')
        is(normative.id.length, 64)
        is(typeof normative.k, 'string')
        is(normative.k.length, 64)
        is(normative.v, 'hello world')
        is(normative.m, false)
        is(normative.seq, null)
        is(normative.sig, null)
        untilNormative()
      })
      await untilNormative.done()
      grape1.get({ hash, m: false }, (err, explicit) => {
        error(err)
        is(typeof explicit.id, 'string')
        is(explicit.id.length, 64)
        is(typeof explicit.k, 'string')
        is(explicit.k.length, 64)
        is(explicit.v, 'hello world')
        is(explicit.m, false)
        is(explicit.seq, null)
        is(explicit.sig, null)
        untilExplicit()
      })
      await untilExplicit.done()
      grape1.get({ hash }, (err, legacy) => {
        error(err)
        is(typeof legacy.id, 'string')
        is(legacy.id.length, 64)
        is(typeof legacy.k, 'string')
        is(legacy.k.length, 64)
        is(legacy.v, 'hello world')
        is(legacy.m, false)
        is(legacy.seq, null)
        is(legacy.sig, null)
        untilLegacy()
      })
      await untilLegacy.done()
      until()
    })

    await until.done()
    await stop()
  })

  test('stores and retrieves mutable data', { timeout: 5000 }, async ({ is, error }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    const keypair = hypersign.keypair()
    const { publicKey: key } = keypair
    const value = 'hello world'
    const sig = hypersign.sign(Buffer.from(value), { keypair })

    const data = {
      v: value,
      k: key,
      sig
    }
    const until = when()
    grape2.put(data, async (err, hexKey) => {
      error(err)
      is(hexKey, key.toString('hex'))
      const untilNormative = when()
      const untilExplicit = when()
      const untilLegacy = when()
      grape1.get({ key: hexKey }, (err, normative) => {
        error(err)
        is(typeof normative.id, 'string')
        is(normative.id.length, 64)
        is(normative.k, hexKey)
        is(normative.v, 'hello world')
        is(normative.m, true)
        is(normative.seq, 0)
        is(normative.sig, sig.toString('hex'))
        is(normative.salt, null)
        untilNormative()
      })
      await untilNormative.done()
      grape1.get({ hash: hexKey, m: true }, (err, explicit) => {
        error(err)
        is(typeof explicit.id, 'string')
        is(explicit.id.length, 64)
        is(explicit.k, hexKey)
        is(explicit.v, 'hello world')
        is(explicit.m, true)
        is(explicit.seq, 0)
        is(explicit.sig, sig.toString('hex'))
        is(explicit.salt, null)
        untilExplicit()
      })
      await untilExplicit.done()
      grape1.get({ hash: hexKey }, (err, legacy) => {
        error(err)
        is(typeof legacy.id, 'string')
        is(legacy.id.length, 64)
        is(typeof legacy.k, 'string')
        is(legacy.k.length, 64)
        is(legacy.v, 'hello world')
        is(legacy.m, true)
        is(legacy.seq, 0)
        is(legacy.sig, sig.toString('hex'))
        is(legacy.salt, null)
        untilLegacy()
      })
      await untilLegacy.done()
      until()
    })
    await until.done()
    await stop()
  })

  test('stores and retrieves salted mutable data', { timeout: 5000 }, async ({ is, error }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

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
    const until = when()

    grape2.put(data, async (err, hexKey) => {
      error(err)
      is(hexKey, key.toString('hex'))

      const untilNormative = when()
      const untilExplicit = when()
      const untilLegacy = when()

      grape1.get({ key: hexKey, salt }, (err, normative) => {
        error(err)
        is(typeof normative.id, 'string')
        is(normative.id.length, 64)
        is(normative.k, hexKey)
        is(normative.v, 'hello world')
        is(normative.m, true)
        is(normative.seq, 0)
        is(normative.sig, sig.toString('hex'))
        is(normative.salt, salt.toString('hex'))
        untilNormative()
      })
      await untilNormative.done()

      grape1.get({ hash: hexKey, m: true, salt }, (err, explicit) => {
        error(err)
        is(typeof explicit.id, 'string')
        is(explicit.id.length, 64)
        is(explicit.k, hexKey)
        is(explicit.v, 'hello world')
        is(explicit.m, true)
        is(explicit.seq, 0)
        is(explicit.sig, sig.toString('hex'))
        is(explicit.salt, salt.toString('hex'))
        untilExplicit()
      })
      await untilExplicit.done()

      grape1.get({ hash: hexKey, salt }, (err, legacy) => {
        error(err)
        is(typeof legacy.id, 'string')
        is(legacy.id.length, 64)
        is(typeof legacy.k, 'string')
        is(legacy.k.length, 64)
        is(legacy.v, 'hello world')
        is(legacy.m, true)
        is(legacy.seq, 0)
        is(legacy.sig, sig.toString('hex'))
        is(legacy.salt, salt.toString('hex'))
        untilLegacy()
      })

      await untilLegacy.done()
      until()
    })

    await until.done()
    await stop()
  })

  test('put - fire and forget', async ({ is, error }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

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

    grape2.put(data)
    await timeout(100)
    const hexKey = key.toString('hex')

    const untilNormative = when()
    const untilExplicit = when()
    const untilLegacy = when()

    grape1.get({ key: hexKey, salt }, (err, normative) => {
      error(err)
      is(typeof normative.id, 'string')
      is(normative.id.length, 64)
      is(normative.k, hexKey)
      is(normative.v, 'hello world')
      is(normative.m, true)
      is(normative.seq, 0)
      is(normative.sig, sig.toString('hex'))
      is(normative.salt, salt.toString('hex'))
      untilNormative()
    })
    await untilNormative.done()

    grape1.get({ hash: hexKey, m: true, salt }, (err, explicit) => {
      error(err)
      is(typeof explicit.id, 'string')
      is(explicit.id.length, 64)
      is(explicit.k, hexKey)
      is(explicit.v, 'hello world')
      is(explicit.m, true)
      is(explicit.seq, 0)
      is(explicit.sig, sig.toString('hex'))
      is(explicit.salt, salt.toString('hex'))
      untilExplicit()
    })
    await untilExplicit.done()

    grape1.get({ hash: hexKey, salt }, (err, legacy) => {
      error(err)
      is(typeof legacy.id, 'string')
      is(legacy.id.length, 64)
      is(typeof legacy.k, 'string')
      is(legacy.k.length, 64)
      is(legacy.v, 'hello world')
      is(legacy.m, true)
      is(legacy.seq, 0)
      is(legacy.sig, sig.toString('hex'))
      is(legacy.salt, salt.toString('hex'))
      untilLegacy()
    })

    await untilLegacy.done()
    await stop()
  })

  test('put - options.sign not supported', async ({ is, ok }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    const keypair = hypersign.keypair()
    const salt = 'test salt'
    const { publicKey: key } = keypair
    const value = 'hello world'
    const sig = hypersign.sign(Buffer.from(value), { keypair })
    const data = {
      v: value,
      k: key,
      sig,
      sign () { },
      salt
    }
    const until = when()
    await start(grape1)()
    grape2.put(data, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_SIGN_NOT_SUPPORTED')
      until()
    })
    await until.done()
    await stop()
  })

  test('immutable put value exceed maximum', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()

    const until = when()
    const data = {
      v: Buffer.alloc(1001)
    }

    grape.put(data, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_GENERIC: Value size must be <= 1000')
      until()
    })

    await until.done()
    await stop()
  })

  test('mutable put value exceed maximum', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()

    const keypair = hypersign.keypair()
    const { publicKey: key } = keypair

    const value = Buffer.alloc(1001)
    const sig = hypersign.sign(Buffer.from(value).slice(-1), { keypair })

    const data = {
      v: value,
      k: key,
      sig
    }
    const until = when()
    grape.put(data, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_GENERIC: Value size must be <= 1000')
      until()
    })
    await until.done()
    await stop()
  })

  test('get - invalid get', async ({ is, ok, teardown }) => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    teardown(() => grape.stop())
    const until = when()
    await start(grape)()
    grape.get({ not: 'valid' }, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_INVALID_GET_OPTIONS')
      until()
    })
    await until.done()
    await stop(grape)()
  })

  test('get non-existent immutable data', { timeout: 5000 }, async ({ is, error }) => {
    const { grape, stop } = await createGrape()

    const hash = '256c83b297114d201b30179f3f0ef0cace9783622da5974326b436178aeef611'

    const untilNormative = when()
    const untilExplicit = when()
    const untilLegacy = when()
    grape.get(hash, (err, normative) => {
      error(err)
      is(normative, undefined)
      untilNormative()
    })
    await untilNormative.done()
    grape.get({ hash, m: false }, (err, explicit) => {
      error(err)

      untilExplicit()
    })
    await untilExplicit.done()
    grape.get({ hash }, (err, legacy) => {
      error(err)

      untilLegacy()
    })
    await untilLegacy.done()

    await stop()
  })

  test('get non-existent mutable data', { timeout: 5000 }, async ({ is, error }) => {
    const { grape, stop } = await createGrape()

    const keypair = hypersign.keypair()
    const { publicKey: key } = keypair
    const hexKey = key.toString('hex')

    const untilNormative = when()
    const untilExplicit = when()
    const untilLegacy = when()
    grape.get({ key: hexKey }, (err, { id, v }) => {
      error(err)
      is(v, null)
      is(id, null)
      untilNormative()
    })
    await untilNormative.done()
    grape.get({ hash: hexKey, m: true }, (err, { id, v }) => {
      error(err)
      is(v, null)
      is(id, null)
      untilExplicit()
    })
    await untilExplicit.done()
    grape.get({ hash: hexKey }, (err, result) => {
      // TODO MAKE SURE IMMUTABLE GET / MUTABLE GET RESPONSNE OF
      // NON-EXISTENT DATA MATCHES BITTORRENT DHT
      is(result, undefined)
      error(err)
      // is(v, null)
      // is(id, null)
      untilLegacy()
    })
    await untilLegacy.done()

    await stop()
  })

  test('invalid get options', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()

    const until = when()
    grape.get({}, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_INVALID_GET_OPTIONS')
      until()
    })

    await until.done()
    await stop()
  })

  test('invalid get options', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()
    const until = when()
    grape.get({}, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_INVALID_GET_OPTIONS')
      until()
    })

    await until.done()
    await stop()
  })

  test('immutable get generic error propagation', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()
    const { get } = grape.node.immutable
    // simulate generic thrown error
    grape.node.immutable.get = (hash, cb) => {
      grape.node.immutable.get = get
      throw Error('test')
    }
    const hash = '256c83b297114d201b30179f3f0ef0cace9783622da5974326b436178aeef611'
    const until = when()
    grape.get(hash, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_GENERIC: test')
      until()
    })

    await until.done()
    await stop()
  })

  test('rpc: stores and retrieves immutable data', { timeout: 5000 }, async ({ is }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    const data = {
      v: 'hello world'
    }
    const port1 = grape1.conf.api_port
    const port2 = grape2.conf.api_port
    const { post } = supertest(`http://127.0.0.1:${port2}`)
    const { body: hash } = await post('/put')
      .send({ rid: 'test', data: data })
      .expect(200)

    const normative = await getValue(hash, port1)
    is(typeof normative.id, 'string')
    is(normative.id.length, 64)
    is(typeof normative.k, 'string')
    is(normative.k.length, 64)
    is(normative.v, 'hello world')
    is(normative.m, false)
    is(normative.seq, null)
    is(normative.sig, null)

    const explicit = await getValue({ hash, m: false }, port1)
    is(typeof explicit.id, 'string')
    is(explicit.id.length, 64)
    is(typeof explicit.k, 'string')
    is(explicit.k.length, 64)
    is(explicit.v, 'hello world')
    is(explicit.m, false)
    is(explicit.seq, null)
    is(explicit.sig, null)

    const legacy = await getValue({ hash }, port1)
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

  test('rpc: stores and retrieves mutable data', { timeout: 5000 }, async ({ is }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    const keypair = hypersign.keypair()
    const { publicKey: key } = keypair
    const value = 'hello world'
    const sig = hypersign.sign(Buffer.from(value), { keypair })

    const data = {
      v: value,
      k: key,
      sig
    }
    const port1 = grape1.conf.api_port
    const port2 = grape2.conf.api_port
    const { post } = supertest(`http://127.0.0.1:${port2}`)
    const { body: hexKey } = await post('/put')
      .send({ rid: 'test', data: data })
      .expect(200)

    is(hexKey, key.toString('hex'))

    const normative = await getValue({ key: hexKey }, port1)
    is(typeof normative.id, 'string')
    is(normative.id.length, 64)
    is(normative.k, hexKey)
    is(normative.v, 'hello world')
    is(normative.m, true)
    is(normative.seq, 0)
    is(normative.sig, sig.toString('hex'))
    is(normative.salt, null)

    const explicit = await getValue({ hash: hexKey, m: true }, port1)
    is(typeof explicit.id, 'string')
    is(explicit.id.length, 64)
    is(explicit.k, hexKey)
    is(explicit.v, 'hello world')
    is(explicit.m, true)
    is(explicit.seq, 0)
    is(explicit.sig, sig.toString('hex'))
    is(explicit.salt, null)

    const legacy = await getValue({ hash: hexKey }, port1)
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

  test('rpc: stores and retrieves salted mutable data', { timeout: 5000 }, async ({ is }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

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
    const port1 = grape1.conf.api_port
    const port2 = grape2.conf.api_port
    const { post } = supertest(`http://127.0.0.1:${port2}`)
    const { body: hexKey } = await post('/put')
      .send({ rid: 'test', data: data })
      .expect(200)
    is(hexKey, key.toString('hex'))

    const normative = await getValue({ key: hexKey, salt }, port1)

    is(typeof normative.id, 'string')
    is(normative.id.length, 64)
    is(normative.k, hexKey)
    is(normative.v, 'hello world')
    is(normative.m, true)
    is(normative.seq, 0)
    is(normative.sig, sig.toString('hex'))
    is(normative.salt, salt.toString('hex'))

    const explicit = await getValue({ hash: hexKey, m: true, salt }, port1)
    is(typeof explicit.id, 'string')
    is(explicit.id.length, 64)
    is(explicit.k, hexKey)
    is(explicit.v, 'hello world')
    is(explicit.m, true)
    is(explicit.seq, 0)
    is(explicit.sig, sig.toString('hex'))
    is(explicit.salt, salt.toString('hex'))

    const legacy = await getValue({ hash: hexKey, salt }, port1)
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

  test('rpc: mutable put without sig results in 400 error', { timeout: 5000 }, async ({ is }) => {
    const { grape, stop } = await createGrape()

    const keypair = hypersign.keypair()
    const { publicKey: key } = keypair
    const value = 'hello world'

    const data = {
      v: value,
      k: key
    }
    const port = grape.conf.api_port
    const { post } = supertest(`http://127.0.0.1:${port}`)
    await post('/put')
      .send({ rid: 'test', data: data })
      .expect(400, '"ERR_GRAPE_SIG_REQUIRED"')
    await stop()
  })
})
