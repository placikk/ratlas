import { supabase } from '../lib/supabase'
import { DEFAULT_FADE_DAYS, type Bounds, type Pin } from './pins'

export type ReportReason = 'not_rat' | 'inappropriate' | 'other'
export const REPORT_REASONS: ReportReason[] = ['not_rat', 'inappropriate', 'other']
export type ReportResult = 'reported' | 'already' | 'own' | 'hidden' | 'not_found' | 'error'

const REPORT_RESULTS: readonly string[] = ['reported', 'already', 'own', 'hidden', 'not_found']

interface PinRow {
  id: string
  lon: number
  lat: number
  rats: number
  created_at: string
  photo_path: string
  nickname: string | null
  is_mine: boolean
}

export async function fetchPins(bounds: Bounds): Promise<Pin[]> {
  const { data, error } = await supabase.rpc('sightings_in_view', {
    p_west: bounds.west,
    p_south: bounds.south,
    p_east: bounds.east,
    p_north: bounds.north,
  })
  if (error) throw error
  return ((data ?? []) as PinRow[]).map((row) => ({
    id: row.id,
    lon: row.lon,
    lat: row.lat,
    rats: row.rats,
    createdAt: row.created_at,
    photoPath: row.photo_path,
    nickname: row.nickname,
    isMine: row.is_mine,
  }))
}

export async function fetchFadeDays(): Promise<number> {
  const { data, error } = await supabase.from('app_config').select('value').eq('key', 'pin_fade_days').maybeSingle()
  const days = Number((data as { value?: unknown } | null)?.value)
  return error || !Number.isFinite(days) || days <= 0 ? DEFAULT_FADE_DAYS : days
}

export async function reportPin(sightingId: string, reason: ReportReason): Promise<ReportResult> {
  const { data, error } = await supabase.rpc('report_sighting', { p_sighting_id: sightingId, p_reason: reason })
  if (error || typeof data !== 'string' || !REPORT_RESULTS.includes(data)) return 'error'
  return data as ReportResult
}

export function photoUrl(path: string): string {
  return supabase.storage.from('map-photos').getPublicUrl(path).data.publicUrl
}
