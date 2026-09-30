import { expect, test, vi } from 'vitest'
import { fetchRanks, rankProgress, type Rank } from './ranksApi'

const mocks = vi.hoisted(() => ({ order: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ order: mocks.order }) }) },
}))

const ranks: Rank[] = [
  { id: 2, name: 'Podwórkowy Obserwator', min_rats: 5 },
  { id: 1, name: 'Szczurzy Nowicjusz', min_rats: 0 },
  { id: 3, name: 'Tropiciel z Nadodrza', min_rats: 15 },
]

test('nowicjusz z 0 szczurów', () => {
  expect(rankProgress(0, ranks)).toEqual({ current: ranks[1], next: ranks[0], remaining: 5, fraction: 0 })
})

test('w połowie drogi do kolejnej rangi', () => {
  expect(rankProgress(10, ranks)).toEqual({ current: ranks[0], next: ranks[2], remaining: 5, fraction: 0.5 })
})

test('dokładnie na progu awansuje', () => {
  expect(rankProgress(5, ranks)?.current.name).toBe('Podwórkowy Obserwator')
})

test('najwyższa ranga nie ma następnej', () => {
  expect(rankProgress(99, ranks)).toEqual({ current: ranks[2], next: null, remaining: 0, fraction: 1 })
})

test('bez rang nie ma postępu', () => {
  expect(rankProgress(3, [])).toBeNull()
})

test('pobiera rangi posortowane po progu', async () => {
  mocks.order.mockResolvedValue({ data: ranks, error: null })
  await expect(fetchRanks()).resolves.toBe(ranks)
  expect(mocks.order).toHaveBeenCalledWith('min_rats')
})
