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
  .example('grape --dp 20001 --apw 30001 --aph 40001 --bn \'127.0.0.1:20002,127.0.0.1:20003\'')
  .example('grape --dp 20002 --dh 127.0.0.1 --apw 30002 --aph 40002 --bn \'127.0.0.1:20001,127.0.0.1:20003\'')
  .example('grape --dp 20003 --apw 30003 --aph 40003 --bn \'127.0.0.1:20001,127.0.0.1:20002\'')
  .usage('Usage: $0 --dp <val> --awp <val> --aph <val> --bn <val>')
  .argv

const portDht = program.dp
const portApi = program.apw
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
  api_port: portApi,
  api_port_http: httpPortApi,
  host: bind
})

g.start(() => {})
