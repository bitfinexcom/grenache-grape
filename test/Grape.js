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

  describe('lookup', () => {
    it('start is implicitly called', (done) => {
      var grape = new Grape({dht_port: 20000, api_port: 20001, dht_bootstrap: ['127.0.0.1:20000']})

      grape.announce('test', 1000, (err, result) => {
        assert.ifError(err)

        grape.lookup('test', function (err, result) {
          assert.ifError(err)
          assert.equal('tcp://127.0.0.1:1000', result)
          grape.stop(done)
        })
      })
    })

    // TODO: confirm we can enforce value is always a string rule
    it.skip('errors when invalid value is passed', (done) => {
      var grape = new Grape({dht_port: 20000, api_port: 20001, dht_bootstrap: ['127.0.0.1:20000']})
      grape.lookup(false, (err) => {
        assert.ok(err instanceof Error)
        grape.stop(done)
      })
    })
  })

  describe('errors', () => {
    it('should error when api_port is already in use', (done) => {
      var grape1 = new Grape({
        dht_port: 20000,
        api_port: 20001
      })

      var grape2 = new Grape({
        dht_port: 30000,
        api_port: 20001 // same
      })

      grape1.start((err) => {
        assert.ifError(err)
        grape2.start((err) => {
          assert.ok(err instanceof Error)
          assert.equal('EADDRINUSE', err.code)
          grape1.stop(done)
        })
      })
    })

    it('should error when dht_port is already in use', (done) => {
      var grape1 = new Grape({
        dht_port: 20000,
        api_port: 20001
      })

      var grape2 = new Grape({
        dht_port: 20000, // same
        api_port: 30000
      })

      grape1.start((err) => {
        assert.ifError(err)
        grape2.start((err) => {
          assert.ok(err instanceof Error)
          assert.equal('EADDRINUSE', err.code)
          grape1.stop(done)
        })
      })
    })
  })
})
