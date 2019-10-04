'use strict'
const tapenet = require('tapenet')
const spinup = require('./helpers/spinup')
const { 
  NODES = 253,
  RTS = 1000
} = process.env

const { 
  h1: server, 
  h2: client,
  h3: bootstrapper,
  ...horde 
} = tapenet.topologies.basic(NODES)

tapenet(`1 announcing server, 1 lookup client, ${NODES - 3} grapes, ${RTS} lookups`, (t) => {
  const state = { rts: +RTS }
  const scenario = [
    {
      containers: [server],
      worker: true,
      ready (t, _, state, next) {
        const crypto = require('crypto')
        const { PeerRPCServer } = require('grenache-nodejs-http')
        const Link = require('grenache-nodejs-link')
        const topic = crypto.randomBytes(32).toString('base64')
        const link = new Link({ grape: 'http://127.0.0.1:40001' })
        link.start()

        const srv = new PeerRPCServer(link, {})
        srv.init()

        const service = srv.transport('server')
        service.listen(5000)

        next(null, {...state, link, service, topic})
      },
      run (t, _, { topic, link, service }, done) {
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
      containers: [client],
      worker: true,
      run (t, _, { rts, topic }, done) {
        const { PeerRPCClient } = require('grenache-nodejs-http')
        const Link = require('grenache-nodejs-link')
        const link = new Link({ grape: 'http://127.0.0.1:40001' })
        link.start()
        client.init()
        const client = new PeerRPCClient(link, {})
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
          client.request(topic, payload, { timeout: 10000 }, (err, data) => {
            t.error(err, 'no request error')
            actual.push(data)
            lookups(n - 1)
          })
        }
      }
    },
    {
      containers: horde,
      options: { api_port: 40001, dht_ephemeral: false },
    }
  ]
  spinup(NODES, {t, scenario, state, bs: [bootstrapper]})
})

