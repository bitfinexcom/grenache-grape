#!/usr/bin/env node
'use strict'

const _ = require('lodash')
const Grape = require('../lib/Grape')

const program = require('yargs')
  .option('b', {
    describe: 'Listening host',
    alias: 'bind',
    type: 'string'
  })
  .option('dp', {
    describe: 'DHT listening port',
    alias: 'dht_port',
    type: 'number',
    demand: true
  })
  .option('de', {
    describe: 'DHT node epemerality',
    alias: 'dht_ephemeral',
    type: 'number'
  })
  .option('dht_maxValues', {
    describe: 'DHT max values',
    type: 'number'
  })
  .option('bn', {
    describe: 'Bootstrap nodes',
    alias: 'bootstrap',
    type: 'string',
    demand: true
  })
  .option('aph', {
    describe: 'HTTP api port',
    alias: 'api_port',
    type: 'number',
    demand: true
  })
  .option('dht_peer_maxAge', {
    describe: 'Max age for peers in DHT',
    alias: 'dpa',
    type: 'number'
  })
  .option('check_maxPayloadSize', {
    describe: 'Limit for max payload size',
    type: 'number'
  })
  .help('help')
  .version()
  .example('grape --dp 20001 --aph 30001 --bn \'127.0.0.1:20002,127.0.0.1:20003\'')
  .example('grape --dp 20002 --b 127.0.0.1 --aph 40001 --bn \'127.0.0.1:20001,127.0.0.1:20003\'')
  .example('grape --dp 20003 --aph 50001 --bn \'127.0.0.1:20001,127.0.0.1:20002\'')
  .usage('Usage: $0 --dp <dht-port> --aph <http-api-port> --bn <nodes> [--b bind-to-address]')
  .argv

const dhtEphemeral = program.de
const dhtPort = program.dp
const apiPort = program.aph
const bind = program.b
const maxDhtPeerAge = program.dpa
const maxDhtValues = program.dht_maxValues
const maxPayloadSize = program.check_maxPayloadSize

const dhtBoostrap = _.reduce((program.bn || '').split(','), (acc, e) => {
  if (e) {
    acc.push(e)
  }
  return acc
}, [])

const g = new Grape({
  host: bind,
  dht_ephemeral: dhtEphemeral,
  dht_port: dhtPort,
  dht_bootstrap: dhtBoostrap,
  dht_maxValues: maxDhtValues,
  api_port: apiPort,
  dht_peer_maxAge: maxDhtPeerAge,
  check_maxPayloadSize: maxPayloadSize
})

g.start((err) => {
  if (err) throw err
})
