export interface StoredPhoto {
  photo_bucket: string
  photo_path: string
}

export function groupPathsByBucket(rows: StoredPhoto[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>()
  for (const row of rows) {
    const paths = grouped.get(row.photo_bucket) ?? []
    paths.push(row.photo_path)
    grouped.set(row.photo_bucket, paths)
  }
  return grouped
}

export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size))
  return batches
}
