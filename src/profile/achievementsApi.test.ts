import { expect, test, vi } from 'vitest'
import { fetchMyAchievements } from './achievementsApi'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

test('zamienia wiersze osiągnięć na obiekty aplikacji', async () => {
  mocks.rpc.mockResolvedValue({
    data: [
      { sort_order: 1, code: 'first_rat', name: 'Pierwszy szczur', description: 'Opis', secret: false, reward_tokens: 25, unlocked_at: '2026-10-04T10:00:00Z' },
      { sort_order: 10, code: null, name: null, description: null, secret: true, reward_tokens: null, unlocked_at: null },
    ],
    error: null,
  })
  expect(await fetchMyAchievements()).toEqual([
    { position: 1, code: 'first_rat', name: 'Pierwszy szczur', description: 'Opis', secret: false, rewardTokens: 25, unlockedAt: '2026-10-04T10:00:00Z' },
    { position: 10, code: null, name: null, description: null, secret: true, rewardTokens: null, unlockedAt: null },
  ])
  expect(mocks.rpc).toHaveBeenCalledWith('my_achievements')
})

test('błąd jest zgłaszany wyżej', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: new Error('offline') })
  await expect(fetchMyAchievements()).rejects.toThrow('offline')
})
