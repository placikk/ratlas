import { supabase } from '../lib/supabase'

export type RankingPeriod = 'month' | 'all'

export interface RankingRow {
  place: number
  nickname: string
  rats: number
  isMe: boolean
  title: string | null
}

interface Row {
  place: number
  nickname: string
  rats: number
  is_me: boolean
  title: string | null
}

export async function fetchRanking(period: RankingPeriod): Promise<RankingRow[]> {
  const { data, error } = await supabase.rpc('get_ranking', { p_period: period })
  if (error) throw error
  return ((data ?? []) as Row[]).map((row) => ({
    place: Number(row.place),
    nickname: row.nickname,
    rats: Number(row.rats),
    isMe: row.is_me,
    title: row.title ?? null,
  }))
}
