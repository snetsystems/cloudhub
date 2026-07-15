import i18n from 'i18next'
import {initReactI18next} from 'react-i18next'

import translationEN from './locales/en/translation.json'
import translationKO from './locales/ko/translation.json'
import {getStoredLanguage} from 'src/shared/utils/language'

const resources = {
  en: {
    translation: translationEN,
  },
  ko: {
    translation: translationKO,
  },
}

i18n.use(initReactI18next).init({
  resources,
  lng: getStoredLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
