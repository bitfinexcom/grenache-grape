#!/usr/bin/env node
'use strict'

var minimist = require('minimist')
var _ = require('lodash')
var Grape = require('../lib/Grape')

var argv = minimist(process.argv.slice(2))

if (!argv.dp) {
  console.error('Grape: no dht-port (--dp) specified')
  argv.help = 1
}

if (!argv.ap) {
  console.error('Grape: no api-port (--ap) specified')
  argv.help = 1
}

if (argv.help) {
  console.log(
    '\nGRAPE help\n' +
    '--dp <INT> : DHT listening port\n' +
    '--bn <IP:PORT[,IP:PORT]>: DHT Bootstrap Nodes\n' +
    '--ap <INT> : Grape API port\n' +
    '\nExamples:\n' +
    'grape --dp 20001 --ap 30001 --bn \'127.0.0.1:20002,127.0.0.1:20003\'\n' +
    'grape --dp 20002 --ap 30002 --bn \'127.0.0.1:20001,127.0.0.1:20003\'\n' +
    'grape --dp 20003 --ap 30003 --bn \'127.0.0.1:20001,127.0.0.1:20002\'\n' +
    ''
  )
  process.exit(-1)
}


var dht_port = argv.dp
var api_port = argv.ap
var dht_bootstrap = _.reduce((argv.bn || '').split(','), (acc, e) => {
  if (e) {
    acc.push(e)
  }
  return acc  
}, [])

var g = new Grape({
  dht_port: dht_port,
  dht_bootstrap: dht_bootstrap,
  api_port: api_port
})

g.start()
