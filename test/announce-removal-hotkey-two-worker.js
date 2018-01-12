/* eslint-env mocha */

'use strict'

const { Grape } = require('./../')
const assert = require('assert')

// tests a setup with two grapes
// initally two worker announce their rest service
// and a client does periodic lookups for the service key
// just one worker continues to announe to simulate a crashed worker
// we test that the "crashed" worker is removed in this case

describe('service announces - mixed lookups and 1 worker from 2 killed', () => {
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
    let interAnnounceSameKey
    grape1.on('grape-ready', () => {
      // announce 1 time, then stop announcing to simulate crashed worker
      grape1.announce('rest:util:net', 1337, () => {
        ts = Date.now()
      })

      grape1.announce('rest:util:net', 1338, () => {})
      interAnnounceSameKey = startPeriodicAnnounce()
      function startPeriodicAnnounce () {
        return setTimeout(() => {
          grape1.announce('rest:util:net', 1338, startPeriodicAnnounce)
        }, 25)
      }
    })

    let cnt = 0
    grape2.on('announce', () => {
      cnt++
      if (cnt !== 2) return

      grape2.lookup('rest:util:net', (_, res) => {
        assert.equal(res.length, 2, 'both worker there')

        // clients keep doing lookups
        doPeriodicLookup()
      })
    })

    let inter
    function doPeriodicLookup () {
      inter = setTimeout(() => {
        grape2.lookup('rest:util:net', (_, res) => {
          //console.log('grape2:', res, 'ms:', Date.now() - ts)
          if (res.length === 2) {
            return doPeriodicLookup()
          }

          if (res.length === 1) {
            assert.equal(res.length, 1, 'worker removed')

            clearTimeout(inter)
            clearTimeout(interAnnounceSameKey)
            grape1.stop(() => { grape2.stop(done) })
          }
        })
      }, 25)
    }
  }).timeout(5000)
})
