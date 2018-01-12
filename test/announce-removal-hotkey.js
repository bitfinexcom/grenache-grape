/* eslint-env mocha */

'use strict'

const { Grape } = require('./../')
const assert = require('assert')

describe('service announces - mixed lookups and killed worker', () => {
  it('should remove outdated services after ~100ms', (done) => {
    const grape1 = new Grape({
      dht_port: 20002,
      dht_bootstrap: [ '127.0.0.1:20001' ],
      api_port: 40001,
      dht_peer_maxAge: 100
    })

    const grape2 = new Grape({
      dht_port: 20001,
      dht_bootstrap: [ '127.0.0.1:20002' ],
      api_port: 30002,
      dht_peer_maxAge: 100
    })

    grape1.start(() => {})
    grape2.start(() => {})

    let ts
    grape1.on('grape-ready', () => {
      // announce 1 time, then stop announcing to simulate crashed worker
      grape1.announce('rest:util:net', 1337, () => {
        ts = Date.now()
      })
    })

    grape2.on('announce', () => {
      // clients keep doing lookups
      doPeriodicLookup()
    })

    let inter
    let removed = 0

    function doPeriodicLookup () {
      inter = setTimeout(() => {

        if (removed === 2) {
          assert.equal(removed, 2, 'worker removed from both grapes')
          clearTimeout(inter)
          grape1.stop(() => { grape2.stop(done) })
          return
        }

        grape1.lookup('rest:util:net', (_, res) => {
          //console.log('grape1:', res, 'ms:', Date.now() - ts)
          if (!res.length) {
            removed++
            return
          }

          assert.deepEqual(res, [ '127.0.0.1:1337' ])
          doPeriodicLookup()
        })
        grape2.lookup('rest:util:net', (_, res) => {
          //console.log('grape2:', res, 'ms:', Date.now() - ts)
          if (!res.length) {
            removed++
            return
          }

          assert.deepEqual(res, [ '127.0.0.1:1337' ])
        })
      }, 25)
    }
  }).timeout(5000)
})
