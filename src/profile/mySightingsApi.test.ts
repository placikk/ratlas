import { expect, test, vi } from 'vitest'
import { fetchMySightings } from './mySightingsApi'

const mocks = vi.hoisted(() => ({ select: vi.fn(), limit: vi.fn(), createSignedUrls: vi.fn(), getPublicUrl: vi.fn(), order: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: (...cols: unknown[]) => { mocks.select(...cols); return { order: (...args: unknown[]) => { mocks.order(...args); return { limit: mocks.limit } } } } }),
    storage: {
      from: (bucket: string) =>
        bucket === 'map-photos'
          ? { getPublicUrl: mocks.getPublicUrl }
          : { createSignedUrls: mocks.createSignedUrls },
    },
  },
}))

const row = {
  id: 's1',
  status: 'accepted',
  reject_reason: null,
  hidden: false,
  rats_awarded: 2,
  tokens_awarded: 20,
  created_at: '2026-10-08T10:00:00Z',
  photo_bucket: 'map-photos',
  photo_path: 's1.jpg',
}

test('pobiera ostatnie zgłoszenia z adresami zdjęć publicznych i prywatnych', async () => {
  mocks.limit.mockResolvedValue({
    data: [row, { ...row, id: 's2', status: 'rejected', reject_reason: 'no_rat', rats_awarded: 0, tokens_awarded: 0, photo_bucket: 'sightings-private', photo_path: 'u1/s2.jpg' }],
    error: null,
  })
  mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://x/public/s1.jpg' } })
  mocks.createSignedUrls.mockResolvedValue({ data: [{ path: 'u1/s2.jpg', signedUrl: 'https://x/signed/s2', error: null }], error: null })

  const result = await fetchMySightings()

  expect(mocks.select).toHaveBeenCalledWith('id, status, reject_reason, hidden, rats_awarded, tokens_awarded, created_at, photo_bucket, photo_path')
  expect(mocks.order).toHaveBeenCalledWith('created_at', { ascending: false })
  expect(mocks.limit).toHaveBeenCalledWith(10)
  expect(mocks.createSignedUrls).toHaveBeenCalledWith(['u1/s2.jpg'], 3600)
  expect(result).toEqual([
    { id: 's1', status: 'accepted', rejectReason: null, hidden: false, ratsAwarded: 2, tokensAwarded: 20, createdAt: '2026-10-08T10:00:00Z', photoUrl: 'https://x/public/s1.jpg' },
    { id: 's2', status: 'rejected', rejectReason: 'no_rat', hidden: false, ratsAwarded: 0, tokensAwarded: 0, createdAt: '2026-10-08T10:00:00Z', photoUrl: 'https://x/signed/s2' },
  ])
})

test('bez prywatnych zdjęć nie prosi o podpisane adresy', async () => {
  mocks.limit.mockResolvedValue({ data: [row], error: null })
  mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://x/public/s1.jpg' } })
  await fetchMySightings(5)
  expect(mocks.limit).toHaveBeenCalledWith(5)
  expect(mocks.createSignedUrls).not.toHaveBeenCalled()
})

test('błąd podpisywania zostawia zdjęcie bez adresu', async () => {
  mocks.limit.mockResolvedValue({ data: [{ ...row, photo_bucket: 'sightings-private', photo_path: 'u1/s1.jpg' }], error: null })
  mocks.createSignedUrls.mockResolvedValue({ data: null, error: new Error('x') })
  expect((await fetchMySightings())[0].photoUrl).toBeNull()
})

test('błąd tabeli jest zgłaszany wyżej', async () => {
  mocks.limit.mockResolvedValue({ data: null, error: new Error('offline') })
  await expect(fetchMySightings()).rejects.toThrow('offline')
})
