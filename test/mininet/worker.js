'use strict'

const PORT = 5000

const Grenache = require('grenache-nodejs-http')
const { PeerRPCServer } = require('grenache-nodejs-http')
const Link = require('grenache-nodejs-link')

const _ = require('lodash')

const link = new Link({
  grape: 'http://127.0.0.1:30000'
})
link.start()

const peer = new PeerRPCServer(link, {})
peer.init()

const service = peer.transport('server')
service.listen(PORT)

setInterval(function () {
  link.announce('rpc_test', service.port, {})
}, 300)

service.on('request', (rid, key, payload, handler) => {
  // console.log('peer', rid, key, payload)
  handler.reply(null, 'world')
  // handler.reply(new Error('something went wrong'), 'world')
})
