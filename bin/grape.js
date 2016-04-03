#!/usr/bin/env node

var minimist = require('minimist')
var Grape = require('../lib/Grape')

var argv = minimist(process.argv.slice(2))

if (!argv.dp) {
  console.error('Grape: no dht-port (--dp) specified')
  process.exit(-1)
}

if (!argv.ap) {
  console.error('Grape: no api-port (--ap) specified')
  process.exit(-1)
}

var dht_port = argv.dp
var api_port = argv.ap
var dht_bootstrap = (argv.bn || '').split(',')

var g = new Grape({
  dht_port: dht_port,
  dht_bootstrap: dht_bootstrap,
  api_port: api_port
})

g.start()
