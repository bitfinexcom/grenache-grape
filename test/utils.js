/* eslint-env mocha */

'use strict'

const assert = require('chai').assert

const _ = require('./../lib/utils')

describe('utils', () => {
  describe('camelCase', () => {
    it('should convert strings to camelCase', () => {
      assert.strictEqual(_.camelCase('hello_world'), 'helloWorld')
      assert.strictEqual(_.camelCase('Hello-world'), 'helloWorld')
      assert.strictEqual(_.camelCase('-hello_world'), 'helloWorld')
      assert.strictEqual(_.camelCase('hello world'), 'helloWorld')
    })

    it('should handle single words', () => {
      assert.strictEqual(_.camelCase('hello'), 'hello')
      assert.strictEqual(_.camelCase('Hello'), 'hello')
    })

    it('should handle empty strings', () => {
      assert.strictEqual(_.camelCase(''), '')
    })

    it('should handle strings with numbers', () => {
      assert.strictEqual(_.camelCase('hello1_world2'), 'hello1World2')
    })

    it('should throw on non string input', () => {
      assert.throws(() => _.camelCase(123))
    })
  })

  describe('upperFirst', () => {
    it('should capitalize the first letter of a lowercase word', () => {
      assert.strictEqual(_.upperFirst('hello'), 'Hello')
    })

    it('should leave the rest of the string unchanged', () => {
      assert.strictEqual(_.upperFirst('hELLO'), 'HELLO')
    })

    it('should work with a single character', () => {
      assert.strictEqual(_.upperFirst('a'), 'A')
    })

    it('should return an empty string if input is empty', () => {
      assert.strictEqual(_.upperFirst(''), '')
    })

    it('should handle strings with non-alphabetic first characters', () => {
      assert.strictEqual(_.upperFirst('1abc'), '1abc')
      assert.strictEqual(_.upperFirst('-abc'), '-abc')
    })

    it('should throw on non string input', () => {
      assert.throws(() => _.upperFirst(123))
    })
  })
})
