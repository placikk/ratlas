import { supabase } from '../lib/supabase'

export interface Achievement {
  position: number
  code: string | null
  name: string | null
  description: string | null
  secret: boolean
  rewardTokens: number | null
  unlockedAt: string | null
}

interface AchievementRow {
  sort_order: number
  code: string | null
  name: string | null
  description: string | null
  secret: boolean
  reward_tokens: number | null
  unlocked_at: string | null
}

export async function fetchMyAchievements(): Promise<Achievement[]> {
  const { data, error } = await supabase.rpc('my_achievements')
  if (error) throw error
  return ((data ?? []) as AchievementRow[]).map((row) => ({
    position: row.sort_order,
    code: row.code,
    name: row.name,
    description: row.description,
    secret: row.secret,
    rewardTokens: row.reward_tokens,
    unlockedAt: row.unlocked_at,
  }))
}
