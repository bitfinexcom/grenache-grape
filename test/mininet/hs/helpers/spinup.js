'use strict'
const bootstrap = require('./bootstrap')


function spinup (size, {t, scenario, state, bs}) {
  bootstrap({t, hosts: bs, state, size})
  mediate(t, bs[0])
  
  const noop = (t, p, s, cb) => { cb(null) } 
  for (let i = 0; i < scenario.length; i++) {
    const {containers, options = {}, ready = noop, run = noop} = scenario[i]
    iteratorify(containers)
    for (const container of containers) {
      t.run(container, `
        tapenet.once('next-${i}', (state) => {
          const ready = ${fnStringify(ready)}
          const run = ${fnStringify(run)}
          const dht = require('@hyperswarm/dht')
          const { bootstrap } = state
          const peer = dht({ bootstrap, ...${JSON.stringify(options)} })
          peer.ready(() => {
            tapenet.emit('peer-ready')
            ready(t, peer, state, (err, nextState = state) => {
              if (err) throw err
              state = nextState
              tapenet.emit('next-${i + 1}', state)
            })
            tapenet.once('rebootstrap', () => {
              peer.bootstrap(() => {
                tapenet.emit('peer-rebootstrapped')
              })
            })
            tapenet.once('run-${i}', () => {
              run (t, peer, state, () => {
                tapenet.emit('run-${i + 1}')
                tapenet.emit('host-done')
              })
            })
          })
          tapenet.once('done', () => { peer.destroy() })
        })
      `)
    }
  }
}

function mediate (t, h) {
  t.run(h, function () {
    tapenet.on('bootstrap', (state, size) => {
      var readyCount = 0
      var rebootstrapCount = 0
      var doneCount = 0
      tapenet.on('peer-ready', () => {
        if (++readyCount === size - 1) {
          tapenet.emit('rebootstrap')
        }
      })
      
      tapenet.on('peer-rebootstrapped', () => {
        if (++rebootstrapCount === size) tapenet.emit('run-0')
      })

      tapenet.on('host-done', () => {
        if (++doneCount === size - 1) {
          tapenet.emit('done')
          t.end()
        }
      })

      tapenet.emit('next-0', state) // kick off first scenario row
    })
  })
}

function fnStringify (fn) { 
  const str = fn.toString()
  const isShorthandMethod = fn.name && 
    str.indexOf(fn.name) > -1 && 
    /^(\s?)+function/.test(str) === false
  return isShorthandMethod ? 'function ' + str : str
}

function iteratorify (containers) {
  if (Array.isArray(containers) === false) {
    containers[Symbol.iterator] = hostsIterator
  }
}

function * hostsIterator () {
  for (const id in this) {
    if (id[0] !== 'h') continue
    yield this[id]
  }
  delete this[Symbol.iterator]
}

module.exports = spinup