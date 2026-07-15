export type AppLanguage = 'en' | 'ko'

export const getStoredLanguage = (): AppLanguage => {
  try {
    const language = JSON.parse(localStorage.getItem('state') || '{}')?.app
      ?.persisted?.language
    if (language === 'en' || language === 'ko') {
      return language
    }
  } catch {}
  return 'ko'
}
