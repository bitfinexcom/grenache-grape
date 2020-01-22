
'use strict'
const tapenet = require('tapenet')
const spinup = require('./helpers/spinup')
const {
  NODES = 251,
  RTS = 1000
} = process.env

const topology = tapenet.topologies.basic(NODES)
const { h1: bootstrapper, ...rest } = topology
const nodes = spinup.arrarify(rest)
const putters = nodes.slice(0, Math.ceil(nodes.length / 2))
const getters = nodes.slice(
  putters.length,
  putters.length + Math.floor(nodes.length / 2)
)

tapenet(`1 mutable put peer, ${NODES - 2} mutable get peers, ${RTS} gets per peer`, (t) => {
  const state = {
    rts: +RTS,
    putterCount: putters.length,
    $shared: {
      kv: {}
    }
  }
  const scenario = [
    {
      containers: putters,
      ready (t, peer, state, next) {
        const crypto = require('crypto')
        const hypersign = require('@hyperswarm/hypersign')()
        const keypair = hypersign.keypair()
        const { publicKey: key } = keypair
        const value = crypto.randomBytes(32).toString('hex')
        const { $shared, $index } = state
        const sig = hypersign.sign(Buffer.from(value), {
          keypair
        })
        $shared.kv[$index] = { sig, key, value }
        next(null, { ...state, key, value, sig })
      },
      run (t, peer, { key, value, sig }, done) {
        peer.put({ k: key, v: value, sig }, (err) => {
          t.error(err, 'no announce error')
          done()
        })
      }
    },
    {
      containers: getters,
      options: { ephemeral: false },
      run (t, peer, { rts, $shared, $index }, done) {
        const { key, value } = $shared.kv[$index]
        const started = Date.now()
        gets(rts)
        function gets (n) {
          if (n === 0) {
            t.pass(`${rts} round trips took ${Date.now() - started} ms`)
            done()
            return
          }
          peer.get({ key }, (err, { v } = {}) => {
            try {
              t.error(err, 'no get error')
              if (err) return
              t.is(v, value)
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
