'use strict'

const test = require('brittle')

const Events = require('events')

const Grape = require('./../lib/Grape')

test('Grape', { timeout: 20000 }, async (t) => {
  t.test('should be an instance of Events', async (t) => {
    const grape = new Grape({
      dht_port: 20000,
      api_port: 20001
    })

    t.ok(grape instanceof Events)
  })

  t.test('should accept callback on starting a grape', async (t) => {
    const grape = new Grape({
      dht_port: 20002,
      api_port: 30000
    })

    const stopped = await new Promise((resolve, reject) => {
      grape.start((err) => {
        if (err) return reject(err)
        grape.stop((err) => {
          if (err) return reject(err)
          resolve(true)
        })
      })
    })
    t.ok(stopped)
  })

  t.test('calling stop on an unstarted Grape is fine', async (t) => {
    const grape = new Grape({
      dht_port: 20000,
      api_port: 20001
    })

    await new Promise(resolve => grape.stop(resolve))
    t.ok(true)
  })

  t.test('requires a port', async (t) => {
    const grape = new Grape({
      dht_port: 20000
    })

    await t.exception(new Promise((resolve, reject) => {
      grape.start((err) => {
        grape.stop(() => err ? reject(err.message) : resolve())
      })
    }), 'ERR_NO_PORT')
  })

  t.test('keeps running on invalid put payload', async (t) => {
    const grape = new Grape({
      dht_port: 20003,
      api_port: 30003
    })

    await t.exception(new Promise((resolve, reject) => {
      grape.start((err) => {
        if (err) return grape.stop(reject)
        grape.put({ foo: 'bar' }, (err) => {
          grape.stop(() => {
            err ? reject(err) : resolve()
          })
        })
      })
    }), 'opts.v not given')
  })
})
