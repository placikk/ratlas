// @vitest-environment node
import jpeg from 'jpeg-js'
import { expect, test } from 'vitest'
import { differenceHash, hammingDistance } from './imageHash.ts'

// Obraz testowy: poziomy gradient z „plamą” — deterministyczny, z wyraźną strukturą.
function makeJpeg(width: number, height: number, quality: number, mirrored = false): Uint8Array {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const u = mirrored ? width - 1 - x : x
      const blob = Math.hypot(u - width * 0.3, y - height * 0.6) < height * 0.2 ? 90 : 0
      const value = Math.min(255, Math.round((u / width) * 160 + (y / height) * 40 + blob))
      data[i] = value
      data[i + 1] = value
      data[i + 2] = value
      data[i + 3] = 255
    }
  }
  return new Uint8Array(jpeg.encode({ data, width, height }, quality).data)
}

test('odcisk ma 16 znaków szesnastkowych', () => {
  expect(differenceHash(makeJpeg(160, 120, 90))).toMatch(/^[0-9a-f]{16}$/)
})

test('to samo zdjęcie w innej jakości i rozmiarze ma prawie ten sam odcisk', () => {
  const original = differenceHash(makeJpeg(640, 480, 90))
  expect(hammingDistance(original, differenceHash(makeJpeg(640, 480, 40)))).toBeLessThanOrEqual(6)
  expect(hammingDistance(original, differenceHash(makeJpeg(320, 240, 80)))).toBeLessThanOrEqual(6)
})

test('lustrzane odbicie ma zupełnie inny odcisk', () => {
  const original = differenceHash(makeJpeg(640, 480, 90))
  expect(hammingDistance(original, differenceHash(makeJpeg(640, 480, 90, true)))).toBeGreaterThan(20)
})

test('odległość Hamminga liczy różne bity', () => {
  expect(hammingDistance('0000000000000000', '0000000000000003')).toBe(2)
  expect(hammingDistance('ffffffffffffffff', '0000000000000000')).toBe(64)
})
