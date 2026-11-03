'use strict'

const test = require('brittle')
const fetch = require('node-fetch')

const {
  createTwoGrapes
} = require('./helper.js')

async function jsonPost (url, data, cb) {
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    let res = await resp.text()
    try {
      res = JSON.parse(res)
    } catch (err) {
      // noop
    }

    if (!resp.ok) {
      const err = new Error(res)
      err.code = resp.status
      throw err
    }

    return cb(null, res)
  } catch (err) {
    console.log(err)
    return cb(err)
  }
}

function getValue (h, cb) {
  return jsonPost('http://127.0.0.1:40001/get', { rid: 'test', data: h }, cb)
}

test('put-get-bep44', (t) => {
  t.test('works with hashes', { timeout: 5000 }, async (t) => {
    const { grape1, grape2, stop } = createTwoGrapes()

    grape1.on('ready', () => {
      grape1.announce('rest:util:net', 1337, () => { })
    })

    await new Promise(resolve => {
      grape2.on('announce', () => {
        const data = {
          v: 'hello world'
        }

        jsonPost('http://127.0.0.1:40001/put', { rid: 'test', data }, (err, hash) => {
          if (err) throw err

          getValue(hash, (err, res) => {
            if (err) throw err

            t.is(res.v, 'hello world')

            getValue({ hash }, (err, res) => {
              if (err) throw err

              t.is(res.v, 'hello world')

              stop(resolve)
            })
          })
        })
      })
    })
  })
})
