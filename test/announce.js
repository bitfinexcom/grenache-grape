/* eslint-env mocha */

'use strict'

const { Grape } = require('./../')
const assert = require('assert')

describe('service announce', () => {
  it('should find services', (done) => {
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
      grape1.announce('rest:util:net', 1337, () => {})
    })

    grape2.on('announce', () => {
      grape2.lookup('rest:util:net', (err, res) => {
        assert.equal(err, null)
        assert.deepEqual(res, [ '127.0.0.1:1337' ])
        grape2.stop(() => { grape1.stop(done) })
      })
    })
  }).timeout(5000)
})
