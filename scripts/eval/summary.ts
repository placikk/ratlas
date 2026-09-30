export interface EvalCase {
  file: string
  rats: number
  screen: boolean
  toy: boolean
  selfie: boolean
}

export interface Predicted {
  ratCount: number
  isScreenOrPrint: boolean
  isToyOrDrawing: boolean
  isSelfie: boolean
}

export interface EvalOutcome {
  evalCase: EvalCase
  predicted: Predicted | null
}

export interface EvalSummary {
  total: number
  failed: number
  truePositive: number
  falsePositive: number
  trueNegative: number
  falseNegative: number
  precision: number
  recall: number
  exactCount: number
  mistakes: string[]
}

export function parseLabels(csv: string): EvalCase[] {
  return csv
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [file, rats, screen, toy, selfie] = line.split(',').map((cell) => cell.trim())
      return { file, rats: Number(rats), screen: screen === '1', toy: toy === '1', selfie: selfie === '1' }
    })
}

// „Prawdziwy szczur” = zdjęcie, które gra powinna zaliczyć (szczur, nie ekran, nie zabawka).
function expectedRealRat(evalCase: EvalCase): boolean {
  return evalCase.rats > 0 && !evalCase.screen && !evalCase.toy
}

function predictedRealRat(predicted: Predicted): boolean {
  return predicted.ratCount > 0 && !predicted.isScreenOrPrint && !predicted.isToyOrDrawing
}

export function summarize(outcomes: EvalOutcome[]): EvalSummary {
  const summary: EvalSummary = {
    total: outcomes.length,
    failed: 0,
    truePositive: 0,
    falsePositive: 0,
    trueNegative: 0,
    falseNegative: 0,
    precision: 0,
    recall: 0,
    exactCount: 0,
    mistakes: [],
  }

  for (const { evalCase, predicted } of outcomes) {
    if (!predicted) {
      summary.failed += 1
      summary.mistakes.push(`${evalCase.file}: brak odpowiedzi modelu`)
      continue
    }
    const expected = expectedRealRat(evalCase)
    const actual = predictedRealRat(predicted)
    if (expected && actual) {
      summary.truePositive += 1
      if (predicted.ratCount === evalCase.rats) summary.exactCount += 1
      else summary.mistakes.push(`${evalCase.file}: oczekiwano ${evalCase.rats} szczurów, model podał ${predicted.ratCount}`)
    } else if (!expected && actual) {
      summary.falsePositive += 1
      summary.mistakes.push(`${evalCase.file}: model uznał za szczura`)
    } else if (expected && !actual) {
      summary.falseNegative += 1
      summary.mistakes.push(`${evalCase.file}: model nie uznał za szczura`)
    } else {
      summary.trueNegative += 1
    }
  }

  const positives = summary.truePositive + summary.falsePositive
  const relevant = summary.truePositive + summary.falseNegative
  summary.precision = positives === 0 ? 0 : summary.truePositive / positives
  summary.recall = relevant === 0 ? 0 : summary.truePositive / relevant
  return summary
}
