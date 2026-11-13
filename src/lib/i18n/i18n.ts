import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { UI_DICTIONARIES } from './dictionaries';
import marketingEn from './marketing/en.json';
import marketingZhCn from './marketing/zh-CN.json';
import marketingZhTw from './marketing/zh-TW.json';
import marketingMs from './marketing/ms.json';

// Structure resources for i18next with strict namespace separation:
// - `translation`: event-specific guest/rsvp/display UI strings
// - `marketing`: global public-facing marketing website strings
const resources = {
  en: {
    translation: UI_DICTIONARIES['en'],
    marketing: marketingEn
  },
  'zh-CN': {
    translation: UI_DICTIONARIES['zh-CN'],
    marketing: marketingZhCn
  },
  'zh-TW': {
    translation: UI_DICTIONARIES['zh-TW'],
    marketing: marketingZhTw
  },
  ms: {
    translation: UI_DICTIONARIES['ms'],
    marketing: marketingMs
  }
};

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: 'en',
      fallbackLng: 'en',
      ns: ['translation', 'marketing'],
      defaultNS: 'translation',
      supportedLngs: ['en', 'zh-CN', 'zh-TW', 'ms'],
      interpolation: {
        escapeValue: false // React already escapes values
      },
      returnEmptyString: false
    });
} else {
  // Ensure marketing namespace bundles are registered if i18n was pre-initialized
  Object.entries(resources).forEach(([lng, namespaces]) => {
    if (!i18n.hasResourceBundle(lng, 'marketing')) {
      i18n.addResourceBundle(lng, 'marketing', namespaces.marketing, true, true);
    }
  });
}

export default i18n;
