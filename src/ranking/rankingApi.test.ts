import { expect, test, vi } from 'vitest'
import { fetchRanking } from './rankingApi'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

test('pobiera ranking wybranego okresu', async () => {
  mocks.rpc.mockResolvedValue({ data: [{ place: 1, nickname: 'Ala', rats: 12, is_me: true, title: 'Tester' }], error: null })
  expect(await fetchRanking('month')).toEqual([{ place: 1, nickname: 'Ala', rats: 12, isMe: true, title: 'Tester' }])
  expect(mocks.rpc).toHaveBeenCalledWith('get_ranking', { p_period: 'month' })
})

test('błąd jest zgłaszany wyżej', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: new Error('offline') })
  await expect(fetchRanking('all')).rejects.toThrow('offline')
})
