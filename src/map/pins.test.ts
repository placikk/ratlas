import { expect, test } from 'vitest'
import { pinOpacity, timeAgo, toFeatureCollection, type Pin } from './pins'

const NOW = Date.parse('2026-10-08T12:00:00Z')
const DAY = 86_400_000

test.each([
  [0, 1],
  [3.5, 0.5],
  [6.9, 0.15],
  [10, 0.15],
])('pinezka sprzed %f dni ma przezroczystość %f', (days, expected) => {
  const createdAt = new Date(NOW - days * DAY).toISOString()
  expect(pinOpacity(createdAt, NOW, 7)).toBeCloseTo(expected, 5)
})

test('zamienia pinezki na GeoJSON dla mapy', () => {
  const pins: Pin[] = [
    { id: 'a', lon: 17.03, lat: 51.11, rats: 3, createdAt: new Date(NOW).toISOString(), photoPath: 'a.jpg', nickname: 'Ala', isMine: true },
    { id: 'b', lon: 17.05, lat: 51.12, rats: 1, createdAt: new Date(NOW - 7 * DAY).toISOString(), photoPath: 'b.jpg', nickname: null, isMine: false },
  ]
  expect(toFeatureCollection(pins, NOW, 7)).toEqual({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: 0, properties: { id: 'a', rats: 3, opacity: 1, mine: true }, geometry: { type: 'Point', coordinates: [17.03, 51.11] } },
      { type: 'Feature', id: 1, properties: { id: 'b', rats: 1, opacity: 0.15, mine: false }, geometry: { type: 'Point', coordinates: [17.05, 51.12] } },
    ],
  })
})

test.each([
  [30_000, 'przed chwilą'],
  [5 * 60_000, '5 minut temu'],
  [22 * 60_000, '22 minuty temu'],
  [60 * 60_000, '1 godzinę temu'],
  [2 * 60 * 60_000, '2 godziny temu'],
  [DAY, 'wczoraj'],
  [3 * DAY, '3 dni temu'],
])('timeAgo dla %i ms', (ago, expected) => {
  expect(timeAgo(new Date(NOW - ago).toISOString(), NOW, 'przed chwilą')).toBe(expected)
})
