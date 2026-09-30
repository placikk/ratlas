import type { Session } from '@supabase/supabase-js'
import { act, renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { useSession } from './useSession'

type Listener = (event: string, session: Session | null) => void

const mocks = vi.hoisted(() => {
  const state: { listener: Listener | null } = { listener: null }
  const unsubscribe = vi.fn()
  const onAuthStateChange = vi.fn((listener: Listener) => {
    state.listener = listener
    return { data: { subscription: { unsubscribe } } }
  })
  return { state, unsubscribe, onAuthStateChange }
})

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: mocks.onAuthStateChange } },
}))

const fakeSession = { user: { id: 'u1' } } as unknown as Session

test('na początku stan to ładowanie', () => {
  const { result } = renderHook(() => useSession())
  expect(result.current).toEqual({ status: 'loading' })
})

test('bez sesji użytkownik jest wylogowany', () => {
  const { result } = renderHook(() => useSession())
  act(() => mocks.state.listener?.('INITIAL_SESSION', null))
  expect(result.current).toEqual({ status: 'signedOut' })
})

test('z sesją użytkownik jest zalogowany', () => {
  const { result } = renderHook(() => useSession())
  act(() => mocks.state.listener?.('SIGNED_IN', fakeSession))
  expect(result.current).toEqual({ status: 'signedIn', session: fakeSession })
})

test('wypisuje się z nasłuchu po odmontowaniu', () => {
  const { unmount } = renderHook(() => useSession())
  unmount()
  expect(mocks.unsubscribe).toHaveBeenCalled()
})
