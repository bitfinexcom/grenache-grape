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

tapenet(`${NODES - 2} non-ephemeral peers, 20 peers announcing same topic, 1 ephemeral lookup peer, ${RTS} lookups, unannounce on one peer, ${RTS} lookups`, (t) => {
 
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
        // only ever announcing on 20 nodes
        if (state.$index >= 20) {
          next(null, state)
          return
        }
        const { $shared, $index } = state
        const { port } = peer.address()
        $shared.cfg[$index] = {host: ip, port}
        next(null, state)
      },
      run (t, peer, { topic, $index }, done) {
        // only ever announcing on 20 nodes
        if ($index >= 20) {
          done()
          return
        }
        // unannounce on the first node when triggered
        if ($index === 0) {
          tapenet.on('unannounce', () => {
            peer.unannounce(topic, (err) => {
              if (err) throw err
              const { port } = peer.address()
              const host = ip
              tapenet.emit('unannounced', {host, port})
            })
          })
        }
        peer.announce(topic, (err) => {
          t.error(err, 'no announce error')
          done()
        })
      }
    },
    { 
      containers: [lookup],
      options: { ephemeral: true },
      run (t, peer, { rts, topic }, done) {
        const started = Date.now()
        lookups(rts)
        let unannounced = false
        function lookups (n, expectToExclude) {
          if (n === 0) {
            if (unannounced === false) {
              tapenet.emit('unannounce')
              tapenet.on('unannounced', (expectToExclude) => {
                unannounced = true
                lookups(rts, expectToExclude) // run it again
              })
              return
            }
            t.pass(`${rts} round trips took ${Date.now() - started} ms`)
            done()
            return
          }
          peer.lookup(topic, (err, result) => {
            t.error(err, 'no lookup error')
            if (err) return
            const hasResult = result.length > 0
            t.is(hasResult, true, 'lookup has a result')
            if (hasResult === false) return
            if (expectToExclude) { 
              const { host, port } = expectToExclude
              const match = result.some(({node}) => {
                return node.port === port && node.host === host
              })
              t.is(match, false, 'lookup result does not contain unannounced peer')
            }
            lookups(n - 1)
          })
        }
      }
    }
  ]
  spinup(NODES, {t, scenario, state, bs: [bootstrapper]})
  
})
