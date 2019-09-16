const tapenet = require('tapenet')
const bootstrap = require('./hs-helpers/bootstrap')

const nodes = 2000
const { h1, h2 } = tapenet.topologies.basic(nodes)

tapenet(nodes + ' grapes start and connect', async function (t) {
  
  for (let i = 2; i < nodes; i++) {
    t.run(tapenet.hosts[i], `
      tapenet.on('bootstrap', (bootstrap) => {
        const grape = require('./helpers/grape')
        grape(bootstrap, () => {
          t.pass('grape ${i + 1} ready')
          tapenet.emit('horde:grape')
        })
      })
    `)
  }
  t.run(h1, `
    let missing = ${nodes} - 2
    tapenet.on('horde:grape', () => {
      missing-- 
      if (missing === 0) {
        t.pass('all grapes ready')
        t.end()
      }
    })
  `)

  bootstrap(tapenet, t, [h1, h2])
})
