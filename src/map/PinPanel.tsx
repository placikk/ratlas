import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { photoUrl, REPORT_REASONS, reportPin, type ReportReason, type ReportResult } from './mapApi'
import { timeAgo, type Pin } from './pins'

export function PinPanel({
  pin,
  now,
  onClose,
  onHidden,
}: {
  pin: Pin
  now: number
  onClose: () => void
  onHidden: (id: string) => void
}) {
  const { t } = useTranslation()
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ReportResult | null>(null)

  async function send() {
    if (!reason) return
    setBusy(true)
    const outcome = await reportPin(pin.id, reason)
    setBusy(false)
    setResult(outcome)
    setReporting(false)
  }

  function close() {
    if (result === 'hidden') onHidden(pin.id)
    onClose()
  }

  return (
    <div className="pin-panel card stack" role="dialog" aria-label={t('map.panelTitle')}>
      <img className="pin-panel__photo" src={photoUrl(pin.photoPath)} alt={t('map.photoAlt')} />
      <div className="pin-panel__meta">
        <strong>{t('map.rats', { count: pin.rats })}</strong>
        <span className="muted">{timeAgo(pin.createdAt, now, t('map.justNow'))}</span>
      </div>
      <span className="muted">{pin.nickname ? t('map.author', { nickname: pin.nickname }) : t('map.authorHidden')}</span>
      {pin.title && <span className="pin-panel__title">{t('map.title', { title: pin.title })}</span>}

      {result && <p role="status">{t(`map.reportResult.${result}`)}</p>}

      {reporting ? (
        <>
          <fieldset>
            <legend>{t('map.reportTitle')}</legend>
            {REPORT_REASONS.map((option) => (
              <label key={option} className="check">
                <input
                  type="radio"
                  name="report-reason"
                  checked={reason === option}
                  onChange={() => setReason(option)}
                />
                <span>{t(`map.reasons.${option}`)}</span>
              </label>
            ))}
          </fieldset>
          <button className="btn" type="button" disabled={!reason || busy} onClick={() => void send()}>
            {t('map.send')}
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => setReporting(false)}>
            {t('map.cancel')}
          </button>
        </>
      ) : (
        <>
          {pin.isMine ? (
            <span className="muted">{t('map.yours')}</span>
          ) : (
            (!result || result === 'error') && (
              <button className="btn--link" type="button" onClick={() => {
                  setResult(null)
                  setReporting(true)
                }}>
                {t('map.report')}
              </button>
            )
          )}
          <button className="btn btn--ghost" type="button" onClick={close}>
            {t('map.close')}
          </button>
        </>
      )}
    </div>
  )
}
