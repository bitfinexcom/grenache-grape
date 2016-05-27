'use strict'

var Grape = require('./../lib/Grape')

var g1 = new Grape({
  dht_port: 20001,
  dht_bootstrap: [
    '127.0.0.1:20002'
  ],
  api_port: 30001
})

g1.start(() => {
  console.log('grape1: started')       
})

var g2 = new Grape({
  dht_port: 20002,
  dht_bootstrap: [
    '127.0.0.1:20001'
  ],
  api_port: 30002
})

g2.start(() => {
  console.log('grape2: started')       
})
