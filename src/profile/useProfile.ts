import { useCallback, useEffect, useState } from 'react'
import { fetchMyProfile, type Profile } from './profileApi'

export function useProfile(userId: string) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchMyProfile(userId).then(
      (loaded) => {
        if (cancelled) return
        setProfile(loaded)
        setFailed(false)
      },
      () => {
        if (!cancelled) setFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [userId, attempt])

  const reload = useCallback(() => {
    setFailed(false)
    setAttempt((count) => count + 1)
  }, [])

  return { profile, failed, reload }
}
