import { isPublicCandidate, type VerificationResult } from './verification.ts'

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024
export const PUBLIC_BUCKET = 'map-photos'
export const PRIVATE_BUCKET = 'sightings-private'

export interface SightingInput {
  lat: number
  lon: number
  accuracyM: number
  capturedAt: string
}

export type ParsedSighting = { ok: true; input: SightingInput; photo: Uint8Array } | { ok: false }

export async function parseSightingForm(form: FormData): Promise<ParsedSighting> {
  const photo = form.get('photo')
  if (!(photo instanceof Blob) || photo.type !== 'image/jpeg' || photo.size === 0 || photo.size > MAX_PHOTO_BYTES) {
    return { ok: false }
  }

  const rawLat = form.get('lat')
  const rawLon = form.get('lon')
  const rawAccuracy = form.get('accuracy')
  // Number(null) i Number('') dają 0 — brakujące pole nie może przejść jako „0”.
  for (const raw of [rawLat, rawLon, rawAccuracy]) {
    if (typeof raw !== 'string' || raw.trim() === '') return { ok: false }
  }
  const lat = Number(rawLat)
  const lon = Number(rawLon)
  const accuracyM = Number(rawAccuracy)
  const capturedAt = Date.parse(String(form.get('capturedAt') ?? ''))
  if (
    !Number.isFinite(lat) || lat < -90 || lat > 90 ||
    !Number.isFinite(lon) || lon < -180 || lon > 180 ||
    !Number.isFinite(accuracyM) || accuracyM < 0 ||
    Number.isNaN(capturedAt)
  ) {
    return { ok: false }
  }

  return {
    ok: true,
    input: { lat, lon, accuracyM, capturedAt: new Date(capturedAt).toISOString() },
    photo: new Uint8Array(await photo.arrayBuffer()),
  }
}

export function photoPlacement(
  userId: string,
  sightingId: string,
  verification: VerificationResult | null,
): { bucket: string; path: string } {
  return isPublicCandidate(verification)
    ? { bucket: PUBLIC_BUCKET, path: `${sightingId}.jpg` }
    : { bucket: PRIVATE_BUCKET, path: `${userId}/${sightingId}.jpg` }
}
