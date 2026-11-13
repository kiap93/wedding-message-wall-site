import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import i18n from './i18n';
import { SUPPORTED_LANGUAGES, LanguageMeta, SupportedLanguageCode } from '../../types';
import { normalizePathname } from '../../seo/canonical';

export const MARKETING_LANG_STORAGE_KEY = 'ef_marketing_lang';

export const MARKETING_LANGUAGE_CODES: SupportedLanguageCode[] = ['en', 'zh-CN', 'zh-TW', 'ms'];

export const PUBLIC_MARKETING_PATHS = new Set<string>([
  '/',
  '/templates',
  '/pricing',
  '/wedding-planner-software',
  '/white-label-wedding-software',
  '/digital-wedding-invitations',
  '/wedding-rsvp-management',
  '/wedding-guest-management',
  '/wedding-reception-display',
  '/subscription',
]);

export function isValidMarketingLanguage(code?: string | null): code is SupportedLanguageCode {
  return !!code && (MARKETING_LANGUAGE_CODES as string[]).includes(code);
}

export function normalizeMarketingLanguage(code?: string | null): SupportedLanguageCode {
  if (isValidMarketingLanguage(code)) {
    return code;
  }
  return 'en';
}

export function isPublicMarketingPath(pathname: string): boolean {
  return PUBLIC_MARKETING_PATHS.has(normalizePathname(pathname));
}

