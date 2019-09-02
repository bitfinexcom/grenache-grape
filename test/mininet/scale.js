const tapenet = require('tapenet')
const bootstrap = require('./helpers/bootstrap')

const nodes = 500
const { h1, h2 } = tapenet.topologies.basic(nodes)

tapenet(nodes + ' grapes, worker + client', function (t) {
  bootstrap(tapenet, t)

  t.run(h1, function () {
    tapenet.on('bootstrap', function (bootstrap) {
      t.pass('boostrapped')
    })
  })

  t.run(h2, function () {
    h1.on('service', function (bootstrap) {
      t.pass('service heard')
    })
  })
})
