'use strict'

const test = require('brittle')
const { Grape } = require('./../')

test('Grape integration', { timeout: 5000 }, (t) => {
  t.test('should emit a ready event', async (t) => {
    const grape1 = new Grape({
      dht_port: 20002,
      dht_bootstrap: ['127.0.0.1:20001'],
      api_port: 40001
    })

    grape1.start(() => {})

    const grape2 = new Grape({
      dht_port: 20001,
      dht_bootstrap: ['127.0.0.1:20002'],
      api_port: 30002
    })

    grape2.start(() => {})

    await new Promise(resolve => {
      grape1.on('ready', () => {
        grape1.stop()
        grape2.stop()
        resolve()
      })
    })
    t.pass()
  })
})