export function getStoredMarketingLanguage(): SupportedLanguageCode | null {
  try {
    if (typeof window === 'undefined') return null;
    const saved = window.localStorage.getItem(MARKETING_LANG_STORAGE_KEY);
    return isValidMarketingLanguage(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function saveStoredMarketingLanguage(lang: SupportedLanguageCode): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MARKETING_LANG_STORAGE_KEY, lang);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Resolves the active marketing language strictly from explicit sources:
 * 1. URL `?lang=` parameter (if supported)
 * 2. Stored preference in localStorage (`ef_marketing_lang`)
 * 3. Default `'en'`
 *
 * Intentionally does NOT auto-detect `navigator.language` so manual selections
 * and default English behavior remain deterministic.
 */
export function resolveInitialMarketingLanguage(
  search?: string,
  stored?: string | null
): SupportedLanguageCode {
  if (search) {
    try {
      const params = new URLSearchParams(search);
      const urlLang = params.get('lang');
      if (isValidMarketingLanguage(urlLang)) {
        return urlLang;
      }
    } catch {
      // Ignore query parse error
    }
  }

  if (isValidMarketingLanguage(stored)) {
    return stored;
  }

  return 'en';
}

/**
 * Preserves existing query parameters on a marketing target href while
 * applying or clearing the `?lang=` parameter cleanly.
 */
export function buildMarketingLocalizedPath(
  targetHref: string,
  lang: SupportedLanguageCode
): string {
  const [pathAndQuery, hash = ''] = targetHref.split('#');
  const [rawPath, rawQuery = ''] = pathAndQuery.split('?');
  const normalizedPath = normalizePathname(rawPath || '/');

  // Only attach `?lang=` to public marketing routes; leave app/demo routes untouched
  if (!isPublicMarketingPath(normalizedPath)) {
    return targetHref;
  }

  const params = new URLSearchParams(rawQuery);
  if (lang === 'en') {
    params.delete('lang');
  } else {
    params.set('lang', lang);
  }

  const queryString = params.toString();
  const base = normalizedPath === '/' ? '/' : normalizedPath;
  const withQuery = queryString ? `${base}?${queryString}` : base;
  return hash ? `${withQuery}#${hash}` : withQuery;
}

/**
 * Pure translation helper for the `marketing` namespace.
 * Explicitly scopes lookups to `ns: 'marketing'` and `lng: lang` so event-specific
 * `i18n.changeLanguage()` calls never interfere with marketing translations.
 */
export function translateMarketing(
  key: string,
  lang: SupportedLanguageCode = 'en',
  params?: Record<string, string | number>
): string {
  const targetLang = normalizeMarketingLanguage(lang);
  const enFallback = i18n.t(key, {
    ns: 'marketing',
    lng: 'en',
    ...(params || {}),
  });
  const result = i18n.t(key, {
    ns: 'marketing',
    lng: targetLang,
    defaultValue: typeof enFallback === 'string' ? enFallback : key,
    ...(params || {}),
  });
  return typeof result === 'string' && result.length > 0 ? result : key;
}

export interface MarketingTranslationContextValue {
  currentLanguage: SupportedLanguageCode;
  supportedLanguages: LanguageMeta[];
  setLanguage: (langCode: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  getLocalizedPath: (targetHref: string) => string;
  getLanguageMeta: (langCode?: string) => LanguageMeta;
}

const MarketingTranslationContext = createContext<MarketingTranslationContextValue | null>(null);

export const MarketingTranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguageCode>(() => {
    const initial = resolveInitialMarketingLanguage(
      typeof window !== 'undefined' ? window.location.search : location.search,
      getStoredMarketingLanguage()
    );
    return initial;
  });

  // Persist URL `?lang=` parameter when visitor arrives with one
  useEffect(() => {
    if (!isPublicMarketingPath(location.pathname)) return;
    try {
      const params = new URLSearchParams(location.search);
      const urlLang = params.get('lang');
      if (isValidMarketingLanguage(urlLang)) {
        if (urlLang !== currentLanguage) {
          setCurrentLanguage(urlLang);
        }
        saveStoredMarketingLanguage(urlLang);
      }
    } catch {
      // Ignore query errors
    }
  }, [location.pathname, location.search]);

  // Keep <html lang="..."> synced on public marketing routes without affecting private/event pages
  useEffect(() => {
    if (typeof document !== 'undefined' && isPublicMarketingPath(location.pathname)) {
      document.documentElement.lang = currentLanguage;
    }
  }, [currentLanguage, location.pathname]);

  const setLanguage = useCallback(
    (langCode: string) => {
      const nextLang = normalizeMarketingLanguage(langCode);
      setCurrentLanguage(nextLang);
      saveStoredMarketingLanguage(nextLang);

      if (isPublicMarketingPath(location.pathname)) {
        const params = new URLSearchParams(location.search);
        if (nextLang === 'en') {
          params.delete('lang');
        } else {
          params.set('lang', nextLang);
        }
        const searchStr = params.toString();
        navigate(
          {
            pathname: location.pathname,
            search: searchStr ? `?${searchStr}` : '',
            hash: location.hash,
          },
          { replace: true }
        );
      }
    },
    [location.pathname, location.search, location.hash, navigate]
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translateMarketing(key, currentLanguage, params);
    },
    [currentLanguage]
  );

  const getLocalizedPath = useCallback(
    (targetHref: string) => {
      return buildMarketingLocalizedPath(targetHref, currentLanguage);
    },
    [currentLanguage]
  );

  const getLanguageMeta = useCallback(
    (langCode?: string): LanguageMeta => {
      const target = langCode || currentLanguage;
      return SUPPORTED_LANGUAGES.find((l) => l.code === target) || SUPPORTED_LANGUAGES[0];
    },
    [currentLanguage]
  );

  return (
    <MarketingTranslationContext.Provider
      value={{
        currentLanguage,
        supportedLanguages: SUPPORTED_LANGUAGES,
        setLanguage,
        t,
        getLocalizedPath,
        getLanguageMeta,
      }}
    >
      {children}
    </MarketingTranslationContext.Provider>
  );
};

export function useMarketingTranslation(): MarketingTranslationContextValue {
  const ctx = useContext(MarketingTranslationContext);
  if (!ctx) {
    return {
      currentLanguage: 'en',
      supportedLanguages: SUPPORTED_LANGUAGES,
      setLanguage: () => {},
      t: (key: string, params?: Record<string, string | number>) =>
        translateMarketing(key, 'en', params),
      getLocalizedPath: (targetHref: string) => targetHref,
      getLanguageMeta: (langCode?: string) =>
        SUPPORTED_LANGUAGES.find((l) => l.code === (langCode || 'en')) || SUPPORTED_LANGUAGES[0],
    };
  }
  return ctx;
}
