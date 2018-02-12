'use strict'

const DHT = require('bittorrent-dht')
const records = require('record-cache')
const _ = require('lodash')
const CbQ = require('cbq')
const async = require('async')
const http = require('http')
const Events = require('events')
const debug = require('debug')('grenache:grape')
const crypto = require('ed25519-supercop')

const noop = () => {}

class Grape extends Events {
  constructor (conf) {
    super()

    this.conf = _.defaults({}, conf, {
      host: null,
      dht_maxTables: 5000,
      dht_maxValues: 5000,
      dht_port: 20001,
      dht_bootstrap: [],
      dht_concurrency: 24,
      dht_nodeLiveness: 5 * 60 * 1000, // 5 min
      api_port: null,
      dht_peer_maxAge: 120000
    })

    this._mem = records({
      maxSize: 5000,
      maxAge: Math.ceil(this.conf.dht_peer_maxAge / 2)
    })

    this.cbq0 = new CbQ()

    this._interface = {}
    this._active = false
  }

  createNode (cb) {
    const dht = new DHT({
      maxTables: this.conf.dht_maxTables,
      maxValues: this.conf.dht_maxValues,
      host: this.conf.host || false,
      bootstrap: this.conf.dht_bootstrap,
      timeBucketOutdated: this.conf.dht_nodeLiveness,
      verify: crypto.verify,
      maxAge: this.conf.dht_peer_maxAge
    })

    dht.on('announce', (_peer, ih) => {
      const val = this.hex2str(ih)
      debug(this.conf.dht_port, 'announce', val)
      this.emit('announce', val)
    })

    dht.on('warning', () => {
      debug(this.conf.dht_port, 'warning')
      this.emit('warning')
    })

    dht.on('node', () => {
      debug(this.conf.dht_port, 'node')
      this.emit('node')
    })

    dht.on('listening', () => {
      debug(this.conf.dht_port, 'listening')
      this.emit('listening')
    })

    dht.on('ready', () => {
      debug(this.conf.dht_port, 'ready')
      this.emit('ready')
    })

    dht.on('error', (err) => {
      debug(this.conf.dht_port, 'error', err)
    })

    dht.on('peer', (_peer, val, from) => {
      const ih = this.str2hex(val)
      const peer = `${_peer.host}:${_peer.port}`

      this._mem.add(ih, peer)

      debug(this.conf.dht_port, 'found potential peer ' + peer + (from ? ' through ' + from.address + ':' + from.port : '') + ' for hash: ' + val)
      this.emit('peer', peer)
    })

    dht.once('error', handleBootstrapError)

    function handleBootstrapError (err) {
      cb(err)
    }

    dht.listen(this.conf.dht_port, (err) => {
      dht.removeListener('error', handleBootstrapError)
      if (err) return cb(err)

      cb(null, dht)
    })
  }

  hex2str (val) {
    return Buffer.from(val, 'hex').toString()
  }

  str2hex (val) {
    return Buffer.from(val).toString('hex')
  }

  str2buf (val, enc) {
    try {
      return Buffer.from(JSON.parse(val))
    } catch (ex) {
      return Buffer.from(val, enc || '')
    }
  }

  onRequest (type, data, cb) {
    const met = `handlePeer${_.upperFirst(_.camelCase(`-${type}`))}`

    if (!this[met]) {
      return cb(new Error('ERR_REQ_NOTFOUND'))
    }

    this[met](data, cb)
  }

  handlePeerLookup (_val, cb) {
    if (!_val || !_.isString(_val)) {
      return cb(new Error('ERR_GRAPE_LOOKUP'))
    }

    this.lookup(
      _val,
      cb
    )
  }

  handlePeerAnnounce (data, cb) {
    if (!data || !_.isArray(data)) {
      return cb(new Error('ERR_GRAPE_ANNOUNCE'))
    }

    const [val, port] = [data[0], data[1]]
    this.announce(val, port, cb)
  }

