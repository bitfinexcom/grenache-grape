/* eslint-env mocha */

'use strict'

const { Grape } = require('./../')

describe('Grape integration', () => {
  it('should emit a ready event', (done) => {
    const grape1 = new Grape({
      dht_port: 20002,
      dht_bootstrap: [ '127.0.0.1:20001', '127.0.0.1:20003' ],
      api_port: 40001,
      api_port_http: 40002
    })

    grape1.start(() => {})

    const grape2 = new Grape({
      dht_port: 20001,
      dht_bootstrap: [ '127.0.0.1:20002', '127.0.0.1:20003' ],
      api_port: 30001,
      api_port_http: 30002
    })

    grape2.start(() => {})

    grape1.on('ready', () => {
      done()
    })
  }).timeout(5000)
})
