'use strict'
const tapenet = require('tapenet')
const spinup = require('./helpers/spinup')
const {
  NODES = 252,
  RTS = 1000
} = process.env

const {
  h1: announcer,
  h2: bootstrapper,
  ...lookups
} = tapenet.topologies.basic(NODES)

tapenet(`1 announcing peer, ${NODES - 2} lookup peers, ${RTS} lookups per peer`, (t) => {
  const state = { rts: +RTS }
  const scenario = [
    {
      containers: [announcer],
      ready (t, peer, state, next) {
        const crypto = require('crypto')
        const topic = crypto.randomBytes(32).toString('hex')
        const { port } = peer.address()
        next(null, { ...state, announcerPort: port, topic })
      },
      run (t, peer, { topic }, done) {
        peer.announce(topic, (err) => {
          t.error(err, 'no announce error')
          done()
        })
      }
    },
    {
      containers: lookups,
      options: { ephemeral: false },
      run (t, peer, { rts, topic, announcerPort }, done) {
        const started = Date.now()
        lookups(rts)
        function lookups (n) {
          if (n === 0) {
            t.pass(`${rts} round trips took ${Date.now() - started} ms`)
            done()
            return
          }
          peer.lookup(topic, (err, peers) => {
            t.error(err, 'no lookup error')
            if (err) return
            const hasResult = peers.length > 0
            t.is(hasResult, true, 'lookup has a result')
            if (hasResult === false) return
            t.is(peers[0].split(':')[1], announcerPort, 'is announcer port')
            lookups(n - 1)
          })
        }
      }
    }
  ]
  spinup(NODES, { t, scenario, state, bs: [bootstrapper] })
})
