
'use strict'
const tapenet = require('tapenet')
const spinup = require('./helpers/spinup')
const {
  NODES = 252,
  RTS = 1000
} = process.env

const topology = tapenet.topologies.basic(NODES)
const { h1: bootstrapper, ...rest } = topology
const nodes = spinup.arrarify(rest)
const putters = nodes.slice(0, nodes.length / 2)
const getters = nodes.slice(nodes.length / 2)

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
        const hypersign = require('@hyperswarm/hypersign')
        const keypair = hypersign.keypair()
        const { publicKey: key } = keypair
        const value = crypto.randomBytes(32).toString('hex')
        const { $shared, $index } = state
        $shared.kv[$index] = { key, value }
        next(null, { ...state, keypair, value })
      },
      run (t, peer, { keypair, value }, done) {
        peer.mutable.put(value, { keypair }, (err) => {
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
          peer.mutable.get(key, (err, result) => {
            t.error(err, 'no get error')
            if (err) return
            t.is(result.value, value)
            gets(n - 1)
          })
        }
      }
    }
  ]
  spinup(NODES, { t, scenario, state, bs: [bootstrapper] })
})
