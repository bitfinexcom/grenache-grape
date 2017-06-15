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
  .option('dc', {
    describe: 'DHT concurrency',
    alias: 'dht_concurrency',
    type: 'number'
  })
  .option('aph', {
    describe: 'HTTP api port',
    alias: 'api_port_http',
    type: 'number',
    demand: true
  })
  .option('bn', {
    describe: 'Bootstrap nodes',
    alias: 'bootstrap',
    type: 'string',
    demand: true
  })
  .help('help')
  .version()
  .example('grape --dp 20001 --dc 32 --aph 30001 --bn \'127.0.0.1:20002,127.0.0.1:20003\'')
  .example('grape --dp 20002 --dc 32 --b 127.0.0.1 --aph 40001 --bn \'127.0.0.1:20001,127.0.0.1:20003\'')
  .example('grape --dp 20003 --dc 32 --aph 50001 --bn \'127.0.0.1:20001,127.0.0.1:20002\'')
  .usage('Usage: $0 --dp <val> --awp <val> --aph <val> --bn <val>')
  .argv

const portDht = program.dp
const httpPortApi = program.aph
const bind = program.b

const bootstrapDht = _.reduce((program.bn || '').split(','), (acc, e) => {
  if (e) {
    acc.push(e)
  }
  return acc
}, [])

const g = new Grape({
  dht_port: portDht,
  dht_bootstrap: bootstrapDht,
  api_port_http: httpPortApi,
  host: bind
})

g.start(() => {})
