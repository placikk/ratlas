import { expect, test } from 'vitest'
import { checkNickname } from './nickname'

test.each([
  ['Szczurek', null],
  ['Szczurołap_1', null],
  ['ab-ę', null],
  ['  Ola  ', null],
  ['ab', 'too_short'],
  ['a'.repeat(21), 'too_long'],
  ['a b', 'bad_chars'],
  ['szczur!', 'bad_chars'],
  ['🐀🐀🐀', 'bad_chars'],
])('checkNickname(%j) = %j', (input, expected) => {
  expect(checkNickname(input)).toBe(expected)
})
