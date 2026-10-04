// @vitest-environment node
import { expect, test } from 'vitest'
import { chunk, groupPathsByBucket } from './storageCleanup.ts'

test('grupuje ścieżki zdjęć według bucketu', () => {
  const grouped = groupPathsByBucket([
    { photo_bucket: 'map-photos', photo_path: 'a.jpg' },
    { photo_bucket: 'sightings-private', photo_path: 'u1/b.jpg' },
    { photo_bucket: 'map-photos', photo_path: 'c.jpg' },
  ])
  expect([...grouped.entries()]).toEqual([
    ['map-photos', ['a.jpg', 'c.jpg']],
    ['sightings-private', ['u1/b.jpg']],
  ])
})

test('dzieli listę na paczki', () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  expect(chunk([], 100)).toEqual([])
})
