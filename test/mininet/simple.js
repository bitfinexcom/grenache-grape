const mininet = require('mininet')

const mn = mininet()

const s1 = mn.createSwitch()

const bootstrap1 = mn.createHost()
const bootstrap2 = mn.createHost()

const c1 = mn.createHost()
const w1 = mn.createHost()

bootstrap1.link(s1)
bootstrap2.link(s1)
c1.link(s1)
w1.link(s1)

forward(bootstrap1, 'bootstrap1')
forward(bootstrap2, 'bootstrap2')
forward(c1, 'c1')
forward(w1, 'w1')

mn.start()
mn.on('start', function () {
  console.log('Starting bootstrap nodes')
  bootstrap1.spawn('grape --dp 20000 --aph 30000 --bn ' + bootstrap2.ip + ':20000')
  bootstrap2.spawn('grape --dp 20000 --aph 30000 --bn ' + bootstrap1.ip + ':20000')
  setTimeout(function () {
    console.log('Starting workers and clients')
    const bn = bootstrap1.ip + ':20000,' + bootstrap2.ip + ':20000'
    c1.spawn('grape --dp 20000 ---aph 30000 --bn ' + bn + ' & node client.js')
    w1.spawn('grape --dp 20000 ---aph 30000 --bn ' + bn + ' & node worker.js')
  }, 1000)
})

process.on('SIGINT', function () {
  mn.stop()
})

function forward (h, name) {
  h.on('stdout', function (data) {
    process.stdout.write(name + ' ' + data)
  })
}
