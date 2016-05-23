'use strict'

var DHT = require('bittorrent-dht')
var _ = require('lodash')
var _s = require('underscore.string')
var async = require('async')
var Events = require('events')
var UWS = require('uws')

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

  create_node(port, bootstrap) {
    var dht = new DHT({
      bootstrap: bootstrap 
    })

    dht.listen(port, () => {
      console.log(port, 'now listening')
    })

    dht.on('announce', (_peer, ih) => {
      var val = this.hex2Str(ih)
      console.log(port, 'announce', val)
    })

    dht.on('warning', () => {
      console.log(port, 'warning')
    })

    dht.on('node', () => {
      console.log(port, 'node')
    })

    dht.on('listening', () => {
      console.log(port, 'listening')
    })

    dht.on('ready', () => {
      console.log(port, 'ready')
    })

    dht.on('error', (err) => {
      console.log(port, 'error', err)
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

      console.log(port, 'found potential peer ' + peer + (from ? ' through ' + from.address + ':' + from.port : '') + ' for hash: ' + val)
    })

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
    this.node.announce(this.str2Hex(val), port || this.conf.dht_port, cb ? cb : () => {})
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

  start() {
    this.node = this.create_node(this.conf.dht_port, this.conf.dht_bootstrap)

    this.transport = new UWS.Server({ port: this.conf.api_port })

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
  }

  stop() {
    if (this.node) {
      this.node.destroy()
      delete this.node
    }

    if (this.transport) {
      this.transport.close()
      delete this.transport
    }
  }
}

module.exports = Grape
