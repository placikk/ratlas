import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Rank {
  id: number
  name: string
  min_rats: number
}

export interface RankProgress {
  current: Rank
  next: Rank | null
  remaining: number
  fraction: number
}

export async function fetchRanks(): Promise<Rank[]> {
  const { data, error } = await supabase.from('ranks').select('id, name, min_rats').order('min_rats')
  if (error) throw error
  return data as Rank[]
}

export function rankProgress(totalRats: number, ranks: Rank[]): RankProgress | null {
  const sorted = [...ranks].sort((a, b) => a.min_rats - b.min_rats)
  if (sorted.length === 0) return null

  let index = 0
  while (index + 1 < sorted.length && sorted[index + 1].min_rats <= totalRats) index += 1
  const current = sorted[index]
  const next = sorted[index + 1] ?? null
  if (!next) return { current, next: null, remaining: 0, fraction: 1 }

  return {
    current,
    next,
    remaining: next.min_rats - totalRats,
    fraction: (totalRats - current.min_rats) / (next.min_rats - current.min_rats),
  }
}

// Rangi rzadko się zmieniają; gdy nie uda się ich pobrać, profil po prostu ich nie pokazuje.
export function useRanks(): Rank[] {
  const [ranks, setRanks] = useState<Rank[]>([])

  useEffect(() => {
    let cancelled = false
    fetchRanks().then(
      (loaded) => {
        if (!cancelled) setRanks(loaded)
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [])

  return ranks
}
