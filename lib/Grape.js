'use strict'

var DHT = require('bittorrent-dht')
var _ = require('lodash')
var _s = require('underscore.string')
var async = require('async')
var Events = require('events')
var UWS = require('uws')
var debug = require('debug')('grenache:grape')

var noop = () => {}

class Grape extends Events {

  constructor(conf) {
    super()

    this.conf = {
      dht_port: 1,
      dht_bootstrap: [],
      api_port: null,
      timeslot: 2500
    }

    _.extend(this.conf, conf)

    this._mem = {}
  }

  create_node(port, bootstrap, cb) {
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

    function handleBootstrapError(err) {
      cb(err)
      cb = noop
    }

    return dht
  }

  hex2Str(val) {
    return (new Buffer(val, 'hex')).toString()
  }

  str2Hex(val) {
    return (new Buffer(val)).toString('hex')
  }

  timeslot(offset) {
    if (!offset) {
      offset = 0
    }

    var ts = (new Date()).getTime()
    ts -= offset * this.conf.timeslot * -1
    ts = ts - (ts % this.conf.timeslot)
    return ts
  }

  onRequest(type, data, cb) {
    var met = 'handle' + _s.camelize('-' + type)

    if (!this[met]) {
      cb('ERR_REQ_NOTFOUND')
      return
    }

    this[met](data, (res) => {
      cb(null, res)
    })
  }

  handleLookup(_val, cb) {
    if (!_val || !_.isString(_val)) {
      cb('ERR_GRAPE_LOOKUP')
      return
    }

    var queue = []
    var data = []

    for (var i = 0; i < 2; i++) {
      (i => {
        queue.push(next => {
          var val = [_val, this.timeslot(0 - i)].join('-')
          this.lookup(val, res => {
            data = _.union(data, res)
            next()
          })
        })
      })(i)
    }

    async.parallel(queue, () => {
      cb(data)
    })
  }

  handleAnnounce(val, cb) {
    if (!val || !_.isArray(val)) {
      cb('ERR_GRAPE_ANNOUNCE')
      return
    }

    val[0] = [val[0], this.timeslot(0)].join('-')

    this.announce(val[0], val[1], cb)
  }

  announce(val, port, cb) {
    this.node.announce(this.str2Hex(val), port || this.conf.dht_port, cb ? cb : () => {
    })
  }

  lookup(val, cb) {
    var ih = this.str2Hex(val)

    this.node.lookup(ih, (err) => {
      var res = []

      if (this._mem[ih]) {
        let me = this._mem[ih]
        res = _.reduce(me.peers, (acc, v, k) => {
          acc.push(k)
          return acc
        }, [])
      }

      cb(res)
    })
  }

  start(cb) {
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

        cb()
        cb = noop
      })

      // We have to do this because UWS.Server does not call the callback with an error if the port is already in use.
      this.transport.httpServer.once('error', handleApiBootstrapError)
      function handleApiBootstrapError(err) {
        cb(err)
        cb = noop
      }
    })
  }

  stop(cb) {
    var node = this.node
    var transport = this.transport

    // this is done to maintain the same API from before the callback as added
    delete this.node
    delete this.transport

    async.series([
      (cb) => node ? node.destroy(cb) : cb(),
      (cb) => {
        // Transport.close does not accept a callback, but should since its underlying implementation accepts one
        //transport ? transport.close(cb) : cb()

        if (!transport) return cb()
        
        transport.close()

        // Under the hood it creates a httpServer instance then doesn't clean it up
        transport.httpServer.close();
        cb()
      }
    ], cb)
  }
}

module.exports = Grape
