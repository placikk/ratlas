import { expect, test, vi } from 'vitest'
import { fetchCatalog, fetchItemContent, purchaseItem, saveQuizResult, setEquipped } from './libraryApi'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

test('pobiera katalog', async () => {
  mocks.rpc.mockResolvedValue({
    data: [{ id: 'card_laugh', type: 'knowledge_card', name: 'Czy szczury się śmieją?', teaser: 'Łaskotanie', price: 30, sort_order: 2, preview: null, owned: false, equipped: false }],
    error: null,
  })
  expect(await fetchCatalog()).toEqual([
    { id: 'card_laugh', type: 'knowledge_card', name: 'Czy szczury się śmieją?', teaser: 'Łaskotanie', price: 30, preview: null, owned: false, equipped: false },
  ])
  expect(mocks.rpc).toHaveBeenCalledWith('library_catalog')
})

test.each([
  [{ data: 'purchased', error: null }, 'purchased'],
  [{ data: 'insufficient', error: null }, 'insufficient'],
  [{ data: 'dziwne', error: null }, 'error'],
  [{ data: null, error: new Error('offline') }, 'error'],
])('zakup: %o → %s', async (response, expected) => {
  mocks.rpc.mockResolvedValue(response)
  expect(await purchaseItem('card_laugh')).toBe(expected)
  expect(mocks.rpc).toHaveBeenCalledWith('purchase_item', { p_item_id: 'card_laugh' })
})

test('treść przedmiotu: kupiony i niekupiony', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: [{ content: { body: ['A'] }, data: { best_score: 3 } }], error: null })
  expect(await fetchItemContent('quiz_body')).toEqual({ content: { body: ['A'] }, data: { best_score: 3 } })
  mocks.rpc.mockResolvedValueOnce({ data: [], error: null })
  expect(await fetchItemContent('quiz_body')).toBeNull()
  expect(mocks.rpc).toHaveBeenCalledWith('get_item_content', { p_item_id: 'quiz_body' })
})

test('zapis wyniku quizu i zakładanie wyglądu', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: 4, error: null })
  expect(await saveQuizResult('quiz_body', 4)).toBe(4)
  expect(mocks.rpc).toHaveBeenLastCalledWith('save_quiz_result', { p_item_id: 'quiz_body', p_score: 4 })
  mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error('x') })
  expect(await saveQuizResult('quiz_body', 4)).toBeNull()
  mocks.rpc.mockResolvedValueOnce({ data: 'ok', error: null })
  expect(await setEquipped('pin_skin', null)).toBe('ok')
  expect(mocks.rpc).toHaveBeenLastCalledWith('set_equipped', { p_type: 'pin_skin', p_item_id: null })
  mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error('x') })
  expect(await setEquipped('title', 'title_odra')).toBe('error')
})
