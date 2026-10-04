import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { checkNickname, type NicknameProblem } from '../onboarding/nickname'
import { changeNickname, type OnboardingFailure } from './profileApi'

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

export function NicknameEditor({ nickname, onChange }: { nickname: string; onChange: () => void }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(nickname)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const problem = checkNickname(value)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (problem || busy) return
    setBusy(true)
    setError(null)
    const result = await changeNickname(value.trim())
    setBusy(false)
    if (result.ok) {
      setEditing(false)
      onChange()
      return
    }
    setError(t(FAILURE_KEYS[result.reason]))
  }

  if (!editing) {
    return (
      <button
        className="btn--link"
        type="button"
        onClick={() => {
          setValue(nickname)
          setError(null)
          setEditing(true)
        }}
      >
        {t('profile.changeNickname')}
      </button>
    )
  }

  return (
    <form className="stack card" onSubmit={onSubmit}>
      <label className="stack">
        <span>{t('onboarding.nicknameLabel')}</span>
        <input className="input" autoComplete="nickname" maxLength={30} value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      {problem ? <p className="error">{t(PROBLEM_KEYS[problem])}</p> : <p className="muted">{t('onboarding.nicknameHint')}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button className="btn" type="submit" disabled={problem !== null || busy}>
          {t('profile.saveNickname')}
        </button>
        <button className="btn btn--ghost" type="button" onClick={() => setEditing(false)}>
          {t('profile.cancel')}
        </button>
      </div>
    </form>
  )
}
