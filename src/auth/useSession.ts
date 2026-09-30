import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: Session }

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: 'signedIn', session } : { status: 'signedOut' })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return state
}
