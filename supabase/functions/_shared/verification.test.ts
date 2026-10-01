// @vitest-environment node
import { expect, test } from 'vitest'
import { isPublicCandidate, parseVerification, type VerificationResult } from './verification.ts'

const base = {
  ratCount: 2,
  isSelfie: false,
  isScreenOrPrint: false,
  isToyOrDrawing: false,
  hasThirdPartyFaces: false,
  tags: ['smietnik', 'kot', 'deszcz'],
}

test('odczytuje poprawną odpowiedź i odrzuca nieznane tagi', () => {
  const result = parseVerification(base)
  expect(result).toEqual({ ...base, tags: ['smietnik', 'deszcz'], raw: base })
})

test('odrzuca odpowiedź bez wymaganych pól', () => {
  expect(() => parseVerification({ ratCount: 1 })).toThrow()
})

test('odrzuca ujemną liczbę szczurów', () => {
  expect(() => parseVerification({ ...base, ratCount: -1 })).toThrow()
})

const accepted: VerificationResult = { ...base, tags: [], raw: {} }

test.each([
  ['zaliczony szczur', accepted, true],
  ['brak weryfikacji', null, false],
  ['brak szczura', { ...accepted, ratCount: 0 }, false],
  ['zdjęcie ekranu', { ...accepted, isScreenOrPrint: true }, false],
  ['zabawka', { ...accepted, isToyOrDrawing: true }, false],
  ['selfie', { ...accepted, isSelfie: true }, false],
  ['twarze osób trzecich', { ...accepted, hasThirdPartyFaces: true }, false],
])('publiczne zdjęcie: %s', (_name, input, expected) => {
  expect(isPublicCandidate(input)).toBe(expected)
})
