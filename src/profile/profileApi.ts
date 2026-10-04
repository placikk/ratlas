import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  nickname: string | null
  show_nickname_on_map: boolean
  total_rats: number
  tokens_balance: number
  training_consent: boolean
  terms_accepted_at: string | null
}

export type ProfileSettings = Pick<Profile, 'show_nickname_on_map' | 'training_consent'>

export type OnboardingFailure = 'nickname_taken' | 'nickname_invalid' | 'unknown'

export type OnboardingResult = { ok: true } | { ok: false; reason: OnboardingFailure }

const PROFILE_COLUMNS =
  'id, nickname, show_nickname_on_map, total_rats, tokens_balance, training_consent, terms_accepted_at'

export async function fetchMyProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single()
  if (error) throw error
  return data as Profile
}

export function onboardingFailureFor(code: string | undefined): OnboardingFailure {
  if (code === '23505') return 'nickname_taken'
  if (code === '23514') return 'nickname_invalid'
  return 'unknown'
}

export async function completeOnboarding(nickname: string, trainingConsent: boolean): Promise<OnboardingResult> {
  const { error } = await supabase.rpc('complete_onboarding', {
    p_nickname: nickname,
    p_training_consent: trainingConsent,
  })
  if (!error) return { ok: true }
  // Onboarding już się udał (np. odpowiedź zginęła i użytkownik ponawia) — nie blokuj go.
  if (error.code === 'P0001') return { ok: true }
  return { ok: false, reason: onboardingFailureFor(error.code) }
}

export async function updateSettings(userId: string, patch: Partial<ProfileSettings>): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw error
}

export async function changeNickname(nickname: string): Promise<OnboardingResult> {
  const { error } = await supabase.rpc('change_nickname', { p_nickname: nickname })
  if (!error) return { ok: true }
  return { ok: false, reason: onboardingFailureFor(error.code) }
}
