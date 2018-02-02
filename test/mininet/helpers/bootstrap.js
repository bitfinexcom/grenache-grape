module.exports = bootstrap

function bootstrap (tapenet, t) {
  t.run(tapenet.hosts[0], function () {
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

  t.run(tapenet.hosts[1], function () {
    h1.on('bootstrap', function (node) {
      const { Grape } = require('../../')

      const grape = new Grape({
        dht_port: 20001,
        dht_bootstrap: [ node ],
        api_port: 40001
      })

      grape.start(() => {
        t.pass('grape 2 bootstrapped and ready')
        tapenet.emit('bootstrap', [node, `${global.ip}:20001`])
      })
    })
  })
}
