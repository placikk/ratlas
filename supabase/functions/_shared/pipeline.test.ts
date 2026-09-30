// @vitest-environment node
import { expect, test } from 'vitest'
import { parseSightingForm, photoPlacement, PRIVATE_BUCKET, PUBLIC_BUCKET } from './pipeline.ts'
import type { VerificationResult } from './verification.ts'

function form(overrides: Record<string, string | Blob | null> = {}) {
  const values: Record<string, string | Blob | null> = {
    photo: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
    lat: '51.11',
    lon: '17.032',
    accuracy: '12.5',
    capturedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value === null) continue
    if (value instanceof Blob) data.append(key, value, 'photo.jpg')
    else data.append(key, value)
  }
  return data
}

test('odczytuje poprawny formularz', async () => {
  const parsed = await parseSightingForm(form())
  expect(parsed).toEqual({
    ok: true,
    input: { lat: 51.11, lon: 17.032, accuracyM: 12.5, capturedAt: '2026-10-01T10:00:00.000Z' },
    photo: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  })
})

test.each([
  ['brak zdjęcia', { photo: null }],
  ['zły typ zdjęcia', { photo: new Blob(['x'], { type: 'image/png' }) }],
  ['za duże zdjęcie', { photo: new Blob([new Uint8Array(3 * 1024 * 1024 + 1)], { type: 'image/jpeg' }) }],
  ['szerokość poza zakresem', { lat: '91' }],
  ['długość nie jest liczbą', { lon: 'abc' }],
  ['ujemna dokładność', { accuracy: '-1' }],
  ['zła data', { capturedAt: 'wczoraj' }],
  ['brak dokładności', { accuracy: null }],
  ['puste lat', { lat: '' }],
  ['lon z samych spacji', { lon: '  ' }],
])('odrzuca: %s', async (_name, overrides) => {
  expect(await parseSightingForm(form(overrides))).toEqual({ ok: false })
})

const verification: VerificationResult = {
  ratCount: 1,
  isSelfie: false,
  isScreenOrPrint: false,
  isToyOrDrawing: false,
  hasThirdPartyFaces: false,
  tags: [],
  raw: {},
}

test('zaliczone zdjęcie trafia do publicznego bucketu', () => {
  expect(photoPlacement('u1', 's1', verification)).toEqual({ bucket: PUBLIC_BUCKET, path: 's1.jpg' })
})

test('selfie i zgłoszenia bez weryfikacji trafiają do prywatnego bucketu', () => {
  expect(photoPlacement('u1', 's1', { ...verification, isSelfie: true })).toEqual({ bucket: PRIVATE_BUCKET, path: 'u1/s1.jpg' })
  expect(photoPlacement('u1', 's1', null)).toEqual({ bucket: PRIVATE_BUCKET, path: 'u1/s1.jpg' })
})
