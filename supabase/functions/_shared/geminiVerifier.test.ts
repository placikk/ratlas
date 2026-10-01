// @vitest-environment node
import { expect, test, vi } from 'vitest'
import { createGeminiVerifier, toBase64 } from './geminiVerifier.ts'
import { VerifierUnavailableError } from './verification.ts'

const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
const answer = {
  ratCount: 1,
  isSelfie: false,
  isScreenOrPrint: false,
  isToyOrDrawing: false,
  hasThirdPartyFaces: false,
  tags: ['woda'],
}

function geminiResponse(text: string, status = 200) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: 'myślę…', thought: true }, { text }] } }] }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}

test('koduje bajty do base64', () => {
  expect(toBase64(new Uint8Array([72, 105]))).toBe('SGk=')
})

test('wysyła zdjęcie z poleceniem i schematem, zwraca wynik', async () => {
  const fetchMock = vi.fn(async () => geminiResponse(JSON.stringify(answer)))
  const verifier = createGeminiVerifier({ apiKey: 'klucz', model: 'gemini-test', fetch: fetchMock })

  const result = await verifier.verify(photo)

  expect(result).toEqual({ ...answer, tags: ['woda'], raw: answer })
  expect(verifier.name).toBe('gemini:gemini-test')
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent')
  expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('klucz')
  const body = JSON.parse(init.body as string)
  expect(body.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: toBase64(photo) })
  expect(body.generationConfig.responseMimeType).toBe('application/json')
  expect(body.generationConfig.responseSchema.required).toContain('ratCount')
})

test.each([408, 429, 500, 503])('HTTP %i oznacza chwilową niedostępność', async (status) => {
  const verifier = createGeminiVerifier({ apiKey: 'k', model: 'm', fetch: vi.fn(async () => new Response('{}', { status })) })
  await expect(verifier.verify(photo)).rejects.toBeInstanceOf(VerifierUnavailableError)
})

test('błąd sieci oznacza chwilową niedostępność', async () => {
  const verifier = createGeminiVerifier({ apiKey: 'k', model: 'm', fetch: vi.fn(async () => Promise.reject(new TypeError('fetch failed'))) })
  await expect(verifier.verify(photo)).rejects.toBeInstanceOf(VerifierUnavailableError)
})

test('niepoprawny JSON od modelu oznacza chwilową niedostępność', async () => {
  const verifier = createGeminiVerifier({ apiKey: 'k', model: 'm', fetch: vi.fn(async () => geminiResponse('to nie JSON')) })
  await expect(verifier.verify(photo)).rejects.toBeInstanceOf(VerifierUnavailableError)
})

test('odpowiedź 200 niebędąca JSON-em oznacza chwilową niedostępność', async () => {
  const verifier = createGeminiVerifier({ apiKey: 'k', model: 'm', fetch: vi.fn(async () => new Response('<html>', { status: 200 })) })
  await expect(verifier.verify(photo)).rejects.toBeInstanceOf(VerifierUnavailableError)
})

test('zły klucz (403) to błąd konfiguracji, a nie niedostępność', async () => {
  const verifier = createGeminiVerifier({ apiKey: 'zly', model: 'm', fetch: vi.fn(async () => new Response('{}', { status: 403 })) })
  const error = await verifier.verify(photo).catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(Error)
  expect(error).not.toBeInstanceOf(VerifierUnavailableError)
})
