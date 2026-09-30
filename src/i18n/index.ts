import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import pl from './pl.json'

void i18n.use(initReactI18next).init({
  lng: 'pl',
  fallbackLng: 'pl',
  resources: { pl: { translation: pl } },
  interpolation: { escapeValue: false },
  initImmediate: false,
})

export default i18n
