#!/usr/bin/env node
'use strict'

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
  .option('dc', {
    describe: 'DHT concurrency',
    alias: 'dht_concurrency',
    type: 'number'
  })
  .option('dht_maxTables', {
    describe: 'DHT max tables',
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
  .option('cache_maxAge', {
    describe: 'Maximum cache age',
    type: 'number'
  })
  .option('dnl', {
    alias: 'dht_nodeLiveness',
    describe: 'Interval in ms to check for dead nodes',
    type: 'number'
  })
  .option('check_maxPayloadSize', {
    describe: 'Limit for max payload size',
    type: 'number'
  })
  .help('help')
  .version()
  .example('grape --dp 20001 --dc 32 --aph 30001 --bn \'127.0.0.1:20002,127.0.0.1:20003\'')
  .example('grape --dp 20002 --dc 32 --b 127.0.0.1 --aph 40001 --bn \'127.0.0.1:20001,127.0.0.1:20003\'')
  .example('grape --dp 20003 --dc 32 --aph 50001 --bn \'127.0.0.1:20001,127.0.0.1:20002\'')
  .usage('Usage: $0 --dp <dht-port> --aph <http-api-port> --bn <nodes> [--b bind-to-address]')
  .argv

const dhtPort = program.dp
const apiPort = program.aph
const bind = program.b
const maxDhtPeerAge = program.dpa
const maxCacheAge = program.cache_maxAge
const maxDhtTables = program.dht_maxTables
const maxDhtValues = program.dht_maxValues
const maxDhtConcurrency = program.dht_concurrency
const dhtNodeLiveness = program.dnl
const maxPayloadSize = program.check_maxPayloadSize

const dhtBoostrap = (program.bn || '').split(',').reduce((acc, e) => {
  if (e) {
    acc.push(e)
  }
  return acc
}, [])

const g = new Grape({
  host: bind,
  dht_port: dhtPort,
  dht_bootstrap: dhtBoostrap,
  dht_maxTables: maxDhtTables,
  dht_maxValues: maxDhtValues,
  dht_concurrency: maxDhtConcurrency,
  dht_nodeLiveness: dhtNodeLiveness,
  api_port: apiPort,
  dht_peer_maxAge: maxDhtPeerAge,
  cache_maxAge: maxCacheAge,
  check_maxPayloadSize: maxPayloadSize
})

g.start((err) => {
  if (err) throw err
})
