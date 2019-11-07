#!/usr/bin/env node
const pump = require('pump')
const { promisify } = require('util')
const { join, basename } = require('path')
const fs = require('fs')
const glob = require('glob')
const { timeout, once } = require('nonsynchronous')
const files = glob.sync(join(__dirname, '*.js')).filter((f) => basename(f) !== basename(__filename))
const { spawn } = require('child_process')
const pipe = promisify(pump)
const results = join(__dirname, 'results', Date().toString())
fs.mkdirSync(results, { recursive: true })
const node = process.execPath
async function main () {
  await cleanup()
  for (const file of files) {
    const cp = await run(node, file)
    await cleanup(cp)
  }
  process.exit()
}

async function run (cmd, ...args) {
  const cp = spawn(cmd, args, ['ignore', 'pipe', 'inherit'])
  const writer = (cmd === node)
    ? pipe(cp.stdout, fs.createWriteStream(join(results, `${basename(args[0])}.tap`)))
    : Promise.resolve()
  if (cmd === node) cp.stdout.pipe(process.stdout)
  await Promise.race([
    once(cp, 'exit'),
    handleError(cp),
    closeAfterTimeout(cp, 600000) // 10 mins
  ])
  await writer
  return cp
}

async function handleError (cp) {
  const [err] = await once(cp, 'error')
  console.error(err)
  await cleanup(cp)
  throw err
}

async function closeAfterTimeout (cp, ms) {
  await timeout(ms)
  cp.kill()
  await once(cp, 'exit')
}

async function cleanup (cp) {
  if (cp) {
    cp.kill()
    cp.unref()
  }
  const mn = spawn('sudo', ['mn', '-c'], { stdio: 'ignore' })
  await once(mn, 'exit')
}

main().catch(console.error)
