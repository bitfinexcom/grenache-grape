'use strict'
const { createHash } = require('crypto')
const DHT = require('@hyperswarm/dht')
const records = require('record-cache')
const _ = require('lodash')
const async = require('async')
const http = require('http')
const Events = require('events')
const debug = require('debug')('grenache:grape')
const getRawBody = require('raw-body')

const kOnWarning = Symbol('grape-on-warning')

const noop = () => {}

class Grape extends Events {
  constructor (conf) {
    super()
    this.conf = _.defaults({}, conf, {
      host: null,
      dht_ephemeral: false,
      dht_maxValues: 5000,
      dht_port: 20001,
      dht_bootstrap: [],
      dht_nodeLiveness: 5 * 60 * 1000, // 5 min
      api_port: null,
      dht_peer_maxAge: 120000,
      check_maxPayloadSize: 8192
    })

    this._mem = records({
      maxSize: 5000,
      maxAge: Math.ceil(this.conf.dht_peer_maxAge / 2)
    })

    this._interface = {}
    this._active = false
    this.listening = false
    this[kOnWarning] = (...args) => {
      debug(this.conf.dht_port, 'warning', ...args)
      this.emit('warning', ...args)
    }
  }

  createNode (cb) {
    const dht = this.dht = DHT({
      maxValues: this.conf.dht_maxValues,
      bootstrap: this.conf.dht_bootstrap,
      // timeBucketOutdated: this.conf.dht_nodeLiveness,
      maxAge: this.conf.dht_peer_maxAge
    })

    dht.on('announce', (ih, _peer) => {
      const val = this.hex2str(ih)
      debug(this.conf.dht_port, 'announce', ih.toString('hex'))
      this.emit('announce', val)
    })

    dht.on('unannounce', (ih, _peer) => {
      const val = this.hex2str(ih)
      debug(this.conf.dht_port, 'unannounce', ih.toString('hex'))
      this.emit('unannounce', val)
    })

    dht.on('warning', this[kOnWarning])

    dht.on('add-node', () => {
      debug(this.conf.dht_port, 'node')
      this.emit('node')
    })

    dht.on('listening', () => {
      debug(this.conf.dht_port, 'listening')
      this.listening = true
      this.emit('listening')
    })

    dht.on('ready', () => {
      debug(this.conf.dht_port, 'ready')
      this.emit('ready')
    })

    dht.on('error', (err) => {
      debug(this.conf.dht_port, 'error', err)
    })

    dht.once('error', handleBootstrapError)

    function handleBootstrapError (err) {
      cb(err)
    }

    dht.listen(this.conf.dht_port, this.conf.host, (err) => {
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

  str2hashbuf (val) {
    return createHash('sha256')
      .update(val)
      .digest()
  }

  onRequest (type, data, cb) {
    const met = `handlePeer${_.upperFirst(_.camelCase(`-${type}`))}`
    if (!this[met]) {
      return cb(new Error('ERR_REQ_NOTFOUND'))
    }
    this[met](data, (err, ...args) => {
      if (err && !/$ERR/.test(err.message)) {
        err.message = 'ERR_GRAPE_GENERIC: ' + err.message
      }
      cb(err, ...args)
    })
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

    const [key, port] = [data[0], data[1]]
    this.announce(key, port, cb)
  }

  handlePeerUnannounce (data, cb) {
    if (!data || !_.isArray(data)) {
      return cb(new Error('ERR_GRAPE_UNANNOUNCE'))
    }

    const [key, port] = [data[0], data[1]]
    this.unannounce(key, port, cb)
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
        opts.salt = Buffer.from(opts.salt)
      }
    }

    this.put(opts, cb)
  }

  handlePeerGet (opts, cb) {
    if (opts.salt && !Buffer.isBuffer(opts.salt)) {
      opts.salt = Buffer.from(opts.salt)
    }
    this.get(opts, cb)
  }

  announce (key, port = this.conf.dht_port, cb) {
    if (_.isFunction(port)) {
      cb = port
      port = this.conf.dht_port
    }
    if (!_.isInteger(port)) {
      return cb(new Error('ERR_GRAPE_SERVICE_PORT'))
    }

    cb = cb || noop
    this.node.announce(
      this.str2hashbuf(key),
      { port },
      cb
    )
  }

  unannounce (key, port = this.conf.dht_port, cb) {
    if (_.isFunction(port)) {
      cb = port
      port = this.conf.dht_port
    }
    if (!_.isInteger(port)) {
      return cb(new Error('ERR_GRAPE_SERVICE_PORT'))
    }

    cb = cb || noop
    this.node.unannounce(
      this.str2hashbuf(key),
      { port },
      cb
    )
  }

  lookup (key, cb) {
    const ih = this.str2hashbuf(key)
    this._mem.remove(ih)
    this.node.lookup(ih, (err, result) => {
      if (err) {
        cb(err)
        return
      }
      for (const { node, peers, localPeers } of result) {
        if (localPeers) {
          for (const peer of localPeers) {
            const { port, host } = peer
            const local = true
            const referrer = null
            const id = `${host}:${port}`
            this._mem.add(ih, id)
            this.emit('peer', id, { ih, port, host, local, referrer })
          }
        }

        if (peers) {
          for (const peer of peers) {
            const { port, host } = peer
            const local = false
            const referrer = node
            const id = `${host}:${port}`
            this._mem.add(ih, id)
            this.emit('peer', id, { ih, port, host, local, referrer })
          }
        }
      }

      const peers = this._mem.get(ih, 100)
      cb(null, peers)
    })
  }

  put (opts, cb) {
    const done = !cb ? noop : (err, key) => {
      if (err) {
        cb(err)
        return
      }
      cb(null, this.str2hex(key))
    }
    const mutable = 'k' in opts
    if (mutable) this.mutablePut(opts, done)
    else this.immutablePut(opts.v, done)
  }

  get (opts, cb) {
    if (typeof opts === 'string' || Buffer.isBuffer(opts)) {
      opts = { hash: opts }
    }

    // any API's using opts.hash for mutable data should
    // switch to opts.key
    const mutable = opts.key || opts.m

    // if salt/seq is used with opts.hash we can infer mutable
    const inferredMutable = !mutable && opts.hash && (opts.salt || 'seq' in opts)

    if (mutable || inferredMutable) {
      this.mutableGet(opts, cb)
      return
    }

    // explicitly immutable
    if (opts.hash && opts.m === false) {
      this.immutableGet(opts.hash, cb)
      return
    }
    // in this case we can't tell whether the get is immutable
    // or mutable
    if (opts.hash) {
      this.mutableGet(opts, (err, res) => {
        if (err) {
          cb(err)
          return
        }
        // mutable store didn't have any values, try mutable
        if (res.v === null) {
          this.immutableGet(opts.hash, cb)
        } else {
          cb(null, res)
        }
      })
      return
    }

    cb(Error('ERR_GRAPE_INVALID_GET_OPTIONS'))
  }

  immutablePut (value, cb) {
    try {
      value = typeof value === 'string' ? Buffer.from(value) : value
      const qs = this.node.immutable.put(value, cb)
      qs.on('warning', this[kOnWarning])
    } catch (e) {
      const msg = `ERR_GRAPE_GENERIC: ${e.message}\n${e.stack}`
      cb(new Error(msg))
    }
  }

  mutablePut (opts, cb) {
    try {
      const { k: publicKey, v, sig, ...options } = opts
      options.signature = sig
      options.keypair = { publicKey }
      if (options.sign) {
        throw Error('ERR_GRAPE_SIGN_NOT_SUPPORTED')
      }
      const value = typeof v === 'string' ? Buffer.from(v) : v
      const qs = this.node.mutable.put(value, options, (err, result) => {
        if (err) {
          cb(err)
          return
        }
        const { key } = result
        cb(err, key)
      })
      qs.on('warning', this[kOnWarning])
    } catch (e) {
      const msg = `ERR_GRAPE_GENERIC: ${e.message}\n${e.stack}`
      cb(new Error(msg))
    }
  }

  immutableGet (hash, cb) {
    if (typeof hash === 'string') hash = this.str2buf(hash, 'hex')
    try {
      const qs = this.node.immutable.get(hash, (err, value, info) => {
        if (err) {
          cb(err)
          return
        }
        if (value === null && info === null) { // Not Found
          cb()
          return
        }
        const { id } = info
        const res = {
          id: id ? this.str2hex(id) : null,
          seq: null,
          sig: null,
          v: (value ? value.toString() : value),
          k: this.str2hex(hash),
          m: false
        }
        cb(null, res)
      })
      qs.on('warning', this[kOnWarning])
    } catch (e) {
      const msg = `ERR_GRAPE_GENERIC: ${e.message}\n${e.stack}`
      cb(new Error(msg))
    }
  }

  mutableGet (opts, cb) {
    if (opts.salt && !Buffer.isBuffer(opts.salt)) {
      opts.salt = Buffer.from(opts.salt + '')
    }
    try {
      const { hash, key = hash, ...options } = opts
      const _key = typeof key === 'string' ? this.str2buf(key, 'hex') : key
      const qs = this.node.mutable.get(_key, options, (err, info) => {
        if (err) {
          cb(err)
          return
        }
        const { value, id = '', signature: sig, salt, seq = null } = info
        const res = {
          id: id ? this.str2hex(id) : null,
          v: value ? value.toString() : value,
          sig: sig ? sig.toString('hex') : sig,
          k: this.str2hex(_key),
          salt: salt ? salt.toString() : null,
          seq: seq,
          m: true
        }
        cb(null, res)
      })
      qs.on('warning', this[kOnWarning])
    } catch (e) {
      const msg = `ERR_GRAPE_GENERIC: ${e.message}\n${e.stack}`
      cb(new Error(msg))
    }
  }

  transportHttp (cb) {
    if (!this.conf.api_port) return cb(new Error('ERR_NO_PORT'))
    const maxPayloadSize = this.conf.check_maxPayloadSize

    const handleRequest = (req, rep, msg) => {
      try {
        msg = JSON.parse(msg)
      } catch (e) {
        rep.statusCode = 500
        rep.end('ERR_GRAPE_PAYLOAD_INVALID')
        return
      }

      const type = req.url.substr(1)
      const data = msg.data

      this.onRequest(type, data, (err, res) => {
        if (err && err.code) {
          rep.statusCode = err.code
        }

        rep.end(JSON.stringify(err ? err.message : res))
      })
    }

    const server = http.createServer((req, res) => {
      getRawBody(req, { limit: maxPayloadSize })
        .then((buf) => {
          handleRequest(req, res, buf.toString())
        })
        .catch((err) => {
          res.statusCode = 500

          if (err.type === 'entity.too.large') {
            res.statusCode = 413
            return res.end('ERR_GRAPE_PAYLOAD_SIZE')
          }

          res.end(err.message)
        })
    })

    const listenArgs = [this.conf.api_port]

    if (this.conf.host) {
      listenArgs.push(this.conf.host)
    }
    listenArgs.push(cb)
    server.listen.apply(server, listenArgs)

    this._interface.http = server
  }

  address () {
    if (!this.dht) throw (Error('ERR_NOT_BOUND'))
    return this.dht.address()
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
    cb = cb || noop
    async.series([
      (cb) => {
        if (!this.node) return cb()
        this.node.once('close', cb)
        this.node.destroy()
      },
      (cb) => {
        const httpsSrv = this._interface.http
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
