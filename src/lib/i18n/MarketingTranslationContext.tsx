import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import i18n from './i18n';
import { SUPPORTED_LANGUAGES, LanguageMeta, SupportedLanguageCode } from '../../types';
import {
  buildLocalizedRoutePath,
  extractLocaleFromPathname,
  isBlogArticlePath,
  isLocalizedMarketingBasePath,
  LOCALIZED_MARKETING_BASE_PATHS,
  normalizeLangParam,
  normalizePathname,
} from '../../seo/canonical';
import { buildBlogPostPath, findBaseBlogPost } from '../../content/blog';

export const MARKETING_LANG_STORAGE_KEY = 'ef_marketing_lang';

export const MARKETING_LANGUAGE_CODES: SupportedLanguageCode[] = ['en', 'zh-CN', 'zh-TW', 'ms'];

export const PUBLIC_MARKETING_PATHS = new Set<string>([
  ...LOCALIZED_MARKETING_BASE_PATHS,
  '/blog',
]);

export function isValidMarketingLanguage(code?: string | null): code is SupportedLanguageCode {
  return !!code && (MARKETING_LANGUAGE_CODES as string[]).includes(code);
}

export function normalizeMarketingLanguage(code?: string | null): SupportedLanguageCode {
  const parsed = normalizeLangParam(code);
  if (parsed && isValidMarketingLanguage(parsed)) {
    return parsed;
  }
  return 'en';
}

export function isPublicMarketingPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  const { basePath } = extractLocaleFromPathname(normalized);
  if (PUBLIC_MARKETING_PATHS.has(basePath)) return true;
  if (isBlogArticlePath(basePath)) return true;
  return false;
}

