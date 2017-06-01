/* eslint-env mocha */

'use strict'

var assert = require('chai').assert

var Events = require('events')

var Grape = require('./../lib/Grape')

describe('Grape', () => {
  it('should be an instance of Events', () => {
    var grape = new Grape({
      dht_port: 20000,
      api_port: 20001
    })

    assert(grape instanceof Events)
  })

  it('should accept callback on starting a grape', (done) => {
    var grape = new Grape({
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
    var grape = new Grape({
      dht_port: 20000,
      api_port: 20001
    })

    grape.stop(done)
  })

  it('timeslot returns the same for immediate calls', (done) => {
    var grape = new Grape({
      dht_port: 20000,
      api_port: 20001
    })

    var now = Date.now()

    var ts1 = grape.timeslot(0, now)
    var ts2 = grape.timeslot(0, now)
    assert.equal(ts1, ts2)

    var ts3 = grape.timeslot(-1, now)
    var ts4 = grape.timeslot(-1, now)
    assert.equal(ts3, ts4)
    done()
  })

  describe('lookup', () => {
    // TODO: confirm we can enforce value is always a string rule
    it.skip('errors when invalid value is passed', (done) => {
      var grape = new Grape({dht_port: 20000, api_port: 20001, dht_bootstrap: ['127.0.0.1:20000']})
      grape.lookup(false, (err) => {
        assert.ok(err instanceof Error)
        grape.stop(done)
      })
    })
  })
})
