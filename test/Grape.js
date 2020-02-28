'use strict'
const Events = require('events')
const { promisifyOf, when, once } = require('nonsynchronous')
const { test, teardown } = require('tap')
const getPort = require('get-port')
const { Grape } = require('..')
const stop = promisifyOf('stop')
const start = promisifyOf('start')
const { createBootstrap } = require('./helper.js')
const guard = (grape) => teardown(() => grape.stop())

test('Grape', async () => {
  test('should be an instance of Events', async ({ ok }) => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    guard(grape)
    ok(grape instanceof Events)
    await stop(grape)()
  })

  test('start may be called multiple times', async ({ doesNotThrow, error }) => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    guard(grape)
    await start(grape)()
    doesNotThrow(() => {
      grape.start((err) => {
        error(err)
      })
    })
    await stop(grape)()
  })

  test('should accept callback on starting a grape', async ({ error }) => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    guard(grape)
    const until = when()
    grape.start((err) => {
      error(err)

      grape.stop((err) => {
        error(err)
        until()
      })
    })
    await until.done()
  })

  test('calling stop on an unstarted Grape will not throw', async () => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    guard(grape)
    await stop(grape)()
  })

  test('stop event', async ({ pass }) => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    guard(grape)
    const until = when()
    await start(grape)()
    grape.once('close', () => {
      pass('close event fired')
      until()
    })
    grape.stop()
    await until.done()
  })

  test('requires an api port', async ({ ok, is }) => {
    const grape = new Grape({
      dht_port: await getPort()
    })
    guard(grape)
    const until = when()
    grape.start((err) => {
      ok(err)
      is(err.message, 'ERR_NO_PORT')
      grape.stop(until)
    })
    await until.done()
  })

  test('dht_adaptive true when dht_ephemeral false', async ({ rejects, resolves }) => {
    rejects(async () => {
      new Grape({ // eslint-disable-line no-new
        dht_port: await getPort(),
        dht_ephemeral: false,
        dht_adaptive: true
      })
    }, Error('dht_adaptive can only applied when dht_ephemeral: true'))
    rejects(async () => {
      new Grape({ // eslint-disable-line no-new
        dht_port: await getPort(),
        dht_adaptive: true
      })
    }, Error('dht_adaptive can only applied when dht_ephemeral: true'))
    resolves(async () => {
      const grape = new Grape({ dht_port: await getPort(), dht_adaptive: true, dht_ephemeral: true })
      grape.stop()
    })
  })

  test('dht port collision', async ({ ok, is }) => {
    const grape1 = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    const grape2 = new Grape({
      dht_port: grape1.conf.dht_port,
      api_port: await getPort()
    })
    guard(grape1)
    guard(grape2)
    const until = when()
    await start(grape1)()
    grape2.start((err) => {
      ok(err)
      const { code } = err
      is(code, 'EADDRINUSE')
      grape1.stop(() => {
        grape2.stop(() => {
          until()
        })
      })
    })
    await until.done()
  })

  test('emits error when no callback supplied', async ({ ok, is }) => {
    const grape1 = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    const grape2 = new Grape({
      dht_port: grape1.conf.dht_port,
      api_port: await getPort()
    })
    guard(grape1)
    guard(grape2)
    const until = when()
    await start(grape1)()
    grape2.start()
    const err = await once(grape2, 'error')
    ok(err)
    const { code } = err
    is(code, 'EADDRINUSE')
    grape1.stop(() => {
      grape2.stop(() => {
        until()
      })
    })
    await until.done()
  })

  test('avoids multi start callback on init error race condition', async ({ ok, is }) => {
    const grape1 = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    const grape2 = new Grape({
      dht_port: grape1.conf.dht_port,
      api_port: await getPort()
    })
    guard(grape1)
    guard(grape2)
    const until = when()
    await start(grape1)()
    var dht = null
    // reliably simulate race condition scenario
    Object.defineProperty(grape2, 'dht', {
      get () {
        return dht
      },
      set (v) {
        dht = v
        dht.listen = (host, port, cb) => {
          dht.emit('error', Error('test'))
          cb()
        }
        return dht
      }
    })
    grape2.start((err) => {
      ok(err)
      const { message } = err
      is(message, 'test')
      grape1.stop(() => {
        grape2.stop(() => {
          until()
        })
      })
    })

    await until.done()
  })

  test('keeps running on invalid put payload', async ({ ok }) => {
    const grape = new Grape({
      dht_port: await getPort(),
      api_port: await getPort()
    })
    guard(grape)
    await start(grape)()
    const until = when()
    grape.put({ foo: 'bar' }, (err) => {
      ok(err)
      until()
    })
    await until.done()
    await stop(grape)()
  })

  test('address', async ({ throws, is }) => {
    const grape = new Grape({
      host: '127.0.0.1',
      dht_port: await getPort(),
      api_port: await getPort()
    })
    guard(grape)
    throws(() => { grape.address() })
    await start(grape)()
    const { address, port } = grape.address()
    is(port, grape.conf.dht_port)
    is(address, grape.conf.host)
    await stop(grape)()
  })

  test('propagates dht warnings', async ({ is }) => {
    const grape = new Grape({
      host: '127.0.0.1',
      dht_port: await getPort(),
      api_port: await getPort()
    })
    guard(grape)
    await start(grape)()
    process.nextTick(() => grape.node.emit('warning', 'test'))
    const [warning] = await once(grape, 'warning')
    is(warning, 'test')
    await stop(grape)()
  })
})

test('adaptive ephemerality', async ({ is, ok, resolves, rejects, tearDown }) => {
  tearDown(() => {
    peer.stop()
    adapt.stop()
    bs.stop()
  })

  const bs = await createBootstrap(true)

  const adapt = new Grape({
    api_port: await getPort(),
    dht_port: await getPort(),
    dht_ephemeral: true,
    dht_adaptive: true,
    dht_bootstrap: bs.dht_bootstrap
  })
  adapt.start()
  await once(adapt, 'ready')
  const peer = new Grape({
    api_port: await getPort(),
    dht_port: await getPort(),
    dht_ephemeral: true,
    dht_bootstrap: bs.dht_bootstrap
  })
  peer.start()
  const announce = promisifyOf('announce')
  const lookup = promisifyOf('lookup')
  await once(peer, 'ready')
  const topic = 'rest:util:net'
  await rejects(announce(peer)(topic, 1234), Error('No close nodes responded'), 'expected no nodes found')
  const t = adapt.dht._adaptiveTimeout
  ok(t._idleTimeout >= 1.2e+6) // >= 20 mins
  ok(t._idleTimeout <= 1.8e+6) // <= 30 mins
  const { persistent } = adapt.dht
  let persistentCalled = false
  adapt.dht.persistent = (cb) => {
    persistentCalled = true
    return persistent.call(adapt.dht, cb)
  }
  is(adapt.ephemeral, true)
  const dhtJoined = once(adapt, 'persistent')
  resolves(dhtJoined, 'dht joined event fired')
  is(persistentCalled, false)
  // fake holepunchable
  adapt.dht.holepunchable = () => true
  // force the timeout to resolve:
  t._onTimeout()
  clearTimeout(t)
  await dhtJoined
  is(persistentCalled, true)
  is(adapt.ephemeral, false)
  const bootstrap = promisifyOf('bootstrap')
  await bootstrap(peer.dht) // speed up discovery of now non-ephemeral "adapt" peer
  await announce(peer)(topic, 1234)
  lookup(peer)(topic)
  const [, { referrer }] = await once(peer, 'peer')
  is(Buffer.compare(referrer.id, adapt.dht.id), 0)
})
