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
  }

  createNode (cb) {
    const dht = this.dht = DHT({
      // maxTables: this.conf.dht_maxTables,
      // maxValues: this.conf.dht_maxValues,
      bootstrap: this.conf.dht_bootstrap || undefined,
      // timeBucketOutdated: this.conf.dht_nodeLiveness,
      maxAge: this.conf.dht_peer_maxAge
    })

    dht.on('announce', (ih, _peer) => {
      const val = this.hex2str(ih)
      debug(this.conf.dht_port, 'announce', val)
      this.emit('announce', val)
    })

    dht.on('warning', () => {
      debug(this.conf.dht_port, 'warning')
      this.emit('warning')
    })

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

  announce (val, port = this.conf.dht_port, cb) {
    if (!_.isInteger(port)) {
      return cb(new Error('ERR_GRAPE_SERVICE_PORT'))
    }

    cb = cb || noop
    this.node.announce(
      this.str2hashbuf(val),
      { port },
      cb
    )
  }

  lookup (val, cb) {
    const ih = this.str2hashbuf(val)

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

  get (opts, cb) {
    if (typeof opts === 'string') opts = this.str2buf(opts, 'hex')
    if (Buffer.isBuffer(opts)) opts = { hash: opts }

    if (opts.salt && !Buffer.isBuffer(opts.salt)) {
      opts.salt = this.str2buf(opts.salt)
    }

    try {
      this.node.get(opts.hash, opts, (err, res) => {
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

        if (res.token) {
          res.token = res.token.toString('hex')
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
