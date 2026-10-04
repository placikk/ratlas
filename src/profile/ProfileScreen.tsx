import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signOut } from '../auth/authApi'
import { InstallGuide } from '../install/InstallGuide'
import { detectPlatform, readInstallEnv } from '../install/platform'
import { LegalModal, type LegalDoc } from '../legal/LegalModal'
import { MySightings } from './MySightings'
import { updateSettings, type Profile, type ProfileSettings } from './profileApi'
import { rankProgress, useRanks } from './ranksApi'

export function ProfileScreen({ profile, onChange }: { profile: Profile; onChange: () => void }) {
  const { t } = useTranslation()
  const [saveFailed, setSaveFailed] = useState(false)
  const [openDoc, setOpenDoc] = useState<LegalDoc | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const progress = rankProgress(profile.total_rats, useRanks())
  const installEnv = readInstallEnv()

  async function save(patch: Partial<ProfileSettings>) {
    setSaveFailed(false)
    try {
      await updateSettings(profile.id, patch)
      onChange()
    } catch {
      setSaveFailed(true)
    }
  }

  return (
    <section className="screen stack">
      <header className="profile__header">
        <img src="/logo.svg" alt="" width={64} height={64} />
        <h1>{profile.nickname}</h1>
      </header>

      <div className="profile__stats">
        <div className="card">
          <strong>{profile.total_rats}</strong>
          <span className="muted">{t('profile.rats')}</span>
        </div>
        <div className="card">
          <strong>{profile.tokens_balance}</strong>
          <span className="muted">{t('profile.tokens')}</span>
        </div>
      </div>
      {progress && (
        <div className="card stack profile__rank">
          <span className="muted">{t('profile.rank')}</span>
          <strong>{progress.current.name}</strong>
          <div
            className="profile__rank-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.fraction * 100)}
          >
            <div className="profile__rank-fill" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
          </div>
          <span className="muted">
            {progress.next
              ? t('profile.toNextRank', { count: progress.remaining, rank: progress.next.name })
              : t('profile.topRank')}
          </span>
        </div>
      )}

      <MySightings />

      <h2>{t('profile.settings')}</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={profile.show_nickname_on_map}
          onChange={(event) => void save({ show_nickname_on_map: event.target.checked })}
        />
        <span>{t('profile.showNickname')}</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={profile.training_consent}
          onChange={(event) => void save({ training_consent: event.target.checked })}
        />
        <span>{t('profile.trainingConsent')}</span>
      </label>
      {saveFailed && (
        <p className="error" role="alert">
          {t('profile.saveFailed')}
        </p>
      )}

      <div className="row">
        <button className="btn--link" type="button" onClick={() => setOpenDoc('terms')}>
          {t('legal.terms')}
        </button>
        <button className="btn--link" type="button" onClick={() => setOpenDoc('privacy')}>
          {t('legal.privacy')}
        </button>
      </div>

      {!installEnv.standalone && (
        <button className="btn--link" type="button" onClick={() => setGuideOpen(true)}>
          {t('install.guideLink')}
        </button>
      )}

      <button className="btn btn--ghost" type="button" onClick={() => void signOut().catch(() => undefined)}>
        {t('profile.logout')}
      </button>

      {openDoc && <LegalModal doc={openDoc} onClose={() => setOpenDoc(null)} />}
      {guideOpen && <InstallGuide platform={detectPlatform(installEnv)} onClose={() => setGuideOpen(false)} />}
    </section>
  )
}
