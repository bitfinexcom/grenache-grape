module.exports = bootstrap

function bootstrap (tapenet, t) {
  const h3 = tapenet.hosts[2]
  const h4 = tapenet.hosts[3]

  t.run(h3, function () {
    const { Grape } = require('../../')

    const grape = new Grape({
      dht_port: 20001,
      dht_bootstrap: [],
      api_port: 40001
    })

    grape.start(() => {
      t.pass('grape 1 bootstrapped and ready')
      h3.emit('bootstrap', `${global.ip}:20001`)
    })
  })

  t.run(h4, function () {
    h3.on('bootstrap', function (node) {
      const { Grape } = require('../../')

      const grape = new Grape({
        dht_port: 20001,
        dht_bootstrap: [node],
        api_port: 40001
      })

      grape.start(() => {
        t.pass('grape 2 bootstrapped and ready')
        tapenet.emit('bootstrap', [node, `${global.ip}:20001`])
      })
    })
  })
}
