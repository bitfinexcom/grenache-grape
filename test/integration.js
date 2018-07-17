/* eslint-env mocha */

'use strict'

const assert = require('assert')
const { Grape } = require('./../')

const {
  addGrape
} = require('./helper.js')

describe('Grape integration', () => {
  it('should emit a ready event', (done) => {
    const grape1 = new Grape({
      dht_port: 20002,
      dht_bootstrap: [ '127.0.0.1:20001' ],
      api_port: 40001
    })

    grape1.start(() => {})

    const grape2 = new Grape({
      dht_port: 20001,
      dht_bootstrap: [ '127.0.0.1:20002' ],
      api_port: 30002
    })

    grape2.start(() => {})

    grape1.on('ready', () => {
      grape1.stop()
      grape2.stop()
      done()
    })
  }).timeout(5000)

  it('bootstraps to at least one known node', done => { // see line 25 in helper.js
    addGrape(run, done)
  }).timeout(5000)
})

function run (grapes, grape, stop, done) {
  var count1 = 0
  var count2 = 0

  grape.on('ready', () => {
    grapes[0].announce('public:trade:bitfinex', 1337, () => {})
    grapes[1].announce('public:trade:bitstamp', 1338, () => {})
  })
  grape.on('announce', () => {
    grape.lookup('public:trade:bitfinex', (e, r) => {
      assert.equal(e, null)
      assert.deepEqual(r, [ '127.0.0.1:1337' ])
      ++count1 === 2 && count2 === 2 && stop(done)
    })
    grape.lookup('public:trade:bitstamp', (e, r) => {
      assert.equal(e, null)
      assert.deepEqual(r, [ '127.0.0.1:1338' ])
      count1 === 2 && ++count2 === 2 && stop(done)
    })
  })
}
