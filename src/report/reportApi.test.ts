import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { expect, test, vi } from 'vitest'
import { retryPending, submitSighting, toSubmitResult } from './reportApi'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: mocks.invoke } } }))

test.each([
  [{ status: 'blocked', reason: 'outside_city' }, { kind: 'blocked', reason: 'outside_city' }],
  [
    { status: 'accepted', reject_reason: null, rats_awarded: 3, tokens_awarded: 30 },
    { kind: 'recorded', status: 'accepted', rejectReason: null, ratsAwarded: 3, tokensAwarded: 30 },
  ],
  [
    { status: 'rejected', reject_reason: 'no_rat', rats_awarded: 0, tokens_awarded: 0 },
    { kind: 'recorded', status: 'rejected', rejectReason: 'no_rat', ratsAwarded: 0, tokensAwarded: 0 },
  ],
  [{ status: 'blocked', reason: 'coś' }, { kind: 'error' }],
  [null, { kind: 'error' }],
])('toSubmitResult(%j)', (data, expected) => {
  expect(toSubmitResult(data)).toEqual(expected)
})

const photo = new Blob(['x'], { type: 'image/jpeg' })
const fix = { lat: 51.11, lon: 17.032, accuracyM: 12 }

test('wysyła zdjęcie z pozycją jako formularz', async () => {
  mocks.invoke.mockResolvedValue({ data: { status: 'pending', reject_reason: null, rats_awarded: 0, tokens_awarded: 0 }, error: null })
  const result = await submitSighting(photo, fix, new Date('2026-10-01T10:00:00Z'))

  expect(result).toEqual({ kind: 'recorded', status: 'pending', rejectReason: null, ratsAwarded: 0, tokensAwarded: 0 })
  const [name, options] = mocks.invoke.mock.calls[0]
  expect(name).toBe('submit-sighting')
  const form = options.body as FormData
  expect(form.get('lat')).toBe('51.11')
  expect(form.get('lon')).toBe('17.032')
  expect(form.get('accuracy')).toBe('12')
  expect(form.get('capturedAt')).toBe('2026-10-01T10:00:00.000Z')
  expect(form.get('photo')).toBeInstanceOf(Blob)
})

test('brak sieci to „offline”', async () => {
  mocks.invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new TypeError('fetch failed')) })
  expect(await submitSighting(photo, fix, new Date())).toEqual({ kind: 'offline' })
})

test('błąd serwera to „error”', async () => {
  mocks.invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(new Response('{}', { status: 500 })) })
  expect(await submitSighting(photo, fix, new Date())).toEqual({ kind: 'error' })
})

test('retryPending zwraca liczbę rozstrzygniętych, a przy błędzie 0', async () => {
  mocks.invoke.mockResolvedValueOnce({ data: { resolved: 2 }, error: null })
  expect(await retryPending()).toBe(2)
  mocks.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new TypeError('x')) })
  expect(await retryPending()).toBe(0)
})

test('równoległe wywołania retryPending wysyłają jedno zapytanie', async () => {
  let release: (value: unknown) => void = () => {}
  mocks.invoke.mockReturnValueOnce(new Promise((resolve) => (release = resolve)))
  const first = retryPending()
  const second = retryPending()
  release({ data: { resolved: 1 }, error: null })
  expect(await first).toBe(1)
  expect(await second).toBe(1)
  expect(mocks.invoke).toHaveBeenCalledTimes(1)

  mocks.invoke.mockResolvedValueOnce({ data: { resolved: 0 }, error: null })
  expect(await retryPending()).toBe(0)
  expect(mocks.invoke).toHaveBeenCalledTimes(2)
})
