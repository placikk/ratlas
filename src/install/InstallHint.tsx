import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { readFlag, writeFlag } from '../lib/storage'
import { InstallGuide } from './InstallGuide'
import { useInstallPrompt } from './installPrompt'
import { detectPlatform, readInstallEnv, shouldShowInstallHint, type InstallEnv } from './platform'

const DISMISSED_KEY = 'szczury.installHintDismissed'

export function InstallHint({ env }: { env?: InstallEnv }) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => readFlag(DISMISSED_KEY))
  const [guideOpen, setGuideOpen] = useState(false)
  const { canInstall, install } = useInstallPrompt()
  const current = env ?? readInstallEnv()

  if (!shouldShowInstallHint(current, dismissed)) return null

  function dismiss() {
    writeFlag(DISMISSED_KEY)
    setDismissed(true)
  }

  return (
    <aside className="card stack install-hint" role="note">
      <strong>{t('install.title')}</strong>
      <p>{t('install.why')}</p>
      <div className="row">
        {canInstall ? (
          <button className="btn" type="button" onClick={() => void install()}>
            {t('install.installNow')}
          </button>
        ) : (
          <button className="btn" type="button" onClick={() => setGuideOpen(true)}>
            {t('install.howTo')}
          </button>
        )}
        <button className="btn btn--ghost" type="button" onClick={dismiss}>
          {t('install.dismiss')}
        </button>
      </div>
      {guideOpen && <InstallGuide platform={detectPlatform(current)} onClose={() => setGuideOpen(false)} />}
    </aside>
  )
}
