// @vitest-environment node
import { expect, test } from 'vitest'
import { parseLabels, summarize, type EvalCase } from './summary.ts'

test('czyta etykiety z CSV', () => {
  const csv = 'file,rats,screen,toy,selfie,faces\nszczur.jpg,2,0,0,0,1\nekran.jpg,1,1,0,0,0\n\n'
  expect(parseLabels(csv)).toEqual([
    { file: 'szczur.jpg', rats: 2, screen: false, toy: false, selfie: false, faces: true },
    { file: 'ekran.jpg', rats: 1, screen: true, toy: false, selfie: false, faces: false },
  ])
})

test('brak kolumny faces oznacza false', () => {
  expect(parseLabels('file,rats,screen,toy,selfie\na.jpg,1,0,0,1\n')).toEqual([
    { file: 'a.jpg', rats: 1, screen: false, toy: false, selfie: true, faces: false },
  ])
})

const rat: EvalCase = { file: 'a.jpg', rats: 1, screen: false, toy: false, selfie: false, faces: false }
const mouse: EvalCase = { file: 'mysz.jpg', rats: 0, screen: false, toy: false, selfie: false, faces: false }
const screenShot: EvalCase = { file: 'ekran.jpg', rats: 1, screen: true, toy: false, selfie: false, faces: false }
const ok = (ratCount: number, flags: Partial<{ isScreenOrPrint: boolean; isToyOrDrawing: boolean; isSelfie: boolean; hasThirdPartyFaces: boolean }> = {}) => ({
  ratCount,
  isScreenOrPrint: false,
  isToyOrDrawing: false,
  isSelfie: false,
  hasThirdPartyFaces: false,
  ...flags,
})

test('liczy precyzję i czułość rozpoznania „prawdziwy szczur”', () => {
  const summary = summarize([
    { evalCase: rat, predicted: ok(1) },
    { evalCase: { ...rat, file: 'b.jpg', rats: 3 }, predicted: ok(2) },
    { evalCase: mouse, predicted: ok(1) },
    { evalCase: screenShot, predicted: ok(1, { isScreenOrPrint: true }) },
    { evalCase: { ...rat, file: 'c.jpg' }, predicted: ok(0) },
    { evalCase: { ...rat, file: 'd.jpg' }, predicted: null },
  ])

  expect(summary).toMatchObject({
    total: 6,
    failed: 1,
    truePositive: 2,
    falsePositive: 1,
    trueNegative: 1,
    falseNegative: 1,
    precision: 2 / 3,
    recall: 2 / 3,
    exactCount: 1,
  })
  expect(summary.mistakes).toEqual([
    'b.jpg: oczekiwano 3 szczurów, model podał 2',
    'mysz.jpg: model uznał za szczura',
    'c.jpg: model nie uznał za szczura',
    'd.jpg: brak odpowiedzi modelu',
  ])
})

test('liczy trafność flag selfie i twarzy oraz wypisuje przeoczenia', () => {
  const summary = summarize([
    { evalCase: { ...rat, file: 's1.jpg', selfie: true }, predicted: ok(1, { isSelfie: true }) },
    { evalCase: { ...rat, file: 's2.jpg', selfie: true }, predicted: ok(1) },
    { evalCase: { ...rat, file: 's3.jpg' }, predicted: ok(1, { isSelfie: true }) },
    { evalCase: { ...rat, file: 'f1.jpg', faces: true }, predicted: ok(1) },
    { evalCase: { ...rat, file: 'f2.jpg', faces: true }, predicted: ok(1, { hasThirdPartyFaces: true }) },
    { evalCase: { ...rat, file: 'x.jpg', faces: true }, predicted: null },
  ])

  expect(summary.selfie).toEqual({ correct: 3, total: 5 })
  expect(summary.faces).toEqual({ correct: 4, total: 5 })
  expect(summary.privacyMisses).toEqual([
    's2.jpg: model przeoczył selfie',
    'f1.jpg: model przeoczył twarz osoby trzeciej',
  ])
})
