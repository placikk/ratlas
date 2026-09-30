import { FunctionsFetchError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Fix } from './location'

export type BlockReason = 'daily_limit' | 'gps_inaccurate' | 'outside_city' | 'duplicate'
export type RecordedStatus = 'accepted' | 'accepted_no_points' | 'rejected' | 'pending'

export type SubmitOutcome =
  | { kind: 'blocked'; reason: BlockReason }
  | { kind: 'recorded'; status: RecordedStatus; rejectReason: string | null; ratsAwarded: number; tokensAwarded: number }

export type SubmitResult = SubmitOutcome | { kind: 'offline' } | { kind: 'error' }

const BLOCK_REASONS: readonly string[] = ['daily_limit', 'gps_inaccurate', 'outside_city', 'duplicate']
const RECORDED_STATUSES: readonly string[] = ['accepted', 'accepted_no_points', 'rejected', 'pending']

export function toSubmitResult(data: unknown): SubmitResult {
  const value = (data ?? {}) as Record<string, unknown>
  if (value.status === 'blocked') {
    return typeof value.reason === 'string' && BLOCK_REASONS.includes(value.reason)
      ? { kind: 'blocked', reason: value.reason as BlockReason }
      : { kind: 'error' }
  }
  if (typeof value.status === 'string' && RECORDED_STATUSES.includes(value.status)) {
    return {
      kind: 'recorded',
      status: value.status as RecordedStatus,
      rejectReason: typeof value.reject_reason === 'string' ? value.reject_reason : null,
      ratsAwarded: Number(value.rats_awarded ?? 0),
      tokensAwarded: Number(value.tokens_awarded ?? 0),
    }
  }
  return { kind: 'error' }
}

export async function submitSighting(photo: Blob, fix: Fix, capturedAt: Date): Promise<SubmitResult> {
  const form = new FormData()
  form.append('photo', photo, 'photo.jpg')
  form.append('lat', String(fix.lat))
  form.append('lon', String(fix.lon))
  form.append('accuracy', String(fix.accuracyM))
  form.append('capturedAt', capturedAt.toISOString())

  const { data, error } = await supabase.functions.invoke('submit-sighting', { body: form })
  if (error) return error instanceof FunctionsFetchError ? { kind: 'offline' } : { kind: 'error' }
  return toSubmitResult(data)
}

export async function retryPending(): Promise<number> {
  const { data, error } = await supabase.functions.invoke('retry-pending', { body: {} })
  if (error) return 0
  return Number((data as { resolved?: number } | null)?.resolved ?? 0)
}
