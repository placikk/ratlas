import { useTranslation } from 'react-i18next'

export type Tab = 'map' | 'report' | 'ranking' | 'library' | 'profile'

const TABS: { id: Tab; icon: string }[] = [
  { id: 'map', icon: '🗺️' },
  { id: 'report', icon: '📸' },
  { id: 'ranking', icon: '🏆' },
  { id: 'library', icon: '📚' },
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
          className="tabbar__item"
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
