'use strict'
const tapenet = require('tapenet')
const spinup = require('./helpers/spinup')
const { 
  NODES = 253,
  RTS = 1000
} = process.env

const { 
  h1: bootstrapper, 
  h2: rpcServer,
  h3: rpcClient,
  h4: server,
  h5: client,
  ...horde 
} = tapenet.topologies.basic(NODES)

tapenet(`1 cross-linked announcing server, 1 cross-linked lookup client, ${NODES} grapes, ${RTS} lookups`, (t) => {
  const state = { rts: +RTS }
  const scenario = [
    {
      containers: horde,
      options: { dht_ephemeral: false },
    },
    {
      containers: [server],
      options: { api_port: 40001, dht_ephemeral: false },
      ready(t, _, state, next) {
        next(null, {...state, serverHost: ip})
      }
    },
    {
      containers: [client],
      options: { api_port: 40001, dht_ephemeral: false },
      ready(t, _, state, next) {
        next(null, {...state, clientHost: ip})
      }
    },
    {
      containers: [rpcServer],
      grapeless: true,
      ready(t, _, state, next) {
        const crypto = require('crypto')
        const topic = crypto.randomBytes(32).toString('base64')
        next(null, {...state, topic})
      },
      run (t, _, { topic, serverHost }, done) {
        
        const { PeerRPCServer } = require('grenache-nodejs-http')
        const Link = require('grenache-nodejs-link')
        
        const link = new Link({ grape: `http://${serverHost}:40001` })
        link.start()

        const srv = new PeerRPCServer(link, {})
        srv.init()

        const service = srv.transport('server')
        service.listen(5000)

        service.on('request', (rid, key, payload, handler) => {
          handler.reply(null, payload + ': world')
        })
        link.startAnnouncing(topic, service.port, { timeout: 20000 }, (err) => {
          t.error(err, 'no announce error')
          done()
        })
      }
    },
    { 
      containers: [rpcClient],
      grapeless: true,
      run (t, peer, { rts, topic, clientHost }, done) {
        const { PeerRPCClient } = require('grenache-nodejs-http')
        const Link = require('grenache-nodejs-link')
        const link = new Link({ grape: `http://${clientHost}:40001` })
        link.start()
        const client = new PeerRPCClient(link, {})
        client.init()
        const expected = []
        const actual = []
        const started = Date.now()
        requests(rts)
        function requests (n) {
          if (n === 0) {
            t.same(actual, expected, 'correct data returned in correct order')
            t.pass(`${rts} round trips took ${Date.now() - started} ms`)
            done()
            return
          }

          const payload = 'hello-' + n
          expected.push(payload + ': world')
          // clear the cache every time 
          // otherwise we're only testing the cache
          link.cache = {}
          client.request(topic, payload, { timeout: 10000 }, (err, data) => {
            t.error(err, 'no request error')
            actual.push(data)
            requests(n - 1)
          })
        }
      }
    }
  ]
  spinup(NODES, {t, scenario, state, bs: [bootstrapper]})
})
