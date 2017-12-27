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

  it('timeslot returns the same for immediate calls', (done) => {
    const grape = new Grape({
      dht_port: 20000,
      api_port: 20001
    })

    const now = Date.now()

    const ts1 = grape.timeslot(0, now)
    const ts2 = grape.timeslot(0, now)
    assert.equal(ts1, ts2)

    const ts3 = grape.timeslot(-1, now)
    const ts4 = grape.timeslot(-1, now)
    assert.equal(ts3, ts4)
    done()
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
        done()
      })
    })
  })
})
