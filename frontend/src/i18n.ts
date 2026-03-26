import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import translationEN from './locales/en/translation.json'
import translationKO from './locales/ko/translation.json'

const resources = {
  en: {
    translation: translationEN,
  },
  ko: {
    translation: translationKO,
  },
}

const userLang = navigator?.language || 'en'
const defaultLang = userLang.startsWith('ko') ? 'ko' : 'en'

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: defaultLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
