import { supabase } from '../lib/supabase'
import type { RecordedStatus } from '../report/reportApi'

export interface MySighting {
  id: string
  status: RecordedStatus
  rejectReason: string | null
  hidden: boolean
  ratsAwarded: number
  tokensAwarded: number
  createdAt: string
  photoUrl: string | null
}

interface SightingRow {
  id: string
  status: RecordedStatus
  reject_reason: string | null
  hidden: boolean
  rats_awarded: number
  tokens_awarded: number
  created_at: string
  photo_bucket: string
  photo_path: string
}

const PUBLIC_BUCKET = 'map-photos'
const PRIVATE_BUCKET = 'sightings-private'
const SIGNED_URL_SECONDS = 3600

export async function fetchMySightings(limit = 10): Promise<MySighting[]> {
  const { data, error } = await supabase
    .from('sightings')
    .select('id, status, reject_reason, hidden, rats_awarded, tokens_awarded, created_at, photo_bucket, photo_path')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const rows = (data ?? []) as SightingRow[]

  // Prywatne zdjęcia (selfie, odrzucone, oczekujące) widzi tylko autor — przez podpisany, czasowy adres.
  const privatePaths = rows.filter((row) => row.photo_bucket !== PUBLIC_BUCKET).map((row) => row.photo_path)
  const signedByPath = new Map<string, string>()
  if (privatePaths.length > 0) {
    const signed = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrls(privatePaths, SIGNED_URL_SECONDS)
    for (const entry of signed.data ?? []) {
      if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl)
    }
  }

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    rejectReason: row.reject_reason,
    hidden: row.hidden,
    ratsAwarded: row.rats_awarded,
    tokensAwarded: row.tokens_awarded,
    createdAt: row.created_at,
    photoUrl:
      row.photo_bucket === PUBLIC_BUCKET
        ? supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(row.photo_path).data.publicUrl
        : signedByPath.get(row.photo_path) ?? null,
  }))
}
