// @vitest-environment node
import { expect, test } from 'vitest'
import { parseLabels, summarize, type EvalCase } from './summary.ts'

test('czyta etykiety z CSV', () => {
  const csv = 'file,rats,screen,toy,selfie\nszczur.jpg,2,0,0,0\nekran.jpg,1,1,0,0\n\n'
  expect(parseLabels(csv)).toEqual([
    { file: 'szczur.jpg', rats: 2, screen: false, toy: false, selfie: false },
    { file: 'ekran.jpg', rats: 1, screen: true, toy: false, selfie: false },
  ])
})

const rat: EvalCase = { file: 'a.jpg', rats: 1, screen: false, toy: false, selfie: false }
const mouse: EvalCase = { file: 'mysz.jpg', rats: 0, screen: false, toy: false, selfie: false }
const screenShot: EvalCase = { file: 'ekran.jpg', rats: 1, screen: true, toy: false, selfie: false }
const ok = (ratCount: number, flags: Partial<{ isScreenOrPrint: boolean; isToyOrDrawing: boolean; isSelfie: boolean }> = {}) => ({
  ratCount,
  isScreenOrPrint: false,
  isToyOrDrawing: false,
  isSelfie: false,
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
