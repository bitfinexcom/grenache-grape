/* eslint-env mocha */

'use strict'

const assert = require('chai').assert

const Events = require('events')

const Grape = require('./../lib/Grape')

describe('Grape', () => {
  it('should be an instance of Events', () => {
    const grape = new Grape({
      dht_port: 20000,
      api_port: 20001
    })

    assert(grape instanceof Events)
  })

  it('should accept callback on starting a grape', (done) => {
    const grape = new Grape({
      dht_port: 20002,
      api_port: 30000
    })

    grape.start((err) => {
      assert.ifError(err)

      grape.stop((err) => {
        assert.ifError(err)
        done()
      })
    })
  })

  it('calling stop on an unstarted Grape is fine', (done) => {
    const grape = new Grape({
      dht_port: 20000,
      api_port: 20001
    })

    grape.stop(done)
  })

  it('requires a port', (done) => {
    const grape = new Grape({
      dht_port: 20000
    })

    grape.start((err) => {
      assert.ok(err)
      grape.stop(done)
    })
  })

  it('keeps running on invalid put payload', (done) => {
    const grape = new Grape({
      dht_port: 20000,
      api_port: 20001
    })

    grape.start((err) => {
      if (err) throw err
      grape.put({ foo: 'bar' }, (err) => {
        assert.ok(err)
        grape.stop(done)
      })
    })
  })
})
