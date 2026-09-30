import type { Profile } from '../profile/profileApi'

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    nickname: 'Szczurek',
    show_nickname_on_map: true,
    total_rats: 0,
    tokens_balance: 0,
    training_consent: false,
    terms_accepted_at: '2026-09-30T10:00:00Z',
    ...overrides,
  }
}
