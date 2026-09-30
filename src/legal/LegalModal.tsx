import { useTranslation } from 'react-i18next'
import { Privacy } from './Privacy'
import { Terms } from './Terms'

export type LegalDoc = 'terms' | 'privacy'

export function LegalModal({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="modal-backdrop">
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-label={t(doc === 'terms' ? 'legal.terms' : 'legal.privacy')}
      >
        <div className="modal__body">{doc === 'terms' ? <Terms /> : <Privacy />}</div>
        <button className="btn" type="button" onClick={onClose}>
          {t('legal.close')}
        </button>
      </div>
    </div>
  )
}
