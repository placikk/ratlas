import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signOut } from '../auth/authApi'
import { deleteAccount } from './accountApi'

export function DeleteAccount() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function remove() {
    setBusy(true)
    setFailed(false)
    const deleted = await deleteAccount()
    setBusy(false)
    if (!deleted) {
      setFailed(true)
      return
    }
    // Konto już nie istnieje — czyścimy lokalną sesję; aplikacja wraca do ekranu logowania.
    await signOut().catch(() => undefined)
  }

  if (!open) {
    return (
      <button className="btn btn--ghost" type="button" onClick={() => setOpen(true)}>
        {t('profile.deleteTitle')}
      </button>
    )
  }

  return (
    <section className="card stack">
      <strong>{t('profile.deleteTitle')}</strong>
      <p>{t('profile.deleteExplain')}</p>
      <label className="check">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>{t('profile.deleteConfirm')}</span>
      </label>
      {failed && (
        <p className="error" role="alert">
          {t('profile.deleteFailed')}
        </p>
      )}
      <button className="btn danger" type="button" disabled={!confirmed || busy} onClick={() => void remove()}>
        {t('profile.deleteForever')}
      </button>
      <button className="btn btn--ghost" type="button" onClick={() => setOpen(false)}>
        {t('profile.cancel')}
      </button>
    </section>
  )
}
