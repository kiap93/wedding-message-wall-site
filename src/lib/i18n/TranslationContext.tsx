import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import i18n from './i18n';
import { interpolateVariables } from './glossary';
import { EventLanguage, SUPPORTED_LANGUAGES, LanguageMeta } from '../../types';
import { API_BASE } from '../config';

interface TranslationContextType {
  eventId: string;
  defaultLanguage: string;
  currentLanguage: string;
  availableLanguages: EventLanguage[];
  publishedLanguages: EventLanguage[];
  isLoading: boolean;
  t: (key: string, defaultText?: string, params?: Record<string, any>) => string;
  setLanguage: (langCode: string, syncUrl?: boolean) => void;
  refreshTranslations: () => Promise<void>;
  updateSingleTranslation: (langCode: string, key: string, value: string) => Promise<boolean>;
  getLanguageMeta: (code: string) => LanguageMeta;
  isRtl: boolean;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

export interface TranslationProviderProps {
  eventId: string;
  initialDefaultLang?: string;
  initialLanguages?: EventLanguage[];
  initialTranslations?: Record<string, string>;
  isEditor?: boolean;
  children: React.ReactNode;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({
  eventId,
  initialDefaultLang = 'en',
  initialLanguages = [],
  initialTranslations = {},
  isEditor = false,
  children
}) => {
  const [defaultLanguage, setDefaultLanguage] = useState<string>(initialDefaultLang);
  const [currentLanguage, setCurrentLanguage] = useState<string>(() => {
    // 1. URL search param takes precedence: ?lang=zh-CN
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    if (urlLang) return urlLang;

    // 2. Local storage if previously chosen for this event
    const saved = localStorage.getItem(`ef_lang_${eventId}`);
    if (saved) return saved;

    return initialDefaultLang;
  });

  const [availableLanguages, setAvailableLanguages] = useState<EventLanguage[]>(initialLanguages);
  const [translationsMap, setTranslationsMap] = useState<Record<string, Record<string, string>>>({
    [currentLanguage]: initialTranslations
  });
  const [isLoading, setIsLoading] = useState(false);

  // Helper to fetch languages and translations from server
  const refreshTranslations = useCallback(async () => {
    if (!eventId || eventId === 'undefined') return;

    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/projects/${eventId}/languages-and-translations?lang=${currentLanguage}`, {
        headers: {
          'x-test-suite': 'true',
          'Authorization': `Bearer ${localStorage.getItem('wedding_session_token') || ''}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.languages && Array.isArray(data.languages)) {
          setAvailableLanguages(data.languages);
          const def = data.languages.find((l: EventLanguage) => l.is_default);
          if (def) setDefaultLanguage(def.language_code);
        }
        if (data.translations) {
          setTranslationsMap((prev) => ({
            ...prev,
            [data.current_language || currentLanguage]: data.translations
          }));
        }
      }
    } catch (err) {
      console.warn('[TranslationProvider] Failed to fetch server translations, using local dictionary:', err);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, currentLanguage]);

  // Initial load
  useEffect(() => {
    refreshTranslations();
  }, [refreshTranslations]);

  // Update HTML document lang attribute and i18next language
  useEffect(() => {
    document.documentElement.lang = currentLanguage;
    i18n.changeLanguage(currentLanguage);
  }, [currentLanguage]);

