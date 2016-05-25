'use strict'

var assert = require('chai').assert;

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
})