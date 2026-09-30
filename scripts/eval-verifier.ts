// Ocena Gemini na własnych zdjęciach. Uruchom:
//   npm run eval
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createGeminiVerifier, DEFAULT_GEMINI_MODEL } from '../supabase/functions/_shared/geminiVerifier.ts'
import { parseLabels, summarize, type EvalOutcome } from './eval/summary.ts'

const directory = process.argv[2] ?? 'eval'
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('Brak GEMINI_API_KEY — wpisz go do supabase/functions/.env')
  process.exit(1)
}

const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
const verifier = createGeminiVerifier({ apiKey, model })
const cases = parseLabels(readFileSync(join(directory, 'labels.csv'), 'utf8'))
const outcomes: EvalOutcome[] = []

console.log(`Model: ${model}, zdjęć: ${cases.length}`)
for (const evalCase of cases) {
  try {
    const predicted = await verifier.verify(new Uint8Array(readFileSync(join(directory, 'photos', evalCase.file))))
    outcomes.push({ evalCase, predicted })
    console.log(`${evalCase.file}: szczury=${predicted.ratCount} ekran=${predicted.isScreenOrPrint} zabawka=${predicted.isToyOrDrawing} selfie=${predicted.isSelfie} twarze=${predicted.hasThirdPartyFaces} tagi=${predicted.tags.join('|')}`)
  } catch (error) {
    outcomes.push({ evalCase, predicted: null })
    console.log(`${evalCase.file}: BŁĄD ${String(error)}`)
  }
  // Darmowy limit zapytań na minutę — nie spieszymy się.
  await new Promise((resolve) => setTimeout(resolve, 7000))
}

const summary = summarize(outcomes)
const percent = (value: number) => `${Math.round(value * 100)}%`
console.log('\n=== Podsumowanie ===')
console.log(`Precyzja „to jest szczur”: ${percent(summary.precision)} (cel ≥ 95%)`)
console.log(`Czułość: ${percent(summary.recall)}`)
console.log(`Dokładna liczba szczurów: ${summary.exactCount}/${summary.truePositive}`)
console.log(`Selfie rozpoznane poprawnie: ${summary.selfie.correct}/${summary.selfie.total}`)
console.log(`Twarze osób trzecich rozpoznane poprawnie: ${summary.faces.correct}/${summary.faces.total}`)
console.log(`Bez odpowiedzi: ${summary.failed}/${summary.total}`)
if (summary.mistakes.length > 0) console.log(`Pomyłki:\n- ${summary.mistakes.join('\n- ')}`)
if (summary.privacyMisses.length > 0) console.log(`Przeoczone dane osobowe (groźne — twarz trafiłaby na mapę):\n- ${summary.privacyMisses.join('\n- ')}`)
