import { expect, test, vi } from 'vitest'
import { fetchFadeDays, fetchPins, photoUrl, reportPin } from './mapApi'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), maybeSingle: vi.fn(), getPublicUrl: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
    storage: { from: () => ({ getPublicUrl: mocks.getPublicUrl }) },
  },
}))

test('pobiera pinezki z widocznego fragmentu i zamienia nazwy pól', async () => {
  mocks.rpc.mockResolvedValue({
    data: [{ id: 'a', lon: 17.03, lat: 51.11, rats: 2, created_at: '2026-10-08T10:00:00Z', photo_path: 'a.jpg', nickname: 'Ala', is_mine: false }],
    error: null,
  })
  const pins = await fetchPins({ west: 16.9, south: 51.0, east: 17.2, north: 51.2 })
  expect(mocks.rpc).toHaveBeenCalledWith('sightings_in_view', { p_west: 16.9, p_south: 51.0, p_east: 17.2, p_north: 51.2 })
  expect(pins).toEqual([
    { id: 'a', lon: 17.03, lat: 51.11, rats: 2, createdAt: '2026-10-08T10:00:00Z', photoPath: 'a.jpg', nickname: 'Ala', isMine: false },
  ])
})

test('błąd pobierania pinezek jest zgłaszany wyżej', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: new Error('offline') })
  await expect(fetchPins({ west: 0, south: 0, east: 1, north: 1 })).rejects.toThrow('offline')
})

test('czas zanikania pochodzi z konfiguracji, a przy błędzie wynosi 7 dni', async () => {
  mocks.maybeSingle.mockResolvedValueOnce({ data: { value: 5 }, error: null })
  expect(await fetchFadeDays()).toBe(5)
  mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('x') })
  expect(await fetchFadeDays()).toBe(7)
})

test.each([
  [{ data: 'hidden', error: null }, 'hidden'],
  [{ data: 'reported', error: null }, 'reported'],
  [{ data: 'dziwne', error: null }, 'error'],
  [{ data: null, error: new Error('x') }, 'error'],
])('zgłoszenie nadużycia: %j → %s', async (response, expected) => {
  mocks.rpc.mockResolvedValue(response)
  expect(await reportPin('a', 'not_rat')).toBe(expected)
})

test('adres zdjęcia z publicznego bucketu', () => {
  mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://x/map-photos/a.jpg' } })
  expect(photoUrl('a.jpg')).toBe('https://x/map-photos/a.jpg')
})
