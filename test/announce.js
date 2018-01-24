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

  it('should not cache dead peers when another one is announcing', (done) => {
    let lookups = 0
    const {grape1, grape2, stop} = createTwoGrapes()

    grape1.on('ready', () => {
      const one = startAnnouncing(grape1, 'test', 2000)
      const two = startAnnouncing(grape2, 'test', 2001)
      grape1.announce('test', 1337, () => {
        setTimeout(loop, 50)
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
            setTimeout(loop, 5)
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

  it('should work when services die and come back', function (done) {
    createGrapes(4, (grapes, stop) => {
      const [g0, g1, g2, g3] = grapes
      const one = startAnnouncing(g0, 'A', 3000)
      let two

      g1.announce('B', 2000, () => {
        setTimeout(run, 50)
        let ticks = 0

        function run () {
          ticks++
          if (ticks === 1) {
            lookup((g2l, g3l) => {
              assert.deepEqual(g2l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g3l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g2l.B, ['127.0.0.1:2000'])
              assert.deepEqual(g3l.B, ['127.0.0.1:2000'])
              setTimeout(run, 50)
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
              setTimeout(run, 50)
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
          setTimeout(run, 50)
        }
      })

      function lookup (onlookup) {
        g2.lookup('A', (_, g2a) => {
          g2.lookup('B', (_, g2b) => {
            g3.lookup('A', (_, g3a) => {
              g3.lookup('B', (_, g3b) => {
                onlookup({A: g2a, B: g2b}, {A: g3a, B: g3b})
              })
            })
          })
        })
      }
    })
  }).timeout(20000)

  it('should work when services die and come back (lots of grapes)', function (done) {
    createGrapes(100, (grapes, stop) => {
      const [g0, g1, g2, g3] = grapes
      const one = startAnnouncing(g0, 'A', 3000)
      let two

      g1.announce('B', 2000, () => {
        setTimeout(run, 50)
        let ticks = 0

        function run () {
          ticks++
          if (ticks === 1) {
            lookup((g2l, g3l) => {
              assert.deepEqual(g2l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g3l.A, ['127.0.0.1:3000'])
              assert.deepEqual(g2l.B, ['127.0.0.1:2000'])
              assert.deepEqual(g3l.B, ['127.0.0.1:2000'])
              setTimeout(run, 50)
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
              setTimeout(run, 50)
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
          setTimeout(run, 50)
        }
      })

      function lookup (onlookup) {
        g2.lookup('A', (_, g2a) => {
          g2.lookup('B', (_, g2b) => {
            g3.lookup('A', (_, g3a) => {
              g3.lookup('B', (_, g3b) => {
                onlookup({A: g2a, B: g2b}, {A: g3a, B: g3b})
              })
            })
          })
        })
      }
    })
  }).timeout(20000)
})

function startAnnouncing (grape, name, port) {
  return setInterval(_ => grape.announce(name, port), 20)
}

function createGrapes (n, onstart) {
  const grapes = []
  let missing = n

  for (let i = 0; i < n; i++) {
    const grape = new Grape({
      dht_port: 20001 + i,
      dht_bootstrap: [ '127.0.0.1:' + (20001 + (i + 1) % 2) ],
      api_port: 40001 + i,
      dht_peer_maxAge: 100
    })

    grape.start(() => {
      if (--missing) return
      if (onstart) onstart(grapes, stop)
    })
    grapes.push(grape)
  }

  return grapes

  function stop (done) {
    loop()

    function loop () {
      if (!grapes.length) return done()
      grapes.pop().stop(loop)
    }
  }
}

function createTwoGrapes () {
  const [grape1, grape2] = createGrapes(2)
  return {grape1, grape2, stop}

  function stop (done) {
    grape1.stop(_ => {
      grape2.stop(_ => {
        done()
      })
    })
  }
}
