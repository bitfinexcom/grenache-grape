# [Grenache](https://github.com/bitfinexcom/grenache) Grape implementation

### Details
- [Project Homepage](https://github.com/bitfinexcom/grenache) 

### Setup

#### Install

```
// Install global (run binary)
npm install -g grenache-grape
```

```
// Install locally to project (programmatic approach)
npm install --save grenache-grape
```

#### Run Binary

```
// help
grape --help
````

````
// Run 3 Grapes
grape -h 127.0.0.1 --dp 20001 --apw 30001 --aph 30002 --bn '127.0.0.1:20002,127.0.0.1:20003'
grape --dp 20002 --apw 40001 --aph 40002 --bn '127.0.0.1:20001,127.0.0.1:20003'
grape --dp 20003 --apw 50001 --aph 50001 --bn '127.0.0.1:20001,127.0.0.1:20002'
```

#### Integrate in your Code

```
var Grape = require('grenache-grape').Grape

var g = new Grape({
  //host: '127.0.0.1', // if undefined the Grape binds all interfaces
  dht_port: 20001,
  dht_bootstrap: [
    '127.0.0.1:20002'
  ],
  api_port: 30001
  api_port_http: 40001
})

g.start()
```

### Implementations

##### Node.JS Clients
* https://github.com/bitfinexcom/grenache-nodejs-ws : WebSocket based Grape microservices
* https://github.com/bitfinexcom/grenache-nodejs-http : HTTP based Grape microservices
* https://github.com/bitfinexcom/grenache-nodejs-zmq : ZeroMQ based Grape microservices

##### Ruby Clients
* https://github.com/bitfinexcom/grenache-ruby-ws : WebSocket based Grape microservices
* https://github.com/bitfinexcom/grenache-ruby-http : HTTP based Grape microservices
