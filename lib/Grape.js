'use strict'

const DHT = require('bittorrent-dht')
const _ = require('lodash')
const async = require('async')
const http = require('http')
const Events = require('events')
const UWS = require('uws')
const debug = require('debug')('grenache:grape')

const noop = () => {}

class Grape extends Events {
  constructor (conf) {
    super()

    this.conf = _.defaults({}, conf, {
      dht_maxTables: 10000,
      dht_port: 20001,
      dht_bootstrap: [],
      api_port: null,
      api_port_http: null,
      timeslot: 10000
    })

    this._interface = {}

    this._active = false
    this._mem = {}
  }

  createNode (cb) {
    const dht = new DHT({
      maxTables: this.conf.dht_maxTables,
      host: this.conf.host || false,
      bootstrap: this.conf.dht_bootstrap
    })

    dht.on('announce', (_peer, ih) => {
      const val = this.hex2str(ih)
      debug(this.conf.dht_port, 'announce', val)
    })

    dht.on('warning', () => {
      debug(port, 'warning')
    })

    dht.on('node', () => {
      debug(this.conf.dht_port, 'node')
    })

    dht.on('listening', () => {
      debug(this.conf.dht_port, 'listening')
    })

    dht.on('ready', () => {
      debug(this.conf.dht_port, 'ready')
    })

    dht.on('error', (err) => {
      debug(port, 'error', err)
    })

    dht.on('peer', (_peer, val, from) => {
      const ih = this.str2hex(val)

      if (!this._mem[ih]) {
        this._mem[ih] = {
          peers: {}
        }
      }

      const me = this._mem[ih]
      me._uts = Date.now()

      const peer = `${_peer.host}:${_peer.port}`

      me.peers[peer] = {
        host: peer,
        _uts: Date.now()
      }

      debug(this.conf.dht_port, 'found potential peer ' + peer + (from ? ' through ' + from.address + ':' + from.port : '') + ' for hash: ' + val)
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

  timeslot (offset, ts) {
    offset = offset || 0
    ts = ts || Date.now()
    ts -= offset * this.conf.timeslot * -1
    ts = ts - (ts % this.conf.timeslot)

    return ts
  }

  onRequest (type, data, cb) {
    const met = 'handlePeer' + _.upperFirst(_.camelCase('-' + type))

    if (!this[met]) {
      return cb(new Error('ERR_REQ_NOTFOUND'))
    }

    this[met](data, cb)
  }

  handlePeerLookup (_val, cb) {
    if (!_val || !_.isString(_val)) {
      return cb(new Error('ERR_GRAPE_LOOKUP'))
    }

    async.mapSeries([
      `${_val}-${this.timeslot(0)}`,
      `${_val}-${this.timeslot(-1)}`
    ], this.lookup.bind(this), (err, mapped) => {
      if (err) return cb(err)

      cb(null, _.union.apply(_, mapped))
    })
  }

  handlePeerAnnounce (announcement, cb) {
    if (!announcement || !_.isArray(announcement)) {
      return cb(new Error('ERR_GRAPE_ANNOUNCE'))
    }

    const [val, port] = [announcement[0], announcement[1]]

    this.announce(`${val}-${this.timeslot(0)}`, port, cb)
  }

  handlePeerPut (opts, cb) {
    this.put(opts, cb)
  }

  handlePeerGet (hash, cb) {
    this.get(hash, cb)
  }

  announce (val, port, cb) {
    cb = cb || noop
    this.node.announce(
      this.str2hex(val),
      port || this.conf.dht_port,
      cb
    )
  }

  lookup (val, cb) {
    cb = cb || noop

    const ih = this.str2hex(val)

    this.node.lookup(ih, (err) => {
      if (err) return cb(err)

      const me = this._mem[ih]
      if (me) {
        cb(null, _.keys(me.peers))
      } else {
        cb(null, [])
      }
    })
  }

  put (opts, cb) {
    cb = cb || noop

    this.node.put(opts, (err, res) => {
      if (err) return cb(err)

      cb(null, this.str2hex(res))
    })
  }

  get (hash, cb) {
    try {
      this.node.get(hash, (err, res) => {
        if (res) {
          res.id = this.str2hex(res.id)
          res.v = res.v.toString()
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

  transportWs (cb) {
    const server = new UWS.Server({
      host: this.conf.host,
      port: this.conf.api_port
    }, (err) => {
      server.httpServer.removeListener('error', handleApiBootstrapError)

      if (err) return cb(err)

      server.on('connection', socket => {
        socket.on('message', msg => {
          msg = JSON.parse(msg)

          const rid = msg[0]
          const type = msg[1]
          const data = msg[2]

          this.onRequest(type, data, (err, res) => {
            debug('Grape.reply', rid, type, err, res)
            socket.send(JSON.stringify([rid, err ? err.message : res]))
          })
        })
      })

      cb()
    })

    // We have to do this because UWS.Server does not call the callback with an error if the port is already in use.
    server.httpServer.once('error', handleApiBootstrapError)
    function handleApiBootstrapError (err) {
      cb(err)
    }

    this._interface.ws = server
  }

  transportHttp (cb) {
    if (!this.conf.api_port_http) return cb()

    let fetchRequest = (req, rep) => {
      let body = ''

      req.on('data', (data) => {
        body += data
      })

      req.on('end', () => {
        handleRequest(req, rep, body)
      })
    }

    let handleRequest = (req, rep, msg) => {
      msg = JSON.parse(msg)

      const type = req.url.substr(1)
      const data = msg.data

      this.onRequest(type, data, (err, res) => {
        rep.end(JSON.stringify(err ? err.message : res))
      })
    }

    const server = http.createServer(fetchRequest)

    const listenArgs = [this.conf.api_port_http]

    if (this.conf.host) {
      listenArgs.push(this.conf.host)
    }
    listenArgs.push(cb)

    server.listen.apply(server, listenArgs)

    this._interface.http = server
  }

  transports (cb) {
    async.series([
      (cb) => {
        this.transportWs(cb)
      },
      (cb) => {
        this.transportHttp(cb)
      }
    ], cb)
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

        this.transports((err) => {
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
        // Transport.close does not accept a callback, but should since its underlying implementation accepts one
        // transport ? transport.close(cb) : cb()
        let wsSrv = this._interface.ws
        if (!wsSrv) return cb()

        wsSrv.close()

        // Under the hood it creates a httpServer instance then doesn't clean it up
        wsSrv.httpServer.close()
        cb()
      },
      (cb) => {
        let httpsSrv = this._interface.http
        if (!httpsSrv) return cb()

        httpsSrv.close()
        cb()
      }
    ], (err) => {
      delete this.node
      delete this._interface.ws
      delete this._interface.http

      this._active = false

      cb(err)
    })
  }
}

module.exports = Grape
