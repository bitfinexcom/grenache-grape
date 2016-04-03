# Grenache Grape

DHT based high-performance microservices framework, by Bitfinex

### Usage

##### Install

```
// Install global (run binary)
npm install -g grenache-grape
```

```
// Install locally to project (programmatic approach)
npm install --save grenache-grape
```

##### Run Binary

```
// help
grape --help
````

````
// Run 3 Grapes
grape --dp 20001 --ap 30001 --bn '127.0.0.1:20002,127.0.0.1:20003'
grape --dp 20002 --ap 30002 --bn '127.0.0.1:20001,127.0.0.1:20003'
grape --dp 20003 --ap 30003 --bn '127.0.0.1:20001,127.0.0.1:20002'
```

### Technology
* DHT definition: http://www.bittorrent.org/beps/bep_0005.html

#### Definitions
**1. Grape: Grenache Discovery Node**
DHT Distributed Nodes

**2. Client: Grenache Client implementation on specific transports**


### Client Implementations

##### Node.JS
* https://github.com/bitfinexcom/grenache-nodejs-zmq : ZeroMQ based Grape microservices
* https://github.com/bitfinexcom/grenache-nodejs-ws : WebSocket based Grape microservices

##### Ruby
