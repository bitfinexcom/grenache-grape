/* global tapenet */
'use strict'
const bootstrap = require('./bootstrap')

function spinup (size, { t, scenario, state, bs }) {
  bootstrap({ t, hosts: bs, state, size })
  mediate(t, bs[0])
  const procs = []
  const noop = (t, p, s, cb) => { cb(null) }
  for (let i = 0; i < scenario.length; i++) {
    const { options = {}, ready = noop, run = noop } = scenario[i]
    const containers = arrarify(scenario[i].containers)
    let count = 0
    for (const container of containers) {
      procs.push(t.run(container, `
        const merge = require('lodash.mergewith')
        tapenet.once('next-${i}', (state) => {
          const ready = ${fnStringify(ready)}
          const run = ${fnStringify(run)}
          const dht = require('@hyperswarm/dht')
          const { bootstrap } = state
          const peer = dht({ bootstrap, ...${JSON.stringify(options)} })
          peer.ready(() => {
            tapenet.emit('peer-ready')
            state.$index = ${count}
            ready(t, peer, state, (err, nextState = state) => {
              if (err) throw err
              state = nextState
              tapenet.emit('next-${i + 1}', state)
              tapenet.emit('state', state.$shared)
            })
            tapenet.once('rebootstrap', () => {
              peer.bootstrap(() => {
                tapenet.emit('peer-rebootstrapped')
              })
            })
            tapenet.once('run-${i}', ($shared) => {
              state.$shared = $shared
              var doneCalled = false
              run (t, peer, state, () => {
                if (doneCalled) return
                doneCalled = true
                tapenet.emit('ran-${i}')
                tapenet.emit('host-done')
              })
            })
          })
          tapenet.once('done', () => { 
            peer.destroy() 
          })
          ${count > 0 ? `` : `
            let count = 0
            tapenet.on('ran-${i}', () => {
              count++
              if (count === ${containers.length}) {
                tapenet.emit('run-${i + 1}', state.$shared)
              }
            })
            tapenet.on('state', (sharedState) => {
              if (state.$shared === sharedState) return
              merge(state.$shared, sharedState)
            })
          `}
        })
      `))
      count++
    }
  }
  return procs
}

function mediate (t, h) {
  t.run(h, function () {
    tapenet.on('bootstrap', (state, size) => {
      state.$shared = state.$shared || {}
      const merge = require('lodash.mergewith')
      var readyCount = 0
      var rebootstrapCount = 0
      var doneCount = 0
      tapenet.on('peer-ready', () => {
        if (++readyCount === size - 1) {
          tapenet.emit('rebootstrap')
        }
      })
      tapenet.on('state', (sharedState) => {
        if (state.$shared === sharedState) return
        merge(state.$shared, sharedState)
      })
      tapenet.on('peer-rebootstrapped', () => {
        if (++rebootstrapCount === size) tapenet.emit('run-0', state.$shared)
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

function arrarify (containers) {
  return Array.isArray(containers) ? containers : [...iterate(containers)]
}

function * iterate (containers) {
  for (const id in containers) {
    if (id[0] !== 'h') continue
    yield containers[id]
  }
}

spinup.arrarify = arrarify

module.exports = spinup
