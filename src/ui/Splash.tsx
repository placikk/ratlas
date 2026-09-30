import { useTranslation } from 'react-i18next'

export function Splash({ failed = false, onRetry }: { failed?: boolean; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <main className="splash">
      <img
        className={failed ? undefined : 'splash__logo--pulse'}
        src="/logo.svg"
        alt=""
        width={96}
        height={96}
      />
      {failed ? (
        <>
          <p role="alert">{t('app.error')}</p>
          <button className="btn" type="button" onClick={onRetry}>
            {t('app.retry')}
          </button>
        </>
      ) : (
        <p className="muted">{t('app.loading')}</p>
      )}
    </main>
  )
}
