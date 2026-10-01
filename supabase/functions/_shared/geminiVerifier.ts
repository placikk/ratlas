import { ALLOWED_TAGS, parseVerification, VerifierUnavailableError, type RatVerifier } from './verification.ts'

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'

const PROMPT = `You verify photos for Ratlas, a game where people in Wrocław, Poland photograph rats they meet in the city.
Answer strictly with the JSON schema.
- ratCount: number of real rats clearly visible (alive or dead). Mice, squirrels, hamsters, guinea pigs, pigeons and other animals are NOT rats. Pet rats count.
- isSelfie: true if the photographer's own face is visible together with the rat.
- isScreenOrPrint: true if the photo shows a screen (phone, monitor, TV) or a printed picture instead of a real scene.
- isToyOrDrawing: true if the "rat" is a toy, plush, figurine, drawing, graffiti, sculpture or statue.
- hasThirdPartyFaces: true if a recognisable face of another person (not the selfie author) is visible.
- tags: zero or more of: smietnik (garbage bin, dumpster or trash), krasnal (a small bronze dwarf statue typical of Wrocław), woda (river, canal or water nearby), tramwaj_przystanek (tram, tram tracks or a tram/bus stop), deszcz (it is raining or wet from rain). Use only these exact values.`

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ratCount: { type: 'INTEGER' },
    isSelfie: { type: 'BOOLEAN' },
    isScreenOrPrint: { type: 'BOOLEAN' },
    isToyOrDrawing: { type: 'BOOLEAN' },
    hasThirdPartyFaces: { type: 'BOOLEAN' },
    tags: { type: 'ARRAY', items: { type: 'STRING', enum: [...ALLOWED_TAGS] } },
  },
  required: ['ratCount', 'isSelfie', 'isScreenOrPrint', 'isToyOrDrawing', 'hasThirdPartyFaces', 'tags'],
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

interface GeminiPart {
  text?: string
  thought?: boolean
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[]
}

export function createGeminiVerifier(options: {
  apiKey: string
  model: string
  fetch?: typeof fetch
  timeoutMs?: number
}): RatVerifier {
  const doFetch = options.fetch ?? fetch
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`

  return {
    name: `gemini:${options.model}`,
    async verify(jpeg) {
      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: toBase64(jpeg) } }],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0 },
      }

      let response: Response
      try {
        response = await doFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
        })
      } catch (error) {
        throw new VerifierUnavailableError(`Gemini: brak odpowiedzi (${String(error)})`)
      }

      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        throw new VerifierUnavailableError(`Gemini: HTTP ${response.status}`)
      }
      if (!response.ok) {
        // 400/401/403/404: zły klucz, model albo zapytanie — to trzeba naprawić, a nie ponawiać.
        throw new Error(`Gemini: HTTP ${response.status} ${await response.text()}`)
      }

      try {
        const json = (await response.json()) as GeminiResponse
        const text = json.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string' && !part.thought)?.text
        return parseVerification(JSON.parse(text ?? ''))
      } catch (error) {
        throw new VerifierUnavailableError(`Gemini: niepoprawna odpowiedź (${String(error)})`)
      }
    },
  }
}
