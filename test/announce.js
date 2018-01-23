/* eslint-env mocha */

'use strict'

const { Grape } = require('./../')
const assert = require('assert')

describe('service announce', () => {
  it('should find services', (done) => {
    const {grape1, grape2, stop} = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('rest:util:net', 1337, () => {})
    })

    grape2.on('announce', () => {
      grape2.lookup('rest:util:net', (err, res) => {
        assert.equal(err, null)
        assert.deepEqual(res, [ '127.0.0.1:1337' ])
        stop(done)
      })
    })
  }).timeout(5000)

  it('should remove outdated services', (done) => {
    const {grape1, grape2, stop} = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('rest:util:net', 1337, () => {})
    })

    grape2.on('announce', () => {
      grape2.lookup('rest:util:net', (err, res) => {
        assert.equal(err, null)
        assert.deepEqual(res, [ '127.0.0.1:1337' ])
        setTimeout(lookup, 150)
      })
    })

    function lookup () {
      grape2.lookup('rest:util:net', (err, res) => {
        assert.equal(err, null)
        assert.deepEqual(res, [])
        stop(done)
      })
    }
  }).timeout(5000)

  it('should not cache dead peers when doing lookups', (done) => {
    let lookups = 0
    const {grape1, grape2, stop} = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('test', 1337, () => {
        loop()

        function loop () {
          lookup((a, b) => {
            if (!a && !b) {
              assert(lookups > 10)
              stop(done)
              return
            }
            lookups++
            if (a) assert.deepEqual(a, '127.0.0.1:1337')
            if (b) assert.deepEqual(b, '127.0.0.1:1337')
            setTimeout(loop, 5)
          })
        }
      })
    })

    function lookup (cb) {
      grape1.lookup('test', (_, a) => {
        grape2.lookup('test', (_, b) => {
          cb(a[0], b[0])
        })
      })
    }
  })
})

function createTwoGrapes () {
  const grape1 = new Grape({
    dht_port: 20002,
    dht_bootstrap: [ '127.0.0.1:20001' ],
    api_port: 40001,
    dht_peer_maxAge: 100
  })

  grape1.start(() => {})

  const grape2 = new Grape({
    dht_port: 20001,
    dht_bootstrap: [ '127.0.0.1:20002' ],
    api_port: 30002,
    dht_peer_maxAge: 100
  })

  grape2.start(() => {})

  return {grape1, grape2, stop}

  function stop (done) {
    grape1.stop(_ => {
      grape2.stop(_ => {
        done()
      })
    })
  }
}