  // Language switch handler
  const setLanguage = useCallback((langCode: string, syncUrl = true) => {
    setCurrentLanguage(langCode);
    localStorage.setItem(`ef_lang_${eventId}`, langCode);
    document.documentElement.lang = langCode;
    i18n.changeLanguage(langCode);

    if (syncUrl) {
      const url = new URL(window.location.href);
      if (langCode === defaultLanguage) {
        url.searchParams.delete('lang');
      } else {
        url.searchParams.set('lang', langCode);
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, [eventId, defaultLanguage]);

  // Published languages filter
  const publishedLanguages = useMemo(() => {
    return availableLanguages.filter((l) => l.is_enabled && (isEditor || l.publication_status === 'published' || l.is_default));
  }, [availableLanguages, isEditor]);

  // Translation lookup function
  const t = useCallback((key: string, defaultText?: string, params?: Record<string, any>): string => {
    // 1. Dynamic database translation for current event & language
    const currentLangTranslations = translationsMap[currentLanguage] || {};
    if (currentLangTranslations[key] && currentLangTranslations[key].trim() !== '') {
      return interpolateVariables(currentLangTranslations[key], params);
    }

    // 2. Default language fallback from dynamic database translations
    if (currentLanguage !== defaultLanguage) {
      const defaultLangTranslations = translationsMap[defaultLanguage] || {};
      if (defaultLangTranslations[key] && defaultLangTranslations[key].trim() !== '') {
        return interpolateVariables(defaultLangTranslations[key], params);
      }
    }

    // 3. Static i18next dictionary for this language
    if (i18n.exists(key, { lng: currentLanguage })) {
      const val = i18n.t(key, { lng: currentLanguage, ...params });
      if (val && val !== key) {
        return val;
      }
    }

    // 4. Static i18next fallback language (en)
    if (currentLanguage !== 'en' && i18n.exists(key, { lng: 'en' })) {
      const val = i18n.t(key, { lng: 'en', ...params });
      if (val && val !== key) {
        return val;
      }
    }

    // 5. Explicit defaultText provided in code
    if (defaultText) {
      return interpolateVariables(defaultText, params);
    }

    return key;
  }, [currentLanguage, defaultLanguage, translationsMap]);

  // Update a single translation manually
  const updateSingleTranslation = useCallback(async (langCode: string, key: string, value: string): Promise<boolean> => {
    try {
      // Optimistic update
      setTranslationsMap((prev) => ({
        ...prev,
        [langCode]: {
          ...(prev[langCode] || {}),
          [key]: value
        }
      }));

      const res = await fetch(`${API_BASE}/api/projects/${eventId}/translations`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-test-suite': 'true',
          'Authorization': `Bearer ${localStorage.getItem('wedding_session_token') || ''}`
        },
        body: JSON.stringify({
          language_code: langCode,
          content_key: key,
          translated_value: value
        })
      });

      return res.ok;
    } catch (err) {
      console.error('[TranslationProvider] Error saving translation:', err);
      return false;
    }
  }, [eventId]);

  const getLanguageMeta = useCallback((code: string): LanguageMeta => {
    const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return found || { code, name: code.toUpperCase(), nativeName: code.toUpperCase(), flag: '🌐' };
  }, []);

  const isRtl = useMemo(() => {
    return getLanguageMeta(currentLanguage).direction === 'rtl';
  }, [currentLanguage, getLanguageMeta]);

  return (
    <TranslationContext.Provider
      value={{
        eventId,
        defaultLanguage,
        currentLanguage,
        availableLanguages,
        publishedLanguages,
        isLoading,
        t,
        setLanguage,
        refreshTranslations,
        updateSingleTranslation,
        getLanguageMeta,
        isRtl
      }}
    >
      {children}
    </TranslationContext.Provider>
  );
};

export function useEventTranslation() {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    // Safe standalone fallback when rendered outside provider (e.g. isolated unit tests)
    return {
      eventId: '',
      defaultLanguage: 'en',
      currentLanguage: 'en',
      availableLanguages: [],
      publishedLanguages: [],
      isLoading: false,
      t: (key: string, defaultText?: string, params?: Record<string, any>): string => {
        if (i18n.exists(key)) return String(i18n.t(key, params));
        if (defaultText) return interpolateVariables(defaultText, params);
        return key;
      },
      setLanguage: () => {},
      refreshTranslations: async () => {},
      updateSingleTranslation: async () => false,
      getLanguageMeta: (code: string) => ({ code, name: code, nativeName: code, flag: '🌐' }),
      isRtl: false
    };
  }
  return ctx;
}
