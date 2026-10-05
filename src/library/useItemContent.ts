import { useEffect, useState } from 'react'
import { fetchItemContent, type ItemContent } from './libraryApi'

export type ContentState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; item: ItemContent }

export function useItemContent(itemId: string): ContentState {
  const [state, setState] = useState<ContentState>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    fetchItemContent(itemId).then(
      (item) => {
        if (active) setState(item ? { kind: 'loaded', item } : { kind: 'failed' })
      },
      () => {
        if (active) setState({ kind: 'failed' })
      },
    )
    return () => {
      active = false
    }
  }, [itemId])

  return state
}
