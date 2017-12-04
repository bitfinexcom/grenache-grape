'use strict'

throw new Error("fix args")
const count = process.argv[2] || 30

// important to pass DEBUG=* down to spawned grapes
const env = Object.create(process.env)

const spawn = require('child_process').spawn
const _ = require('lodash')

const boostrapNodes = {}

let startPort = 20001
for (let i = 0; i < count; i++) {
  boostrapNodes[startPort] = '127.0.0.1:' + startPort
  startPort++
}

const nodes = {}
Object.keys(boostrapNodes).forEach((port) => {
  port = +port
  const others = _.without(Object.keys(boostrapNodes), '' + port)

  const bn = others.map((p2) => {
    return boostrapNodes[p2]
  }).join(',')

  nodes[port] = `--dp ${port} --aph ${port + 1000} --bn ${bn}`
})

const grapes = []
console.log(`spinning up ${Object.keys(nodes).length} grapes`)
Object.keys(nodes).forEach((k) => {
  const cmd = nodes[k]

  let g = spawn('grape', cmd.split(' '), { stdio: 'inherit', env: env })

  grapes.push(g)
})
