import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InstallHint } from '../install/InstallHint'
import { ProfileScreen } from '../profile/ProfileScreen'
import type { Profile } from '../profile/profileApi'
import { retryPending } from '../report/reportApi'
import { ReportScreen } from '../report/ReportScreen'
import { ComingSoon } from './ComingSoon'
import { TabBar, type Tab } from './TabBar'

export function AppShell({ profile, onProfileChange }: { profile: Profile; onProfileChange: () => void }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('map')

  // Zgłoszenia, których model nie zdążył sprawdzić, rozstrzygamy przy każdym otwarciu aplikacji.
  useEffect(() => {
    let active = true
    void retryPending().then((resolved) => {
      if (active && resolved > 0) onProfileChange()
    })
    return () => {
      active = false
    }
  }, [onProfileChange])

  return (
    <div className="shell">
      <InstallHint />
      <main>
        {tab === 'profile' ? (
          <ProfileScreen profile={profile} onChange={onProfileChange} />
        ) : tab === 'report' ? (
          <ReportScreen onRecorded={onProfileChange} />
        ) : (
          <ComingSoon title={t(`tabs.${tab}`)} />
        )}
      </main>
      <TabBar active={tab} onSelect={setTab} />
    </div>
  )
}
