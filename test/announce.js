/* eslint-env mocha */

'use strict'

const assert = require('assert')
const {
  createGrapes,
  createTwoGrapes
} = require('./helper.js')


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
        setTimeout(lookup, 300)
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
            setTimeout(loop, 10)
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

  it('should not cache dead peers when another one is announcing', (done) => {
    let lookups = 0
    const {grape1, grape2, stop} = createTwoGrapes()

    grape1.on('ready', () => {
      const one = startAnnouncing(grape1, 'test', 2000)
      const two = startAnnouncing(grape2, 'test', 2001)
      grape1.announce('test', 1337, () => {
        setTimeout(loop, 100)
        const dead = '127.0.0.1:1337'

        function loop () {
          lookup((a, b) => {
            if (!a.includes(dead) && !b.includes(dead)) {
              clearInterval(one)
              clearInterval(two)
              assert(lookups > 5)
              stop(done)
              return
            }
            lookups++
            assert(a.includes('127.0.0.1:2000'))
            assert(b.includes('127.0.0.1:2000'))
            assert(a.includes('127.0.0.1:2001'))
            assert(b.includes('127.0.0.1:2001'))
            setTimeout(loop, 10)
          })
        }
      })
    })

    function lookup (onlookup) {
      grape1.lookup('test', (_, a) => {
        grape2.lookup('test', (_, b) => {
          onlookup(a, b)
        })
      })
    }
  })

  it('should announce a simple service to lots of grapes', (done) => {
    createGrapes(100, (grapes, stop) => {
      grapes[1].announce('B', 2000, (err) => {
        assert.equal(err, null)
        grapes[2].lookup('B', (err, l) => {
          assert.equal(err, null)
          assert.deepEqual(l, ['127.0.0.1:2000'])
          grapes[3].lookup('B', (err, l) => {
            assert.equal(err, null)
            assert.deepEqual(l, ['127.0.0.1:2000'])
            stop(done)
          })
        })
      })
    })
  }).timeout(20000)

  it('should work when services die and come back', (done) => {
    createGrapes(4, (grapes, stop) => {
      const [g0, g1, g2, g3] = grapes
      const one = startAnnouncing(g0, 'A', 3000)
      let two

      g1.announce('B', 2000, (err) => {
        assert.equal(err, null)
        setTimeout(run, 100)
        let ticks = 0

        function run () {
          ticks++
          if (ticks === 1) {
            lookup((g2l, g3l) => {
              assert.deepEqual(g2l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g3l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g2l.B, ['127.0.0.1:2000'])
              assert.deepEqual(g3l.B, ['127.0.0.1:2000'])
              setTimeout(run, 100)
            })
            return
          }
          if (ticks === 6) {
            lookup((g2l, g3l) => {
              assert.deepEqual(g2l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g3l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g2l.B, [])
              assert.deepEqual(g3l.B, [])
              two = startAnnouncing(g1, 'B', 2000)
              setTimeout(run, 100)
            })
            return
          }
          if (ticks === 20) {
            lookup((g2l, g3l) => {
              assert.deepEqual(g2l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g3l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g2l.B, ['127.0.0.1:2000'])
              assert.deepEqual(g3l.B, ['127.0.0.1:2000'])
              clearInterval(one)
              clearInterval(two)
              setTimeout(_ => stop(done), 100)
            })
            return
          }
          setTimeout(run, 100)
        }
      })

      function lookup (onlookup) {
        let missing = 4
        let res = [{}, {}]

        get(g2, 'A')
        get(g2, 'B')
        get(g3, 'A')
        get(g3, 'B')

        function get (grape, name) {
          grape.lookup(name, (_, l) => {
            res[grape === g2 ? 0 : 1][name] = l
            if (!--missing) onlookup(res[0], res[1])
          })
        }
      }
    })
  }).timeout(20000)

  it('should work when services die and come back (lots of grapes)', (done) => {
    createGrapes(100, (grapes, stop) => {
      const [g0, g1, g2, g3] = grapes
      const one = startAnnouncing(g0, 'A', 3000)
      let two

      g1.announce('B', 2000, (err) => {
        assert.equal(err, null)
        setTimeout(run, 100)
        let ticks = 0

        function run () {
          ticks++
          if (ticks === 1) {
            lookup((g2l, g3l) => {
              assert.deepEqual(g2l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g3l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g2l.B, ['127.0.0.1:2000'])
              assert.deepEqual(g3l.B, ['127.0.0.1:2000'])
              setTimeout(run, 100)
            })
            return
          }
          if (ticks === 6) {
            lookup((g2l, g3l) => {
              assert.deepEqual(g2l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g3l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g2l.B, [])
              assert.deepEqual(g3l.B, [])
              two = startAnnouncing(g1, 'B', 2000)
              setTimeout(run, 100)
            })
            return
          }
          if (ticks === 20) {
            lookup((g2l, g3l) => {
              assert.deepEqual(g2l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g3l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g2l.B, ['127.0.0.1:2000'])
              assert.deepEqual(g3l.B, ['127.0.0.1:2000'])
              clearInterval(one)
              clearInterval(two)
              setTimeout(_ => stop(done), 100)
            })
            return
          }
          setTimeout(run, 100)
        }
      })

      function lookup (onlookup) {
        let missing = 4
        let res = [{}, {}]

        get(g2, 'A')
        get(g2, 'B')
        get(g3, 'A')
        get(g3, 'B')

        function get (grape, name) {
          grape.lookup(name, (_, l) => {
            res[grape === g2 ? 0 : 1][name] = l
            if (!--missing) onlookup(res[0], res[1])
          })
        }
      }
    })
  }).timeout(20000)
})

function startAnnouncing (grape, name, port) {
  return setInterval(_ => grape.announce(name, port), 20)
}
