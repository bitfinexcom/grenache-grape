'use strict'

const test = require('brittle')
const {
  createGrapes,
  createTwoGrapes
} = require('./helper.js')

test('service announce', async (t) => {
  await t.test('should find services', { timeout: 5000 }, async (t) => {
    const { grape1, grape2, stop } = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('rest:util:net', 1337, () => {})
    })

    await new Promise(resolve => {
      grape2.on('announce', () => {
        grape2.lookup('rest:util:net', (err, res) => {
          t.is(err, null)
          t.alike(res, ['127.0.0.1:1337'])
          stop(resolve)
        })
      })
    })
  })

  await t.test('should remove outdated services', { timeout: 5000 }, async (t) => {
    const { grape1, grape2, stop } = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('rest:util:net', 1337, () => {})
    })

    await new Promise(resolve => {
      grape2.on('announce', () => {
        grape2.lookup('rest:util:net', (err, res) => {
          t.is(err, null)
          t.alike(res, ['127.0.0.1:1337'])
          setTimeout(lookup, 300)
        })
      })

      function lookup () {
        grape2.lookup('rest:util:net', (err, res) => {
          t.is(err, null)
          t.alike(res, [])
          stop(resolve)
        })
      }
    })
  })

  await t.test('should not cache dead peers when doing lookups', { timeout: 5000 }, async (t) => {
    let lookups = 0
    const { grape1, grape2, stop } = createTwoGrapes()

    await new Promise(resolve => {
      grape1.on('ready', () => {
        grape1.announce('test', 1337, () => {
          loop()

          function loop () {
            lookup((a, b) => {
              if (!a && !b) {
                t.ok(lookups > 10)
                stop(resolve)
                return
              }
              lookups++
              if (a) t.alike(a, '127.0.0.1:1337')
              if (b) t.alike(b, '127.0.0.1:1337')
              setTimeout(loop, 10)
            })
          }
        })
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

  await t.test('should not cache dead peers when another one is announcing', { timeout: 5000 }, async (t) => {
    let lookups = 0
    const { grape1, grape2, stop } = createTwoGrapes()

    await new Promise(resolve => {
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
                t.ok(lookups > 5)
                stop(resolve)
                return
              }
              lookups++
              t.ok(a.includes('127.0.0.1:2000'))
              t.ok(b.includes('127.0.0.1:2000'))
              t.ok(a.includes('127.0.0.1:2001'))
              t.ok(b.includes('127.0.0.1:2001'))
              setTimeout(loop, 10)
            })
          }
        })
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

  await t.test('should announce a simple service to lots of grapes', { timeout: 20000 }, async (t) => {
    await new Promise(resolve => {
      createGrapes(100, (grapes, stop) => {
        grapes[1].announce('B', 2000, (err) => {
          t.is(err, null)
          grapes[2].lookup('B', (err, l) => {
            t.is(err, null)
            t.alike(l, ['127.0.0.1:2000'])
            grapes[3].lookup('B', (err, l) => {
              t.is(err, null)
              t.alike(l, ['127.0.0.1:2000'])
              stop(resolve)
            })
          })
        })
      })
    })
  })

  await t.test('should work when services die and come back', { timeout: 20000 }, async (t) => {
    await new Promise(resolve => {
      createGrapes(4, (grapes, stop) => {
        const [g0, g1, g2, g3] = grapes
        const one = startAnnouncing(g0, 'A', 3000)
        let two

        g1.announce('B', 2000, (err) => {
          t.is(err, null)
          setTimeout(run, 100)
          let ticks = 0

          function run () {
            ticks++
            if (ticks === 1) {
              lookup((g2l, g3l) => {
                t.alike(g2l.A, ['127.0.0.1:3000'])
                t.alike(g3l.A, ['127.0.0.1:3000'])
                t.alike(g2l.B, ['127.0.0.1:2000'])
                t.alike(g3l.B, ['127.0.0.1:2000'])
                setTimeout(run, 100)
              })
              return
            }
            if (ticks === 6) {
              lookup((g2l, g3l) => {
                t.alike(g2l.A, ['127.0.0.1:3000'])
                t.alike(g3l.A, ['127.0.0.1:3000'])
                t.alike(g2l.B, [])
                t.alike(g3l.B, [])
                two = startAnnouncing(g1, 'B', 2000)
                setTimeout(run, 100)
              })
              return
            }
            if (ticks === 20) {
              lookup((g2l, g3l) => {
                t.alike(g2l.A, ['127.0.0.1:3000'])
                t.alike(g3l.A, ['127.0.0.1:3000'])
                t.alike(g2l.B, ['127.0.0.1:2000'])
                t.alike(g3l.B, ['127.0.0.1:2000'])
                clearInterval(one)
                clearInterval(two)
                setTimeout(_ => stop(resolve), 100)
              })
              return
            }
            setTimeout(run, 100)
          }
        })

        function lookup (onlookup) {
          let missing = 4
          const res = [{}, {}]

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
    })
  })

  await t.test('should work when services die and come back (lots of grapes)', { timeout: 20000 }, async (t) => {
    await new Promise(resolve => {
      createGrapes(40, (grapes, stop) => {
        const [g0, g1, g2, g3] = grapes
        const one = startAnnouncing(g0, 'A', 3000)
        let two

        g1.announce('B', 2000, (err) => {
          t.is(err, null)
          setTimeout(run, 100)
          let ticks = 0

          function run () {
            ticks++
            if (ticks === 1) {
              lookup((g2l, g3l) => {
                t.alike(g2l.A, ['127.0.0.1:3000'])
                t.alike(g3l.A, ['127.0.0.1:3000'])
                t.alike(g2l.B, ['127.0.0.1:2000'])
                t.alike(g3l.B, ['127.0.0.1:2000'])
                setTimeout(run, 100)
              })
              return
            }
            if (ticks === 6) {
              lookup((g2l, g3l) => {
                t.alike(g2l.A, ['127.0.0.1:3000'])
                t.alike(g3l.A, ['127.0.0.1:3000'])
                t.alike(g2l.B, [])
                t.alike(g3l.B, [])
                two = startAnnouncing(g1, 'B', 2000)
                setTimeout(run, 100)
              })
              return
            }
            if (ticks === 20) {
              lookup((g2l, g3l) => {
                t.alike(g2l.A, ['127.0.0.1:3000'])
                t.alike(g3l.A, ['127.0.0.1:3000'])
                t.alike(g2l.B, ['127.0.0.1:2000'])
                t.alike(g3l.B, ['127.0.0.1:2000'])
                clearInterval(one)
                clearInterval(two)
                setTimeout(_ => stop(resolve), 100)
              })
              return
            }
            setTimeout(run, 100)
          }
        })

        function lookup (onlookup) {
          let missing = 4
          const res = [{}, {}]

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
    })
  })
})

function startAnnouncing (grape, name, port) {
  return setInterval(_ => grape.announce(name, port), 20)
}
