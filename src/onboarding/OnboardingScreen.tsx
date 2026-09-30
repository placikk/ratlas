import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LegalModal, type LegalDoc } from '../legal/LegalModal'
import { completeOnboarding, type OnboardingFailure } from '../profile/profileApi'
import { checkNickname, type NicknameProblem } from './nickname'

const PROBLEM_KEYS: Record<NicknameProblem, string> = {
  too_short: 'onboarding.nicknameTooShort',
  too_long: 'onboarding.nicknameTooLong',
  bad_chars: 'onboarding.nicknameBadChars',
}

const FAILURE_KEYS: Record<OnboardingFailure, string> = {
  nickname_taken: 'onboarding.nicknameTaken',
  nickname_invalid: 'onboarding.nicknameBadChars',
  unknown: 'app.error',
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const [nickname, setNickname] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [trainingConsent, setTrainingConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openDoc, setOpenDoc] = useState<LegalDoc | null>(null)

  const problem = checkNickname(nickname)
  const canSubmit = problem === null && ageConfirmed && termsAccepted && !busy

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const result = await completeOnboarding(nickname.trim(), trainingConsent)
    setBusy(false)
    if (result.ok) {
      onDone()
      return
    }
    setError(t(FAILURE_KEYS[result.reason]))
  }

  return (
    <main className="screen stack">
      <h1>{t('onboarding.title')}</h1>

      <section className="card stack">
        <strong>{t('onboarding.safetyTitle')}</strong>
        <p>{t('onboarding.safetyText')}</p>
      </section>

      <form className="stack" onSubmit={onSubmit}>
        <label className="stack">
          <span>{t('onboarding.nicknameLabel')}</span>
          <input
            className="input"
            autoComplete="nickname"
            maxLength={30}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
        {nickname.length > 0 && problem ? (
          <p className="error">{t(PROBLEM_KEYS[problem])}</p>
        ) : (
          <p className="muted">{t('onboarding.nicknameHint')}</p>
        )}

        <label className="check">
          <input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} />
          <span>{t('onboarding.age')}</span>
        </label>

        <label className="check">
          <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
          <span>{t('onboarding.termsAccept')}</span>
        </label>
        <div className="row">
          <span className="muted">{t('onboarding.read')}</span>
          <button className="btn--link" type="button" onClick={() => setOpenDoc('terms')}>
            {t('legal.terms')}
          </button>
          <button className="btn--link" type="button" onClick={() => setOpenDoc('privacy')}>
            {t('legal.privacy')}
          </button>
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={trainingConsent}
            onChange={(event) => setTrainingConsent(event.target.checked)}
          />
          <span>{t('onboarding.training')}</span>
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="btn" type="submit" disabled={!canSubmit}>
          {t('onboarding.submit')}
        </button>
      </form>

      {openDoc && <LegalModal doc={openDoc} onClose={() => setOpenDoc(null)} />}
    </main>
  )
}
