import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchMyAchievements, type Achievement } from './achievementsApi'

type State = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; items: Achievement[] }

export function Achievements() {
  const { t } = useTranslation()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let active = true
    fetchMyAchievements().then(
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

  if (state.kind === 'loading') return null
  if (state.kind === 'failed') {
    return (
      <p className="error" role="alert">
        {t('achievements.loadFailed')}
      </p>
    )
  }

  const unlockedCount = state.items.filter((item) => item.unlockedAt).length
  const secretsLeft = state.items.filter((item) => item.secret && !item.unlockedAt).length

  return (
    <section className="stack">
      <div className="achievements__header">
        <h2>{t('achievements.title')}</h2>
        <span className="muted">{t('achievements.progress', { unlocked: unlockedCount, total: state.items.length })}</span>
      </div>
      {secretsLeft > 0 && <p className="muted">{t('achievements.secretsLeft', { count: secretsLeft })}</p>}
      <button
        className="btn--link"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        {t(expanded ? 'achievements.collapse' : 'achievements.showAll')}
      </button>
      {expanded && (
        <ul className="achievements">
          {state.items.map((item) => {
            const hidden = item.secret && !item.unlockedAt
            return (
              <li
                key={item.position}
                className={item.unlockedAt ? 'card achievements__item achievements__item--unlocked' : 'card achievements__item'}
              >
                <span className="achievements__icon" aria-hidden="true">
                  {item.unlockedAt ? '🏆' : hidden ? '❔' : '🔒'}
                </span>
                <div className="stack achievements__text">
                  <strong>{hidden ? t('achievements.secretName') : item.name}</strong>
                  <span className="muted">{hidden ? t('achievements.secretHint') : item.description}</span>
                  {!hidden && item.rewardTokens !== null && (
                    <span className="achievements__reward">
                      {t('achievements.reward', { raciki: t('result.raciki', { count: item.rewardTokens }) })}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
