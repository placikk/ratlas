import { useTranslation } from 'react-i18next'
import type { LegalDoc } from './LegalModal'
import { Privacy } from './Privacy'
import { Terms } from './Terms'

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { t } = useTranslation()
  return (
    <main className="screen stack">
      {doc === 'terms' ? <Terms /> : <Privacy />}
      <a className="btn" href="/">
        {t('legal.openApp')}
      </a>
    </main>
  )
}
