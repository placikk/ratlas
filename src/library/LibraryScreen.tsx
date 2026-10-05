import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ItemView } from './ItemView'
import { fetchCatalog, purchaseItem, type CatalogItem, type ItemType, type PurchaseResult } from './libraryApi'

type State = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; items: CatalogItem[] }

const SECTIONS: { key: 'cards' | 'quizzes' | 'looks'; types: ItemType[] }[] = [
  { key: 'cards', types: ['knowledge_card'] },
  { key: 'quizzes', types: ['quiz'] },
  { key: 'looks', types: ['pin_skin', 'title'] },
]

export function LibraryScreen({ balance, onBalanceChange }: { balance: number; onBalanceChange: () => void }) {
  const { t } = useTranslation()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [version, setVersion] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [buying, setBuying] = useState<CatalogItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PurchaseResult | null>(null)

  useEffect(() => {
    let active = true
    fetchCatalog().then(
      (items) => {
        if (active) setState({ kind: 'loaded', items })
      },
      () => {
        if (active) setState({ kind: 'failed' })
      },
    )
    return () => {
      active = false
    }
  }, [version])

  function reload() {
    setVersion((current) => current + 1)
  }

  async function buy(item: CatalogItem) {
    setBusy(true)
    const outcome = await purchaseItem(item.id)
    setBusy(false)
    setBuying(null)
    if (outcome !== 'error') onBalanceChange()
    if (outcome === 'purchased' || outcome === 'owned') {
      reload()
      setOpenId(item.id)
      return
    }
    setResult(outcome)
  }

  const items = state.kind === 'loaded' ? state.items : []
  const opened = items.find((item) => item.id === openId && item.owned)

  if (opened) {
    return (
      <section className="screen">
        <ItemView item={opened} onBack={() => setOpenId(null)} onChanged={reload} />
      </section>
    )
  }

  return (
    <section className="screen stack library">
      <h1>{t('library.title')}</h1>
      <p className="library__balance">{t('library.balance', { raciki: t('result.raciki', { count: balance }) })}</p>
      {result && (
        <p className="error" role="alert">
          {t(`library.purchaseResult.${result}`)}
        </p>
      )}
      {state.kind === 'loading' && <p className="muted">{t('app.loading')}</p>}
      {state.kind === 'failed' && (
        <p className="error" role="alert">
          {t('library.loadFailed')}
        </p>
      )}
      {state.kind === 'loaded' &&
        SECTIONS.map((section) => (
          <section key={section.key} className="stack" aria-labelledby={`library-${section.key}`}>
            <h2 id={`library-${section.key}`}>{t(`library.sections.${section.key}`)}</h2>
            <ul className="library__list">
              {items
                .filter((item) => section.types.includes(item.type))
                .map((item) => (
                  <li key={item.id}>
                    <button
                      className="card library__item"
                      type="button"
                      onClick={() => {
                        setResult(null)
                        if (item.owned) setOpenId(item.id)
                        else setBuying(item)
                      }}
                    >
                      <span className="stack library__text">
                        <strong>{item.name}</strong>
                        <span className="muted">{item.teaser}</span>
                      </span>
                      <span className="library__price">
                        {item.equipped
                          ? t('library.equipped')
                          : item.owned
                            ? t('library.owned')
                            : t('result.raciki', { count: item.price })}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}

      {buying && (
        <div className="modal-backdrop">
          <div className="modal card stack" role="dialog" aria-modal="true" aria-label={buying.name}>
            <p>{t('library.buyConfirm', { name: buying.name, raciki: t('result.raciki', { count: buying.price }) })}</p>
            {balance < buying.price && (
              <p className="error">{t('library.missing', { raciki: t('result.raciki', { count: buying.price - balance }) })}</p>
            )}
            <button
              className="btn"
              type="button"
              disabled={busy || balance < buying.price}
              onClick={() => void buy(buying)}
            >
              {t('library.buy')}
            </button>
            <button className="btn btn--ghost" type="button" onClick={() => setBuying(null)}>
              {t('library.cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
