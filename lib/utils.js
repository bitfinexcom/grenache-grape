'use strict'

const camelCase = (str) => {
  return str.replace(/(?:^\w|[A-Z]|\b\w|-\w|_\w)/g, (word, i) => {
    return i === 0 ? word.toLowerCase() : word.toUpperCase()
  }).replace(/(\s|_|-)+/g, '')
}

const upperFirst = str => str.charAt(0).toUpperCase() + str.slice(1)

module.exports = {
  camelCase,
  upperFirst
}
