import { useTranslation } from 'react-i18next'

export type Tab = 'map' | 'report' | 'ranking' | 'profile'

const TABS: { id: Tab; icon: string }[] = [
  { id: 'map', icon: '🗺️' },
  { id: 'report', icon: '📸' },
  { id: 'ranking', icon: '🏆' },
  { id: 'profile', icon: '🐀' },
]

export function TabBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  const { t } = useTranslation()
  return (
    <nav className="tabbar" aria-label={t('app.name')}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === 'report' ? 'tabbar__item tabbar__item--primary' : 'tabbar__item'}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => onSelect(tab.id)}
        >
          <span className="tabbar__icon" aria-hidden="true">
            {tab.icon}
          </span>
          <span>{t(`tabs.${tab.id}`)}</span>
        </button>
      ))}
    </nav>
  )
}
