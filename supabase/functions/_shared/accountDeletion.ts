import { chunk, groupPathsByBucket, type StoredPhoto } from './storageCleanup.ts'

export const PRIVATE_BUCKET = 'sightings-private'

export interface AccountDeletionDeps {
  listPhotoPaths: () => Promise<StoredPhoto[]>
  /** Zwraca jedną stronę nazw obiektów w folderze osoby (bez prefiksu folderu). */
  listPrivateFolder: (offset: number, limit: number) => Promise<string[]>
  /** Zwraca komunikat błędu albo null, gdy usunięto. */
  removeFromBucket: (bucket: string, paths: string[]) => Promise<unknown>
  /** Zwraca błąd (status/code) albo null. */
  deleteUser: () => Promise<{ status?: number; code?: string } | null>
  userId: string
}

export type AccountDeletionResult = { deleted: true } | { deleted: false; error: unknown }

const PAGE = 1000

function isNotFound(error: { status?: number; code?: string }): boolean {
  return error.status === 404 || error.code === 'user_not_found'
}

export async function deleteAccountData(deps: AccountDeletionDeps): Promise<AccountDeletionResult> {
  const removeAll = async (bucket: string, paths: string[]): Promise<unknown> => {
    for (const batch of chunk(paths, 100)) {
      const error = await deps.removeFromBucket(bucket, batch)
      if (error) return error
    }
    return null
  }

  for (const [bucket, paths] of groupPathsByBucket(await deps.listPhotoPaths())) {
    const error = await removeAll(bucket, paths)
    if (error) return { deleted: false, error }
  }

  // Sprzątanie sierot po wcześniejszych nieudanych usunięciach: wszystko w prywatnym folderze osoby.
  const orphans: string[] = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await deps.listPrivateFolder(offset, PAGE)
    orphans.push(...page.map((name) => `${deps.userId}/${name}`))
    if (page.length < PAGE) break
  }
  const orphanError = await removeAll(PRIVATE_BUCKET, orphans)
  if (orphanError) return { deleted: false, error: orphanError }

  const deleteError = await deps.deleteUser()
  if (deleteError && !isNotFound(deleteError)) return { deleted: false, error: deleteError }
  return { deleted: true }
}
