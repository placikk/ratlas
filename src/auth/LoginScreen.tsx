import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import './LoginScreen.css'
import { sendEmailCode, signInWithGoogle, verifyEmailCode } from './authApi'

type Step = { kind: 'email' } | { kind: 'code'; email: string }

export function LoginScreen() {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>({ kind: 'email' })
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>, errorKey: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch {
      setError(t(errorKey))
    } finally {
      setBusy(false)
    }
  }

  function onSendCode(event: FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    void run(async () => {
      await sendEmailCode(trimmed)
      setStep({ kind: 'code', email: trimmed })
    }, 'login.sendFailed')
  }

  function onVerify(event: FormEvent) {
    event.preventDefault()
    if (step.kind !== 'code') return
    void run(() => verifyEmailCode(step.email, code.trim()), 'login.invalidCode')
  }

  function onChangeEmail() {
    setStep({ kind: 'email' })
    setCode('')
    setError(null)
  }

  return (
    <main className="screen login">
      <img className="login__logo" src="/logo.svg" alt="" width={112} height={112} />
      <h1>{t('app.name')}</h1>
      <p className="muted">{t('login.tagline')}</p>

      <button className="btn" type="button" disabled={busy} onClick={() => void run(signInWithGoogle, 'app.error')}>
        {t('login.google')}
      </button>

      <p className="login__or muted">{t('login.or')}</p>

      {step.kind === 'email' ? (
        <form className="stack" onSubmit={onSendCode}>
          <label className="stack">
            <span>{t('login.emailLabel')}</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button className="btn btn--ghost" type="submit" disabled={busy}>
            {t('login.sendCode')}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={onVerify}>
          <p>{t('login.codeSent', { email: step.email })}</p>
          <label className="stack">
            <span>{t('login.codeLabel')}</span>
            <input
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button className="btn" type="submit" disabled={busy}>
            {t('login.verify')}
          </button>
          <button className="btn btn--ghost" type="button" onClick={onChangeEmail}>
            {t('login.changeEmail')}
          </button>
        </form>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  )
}
