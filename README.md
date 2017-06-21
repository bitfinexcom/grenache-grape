# [Grenache](https://github.com/bitfinexcom/grenache) Grape implementation

<img src="logo.png" width="15%" />

Grenache is a micro-framework for connecting microservices. Its simple and optimized for performance.

Internally, Grenache uses Distributed Hash Tables (DHT, known from Bittorrent) for Peer to Peer connections. You can find more details how Grenche internally works at the [Main Project Homepage](https://github.com/bitfinexcom/grenache).

Grapes are the backbone of Grenache. They manage the DHT, the base of our virtual network.

## Install

```
// Install global (run binary)
npm install -g grenache-grape
```

```
// Install locally to project (programmatic approach)
npm install --save grenache-grape
```

## Run in Binary Mode

```
grape --help

Usage: grape --dp <dht-port> --aph <http-api-port> --bn <nodes>
[--dc dht-concurrency] [--b bind-to-address]

Options:
  -b, --bind               Listening host                               [string]
  --dp, --dht_port         DHT listening port                [number] [required]
  --dc, --dht_concurrency  DHT concurrency                              [number]
  --aph, --api_port_http   HTTP api port                     [number] [required]
  --bn, --bootstrap        Bootstrap nodes                   [string] [required]
  --help                   Show help                                   [boolean]
  --version                Show version number                         [boolean]
```

```
// Run 3 Grapes
grape -b 127.0.0.1 --dp 20001 --dc 32 --aph 30001 --bn '127.0.0.1:20002,127.0.0.1:20003'
grape --dp 20002 --aph 40001 --dc 32 --bn '127.0.0.1:20001,127.0.0.1:20003'
grape --dp 20003 --aph 50001 --dc 32 --bn '127.0.0.1:20001,127.0.0.1:20002'
```

## Integrate in your Code

```
const Grape = require('grenache-grape').Grape

const g = new Grape({
  // host: '127.0.0.1', // if undefined the Grape binds all interfaces
  dht_port: 20001,
  dht_bootstrap: [
    '127.0.0.1:20002'
  ],
  api_port_http: 30001
})

g.start()
```

## API

### Class: Grape

#### new Grape(options)

 - `options` &lt;Object&gt; Options for the link
    - `host` &lt;String&gt; IP to bind to. If null, Grape binds to all interfaces
    - `dht_maxTables` &lt;Number&gt; Maximum number of DH tables
    - `dht_port &lt;Number&gt; Port for DHT
    - `dht_concurrency &lt;Number&gt; Concurrency for DHT
    - `dht_bootstrap`: &lt;Array&gt; Bootstrap servers
    - `api_port_http` &lt;Number&gt; Grenache API HTTP Port
    - `timeslot` &lt;Number&gt; Timeslot used for lookup

#### Event: 'ready'

Emitted when the DHT is fully bootstrapped.

#### Event: 'listening'

Emitted when the DHT is listening.

#### Event: 'peer'

Emitted when a potential peer is found.

#### Event: 'node'

Emitted when the DHT finds a new node.


#### Event: 'warning'

Emitted when a peer announces itself in order to be stored in the DHT.


#### Event: 'announce'

Emitted when a peer announces itself in order to be stored in the DHT.


## Implementations

### Node.JS Clients
* https://github.com/bitfinexcom/grenache-nodejs-ws: WebSocket based Grape microservices
* https://github.com/bitfinexcom/grenache-nodejs-http: HTTP based Grape microservices
* https://github.com/bitfinexcom/grenache-nodejs-zmq: ZeroMQ based Grape microservices
* https://github.com/bitfinexcom/grenache-nodejs-ws-tls: WebSocket based Grape microservices with TLS support


### Ruby Clients
* https://github.com/bitfinexcom/grenache-ruby-ws: WebSocket based Grape microservices
* https://github.com/bitfinexcom/grenache-ruby-http: HTTP based Grape microservices
