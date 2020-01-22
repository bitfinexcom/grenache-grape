/* global ip */
'use strict'
const tapenet = require('tapenet')
const spinup = require('./helpers/spinup')
const crypto = require('crypto')

const {
  NODES = 252,
  RTS = 1000
} = process.env

const topology = tapenet.topologies.basic(NODES)
const { h1: lookup, h2: bootstrapper, ...announcers } = topology

tapenet(`1 lookup peer, ${NODES - 2} announcing peers, ${RTS} lookups, same topic`, (t) => {
  const state = {
    rts: +RTS,
    topic: crypto.randomBytes(32),
    $shared: {
      cfg: {}
    }
  }
  const scenario = [
    {
      containers: announcers,
      ready (t, peer, state, next) {
        const { $shared, $index } = state
        const { port } = peer.address()
        $shared.cfg[$index] = { host: ip, port }
        next(null, state)
      },
      run (t, peer, { topic }, done) {
        peer.announce(topic, (err) => {
          try {
            t.error(err, 'no announce error')
          } finally {
            done()
          }
        })
      }
    },
    {
      containers: [lookup],
      options: { ephemeral: false },
      run (t, peer, { rts, topic, bootstrap, $shared }, done) {
        const { cfg } = $shared
        const started = Date.now()
        lookups(rts)
        function lookups (n) {
          if (n === 0) {
            t.pass(`${rts} round trips took ${Date.now() - started} ms`)
            done()
            return
          }
          peer.lookup(topic, (err, result) => {
            try {
              t.error(err, 'no lookup error')
              if (err) return
              const hasResult = result.length > 0
              t.is(hasResult, true, 'lookup has a result')
              if (hasResult === false) return

              const expected = new Set([
                ...bootstrap,
                ...Object.values(cfg).map(({ host, port }) => {
                  return `${host}:${port}`
                })
              ])

              const peersMatch = result.every(({ node, peers }) => {
                const { host, port } = node
                return expected.has(`${host}:${port}`) && peers.every(({ host, port }) => {
                  return expected.has(`${host}:${port}`)
                })
              })
              t.ok(peersMatch, 'peers match')
            } finally {
              lookups(n - 1)
            }
          })
        }
      }
    }
  ]
  spinup(NODES, { t, scenario, state, bs: [bootstrapper] })
})
