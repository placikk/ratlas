import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { readFlag, writeFlag } from '../lib/storage'
import { readInstallEnv, shouldShowIosInstallHint, type InstallEnv } from './platform'

const DISMISSED_KEY = 'szczury.installHintDismissed'

export function InstallHint({ env }: { env?: InstallEnv }) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => readFlag(DISMISSED_KEY))

  if (!shouldShowIosInstallHint(env ?? readInstallEnv(), dismissed)) return null

  function dismiss() {
    writeFlag(DISMISSED_KEY)
    setDismissed(true)
  }

  return (
    <aside className="card stack install-hint" role="note">
      <strong>{t('install.title')}</strong>
      <p>{t('install.ios')}</p>
      <button className="btn btn--ghost" type="button" onClick={dismiss}>
        {t('install.dismiss')}
      </button>
    </aside>
  )
}
