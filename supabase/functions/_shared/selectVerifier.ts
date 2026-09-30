import { createGeminiVerifier, DEFAULT_GEMINI_MODEL } from './geminiVerifier.ts'
import type { RatVerifier } from './verification.ts'

// Tylko do lokalnego rozwoju: każde zdjęcie to `ratCount` szczurów. Nigdy nie ustawiaj VERIFIER=fake na produkcji.
export function createFakeVerifier(ratCount: number): RatVerifier {
  return {
    name: 'fake',
    verify() {
      const answer = {
        ratCount,
        isSelfie: false,
        isScreenOrPrint: false,
        isToyOrDrawing: false,
        hasThirdPartyFaces: false,
        tags: [],
      }
      return Promise.resolve({ ...answer, raw: answer })
    },
  }
}

export function selectVerifier(getEnv: (key: string) => string | undefined, fetchImpl?: typeof fetch): RatVerifier {
  if (getEnv('VERIFIER') === 'fake') {
    return createFakeVerifier(Number(getEnv('FAKE_RAT_COUNT') ?? '1'))
  }
  const apiKey = getEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('Brak GEMINI_API_KEY (lokalnie możesz ustawić VERIFIER=fake w supabase/functions/.env)')
  }
  return createGeminiVerifier({ apiKey, model: getEnv('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL, fetch: fetchImpl })
}
