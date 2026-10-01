// @vitest-environment node
import { expect, test, vi } from 'vitest'
import { createFakeVerifier, selectVerifier } from './selectVerifier.ts'

const env = (values: Record<string, string>) => (key: string) => values[key]

test('fake zwraca zadaną liczbę szczurów bez sieci', async () => {
  const result = await createFakeVerifier(2).verify(new Uint8Array([1]))
  expect(result.ratCount).toBe(2)
  expect(result.isScreenOrPrint).toBe(false)
})

test('VERIFIER=fake wybiera weryfikator testowy', () => {
  const verifier = selectVerifier(env({ VERIFIER: 'fake', FAKE_RAT_COUNT: '3' }))
  expect(verifier.name).toBe('fake')
})

test('domyślnie wybiera Gemini z domyślnym modelem', () => {
  const verifier = selectVerifier(env({ GEMINI_API_KEY: 'k' }), vi.fn())
  expect(verifier.name).toBe('gemini:gemini-3.5-flash')
})

test('GEMINI_MODEL zmienia model', () => {
  const verifier = selectVerifier(env({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-inny' }), vi.fn())
  expect(verifier.name).toBe('gemini:gemini-inny')
})

test('bez klucza i bez fake zgłasza błąd konfiguracji', () => {
  expect(() => selectVerifier(env({}))).toThrow('GEMINI_API_KEY')
})
