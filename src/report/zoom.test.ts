import { expect, test } from 'vitest'
import { centerCrop, clampZoom, hardwareZoomRange, pinchZoom } from './zoom'

test('przybliżenie mieści się w zakresie', () => {
  expect(clampZoom(0.5, { min: 1, max: 5 })).toBe(1)
  expect(clampZoom(7, { min: 1, max: 5 })).toBe(5)
  expect(clampZoom(2.345, { min: 1, max: 5 })).toBe(2.3)
})

test('rozsunięcie palców dwa razy podwaja przybliżenie', () => {
  expect(pinchZoom(1, 100, 200, { min: 1, max: 5 })).toBe(2)
  expect(pinchZoom(2, 200, 100, { min: 1, max: 5 })).toBe(1)
  expect(pinchZoom(3, 100, 400, { min: 1, max: 5 })).toBe(5)
})

test('przybliżenie cyfrowe wycina środek kadru', () => {
  expect(centerCrop(1600, 1200, 1)).toEqual({ sx: 0, sy: 0, sw: 1600, sh: 1200 })
  expect(centerCrop(1600, 1200, 2)).toEqual({ sx: 400, sy: 300, sw: 800, sh: 600 })
})

test('zakres sprzętowego przybliżenia z możliwości aparatu', () => {
  const track = (zoom?: { min: number; max: number }) =>
    ({ getCapabilities: () => (zoom ? { zoom } : {}) }) as unknown as MediaStreamTrack
  expect(hardwareZoomRange(track({ min: 1, max: 8 }))).toEqual({ min: 1, max: 5 })
  expect(hardwareZoomRange(track({ min: 0.5, max: 3 }))).toEqual({ min: 1, max: 3 })
  expect(hardwareZoomRange(track({ min: 1, max: 1 }))).toBeNull()
  expect(hardwareZoomRange(track())).toBeNull()
  expect(hardwareZoomRange({} as MediaStreamTrack)).toBeNull()
})