  handlePeerPut (opts, cb) {
    if (opts.k) {
      if (!Buffer.isBuffer(opts.k)) {
        opts.k = this.str2buf(opts.k, 'hex')
      }

      if (opts.sig && !Buffer.isBuffer(opts.sig)) {
        opts.sig = this.str2buf(opts.sig, 'hex')
      }

      if (opts.salt && !Buffer.isBuffer(opts.salt)) {
        opts.salt = this.str2buf(opts.salt)
      }
    }

    this.put(opts, cb)
  }

  handlePeerGet (hash, cb) {
    this.get(hash, cb)
  }

  announce (val, port, cb) {
    if (!_.isInteger(port)) {
      return cb(new Error('ERR_GRAPE_SERVICE_PORT'))
    }

    cb = cb || noop
    this.node.announce(
      this.str2hex(val),
      port || this.conf.dht_port,
      cb
    )
  }

  lookup (val, cb) {
    const ih = this.str2hex(val)

    this.cbq0.push(ih, (err, data) => {
      cb(err, data)
    })

    const kcnt = this.cbq0.cnt(ih)
    if (kcnt > 1) return

    this.node.lookup(ih, (err, cnt) => {
      debug(`lookup ${val} found ${cnt} nodes`)

      if (err) {
        return this.cbq0.trigger(ih, err, null)
      }

      setImmediate(() => {
        const peers = this._mem.get(ih, 100)
        this.cbq0.trigger(ih, null, peers)
      })
    })
  }

  put (opts, cb) {
    cb = cb || noop

    try {
      this.node.put(opts, (err, res) => {
        if (err) return cb(err)

        cb(null, this.str2hex(res))
      })
    } catch (e) {
      cb(e)
    }
  }

  get (hash, cb) {
    try {
      this.node.get(hash, (err, res) => {
        if (!res) {
          return cb(err)
        }

        res.id = this.str2hex(res.id)
        res.v = res.v.toString()

        if (res.k) {
          res.k = res.k.toString('hex')
        }
        if (res.sig) {
          res.sig = res.sig.toString('hex')
        }

        if (res.salt) {
          res.salt = res.salt.toString()
        }

        cb(err, res)
      })
    } catch (e) {
      let msg = 'ERR_GRAPE_GENERIC'
      if (e.message.indexOf('Invalid hex string') > -1) {
        msg = 'ERR_GRAPE_HASH_FORMAT'
      }
      cb(new Error(msg))
    }
  }

  transportHttp (cb) {
    if (!this.conf.api_port) return cb(new Error('ERR_NO_PORT'))

    let fetchRequest = (req, rep) => {
      let body = []

      req.on('data', (data) => {
        body.push(data)
      })

      req.on('end', () => {
        body = Buffer.concat(body).toString()
        handleRequest(req, rep, body)
      })

      req.on('error', () => {
        // do nothing
      })
    }

    let handleRequest = (req, rep, msg) => {
      msg = JSON.parse(msg)

      const type = req.url.substr(1)
      const data = msg.data

      this.onRequest(type, data, (err, res) => {
        if (err && err.code) {
          rep.statusCode = err.code
        }

        rep.end(JSON.stringify(err ? err.message : res))
      })
    }

    const server = http.createServer(fetchRequest)

    const listenArgs = [this.conf.api_port]

    if (this.conf.host) {
      listenArgs.push(this.conf.host)
    }
    listenArgs.push(cb)

    server.listen.apply(server, listenArgs)

    this._interface.http = server
  }

  start (cb) {
    cb = cb || noop

    if (this._active) {
      debug('skipping start, since Grape is already active')
      return cb()
    }

    debug('starting')

    this.createNode(
      (err, node) => {
        if (err) return cb(err)

        this.node = node

        this.transportHttp(err => {
          if (err) return cb(err)
          this._active = true
          cb()
        })
      }
    )
  }

  stop (cb) {
    async.series([
      (cb) => this.node ? this.node.destroy(cb) : cb(),
      (cb) => {
        let httpsSrv = this._interface.http
        if (!httpsSrv) return cb()

        httpsSrv.close(cb)
      }
    ], (err) => {
      delete this.node
      delete this._interface.http

      this._active = false

      cb(err)
    })
  }
}

module.exports = Grape
