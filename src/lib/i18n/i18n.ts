import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { UI_DICTIONARIES } from './dictionaries';

// Structure resources for i18next
const resources = {
  en: { translation: UI_DICTIONARIES['en'] },
  'zh-CN': { translation: UI_DICTIONARIES['zh-CN'] },
  'zh-TW': { translation: UI_DICTIONARIES['zh-TW'] },
  ms: { translation: UI_DICTIONARIES['ms'] }
};

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: 'en',
      fallbackLng: 'en',
      supportedLngs: ['en', 'zh-CN', 'zh-TW', 'ms'],
      interpolation: {
        escapeValue: false // React already escapes values
      },
      returnEmptyString: false
    });
}

export default i18n;
