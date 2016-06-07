'use strict'

var DHT = require('bittorrent-dht')
var _ = require('lodash')
var _s = require('underscore.string')
var async = require('async')
var Events = require('events')
var UWS = require('uws')
var debug = require('debug')('grenache:grape')

var noop = () => {
}

class Grape extends Events {

  constructor (conf) {
    super()

    this.conf = {
      dht_port: 1,
      dht_bootstrap: [],
      api_port: null,
      timeslot: 2500
    }

    _.extend(this.conf, conf)

    this._running = false
    this._mem = {}
  }

  create_node (port, bootstrap, cb) {
    var dht = new DHT({
      bootstrap: bootstrap
    })

    dht.on('announce', (_peer, ih) => {
      var val = this.hex2Str(ih)
      debug(port, 'announce', val)
    })

    dht.on('warning', () => {
      debug(port, 'warning')
    })

    dht.on('node', () => {
      debug(port, 'node')
    })

    dht.on('listening', () => {
      debug(port, 'listening')
    })

    dht.on('ready', () => {
      debug(port, 'ready')
    })

    dht.on('error', (err) => {
      debug(port, 'error', err)
    })

    dht.on('peer', (_peer, val, from) => {
      var ih = this.str2Hex(val)

      if (!this._mem[ih]) {
        this._mem[ih] = {
          peers: {}
        }
      }

      var me = this._mem[ih]
      me._uts = new Date()

      var peer = 'tcp://' + _peer.host + ':' + _peer.port

      me.peers[peer] = {
        host: peer,
        _uts: new Date()
      }

      debug(port, 'found potential peer ' + peer + (from ? ' through ' + from.address + ':' + from.port : '') + ' for hash: ' + val)
    })

    dht.once('error', handleBootstrapError)

    dht.listen(port, (err) => {
      dht.removeListener('error', handleBootstrapError)
      if (err) return cb(err)

      cb(null, dht)
    })

    function handleBootstrapError (err) {
      cb(err)
      cb = noop
    }
  }

  hex2Str (val) {
    return (new Buffer(val, 'hex')).toString()
  }

  str2Hex (val) {
    return (new Buffer(val)).toString('hex')
  }

  timeslot (offset, ts) {
    offset = offset || 0
    ts = ts || Date.now()
    ts -= offset * this.conf.timeslot * -1
    ts = ts - (ts % this.conf.timeslot)
    return ts
  }

  onRequest (type, data, cb) {
    var met = 'handle' + _s.camelize('-' + type)

    if (!this[met]) {
      cb('ERR_REQ_NOTFOUND')
      return
    }

    this[met](data, (res) => {
      cb(null, res)
    })
  }

  handlePeerLookup (_val, cb) {
    if (!_val || !_.isString(_val)) {
      cb('ERR_GRAPE_LOOKUP')
      return
    }

    async.map([
      _val + '-' + this.timeslot(0),
      _val + '-' + this.timeslot(-1)
    ], this.lookup.bind(this), (err, mapped) => {
      if (err) return cb(err)

      cb(null, _.union.apply(_, mapped))
    })
  }

  handlePeerAnnounce (announcement, cb) {
    if (!announcement || !_.isArray(announcement)) {
      return cb('ERR_GRAPE_ANNOUNCE')
    }

    var val = announcement[0]
    var port = announcement[1]

    this.announce(val + '-' + this.timeslot(0), port, cb)
  }

  announce (val, port, cb) {
    cb = cb || noop

    this.start(err => {
      if (err) return cb(err)

      this.node.announce(this.str2Hex(val), port || this.conf.dht_port, cb)
    })
  }

  lookup (val, cb) {
    cb = cb || noop

    var ih = this.str2Hex(val)

    this.start(err => {
      if (err) return cb(err)

      this.node.lookup(ih, (err) => {
        if (err) return cb(err)

        var me = this._mem[ih]
        if (me) {
          cb(null, Object.keys(me.peers))
        } else {
          cb(null, [])
        }
      })
    })
  }

  start (cb) {
    cb = cb || noop

    if (this._running) {
      debug('skipping start, since Grape is already running')
      return cb()
    }

    debug('starting')

    this.create_node(this.conf.dht_port, this.conf.dht_bootstrap, (err, node) => {
      if (err) return cb(err)

      this.node = node

      this.transport = new UWS.Server({port: this.conf.api_port}, (err) => {
        this.transport.httpServer.removeListener('error', handleApiBootstrapError)

        if (err) return cb(err)

        this.transport.on('connection', socket => {
          socket.on('message', msg => {
            msg = JSON.parse(msg)

            var rid = msg[0]
            var type = msg[1]
            var data = msg[2]
            this.onRequest(type, data, (err, res) => {
              console.log('Grape.reply', rid, type, err, res)
              socket.send(JSON.stringify([rid, err || res]))
            })
          })
        })

        this._running = true

        cb()
        cb = noop
      })

      // We have to do this because UWS.Server does not call the callback with an error if the port is already in use.
      this.transport.httpServer.once('error', handleApiBootstrapError)
      function handleApiBootstrapError (err) {
        cb(err)
        cb = noop
      }
    })
  }

  stop (cb) {
    async.series([
      (cb) => this.node ? this.node.destroy(cb) : cb(),
      (cb) => {
        // Transport.close does not accept a callback, but should since its underlying implementation accepts one
        // transport ? transport.close(cb) : cb()

        if (!this.transport) return cb()

        this.transport.close()

        // Under the hood it creates a httpServer instance then doesn't clean it up
        this.transport.httpServer.close()
        cb()
      }
    ], (err) => {
      delete this.node
      delete this.transport

      this._running = false

      cb(err)
    })
  }
}

module.exports = Grape
