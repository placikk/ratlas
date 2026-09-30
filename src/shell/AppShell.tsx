import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InstallHint } from '../install/InstallHint'
import { ProfileScreen } from '../profile/ProfileScreen'
import type { Profile } from '../profile/profileApi'
import { ComingSoon } from './ComingSoon'
import { TabBar, type Tab } from './TabBar'

export function AppShell({ profile, onProfileChange }: { profile: Profile; onProfileChange: () => void }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('map')

  return (
    <div className="shell">
      <InstallHint />
      <main>
        {tab === 'profile' ? (
          <ProfileScreen profile={profile} onChange={onProfileChange} />
        ) : (
          <ComingSoon title={t(`tabs.${tab}`)} />
        )}
      </main>
      <TabBar active={tab} onSelect={setTab} />
    </div>
  )
}
