import { expect, test } from 'vitest'
import { fitWithin } from './photo'

test.each([
  [4032, 3024, { width: 1600, height: 1200 }],
  [3024, 4032, { width: 1200, height: 1600 }],
  [1280, 720, { width: 1280, height: 720 }],
  [1601, 1, { width: 1600, height: 1 }],
])('fitWithin(%i, %i)', (width, height, expected) => {
  expect(fitWithin(width, height, 1600)).toEqual(expected)
})
