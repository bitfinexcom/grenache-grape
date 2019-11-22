'use strict'
const { PassThrough } = require('stream')
const { test } = require('tap')
const supertest = require('supertest')
const { when, promisifyOf, timeout, once } = require('nonsynchronous')
const hypersign = require('@hyperswarm/hypersign')()
const getPort = require('get-port')
const {
  createGrape,
  createTwoGrapes,
  createGrapes
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
        is(normative.seq, undefined)
        is(normative.sig, undefined)
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
        is(explicit.seq, undefined)
        is(explicit.sig, undefined)
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
        is(legacy.seq, undefined)
        is(legacy.sig, undefined)
        untilLegacy()
      })
      await untilLegacy.done()
      until()
    })

    await until.done()
    await stop()
  })

  test('stores and retrieves immutable data (buffers)', { timeout: 5000 }, async ({ is, error }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    const until = when()
    const data = {
      v: Buffer.from('hello world')
    }

    grape2.put(data, async (err, hash) => {
      error(err)
      const untilNormative = when()
      const untilExplicit = when()
      const untilLegacy = when()
      grape1.get(Buffer.from(hash, 'hex'), (err, normative) => {
        error(err)
        is(typeof normative.id, 'string')
        is(normative.id.length, 64)
        is(typeof normative.k, 'string')
        is(normative.k.length, 64)
        is(normative.v, 'hello world')
        is(normative.m, false)
        is(normative.seq, undefined)
        is(normative.sig, undefined)
        untilNormative()
      })
      await untilNormative.done()
      grape1.get({ hash: Buffer.from(hash, 'hex'), m: false }, (err, explicit) => {
        error(err)
        is(typeof explicit.id, 'string')
        is(explicit.id.length, 64)
        is(typeof explicit.k, 'string')
        is(explicit.k.length, 64)
        is(explicit.v, 'hello world')
        is(explicit.m, false)
        is(explicit.seq, undefined)
        is(explicit.sig, undefined)
        untilExplicit()
      })
      await untilExplicit.done()
      grape1.get({ hash: Buffer.from(hash, 'hex') }, (err, legacy) => {
        error(err)
        is(typeof legacy.id, 'string')
        is(legacy.id.length, 64)
        is(typeof legacy.k, 'string')
        is(legacy.k.length, 64)
        is(legacy.v, 'hello world')
        is(legacy.m, false)
        is(legacy.seq, undefined)
        is(legacy.sig, undefined)
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
      const untilSlow = when()
      grape1.get({ key: hexKey }, (err, normative) => {
        error(err)
        is(typeof normative.id, 'string')
        is(normative.id.length, 64)
        is(normative.k, hexKey)
        is(normative.v, 'hello world')
        is(normative.m, true)
        is(normative.seq, 0)
        is(normative.sig, sig.toString('hex'))
        is(normative.salt, undefined)
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
        is(explicit.salt, undefined)
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
        is(legacy.salt, undefined)
        untilLegacy()
      })
      await untilLegacy.done()
      grape1.get(hexKey, (err, slow) => {
        error(err)
        is(typeof slow.id, 'string')
        is(slow.id.length, 64)
        is(typeof slow.k, 'string')
        is(slow.k.length, 64)
        is(slow.v, 'hello world')
        is(slow.m, true)
        is(slow.seq, 0)
        is(slow.sig, sig.toString('hex'))
        is(slow.salt, undefined)
        untilSlow()
      })
      await untilSlow.done()
      until()
    })
    await until.done()
    await stop()
  })

  test('stores and retrieves mutable data (buffers)', { timeout: 5000 }, async ({ is, error }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()

    const keypair = hypersign.keypair()
    const { publicKey: key } = keypair
    const value = 'hello world'
    const sig = hypersign.sign(Buffer.from(value), { keypair })

    const data = {
      v: Buffer.from(value),
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
      const untilSlow = when()
      grape1.get({ key }, (err, normative) => {
        error(err)
        is(typeof normative.id, 'string')
        is(normative.id.length, 64)
        is(normative.k, hexKey)
        is(normative.v, 'hello world')
        is(normative.m, true)
        is(normative.seq, 0)
        is(normative.sig, sig.toString('hex'))
        is(normative.salt, undefined)
        untilNormative()
      })
      await untilNormative.done()
      grape1.get({ hash: key, m: true }, (err, explicit) => {
        error(err)
        is(typeof explicit.id, 'string')
        is(explicit.id.length, 64)
        is(explicit.k, hexKey)
        is(explicit.v, 'hello world')
        is(explicit.m, true)
        is(explicit.seq, 0)
        is(explicit.sig, sig.toString('hex'))
        is(explicit.salt, undefined)
        untilExplicit()
      })
      await untilExplicit.done()
      grape1.get({ hash: key }, (err, legacy) => {
        error(err)
        is(typeof legacy.id, 'string')
        is(legacy.id.length, 64)
        is(typeof legacy.k, 'string')
        is(legacy.k.length, 64)
        is(legacy.v, 'hello world')
        is(legacy.m, true)
        is(legacy.seq, 0)
        is(legacy.sig, sig.toString('hex'))
        is(legacy.salt, undefined)
        untilLegacy()
      })
      await untilLegacy.done()
      grape1.get(key, (err, slow) => {
        error(err)
        is(typeof slow.id, 'string')
        is(slow.id.length, 64)
        is(typeof slow.k, 'string')
        is(slow.k.length, 64)
        is(slow.v, 'hello world')
        is(slow.m, true)
        is(slow.seq, 0)
        is(slow.sig, sig.toString('hex'))
        is(slow.salt, undefined)
        untilSlow()
      })
      await untilSlow.done()
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

  test('put - options.sign', async ({ is, error, teardown }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()
    const keypair = hypersign.keypair()
    const { publicKey: key } = keypair
    const value = 'hello world'
    var sig = null
    const data = {
      v: value,
      k: key,
      sign (buf) {
        sig = hypersign.cryptoSign(buf, keypair)
        return sig
      }
    }

    const until = when()
    await start(grape1)()
    grape2.put(data, async (err, hexKey) => {
      error(err)
      is(hexKey, key.toString('hex'))
      const untilNormative = when()
      const untilExplicit = when()
      const untilLegacy = when()
      const untilSlow = when()

      grape1.get({ key: hexKey }, (err, normative) => {
        error(err)
        is(typeof normative, 'object')
        is(typeof normative.id, 'string')
        is(normative.id.length, 64)
        is(normative.k, hexKey)
        is(normative.v, 'hello world')
        is(normative.m, true)
        is(normative.seq, 0)
        is(normative.sig, sig.toString('hex'))
        is(normative.salt, undefined)
        untilNormative()
      })
      await untilNormative.done()
      grape1.get({ hash: hexKey, m: true }, (err, explicit) => {
        error(err)
        is(typeof explicit, 'object')
        is(typeof explicit.id, 'string')
        is(explicit.id.length, 64)
        is(explicit.k, hexKey)
        is(explicit.v, 'hello world')
        is(explicit.m, true)
        is(explicit.seq, 0)
        is(explicit.sig, sig.toString('hex'))
        is(explicit.salt, undefined)
        untilExplicit()
      })
      await untilExplicit.done()
      grape1.get({ hash: hexKey }, (err, legacy) => {
        error(err)
        is(typeof legacy, 'object')
        is(typeof legacy.id, 'string')
        is(legacy.id.length, 64)
        is(typeof legacy.k, 'string')
        is(legacy.k.length, 64)
        is(legacy.v, 'hello world')
        is(legacy.m, true)
        is(legacy.seq, 0)
        is(legacy.sig, sig.toString('hex'))
        is(legacy.salt, undefined)
        untilLegacy()
      })
      await untilLegacy.done()
      grape1.get(hexKey, (err, slow) => {
        error(err)
        is(typeof slow.id, 'string')
        is(slow.id.length, 64)
        is(typeof slow.k, 'string')
        is(slow.k.length, 64)
        is(slow.v, 'hello world')
        is(slow.m, true)
        is(slow.seq, 0)
        is(slow.sig, sig.toString('hex'))
        is(slow.salt, undefined)
        untilSlow()
      })
      await untilSlow.done()
      until()
    })
    await until.done()
    await stop()
  })

  test('put - options.sign ed25519-supercop compat', async ({ is, error, teardown }) => {
    const { grape1, grape2, stop } = await createTwoGrapes()
    const ed = require('ed25519-supercop')
    const keypair = ed.createKeyPair(ed.createSeed())
    const { publicKey: key } = keypair
    const value = 'hello world'
    var sig = null
    const data = {
      v: value,
      k: key,
      sign (buf) {
        sig = ed.sign(
          buf, keypair.publicKey, keypair.secretKey
        )
        return sig
      }
    }

    const until = when()
    await start(grape1)()
    grape2.put(data, async (err, hexKey) => {
      error(err)
      is(hexKey, key.toString('hex'))
      const untilNormative = when()
      const untilExplicit = when()
      const untilLegacy = when()
      const untilSlow = when()

      grape1.get({ key: hexKey }, (err, normative) => {
        error(err)
        is(typeof normative, 'object')
        is(typeof normative.id, 'string')
        is(normative.id.length, 64)
        is(normative.k, hexKey)
        is(normative.v, 'hello world')
        is(normative.m, true)
        is(normative.seq, 0)
        is(normative.sig, sig.toString('hex'))
        is(normative.salt, undefined)
        untilNormative()
      })
      await untilNormative.done()
      grape1.get({ hash: hexKey, m: true }, (err, explicit) => {
        error(err)
        is(typeof explicit, 'object')
        is(typeof explicit.id, 'string')
        is(explicit.id.length, 64)
        is(explicit.k, hexKey)
        is(explicit.v, 'hello world')
        is(explicit.m, true)
        is(explicit.seq, 0)
        is(explicit.sig, sig.toString('hex'))
        is(explicit.salt, undefined)
        untilExplicit()
      })
      await untilExplicit.done()
      grape1.get({ hash: hexKey }, (err, legacy) => {
        error(err)
        is(typeof legacy, 'object')
        is(typeof legacy.id, 'string')
        is(legacy.id.length, 64)
        is(typeof legacy.k, 'string')
        is(legacy.k.length, 64)
        is(legacy.v, 'hello world')
        is(legacy.m, true)
        is(legacy.seq, 0)
        is(legacy.sig, sig.toString('hex'))
        is(legacy.salt, undefined)
        untilLegacy()
      })
      await untilLegacy.done()
      grape1.get(hexKey, (err, slow) => {
        error(err)
        is(typeof slow.id, 'string')
        is(slow.id.length, 64)
        is(typeof slow.k, 'string')
        is(slow.k.length, 64)
        is(slow.v, 'hello world')
        is(slow.m, true)
        is(slow.seq, 0)
        is(slow.sig, sig.toString('hex'))
        is(slow.salt, undefined)
        untilSlow()
      })
      await untilSlow.done()
      until()
    })
    await until.done()
    await stop()
  })

  test('put - options.sig or options.sign but not both', async ({ is, ok }) => {
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
      is(err.message, 'ERR_GRAPE_SIG_OR_SIGN_NOT_BOTH')
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

  test('put invalid input', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()

    const until = when()
    const data = 'not valid'

    grape.put(data, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_PUT_ARG_MUST_BE_OBJECT')
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

  test('mutable put same seq', { timeout: 5000 }, async ({ is, ok, error }) => {
    const { stop, ...grapes } = await createGrapes(3)
    const [grape1, grape2, grape3] = Object.values(grapes)

    const keypair = hypersign.keypair()
    const { publicKey: key } = keypair
    const value = 'hello world'
    const seq = 1
    const sig = hypersign.sign(Buffer.from(value), { keypair, seq })

    const data = {
      v: value,
      k: key,
      sig,
      seq
    }

    const until = when()
    grape1.put(data, (err) => {
      error(err)
      data.seq += 1
      data.sig = hypersign.sign(Buffer.from(value), { keypair, seq: seq + 1 })
      grape2.put(data, (err) => {
        error(err)
        data.seq = seq
        data.sig = sig
        grape3.put(data, (err) => {
          ok(err)
          is(err.code, 302)
          is(err.message, '302 sequence number less than current')
          until()
        })
      })
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
      is(explicit, undefined)
      untilExplicit()
    })
    await untilExplicit.done()
    grape.get({ hash }, (err, legacy) => {
      error(err)
      is(legacy, undefined)
      untilLegacy()
    })
    await untilLegacy.done()

    await stop()
  })

  test('get invalid hash (immutable)', { timeout: 5000 }, async ({ is, error }) => {
    const { grape, stop } = await createGrape()

    const hash = '256c83b297114d201b3not validf0cace9783622da5974326b436178aeef611'

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
      is(explicit, undefined)
      untilExplicit()
    })
    await untilExplicit.done()
    grape.get({ hash }, (err, legacy) => {
      error(err)
      is(legacy, undefined)
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
    grape.get({ key: hexKey }, (err, normative) => {
      error(err)
      is(normative, undefined)
      untilNormative()
    })
    await untilNormative.done()
    grape.get({ hash: hexKey, m: true }, (err, explicit) => {
      error(err)
      is(explicit, undefined)
      untilExplicit()
    })
    await untilExplicit.done()
    grape.get({ hash: hexKey }, (err, legacy) => {
      error(err)
      is(legacy, undefined)
      untilLegacy()
    })
    await untilLegacy.done()

    await stop()
  })

  test('get invalid hash (mutable)', { timeout: 5000 }, async ({ is, error }) => {
    const { grape, stop } = await createGrape()

    const keypair = hypersign.keypair()
    const { publicKey: key } = keypair
    const hexKey = key.toString('hex').slice(-24)

    const untilNormative = when()
    const untilExplicit = when()
    const untilLegacy = when()
    grape.get({ key: hexKey }, (err, normative) => {
      error(err)
      is(normative, undefined)
      untilNormative()
    })
    await untilNormative.done()
    grape.get({ hash: hexKey, m: true }, (err, explicit) => {
      error(err)
      is(explicit, undefined)
      untilExplicit()
    })
    await untilExplicit.done()
    grape.get({ hash: hexKey }, (err, legacy) => {
      error(err)
      is(legacy, undefined)
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

  test('immutable get generic thrown error propagation', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()
    // simulate generic thrown error
    grape.node.immutable.get = () => {
      throw Error('test')
    }
    const hash = '256c83b297114d201b30179f3f0ef0cace9783622da5974326b436178aeef611'
    const until = when()
    grape.get(hash, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_GENERIC: test')
      grape.get({ hash }, (err, res) => {
        ok(err)
        is(err.message, 'ERR_GRAPE_GENERIC: test')
        until()
      })
    })

    await until.done()
    await stop()
  })

  test('mutable get generic thrown error propagation', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()
    // simulate generic thrown error
    grape.node.mutable.get = () => {
      throw Error('test')
    }
    const key = '256c83b297114d201b30179f3f0ef0cace9783622da5974326b436178aeef611'
    const until = when()
    grape.get({ key }, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_GENERIC: test')
      grape.get(key, (err) => {
        ok(err)
        is(err.message, 'ERR_GRAPE_GENERIC: test')
        until()
      })
    })

    await until.done()
    await stop()
  })

  test('immutable get generic async error propagation', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()
    // simulate generic  error
    grape.node.immutable.get = (hash, cb) => {
      process.nextTick(cb, Error('test'))
      return new PassThrough()
    }
    const hash = '256c83b297114d201b30179f3f0ef0cace9783622da5974326b436178aeef611'
    const until = when()
    grape.get(hash, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_GENERIC: test')
      grape.get({ hash }, (err) => {
        ok(err)
        is(err.message, 'ERR_GRAPE_GENERIC: test')
        until()
      })
    })

    await until.done()
    await stop()
  })

  test('mutable get generic async error propagation ( { hash } )', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()
    // simulate generic  error
    grape.node.mutable.get = (key, opts, cb) => {
      process.nextTick(cb, Error('test'))
      return new PassThrough()
    }
    const hash = '256c83b297114d201b30179f3f0ef0cace9783622da5974326b436178aeef611'
    const until = when()
    grape.get({ hash }, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_GENERIC: test')
      grape.get(hash, (err) => {
        ok(err)
        is(err.message, 'ERR_GRAPE_GENERIC: test')
        until()
      })
    })

    await until.done()
    await stop()
  })

  test('immutable put generic async error propagation', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()
    // simulate generic  error
    grape.node.immutable.put = (val, cb) => {
      process.nextTick(cb, Error('test'))
      return new PassThrough()
    }
    const data = { v: 'hello' }
    const until = when()
    grape.put(data, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_GENERIC: test')
      until()
    })

    await until.done()
    await stop()
  })

  test('mutable put generic async error propagation', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()
    // simulate generic error
    grape.node.mutable.put = (key, opts, cb) => {
      process.nextTick(cb, Error('test'))
      return new PassThrough()
    }
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
    grape.put(data, (err) => {
      ok(err)
      is(err.message, 'ERR_GRAPE_GENERIC: test')
      until()
    })

    await until.done()
    await stop()
  })

  test('immutable get warning propagation', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()
    // simulate warning scenario
    grape.node.immutable.get = (hash, cb) => {
      const qsMock = new PassThrough()
      process.nextTick(() => qsMock.emit('warning', 'test'))
      setImmediate((err, ...args) => cb(err, ...args), null, {}, {})
      return qsMock
    }
    const hash = '256c83b297114d201b30179f3f0ef0cace9783622da5974326b436178aeef611'
    grape.get(hash, () => {})

    const [warning] = await once(grape, 'warning')
    is(warning, 'test')

    await stop()
  })

  test('mutable get warning propagation ( { hash } )', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()
    // simulate warning scenario
    grape.node.mutable.get = (key, opts, cb) => {
      const qsMock = new PassThrough()
      process.nextTick(() => qsMock.emit('warning', 'test'))
      setImmediate((err, ...args) => cb(err, ...args), null, {}, {})
      return qsMock
    }
    const hash = '256c83b297114d201b30179f3f0ef0cace9783622da5974326b436178aeef611'
    grape.get({ hash }, () => {})

    const [warning] = await once(grape, 'warning')
    is(warning, 'test')

    await stop()
  })

  test('immutable put warning propagation', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()
    // simulate warning scenario
    grape.node.immutable.put = (key, cb) => {
      const qsMock = new PassThrough()
      process.nextTick(() => qsMock.emit('warning', 'test'))
      setImmediate((err, ...args) => cb(err, ...args), null, key)
      return qsMock
    }
    const data = { v: 'hello' }

    grape.put(data, () => {})

    const [warning] = await once(grape, 'warning')
    is(warning, 'test')

    await stop()
  })

  test('mutable put warning propagation', { timeout: 5000 }, async ({ is, ok }) => {
    const { grape, stop } = await createGrape()
    // simulate generic error
    grape.node.mutable.put = (key, opts, cb) => {
      const qsMock = new PassThrough()
      process.nextTick(() => qsMock.emit('warning', 'test'))
      setImmediate((err, ...args) => cb(err, ...args), null, { key })
      return qsMock
    }
    const keypair = hypersign.keypair()
    const { publicKey: key } = keypair
    const value = 'hello world'
    const sig = hypersign.sign(Buffer.from(value), { keypair })

    const data = {
      v: value,
      k: key,
      sig
    }

    grape.put(data, () => {})

    const [warning] = await once(grape, 'warning')
    is(warning, 'test')

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
    is(normative.seq, undefined)
    is(normative.sig, undefined)

    const explicit = await getValue({ hash, m: false }, port1)
    is(typeof explicit.id, 'string')
    is(explicit.id.length, 64)
    is(typeof explicit.k, 'string')
    is(explicit.k.length, 64)
    is(explicit.v, 'hello world')
    is(explicit.m, false)
    is(explicit.seq, undefined)
    is(explicit.sig, undefined)

    const legacy = await getValue({ hash }, port1)
    is(typeof legacy.id, 'string')
    is(legacy.id.length, 64)
    is(typeof legacy.k, 'string')
    is(legacy.k.length, 64)
    is(legacy.v, 'hello world')
    is(legacy.m, false)
    is(legacy.seq, undefined)
    is(legacy.sig, undefined)

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
    is(normative.salt, undefined)

    const explicit = await getValue({ hash: hexKey, m: true }, port1)
    is(typeof explicit.id, 'string')
    is(explicit.id.length, 64)
    is(explicit.k, hexKey)
    is(explicit.v, 'hello world')
    is(explicit.m, true)
    is(explicit.seq, 0)
    is(explicit.sig, sig.toString('hex'))
    is(explicit.salt, undefined)

    const legacy = await getValue({ hash: hexKey }, port1)
    is(typeof legacy.id, 'string')
    is(legacy.id.length, 64)
    is(typeof legacy.k, 'string')
    is(legacy.k.length, 64)
    is(legacy.v, 'hello world')
    is(legacy.m, true)
    is(legacy.seq, 0)
    is(legacy.sig, sig.toString('hex'))
    is(legacy.salt, undefined)

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
      .expect(400, '"ERR_GRAPE_SIG_OR_SIGN_REQUIRED"')
    await stop()
  })
})
