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

  /**
   * This test demonstrates a simple way to create a Kademlia cloud of nodes
   * and to grow it as needed. The first node in the cloud (the known node) does
   * not bootstrap, since there are no more nodes to bootstrap to at the moment.
   * The second and all subsequent nodes bootstrap to the known node. All they
   * know before joining the cloud is the IP address and the port number of the
   * known node. As they join the cloud, they learn about each other.
   */
  it('bootstraps to at least one known node', done => { // see line 25 in helper.js
    addGrape(run, done)
  }).timeout(5000)
})
/**
 * Test the Kademlia cloud by announcing two services, 'public:trade:bitfinex'
 * and 'public:trade:bitstamp', on the first two nodes of the cloud, and making
 * sure both services are found by the third node.
 *
 * @param    {Array} grapes - all the grapes (3) in the cloud
 * @param   {Object} grape - the grape we just added
 * @param {Function} stop - function to call to stop the grapes
 * @param {Function} done - function to call to end the test
 */
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
