import { useTranslation } from 'react-i18next'

export function ComingSoon({ title }: { title: string }) {
  const { t } = useTranslation()
  return (
    <section className="screen coming-soon">
      <img src="/logo.svg" alt="" width={72} height={72} />
      <h1>{title}</h1>
      <p className="muted">{t('comingSoon')}</p>
    </section>
  )
}
