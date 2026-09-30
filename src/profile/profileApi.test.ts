import { expect, test, vi } from 'vitest'
import { completeOnboarding, onboardingFailureFor } from './profileApi'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

test.each([
  ['23505', 'nickname_taken'],
  ['23514', 'nickname_invalid'],
  ['XX000', 'unknown'],
  [undefined, 'unknown'],
])('kod błędu %j oznacza %j', (code, expected) => {
  expect(onboardingFailureFor(code)).toBe(expected)
})

test('onboarding wywołuje funkcję w bazie', async () => {
  mocks.rpc.mockResolvedValue({ data: {}, error: null })
  await expect(completeOnboarding('Szczurek', true)).resolves.toEqual({ ok: true })
  expect(mocks.rpc).toHaveBeenCalledWith('complete_onboarding', {
    p_nickname: 'Szczurek',
    p_training_consent: true,
  })
})

test('zajęty pseudonim jest zgłaszany', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } })
  await expect(completeOnboarding('Szczurek', false)).resolves.toEqual({ ok: false, reason: 'nickname_taken' })
})
