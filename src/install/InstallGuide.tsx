import { useTranslation } from 'react-i18next'
import type { Platform } from './platform'

export function InstallGuide({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  const { t } = useTranslation()
  const androidSteps = t('install.androidSteps', { returnObjects: true }) as string[]
  const iosSteps = t('install.iosSteps', { returnObjects: true }) as string[]

  return (
    <div className="modal-backdrop">
      <div className="modal card" role="dialog" aria-modal="true" aria-label={t('install.guideTitle')}>
        <div className="modal__body stack">
          <h2>{t('install.guideTitle')}</h2>
          <details className="install-guide__section" open={platform === 'android'}>
            <summary>{t('install.android')}</summary>
            <ol>
              {androidSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="muted">{t('install.samsung')}</p>
          </details>
          <details className="install-guide__section" open={platform === 'ios'}>
            <summary>{t('install.ios')}</summary>
            <ol>
              {iosSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
        </div>
        <button className="btn" type="button" onClick={onClose}>
          {t('install.close')}
        </button>
      </div>
    </div>
  )
}
