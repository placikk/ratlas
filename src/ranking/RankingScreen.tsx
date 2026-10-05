import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchRanking, type RankingPeriod, type RankingRow } from './rankingApi'

type State = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; rows: RankingRow[] }

const PERIODS: RankingPeriod[] = ['month', 'all']

export function RankingScreen() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<RankingPeriod>('month')
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    fetchRanking(period).then(
      (rows) => {
        if (active) setState({ kind: 'loaded', rows })
      },
      () => {
        if (active) setState({ kind: 'failed' })
      },
    )
    return () => {
      active = false
    }
  }, [period])

  return (
    <section className="screen stack">
      <h1>{t('ranking.title')}</h1>
      <div className="ranking__periods">
        {PERIODS.map((option) => (
          <button
            key={option}
            type="button"
            className={option === period ? 'btn' : 'btn btn--ghost'}
            aria-pressed={option === period}
            onClick={() => {
              setState({ kind: 'loading' })
              setPeriod(option)
            }}
          >
            {t(`ranking.${option}`)}
          </button>
        ))}
      </div>

      {state.kind === 'loading' && <p className="muted">{t('app.loading')}</p>}
      {state.kind === 'failed' && (
        <p className="error" role="alert">
          {t('ranking.loadFailed')}
        </p>
      )}
      {state.kind === 'loaded' && state.rows.length === 0 && <p className="muted">{t('ranking.empty')}</p>}
      {state.kind === 'loaded' && state.rows.length > 0 && (
        <ol className="ranking">
          {state.rows.map((row, index) => {
            const previous = state.rows[index - 1]
            return (
              <Fragment key={`${row.place}-${row.nickname}`}>
                {previous && row.place > previous.place + 1 && (
                  <li className="ranking__gap" aria-hidden="true">
                    …
                  </li>
                )}
                <li className={row.isMe ? 'card ranking__row ranking__row--me' : 'card ranking__row'}>
                  <span className="ranking__place">{row.place}.</span>
                  <strong className="ranking__name">
                    {row.nickname} {row.isMe && <span className="muted">{t('ranking.me')}</span>}
                    {row.title && <span className="ranking__title">{row.title}</span>}
                  </strong>
                  <span>{t('ranking.rats', { count: row.rats })}</span>
                </li>
              </Fragment>
            )
          })}
        </ol>
      )}
    </section>
  )
}
