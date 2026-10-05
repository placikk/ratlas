import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ratIconSvg, skinOrDefault } from '../map/ratIcons'
import { setEquipped, type CatalogItem } from './libraryApi'

export function CosmeticView({ item, onChanged }: { item: CatalogItem; onChanged: () => void }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const type = item.type === 'pin_skin' ? 'pin_skin' : 'title'

  async function toggle() {
    setBusy(true)
    setFailed(false)
    const result = await setEquipped(type, item.equipped ? null : item.id)
    setBusy(false)
    if (result === 'ok') onChanged()
    else setFailed(true)
  }

  return (
    <div className="stack">
      {type === 'pin_skin' ? (
        <img
          className="library__skin"
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(ratIconSvg(skinOrDefault(item.preview), false))}`}
          alt=""
          width={96}
          height={96}
        />
      ) : (
        <p className="library__title-preview">{t('library.cosmetic.titlePreview', { title: item.preview ?? item.name })}</p>
      )}
      <p className="muted">{t(type === 'pin_skin' ? 'library.cosmetic.skinHint' : 'library.cosmetic.titleHint')}</p>
      {item.equipped && <p>{t('library.cosmetic.equippedNow')}</p>}
      {failed && (
        <p className="error" role="alert">
          {t('library.cosmetic.equipFailed')}
        </p>
      )}
      <button className={item.equipped ? 'btn btn--ghost' : 'btn'} type="button" disabled={busy} onClick={() => void toggle()}>
        {t(item.equipped ? 'library.cosmetic.unequip' : 'library.cosmetic.equip')}
      </button>
    </div>
  )
}
