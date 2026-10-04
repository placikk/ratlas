// @vitest-environment node
import { expect, test, vi } from 'vitest'
import { deleteAccountData, type AccountDeletionDeps } from './accountDeletion.ts'

function makeDeps(overrides: Partial<AccountDeletionDeps> = {}): AccountDeletionDeps {
  return {
    userId: 'u1',
    listPhotoPaths: vi.fn().mockResolvedValue([
      { photo_bucket: 'map-photos', photo_path: 'a.jpg' },
      { photo_bucket: 'sightings-private', photo_path: 'u1/b.jpg' },
    ]),
    listPrivateFolder: vi.fn().mockResolvedValue(['orphan.jpg']),
    removeFromBucket: vi.fn().mockResolvedValue(null),
    deleteUser: vi.fn().mockResolvedValue(null),
    ...overrides,
  }
}

test('usuwa zdjęcia i sieroty z prywatnego folderu, potem konto', async () => {
  const deps = makeDeps()
  expect(await deleteAccountData(deps)).toEqual({ deleted: true })
  expect(deps.removeFromBucket).toHaveBeenCalledWith('map-photos', ['a.jpg'])
  expect(deps.removeFromBucket).toHaveBeenCalledWith('sightings-private', ['u1/b.jpg'])
  expect(deps.removeFromBucket).toHaveBeenCalledWith('sightings-private', ['u1/orphan.jpg'])
  expect(deps.deleteUser).toHaveBeenCalledTimes(1)
})

test('błąd Storage przerywa i nie usuwa konta', async () => {
  const deps = makeDeps({ removeFromBucket: vi.fn().mockResolvedValue({ message: 'boom' }) })
  expect(await deleteAccountData(deps)).toEqual({ deleted: false, error: { message: 'boom' } })
  expect(deps.deleteUser).not.toHaveBeenCalled()
})

test('błąd usuwania sierot nie usuwa konta', async () => {
  const removeFromBucket = vi.fn().mockImplementation((_bucket: string, paths: string[]) =>
    Promise.resolve(paths[0] === 'u1/orphan.jpg' ? { message: 'boom' } : null),
  )
  const deps = makeDeps({ removeFromBucket })
  expect((await deleteAccountData(deps)).deleted).toBe(false)
  expect(deps.deleteUser).not.toHaveBeenCalled()
})

test('stronicuje listę prywatnego folderu', async () => {
  const full = Array.from({ length: 1000 }, (_, i) => `f${i}.jpg`)
  const listPrivateFolder = vi.fn().mockResolvedValueOnce(full).mockResolvedValueOnce(['last.jpg'])
  const deps = makeDeps({ listPhotoPaths: vi.fn().mockResolvedValue([]), listPrivateFolder })
  expect(await deleteAccountData(deps)).toEqual({ deleted: true })
  expect(listPrivateFolder).toHaveBeenNthCalledWith(1, 0, 1000)
  expect(listPrivateFolder).toHaveBeenNthCalledWith(2, 1000, 1000)
  expect(deps.removeFromBucket).toHaveBeenCalledTimes(11)
})

test('konto już nieistniejące to sukces (ponowna próba)', async () => {
  const deps = makeDeps({ deleteUser: vi.fn().mockResolvedValue({ status: 404, code: 'user_not_found' }) })
  expect(await deleteAccountData(deps)).toEqual({ deleted: true })
})

test('inny błąd usuwania konta to porażka', async () => {
  const deps = makeDeps({ deleteUser: vi.fn().mockResolvedValue({ status: 500 }) })
  expect((await deleteAccountData(deps)).deleted).toBe(false)
})
