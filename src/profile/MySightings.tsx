import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { timeAgo } from '../map/pins'
import { fetchMySightings, type MySighting } from './mySightingsApi'

type State = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; items: MySighting[] }

export function MySightings() {
  const { t } = useTranslation()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    fetchMySightings().then(
      (items) => {
        if (active) setState({ kind: 'loaded', items })
      },
      () => {
        if (active) setState({ kind: 'failed' })
      },
    )
    return () => {
      active = false
    }
  }, [])

  function statusText(item: MySighting): string {
    const status = t(`mySightings.status.${item.status}`)
    return item.status === 'rejected' && item.rejectReason
      ? `${status}: ${t(`mySightings.reasons.${item.rejectReason}`)}`
      : status
  }

  return (
    <section className="stack">
      <h2>{t('mySightings.title')}</h2>
      {state.kind === 'loading' && <p className="muted">{t('app.loading')}</p>}
      {state.kind === 'failed' && (
        <p className="error" role="alert">
          {t('mySightings.loadFailed')}
        </p>
      )}
      {state.kind === 'loaded' && state.items.length === 0 && <p className="muted">{t('mySightings.empty')}</p>}
      {state.kind === 'loaded' && state.items.length > 0 && (
        <ul className="my-sightings">
          {state.items.map((item) => (
            <li key={item.id} className="card my-sightings__item">
              {item.photoUrl ? (
                <img className="my-sightings__photo" src={item.photoUrl} alt={t('mySightings.photoAlt')} loading="lazy" />
              ) : (
                <span className="my-sightings__photo" aria-hidden="true">
                  🐀
                </span>
              )}
              <div className="stack my-sightings__text">
                <strong>{statusText(item)}</strong>
                {item.status === 'accepted' && (
                  <span>
                    {t('mySightings.gain', {
                      rats: t('result.rats', { count: item.ratsAwarded }),
                      raciki: t('result.raciki', { count: item.tokensAwarded }),
                    })}
                  </span>
                )}
                <span className="muted">{timeAgo(item.createdAt, now, t('map.justNow'))}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
