
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
        const value = crypto.randomBytes(32).toString('hex')
        const sig = hypersign.sign(Buffer.from(value), {
          keypair
        })
        next(null, { ...state, key, value, sig })
      },
      run (t, peer, { key, value, sig }, done) {
        peer.put({ k: key, v: value, sig }, (err, key) => {
          t.error(err, 'no announce error')
          done()
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
          peer.get({ key }, (err, { v }) => {
            t.error(err, 'no get error')
            if (err) return
            t.is(v, value)
            gets(n - 1)
          })
        }
      }
    }
  ]
  spinup(NODES, { t, scenario, state, bs: [bootstrapper] })
})
