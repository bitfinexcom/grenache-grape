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

Usage: grape --dp <dht-port> --aph <http-api-port> --bn <nodes> [--b
bind-to-address]

Options:
  -b, --bind                 Listening host                             [string]
  --dp, --dht_port           DHT listening port              [number] [required]
  --dht_maxValues            DHT max values                             [number]
  --bn, --bootstrap          Bootstrap nodes                 [string] [required]
  --aph, --api_port          HTTP api port                   [number] [required]
  --dht_peer_maxAge, --dpa   Max age for peers in DHT                   [number]
  --dnl, --dht_nodeLiveness  Interval in ms to check for dead nodes     [number]
  --check_maxPayloadSize     Limit for max payload size                 [number]
  --help                     Show help                                 [boolean]
  --version                  Show version number                       [boolean]
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
  api_port: 30001
})

g.start()
```

## API

### Class: Grape

#### new Grape(options)

 - `options` &lt;Object&gt; Options for the link
    - `host` &lt;String&gt; IP to bind to. If null, Grape binds to all interfaces
    - `dht_maxValues` &lt;Number&gt; Maximum number of DHT values
    - `dht_port` &lt;Number&gt; Port for DHT
    - `dht_bootstrap`: &lt;Array&gt; Bootstrap servers
    - `dht_peer_maxAge` &lt;Number&gt; maxAge for DHT peers
    - `api_port` &lt;Number&gt; Grenache API HTTP Port

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

## RPC API

### Immutable Get

#### `POST /get` `{data: hash}`
#### `POST /get` `{data: {hash, m: false}}`

`hash`: A hex string of the hash of the stored value. If `hash` is supplied inside an object, supply an `m` property set to false to disambiguate between mutable/immutable storage.

#### `POST /get` `{data: {hash}}` **Deprecated** **Legacy**

A `hash` in an object with no `m` property should be considered legacy and upgraded to one of the above forms. If this form is used, the request will first attempt a to get the value from the mutable store before attempting the immutable store, so this will be the slowest way to reference immutable data.

#### Response Body

The response body of an Immutable Get takes the following form:

```js
{ id: <hex string of responding node id>,
  seq: null, // always null for immutable gets
  sig: null, // always null for immutable gets
  v: <stored value>,
  k: <hash hex string>,
  m: false // always false for immutable gets
}
```

### Immutable Put

#### `POST /put` `{data: {v}}`

The `v` property is the value to store. 

#### Response Body

The response body will be a hex string containing a hash of the value. This can be passed to a `POST /get` request to fetch the stored value.

### Mutable Get

#### `POST /get` `{data: {key}}`
#### `POST /get` `{data: {hash, m: true}}`

`key`: A hex string of the public key for the signed data. 

Mutable data is stored using a public key, so `hash` is a misnomer. However for backwards compatiblity `hash` can also be used to supply the public key for the mutable data. For best results use `hash` with `m: true` (or use `key` instead).

#### `POST /get` `{data: {hash}}` **Deprecated** **Legacy**

A `hash` in an object with no `m` property should be considered legacy and upgraded to one of the above forms.

#### Response Body

The response body of a Mutable Get takes the following form:

```js
{ id: <hex string of responding node id>,
  seq: <monotonically increasing sequence number>,
  sig: <signature hex string>,
  v: <stored value>,
  k: <public key hex string>,
  salt: <hex string hash of salt - if any>
  m: true // always true for mutable gets
}
```

### Mutable Put

#### `POST /put` `{data: {k, v, sig, [seq, salt]}}`

`k`: The signed public key as a hex string. Required
`v`: The value to store. Required
`sig`: The signature as a hex string corresponding to the public key and value (and salt if supplied). Required
`seq`: The sequence number, used for versioning. Optional
`salt`: The salt as a normal string, this will be internally hashed before sending

#### Response Body

The response body will be a hex string representing of the public key.

## Implementations

### Node.JS Clients
* https://github.com/bitfinexcom/grenache-nodejs-ws: WebSocket based Grape microservices
* https://github.com/bitfinexcom/grenache-nodejs-http: HTTP based Grape microservices
* https://github.com/bitfinexcom/grenache-nodejs-zmq: ZeroMQ based Grape microservices


### Ruby Clients
* https://github.com/bitfinexcom/grenache-ruby-ws: WebSocket based Grape microservices
* https://github.com/bitfinexcom/grenache-ruby-http: HTTP based Grape microservices


### CLI Clients
* https://github.com/bitfinexcom/grenache-cli: Command Line Interface for Grape microservices
