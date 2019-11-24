'use strict'
const { createHash } = require('crypto')
const DHT = require('@hyperswarm/dht')
const { signable } = require('@hyperswarm/hypersign')()
const records = require('record-cache')
const _ = require('lodash')
const http = require('http')
const Events = require('events')
const debug = require('debug')('grenache:grape')
const getRawBody = require('raw-body')

const kOnWarning = Symbol('grape-on-warning')

const noop = () => {}
const compat = (result) => {
  for (const [k, v] of Object.entries(result)) {
    if (k === 'v' || k === 'id') continue
    if (v === null) result[k] = undefined
  }
  return result
}
class GrapeError extends Error {
  constructor (msg, code = 400) {
    super(msg)
    this.code = code
  }

  toString () {
    return JSON.stringify(this.message)
  }
}

class GenericErrorWrap extends GrapeError {
  constructor (err, code = err.statusCode || 500) {
    if (err instanceof GrapeError) return err
    super('ERR_GRAPE_GENERIC: ' + err.message, code)
  }
}

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
    this._initError = null
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

    const handleInitError = (err) => {
      this._initError = new GrapeError('ERR_GRAPE_INIT: ' + err.message)
      cb(err, dht)
    }

    dht.once('error', handleInitError)
    dht.listen(this.conf.dht_port, this.conf.host, () => {
      dht.removeListener('error', handleInitError)
      if (this._initError === null) {
        cb(null, dht)
      }
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
      return Buffer.from(val, enc)
    }
  }

  str2hashbuf (val) {
    return createHash('sha256')
      .update(val)
      .digest()
  }

  onRequest (type, data, cb) {
    const done = (err, ...args) => {
      cb(err ? new GenericErrorWrap(err) : null, ...args)
    }
    switch (type) {
      case 'lookup': return this.handlePeerLookup(data, done)
      case 'announce': return this.handlePeerAnnounce(data, done)
      case 'unannounce': return this.handlePeerUnannounce(data, done)
      case 'get': return this.handlePeerGet(data, done)
      case 'put': return this.handlePeerPut(data, done)
      default: return cb(new GrapeError('ERR_REQ_NOTFOUND', 404))
    }
  }

  handlePeerLookup (_val, cb) {
    if (!_val || !_.isString(_val)) {
      return cb(new GrapeError('ERR_GRAPE_LOOKUP'))
    }

    this.lookup(
      _val,
      cb
    )
  }

  handlePeerAnnounce (data, cb) {
    if (!data || !_.isArray(data)) {
      return cb(new GrapeError('ERR_GRAPE_ANNOUNCE'))
    }

    const [key, port] = [data[0], data[1]]
    this.announce(key, port, cb)
  }

  handlePeerUnannounce (data, cb) {
    if (!data || !_.isArray(data)) {
      return cb(new GrapeError('ERR_GRAPE_UNANNOUNCE'))
    }

    const [key, port] = [data[0], data[1]]
    this.unannounce(key, port, cb)
  }

  handlePeerPut (opts, cb) {
    if (opts.k) {
      opts.k = this.str2buf(opts.k, 'hex')
      if (opts.sig) opts.sig = this.str2buf(opts.sig, 'hex')
      if (opts.salt) opts.salt = Buffer.from(opts.salt)
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
    if (this._initError !== null) {
      return process.nextTick(cb, this._initError)
    }
    if (!_.isInteger(port)) {
      return process.nextTick(cb, new GrapeError('ERR_GRAPE_SERVICE_PORT'))
    }

    cb = cb || noop
    const qs = this.node.announce(
      this.str2hashbuf(key),
      { port },
      (err) => {
        cb(err, qs.updates)
      }
    )
  }

  unannounce (key, port = this.conf.dht_port, cb) {
    if (_.isFunction(port)) {
      cb = port
      port = this.conf.dht_port
    }
    if (!_.isInteger(port)) {
      return process.nextTick(cb, new GrapeError('ERR_GRAPE_SERVICE_PORT'))
    }

    cb = cb || noop
    this.node.unannounce(
      this.str2hashbuf(key),
      { port },
      cb
    )
  }

  lookup (key, cb) {
    if (this._initError !== null) {
      return process.nextTick(cb, this._initError)
    }
    const ih = this.str2hashbuf(key)
    this._mem.remove(ih)
    this.node.lookup(ih, (err, result) => {
      if (err) {
        cb(new GenericErrorWrap(err))
        return
      }
      for (const { node, peers } of result) {
        for (const peer of peers) {
          const { port, host } = peer
          const local = false
          const referrer = node
          const id = `${host}:${port}`
          this._mem.add(ih, id)
          this.emit('peer', id, { ih, port, host, local, referrer })
        }
      }
      const peers = this._mem.get(ih, 100)
      cb(null, peers)
    })
  }

  put (opts, cb) {
    if (typeof opts !== 'object' || opts === null) {
      process.nextTick(cb, new GrapeError('ERR_GRAPE_PUT_ARG_MUST_BE_OBJECT'))
      return
    }
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
    let probablyImmutable = false
    if (typeof opts === 'string' || Buffer.isBuffer(opts)) {
      probablyImmutable = true
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
    // in this case we can't tell whether the get is immutable or mutable
    if (opts.hash) {
      // if probably immutable, do immutable get first, otherwise do mutable get first
      const firstGet = probablyImmutable
        ? this.immutableGet.bind(this, opts.hash)
        : this.mutableGet.bind(this, opts)
      const secondGet = probablyImmutable
        ? this.mutableGet.bind(this, opts)
        : this.immutableGet.bind(this, opts.hash)
      firstGet((err, res) => {
        if (err) {
          cb(err)
          return
        }
        // first store didn't have any values, try second
        if (!res || res.v === null) {
          secondGet((err, res) => {
            if (!res || err) {
              cb(err)
              return
            }
            cb(null, res)
          })
        } else {
          cb(null, res)
        }
      })
      return
    }
    process.nextTick(() => {
      cb(new GrapeError('ERR_GRAPE_INVALID_GET_OPTIONS'))
    })
  }

  immutablePut (value, cb) {
    if (this._initError !== null) {
      return process.nextTick(cb, this._initError)
    }
    try {
      value = typeof value === 'string' ? Buffer.from(value) : value

      const qs = this.node.immutable.put(value, (err, ...args) => {
        if (err) {
          cb(new GenericErrorWrap(err))
          return
        }
        cb(null, ...args)
      })
      qs.on('warning', this[kOnWarning])
    } catch (err) {
      process.nextTick(cb, new GenericErrorWrap(err))
    }
  }

  mutablePut (opts, cb) {
    if (this._initError !== null) {
      return process.nextTick(cb, this._initError)
    }
    try {
      const { k: publicKey, v, sig, sign, ...options } = opts
      const isSign = typeof sign === 'function'
      if (sig && isSign) {
        process.nextTick(cb, new GrapeError('ERR_GRAPE_SIG_OR_SIGN_NOT_BOTH'))
        return
      }
      if (!sig && !isSign) {
        process.nextTick(cb, new GrapeError('ERR_GRAPE_SIG_OR_SIGN_REQUIRED'))
        return
      }
      options.keypair = { publicKey }
      if (options.salt && Buffer.isBuffer(options.salt) === false) {
        options.salt = Buffer.from(options.salt + '')
      }
      const value = typeof v === 'string' ? Buffer.from(v) : v
      const { seq, salt } = options
      options.signature = isSign ? sign(signable(value, { seq, salt })) : sig
      const qs = this.node.mutable.put(value, options, (err, result) => {
        if (err) {
          if (err.message === 'ERR_SEQ_MUST_EXCEED_CURRENT') {
            // legacy edge case error:
            cb(new GrapeError('302 sequence number less than current', 302))
            return
          }

          cb(new GenericErrorWrap(err))
          return
        }
        const { key } = result
        cb(err, key)
      })
      qs.on('warning', this[kOnWarning])
    } catch (err) {
      process.nextTick(cb, new GenericErrorWrap(err))
    }
  }

  immutableGet (hash, cb) {
    if (this._initError !== null) {
      return process.nextTick(cb, this._initError)
    }
    if (typeof hash === 'string') hash = this.str2buf(hash, 'hex')
    try {
      if (hash.length !== this.node.id.length) {
        process.nextTick(() => {
          cb(null, undefined) // invalid hash, straight to not found
        })
        return
      }
      const qs = this.node.immutable.get(hash, (err, value, info) => {
        if (err) {
          cb(new GenericErrorWrap(err))
          return
        }
        if (value === null && info === null) { // Not Found
          cb(null, undefined)
          return
        }
        const { id } = info
        const res = {
          id: id ? this.str2hex(id) : null,
          seq: null,
          sig: null,
          v: value.toString(),
          k: this.str2hex(hash),
          m: false
        }
        cb(null, compat(res))
      })
      qs.on('warning', this[kOnWarning])
    } catch (err) {
      process.nextTick(cb, new GenericErrorWrap(err))
    }
  }

  mutableGet (opts, cb) {
    if (this._initError !== null) {
      return process.nextTick(cb, this._initError)
    }
    if (opts.salt && !Buffer.isBuffer(opts.salt)) {
      opts.salt = Buffer.from(opts.salt + '')
    }
    try {
      const { hash, key = hash, ...options } = opts
      const _key = typeof key === 'string' ? this.str2buf(key, 'hex') : key
      if (_key.length !== this.node.id.length) {
        process.nextTick(() => {
          cb(null, undefined) // invalid hash, straight to not found
        })
        return
      }
      const qs = this.node.mutable.get(_key, options, (err, info) => {
        if (err) {
          cb(new GenericErrorWrap(err))
          return
        }
        const { value, id = '', signature: sig, salt, seq = null } = info
        if (value === null) { // not found
          cb(null, undefined)
          return
        }
        const res = {
          id: id ? this.str2hex(id) : null,
          v: value ? value.toString() : value,
          sig: sig ? sig.toString('hex') : sig,
          k: this.str2hex(_key),
          salt: salt ? salt.toString() : null,
          seq: seq,
          m: true
        }
        cb(null, compat(res))
      })
      qs.on('warning', this[kOnWarning])
    } catch (err) {
      process.nextTick(cb, new GenericErrorWrap(err))
    }
  }

  transportHttp (cb) {
    if (!this.conf.api_port) return cb(new Error('ERR_NO_PORT'))
    const maxPayloadSize = this.conf.check_maxPayloadSize

    const handleRequest = (req, rep, msg, cb) => {
      rep.setHeader('Content-Type', 'application/json')
      try {
        msg = JSON.parse(msg)
      } catch (e) {
        cb(new GrapeError('ERR_GRAPE_PAYLOAD_INVALID', 400))
        return
      }
      const type = req.url.substr(1)
      const data = msg.data
      if (!data) {
        cb(new GrapeError('ERR_GRAPE_DATA_KEY_REQUIRED', 400))
        return
      }
      this.onRequest(type, data, cb)
    }

    const server = http.createServer((req, res) => {
      getRawBody(req, { limit: maxPayloadSize }, (err, buf) => {
        if (err) {
          if (err.type === 'entity.too.large') {
            err = new GrapeError('ERR_GRAPE_PAYLOAD_SIZE', err.statusCode)
            res.statusCode = err.code
            res.end(err.toString())
            return
          }
          err = new GenericErrorWrap(err)
          res.statusCode = err.code
          res.end(err.toString())
          return
        }
        handleRequest(req, res, buf.toString(), (err, result) => {
          if (err) {
            if (!(err instanceof GrapeError)) err = new GenericErrorWrap(err)
            res.statusCode = err.code
            res.end(err.toString())
            return
          }
          res.end(JSON.stringify(result))
        })
      })
    })

    const listenArgs = [this.conf.api_port]

    if (this.conf.host) {
      listenArgs.push(this.conf.host)
    }
    listenArgs.push(() => {
      server.removeListener('error', cb)
      cb()
    })
    server.once('error', cb)
    server.listen.apply(server, listenArgs)
    this._interface.http = server
  }

  address () {
    if (!this.dht) throw new Error('ERR_NOT_BOUND')
    return this.dht.address()
  }

  start (cb) {
    cb = cb || ((err) => {
      if (err) {
        process.nextTick(() => {
          this.emit('error', err)
        })
      }
    })

    if (this._active) {
      debug('skipping start, since Grape is already active')
      return cb()
    }
    debug('starting')
    this.createNode(
      (err, node) => {
        this.node = node
        if (err) {
          this.stop()
          return cb(err)
        }
        this.transportHttp(err => {
          if (err) {
            this.stop()
            return cb(err)
          }
          this._active = true
          cb()
        })
      }
    )
  }

  stop (cb = noop) {
    let count = !!this.node + !!this._interface.http
    this._initError = null
    const closed = (err) => {
      if (--count > 0) return
      this.emit('close')
      delete this.node
      delete this._interface.http
      this._active = false
      cb(err)
    }
    if (count === 0) process.nextTick(closed)
    if (this.node) {
      this.node.once('close', closed)
      this.node.destroy()
    }
    if (this._interface.http) {
      this._interface.http.close(closed)
    }
  }
}

module.exports = Grape
