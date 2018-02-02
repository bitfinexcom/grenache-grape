module.exports = bootstrap

function bootstrap (t, h1, h2) {
  t.run(h1, function () {
    const { Grape } = require('../../')

    const grape = new Grape({
      dht_port: 20001,
      dht_bootstrap: [],
      api_port: 40001
    })

    grape.start(() => {
      t.pass('grape 1 bootstrapped and ready')
      h1.emit('bootstrap', `${global.ip}:20001`)
    })
  })

  t.run(h2, function () {
    h1.on('bootstrap', function (node) {
      const { Grape } = require('../../')

      const grape = new Grape({
        dht_port: 20001,
        dht_bootstrap: [ node ],
        api_port: 40001
      })

      grape.start(() => {
        t.pass('grape 2 bootstrapped and ready')
        h2.emit('ready', [node, `${global.ip}:20001`])
      })
    })
  })
}
