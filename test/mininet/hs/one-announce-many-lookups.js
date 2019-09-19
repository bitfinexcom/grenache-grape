const tapenet = require('tapenet')
const spinup = require('./helpers/spinup')
const { 
  NODES = 102,
  RTS = 1000
} = process.env

const { 
  h1: announcer, 
  h2: bootstrapper, 
  ...lookups 
} = tapenet.topologies.basic(NODES)

tapenet(`1 bootstrap, 1 announcing, ${NODES - 2} lookup peers, ${RTS} lookups per peer`, (t) => {
  const state = { rts: +RTS }
  const scenario = [
    {
      containers: [announcer], 
      ready (t, peer, state, next) {
        const crypto = require('crypto')
        const topic = crypto.randomBytes(32)
        const { port } = peer.address()
        next(null, {...state, announcerPort: port, topic})
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
          peer.lookup(topic, (err, result) => {
            t.error(err, 'no lookup error')
            if (err) return
            const hasResult = result.length > 0
            t.is(hasResult, true, 'lookup has a result')
            if (hasResult === false) return
            const [{ peers }] = result
            t.is(peers[0].port, announcerPort, 'is announcer port')
            lookups(n - 1)
          })
        }
      }
    }
  ]
  spinup(NODES, {t, scenario, state, bs: [bootstrapper]})
})