export function isLocalizedMarketingPath(pathname: string): boolean {
  const { basePath } = extractLocaleFromPathname(pathname);
  return isLocalizedMarketingBasePath(basePath);
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
 * 1. Clean URL locale prefix (`/zh-cn/...`, `/zh-tw/...`, `/ms/...`)
 * 2. URL `?lang=` query parameter (legacy compatibility)
 * 3. Stored preference in localStorage (`ef_marketing_lang`)
 * 4. Default `'en'`
 */
export function resolveInitialMarketingLanguage(
  search?: string,
  stored?: string | null,
  pathname?: string
): SupportedLanguageCode {
  if (pathname) {
    const extracted = extractLocaleFromPathname(pathname);
    if (extracted.hasLocalePrefix) {
      return extracted.lang;
    }
    if (extracted.hasExplicitEnglishPrefix) {
      return 'en';
    }
  }

  if (search) {
    try {
      const params = new URLSearchParams(search);
      const urlLang = normalizeLangParam(params.get('lang'));
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
 * Resolves a marketing or blog target href to its clean localized path (e.g. `/zh-cn/pricing`
 * or `/zh-cn/blog/shuzi-hunli-yaoqinghan-zhinan`) while preserving article identity,
 * query params (excluding redundant `lang`), and hash fragments.
 */
export function buildMarketingLocalizedPath(
  targetHref: string,
  lang: SupportedLanguageCode
): string {
  const [pathAndQuery, hash = ''] = targetHref.split('#');
  const [rawPath, rawQuery = ''] = pathAndQuery.split('?');
  const { basePath } = extractLocaleFromPathname(rawPath || '/');

  if (!isLocalizedMarketingBasePath(basePath)) {
    return targetHref;
  }

  let localizedBase: string;
  if (isBlogArticlePath(basePath)) {
    const slugSegment = basePath.slice('/blog/'.length);
    const basePost = findBaseBlogPost(slugSegment);
    localizedBase = basePost
      ? buildBlogPostPath(basePost.id || basePost.slug, lang)
      : buildLocalizedRoutePath(basePath, lang);
  } else {
    localizedBase = buildLocalizedRoutePath(basePath, lang);
  }

  const params = new URLSearchParams(rawQuery);
  params.delete('lang');

  const queryString = params.toString();
  const withQuery = queryString ? `${localizedBase}?${queryString}` : localizedBase;
  return hash ? `${withQuery}#${hash}` : withQuery;
}

/**
 * Pure translation helper for the `marketing` namespace.
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

export const MarketingTranslationProvider: React.FC<{
  children: React.ReactNode;
  initialLanguage?: SupportedLanguageCode;
}> = ({ children, initialLanguage }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguageCode>(() => {
    if (initialLanguage) return initialLanguage;
    return resolveInitialMarketingLanguage(
      typeof window !== 'undefined' ? window.location.search : location.search,
      getStoredMarketingLanguage(),
      typeof window !== 'undefined' ? window.location.pathname : location.pathname
    );
  });

  // Sync URL locale prefix or legacy `?lang=` query when navigating on localized marketing/blog routes
  useEffect(() => {
    if (!isPublicMarketingPath(location.pathname)) return;
    const extracted = extractLocaleFromPathname(location.pathname);

    if (extracted.hasLocalePrefix) {
      if (extracted.lang !== currentLanguage) {
        setCurrentLanguage(extracted.lang);
      }
      saveStoredMarketingLanguage(extracted.lang);
      return;
    }

    if (extracted.hasExplicitEnglishPrefix) {
      if (currentLanguage !== 'en') {
        setCurrentLanguage('en');
      }
      saveStoredMarketingLanguage('en');
      return;
    }

    try {
      const params = new URLSearchParams(location.search);
      const queryLang = normalizeLangParam(params.get('lang'));
      if (queryLang && isValidMarketingLanguage(queryLang)) {
        if (queryLang !== currentLanguage) {
          setCurrentLanguage(queryLang);
        }
        saveStoredMarketingLanguage(queryLang);

        if (queryLang !== 'en' && isLocalizedMarketingBasePath(extracted.basePath)) {
          params.delete('lang');
          const searchStr = params.toString();
          const targetPathname = isBlogArticlePath(extracted.basePath)
            ? buildMarketingLocalizedPath(extracted.basePath, queryLang)
            : buildLocalizedRoutePath(extracted.basePath, queryLang);
          navigate(
            {
              pathname: targetPathname,
              search: searchStr ? `?${searchStr}` : '',
              hash: location.hash,
            },
            { replace: true }
          );
        }
      } else if (extracted.basePath && isLocalizedMarketingBasePath(extracted.basePath)) {
        if (currentLanguage !== 'en' && !getStoredMarketingLanguage()) {
          setCurrentLanguage('en');
        }
      }
    } catch {
      // Ignore query errors
    }
  }, [location.pathname, location.search]);

  // Keep <html lang="..."> synced on public marketing & blog routes
  useEffect(() => {
    if (typeof document !== 'undefined' && isPublicMarketingPath(location.pathname)) {
      const effectiveLang = isLocalizedMarketingPath(location.pathname) ? currentLanguage : 'en';
      document.documentElement.lang = effectiveLang;
    }
  }, [currentLanguage, location.pathname]);

  const setLanguage = useCallback(
    (langCode: string) => {
      const nextLang = normalizeMarketingLanguage(langCode);
      setCurrentLanguage(nextLang);
      saveStoredMarketingLanguage(nextLang);

      const { basePath } = extractLocaleFromPathname(location.pathname);
      if (isLocalizedMarketingBasePath(basePath)) {
        const params = new URLSearchParams(location.search);
        params.delete('lang');
        const searchStr = params.toString();
        const nextPath = buildMarketingLocalizedPath(location.pathname, nextLang);
        navigate(
          {
            pathname: nextPath,
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
      const { basePath } = extractLocaleFromPathname(location.pathname);
      const effectiveLang = isLocalizedMarketingBasePath(basePath) ? currentLanguage : 'en';
      return translateMarketing(key, effectiveLang, params);
    },
    [currentLanguage, location.pathname]
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
