/* eslint-env mocha */

'use strict'

const { Grape } = require('./../')

describe('Grape integration', () => {
  it('should emit a ready event', (done) => {
    const grape1 = new Grape({
      dht_port: 20002,
      dht_bootstrap: [ '127.0.0.1:20001' ],
      api_port: 40001
    })

    grape1.start(() => {})

    const grape2 = new Grape({
      dht_port: 20001,
      dht_bootstrap: [ '127.0.0.1:20002' ],
      api_port: 30002
    })

    grape2.start(() => {})

    grape1.on('ready', () => {
      grape1.stop()
      grape2.stop()
      done()
    })
  }).timeout(5000)
})
