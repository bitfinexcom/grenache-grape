'use strict'

const test = require('brittle')

const _ = require('./../lib/utils')

test('utils', (t) => {
  t.test('camelCase', (t) => {
    t.test('should convert strings to camelCase', (t) => {
      t.is(_.camelCase('hello_world'), 'helloWorld')
      t.is(_.camelCase('Hello-world'), 'helloWorld')
      t.is(_.camelCase('-hello_world'), 'helloWorld')
      t.is(_.camelCase('hello world'), 'helloWorld')
    })

    t.test('should handle single words', (t) => {
      t.is(_.camelCase('hello'), 'hello')
      t.is(_.camelCase('Hello'), 'hello')
    })

    t.test('should handle empty strings', (t) => {
      t.is(_.camelCase(''), '')
    })

    t.test('should handle strings wt.testh numbers', (t) => {
      t.is(_.camelCase('hello1_world2'), 'hello1World2')
    })

    t.test('should throw on non string input', (t) => {
      t.exception.all(() => _.camelCase(123))
    })
  })

  t.test('upperFirst', (t) => {
    t.test('should capt.testalize the first letter of a lowercase word', (t) => {
      t.is(_.upperFirst('hello'), 'Hello')
    })

    t.test('should leave the rest of the string unchanged', (t) => {
      t.is(_.upperFirst('hELLO'), 'HELLO')
    })

    t.test('should work wt.testh a single character', (t) => {
      t.is(_.upperFirst('a'), 'A')
    })

    t.test('should return an empty string if input is empty', (t) => {
      t.is(_.upperFirst(''), '')
    })

    t.test('should handle strings wt.testh non-alphabetic first characters', (t) => {
      t.is(_.upperFirst('1abc'), '1abc')
      t.is(_.upperFirst('-abc'), '-abc')
    })

    t.test('should throw on non string input', (t) => {
      t.exception.all(() => _.upperFirst(123))
    })
  })
})
