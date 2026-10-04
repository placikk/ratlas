import { useTranslation } from 'react-i18next'
import type { SubmitOutcome } from './reportApi'

export function ResultView({ outcome, onAgain }: { outcome: SubmitOutcome; onAgain: () => void }) {
  const { t } = useTranslation()

  let emoji = '🐀'
  let title: string
  let text: string

  if (outcome.kind === 'blocked') {
    emoji = '🚫'
    title = t('result.blockedTitle')
    text = t(`result.blocked.${outcome.reason}`)
  } else if (outcome.status === 'accepted') {
    title = t('result.acceptedTitle')
    text = t('result.gain', {
      rats: t('result.rats', { count: outcome.ratsAwarded }),
      raciki: t('result.raciki', { count: outcome.tokensAwarded }),
    })
  } else if (outcome.status === 'accepted_no_points') {
    emoji = '📍'
    title = t('result.noPointsTitle')
    text = t('result.noPoints')
  } else if (outcome.status === 'pending') {
    emoji = '⏳'
    title = t('result.pendingTitle')
    text = t('result.pending')
  } else {
    emoji = '🤔'
    title = t('result.rejectedTitle')
    text = t(`result.rejected.${outcome.rejectReason ?? 'no_rat'}`)
  }

  const isGain = outcome.kind === 'recorded' && outcome.status === 'accepted'

  const unlocked = outcome.kind === 'recorded' ? (outcome.achievements ?? []) : []

  return (
    <section className="screen stack result">
      <span className="result__emoji" aria-hidden="true">
        {emoji}
      </span>
      <h1>{title}</h1>
      <p className={isGain ? 'result__gain' : undefined}>{text}</p>
      {unlocked.length > 0 && (
        <ul className="result__achievements">
          {unlocked.map((achievement) => (
            <li key={achievement.code}>
              {t(achievement.secret ? 'result.secretUnlocked' : 'result.achievementUnlocked', {
                name: achievement.name,
                raciki: t('result.raciki', { count: achievement.rewardTokens }),
              })}
            </li>
          ))}
        </ul>
      )}
      <button className="btn" type="button" onClick={onAgain}>
        {t('result.again')}
      </button>
    </section>
  )
}
