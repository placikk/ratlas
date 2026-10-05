import { useTranslation } from 'react-i18next'
import { parseCard } from './content'
import { useItemContent } from './useItemContent'

export function CardView({ itemId }: { itemId: string }) {
  const { t } = useTranslation()
  const state = useItemContent(itemId)

  if (state.kind === 'loading') return <p className="muted">{t('app.loading')}</p>
  const card = state.kind === 'loaded' ? parseCard(state.item.content) : null
  if (!card) {
    return (
      <p className="error" role="alert">
        {t('library.contentFailed')}
      </p>
    )
  }

  return (
    <article className="stack library__card">
      {card.body.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      {card.sources.length > 0 && (
        <>
          <h2>{t('library.sources')}</h2>
          <ul className="library__sources">
            {card.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  )
}
