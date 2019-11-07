'use strict'
const tapenet = require('tapenet')
const spinup = require('./helpers/spinup')
const {
  NODES = 252,
  RTS = 1000
} = process.env

const {
  h1: putter,
  h2: bootstrapper,
  ...getters
} = tapenet.topologies.basic(NODES)

tapenet(`1 immutable put peer, ${NODES - 2} immutable get peers, ${RTS} gets per peer`, (t) => {
  const state = {
    rts: +RTS,
    $shared: {}
  }
  const scenario = [
    {
      containers: [putter],
      ready (t, peer, state, next) {
        const crypto = require('crypto')
        const value = crypto.randomBytes(32)
        next(null, { ...state, value })
      },
      run (t, peer, { value, $shared }, done) {
        peer.immutable.put(value, (err, key) => {
          try { 
            t.error(err, 'no announce error')
          } finally {
            $shared.key = key
            done()
          }
        })
      }
    },
    {
      containers: getters,
      options: { ephemeral: false },
      run (t, peer, { rts, value, $shared }, done) {
        const started = Date.now()
        gets(rts)
        function gets (n) {
          if (n === 0) {
            t.pass(`${rts} round trips took ${Date.now() - started} ms`)
            done()
            return
          }
          peer.immutable.get($shared.key, (err, v) => {
            try { 
              t.error(err, 'no get error')
              if (err) return
              t.is(value.equals(v), true)
            } finally {
              gets(n - 1)
            }
          })
        }
      }
    }
  ]
  spinup(NODES, { t, scenario, state, bs: [bootstrapper] })
})
