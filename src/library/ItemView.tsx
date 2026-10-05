import { useTranslation } from 'react-i18next'
import { CardView } from './CardView'
import { CosmeticView } from './CosmeticView'
import type { CatalogItem } from './libraryApi'
import { QuizView } from './QuizView'

export function ItemView({ item, onBack, onChanged }: { item: CatalogItem; onBack: () => void; onChanged: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="stack">
      <button className="btn--link library__back" type="button" onClick={onBack}>
        {t('library.back')}
      </button>
      <h1>{item.name}</h1>
      {item.type === 'knowledge_card' && <CardView itemId={item.id} />}
      {item.type === 'quiz' && <QuizView itemId={item.id} />}
      {(item.type === 'pin_skin' || item.type === 'title') && <CosmeticView item={item} onChanged={onChanged} />}
    </div>
  )
}
