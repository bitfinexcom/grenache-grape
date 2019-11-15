
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

tapenet(`1 mutable put peer, ${NODES - 2} mutable get peers, ${RTS} gets per peer`, (t) => {
  const state = {
    rts: +RTS
  }
  const scenario = [
    {
      containers: [putter],
      ready (t, peer, state, next) {
        const crypto = require('crypto')
        const hypersign = require('@hyperswarm/hypersign')()
        const keypair = hypersign.keypair()
        const { publicKey: key } = keypair
        const value = crypto.randomBytes(32)
        next(null, { ...state, key, keypair, value })
      },
      run (t, peer, { keypair, value }, done) {
        peer.mutable.put(value, { keypair }, (err) => {
          try {
            t.error(err, 'no announce error')
          } finally {
            done()
          }
        })
      }
    },
    {
      containers: getters,
      options: { ephemeral: false },
      run (t, peer, { rts, key, value }, done) {
        const started = Date.now()
        gets(rts)
        function gets (n) {
          if (n === 0) {
            t.pass(`${rts} round trips took ${Date.now() - started} ms`)
            done()
            return
          }
          peer.mutable.get(key, (err, result) => {
            try {
              t.error(err, 'no get error')
              if (err) return
              t.is(value.equals(result.value), true)
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
