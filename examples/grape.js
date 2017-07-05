'use strict'

const Grape = require('./../lib/Grape')

function onStart (err) {
  if (err) {
    console.error(err)
    process.exit(-1)
  }
  console.log('grape: started')
}

const g1 = new Grape({
  host: '127.0.0.1',
  dht_port: 20001,
  dht_bootstrap: [
    '127.0.0.1:20002'
  ],
  api_port: 30001
})

g1.start(onStart)

const g2 = new Grape({
  host: '127.0.0.1',
  dht_port: 20002,
  dht_bootstrap: [
    '127.0.0.1:20001'
  ],
  api_port: 40001
})

g2.start(onStart)
