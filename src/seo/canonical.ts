import { SEO_CONFIG } from './config';

export type MarketingLanguageCode = 'en' | 'zh-CN' | 'zh-TW' | 'ms';

export const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'ref',
  'preview',
  'token',
]);

export const MARKETING_HREFLANG_CODES: readonly MarketingLanguageCode[] = [
  'en',
  'zh-CN',
  'zh-TW',
  'ms',
] as const;

export const LANGUAGE_URL_PREFIXES: Record<MarketingLanguageCode, string> = {
  en: '',
  'zh-CN': '/zh-cn',
  'zh-TW': '/zh-tw',
  ms: '/ms',
};

const PREFIX_TO_LANGUAGE: Record<string, MarketingLanguageCode> = {
  '/zh-cn': 'zh-CN',
  '/zh-tw': 'zh-TW',
  '/ms': 'ms',
};

export const LOCALIZED_MARKETING_BASE_PATHS = new Set<string>([
  '/',
  '/templates',
  '/pricing',
  '/blog',
  '/wedding-website-builder',
  '/wedding-seating-chart',
  '/wedding-planner-software',
  '/white-label-wedding-software',
  '/digital-wedding-invitations',
  '/wedding-rsvp-management',
  '/wedding-guest-management',
  '/wedding-reception-display',
]);

/**
 * Returns true if the unprefixed path is a blog article detail route (`/blog/:slug`).
 */
export function isBlogArticlePath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  if (!normalized.startsWith('/blog/')) return false;
  const slug = normalized.slice('/blog/'.length);
  return slug.length > 0 && !slug.includes('/');
}

/**
 * Returns true for any public marketing route (including /blog and /blog/:slug)
 * that supports multilingual localization.
 */
export function isLocalizedMarketingBasePath(basePath: string): boolean {
  const normalized = normalizePathname(basePath);
  return LOCALIZED_MARKETING_BASE_PATHS.has(normalized) || isBlogArticlePath(normalized);
}

/**
 * Normalizes a URL path:
 * - Ensures leading slash
 * - Strips trailing slash (except root '/')
 * - Lowercases path
 */
export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';

  let clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  clean = clean.replace(/\/+/g, '/');

  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }

  return clean.toLowerCase();
}

export function normalizeLangParam(code?: string | null): MarketingLanguageCode | null {
  if (!code) return null;
  const trimmed = code.trim();
  const lower = trimmed.toLowerCase().replace(/_/g, '-');
  if (lower === 'en' || lower === 'en-us') return 'en';
  if (lower === 'zh-cn' || lower === 'zh-hans') return 'zh-CN';
  if (lower === 'zh-tw' || lower === 'zh-hant' || lower === 'zh-hk') return 'zh-TW';
  if (lower === 'ms' || lower === 'ms-my') return 'ms';
  return null;
}

/**
 * Extracts language prefix and underlying marketing base path from clean localized URLs
 * such as `/zh-cn`, `/zh-cn/pricing`, `/zh-tw/blog`, `/zh-cn/blog/slug`, `/ms/templates`,
 * as well as `/en/blog` or `/en/blog/slug` (canonicalizing `/en/...` to English unprefixed paths).
 */
export function extractLocaleFromPathname(pathname: string): {
  lang: MarketingLanguageCode;
  basePath: string;
  hasLocalePrefix: boolean;
  hasExplicitEnglishPrefix?: boolean;
} {
  const normalized = normalizePathname(pathname);

  if (normalized === '/en') {
    return { lang: 'en', basePath: '/', hasLocalePrefix: false, hasExplicitEnglishPrefix: true };
  }
  if (normalized.startsWith('/en/')) {
    const remainder = normalized.slice('/en'.length) || '/';
    if (isLocalizedMarketingBasePath(remainder)) {
      return {
        lang: 'en',
        basePath: remainder,
        hasLocalePrefix: false,
        hasExplicitEnglishPrefix: true,
      };
    }
  }

  for (const [prefix, lang] of Object.entries(PREFIX_TO_LANGUAGE)) {
    if (normalized === prefix) {
      return { lang, basePath: '/', hasLocalePrefix: true };
    }
    if (normalized.startsWith(`${prefix}/`)) {
      const remainder = normalized.slice(prefix.length) || '/';
      if (isLocalizedMarketingBasePath(remainder)) {
        return { lang, basePath: remainder, hasLocalePrefix: true };
      }
    }
  }

  return { lang: 'en', basePath: normalized, hasLocalePrefix: false };
}

/**
 * Builds a clean path for a given marketing base path and language.
 * Examples:
 * - ('/', 'en') => '/'
 * - ('/', 'zh-CN') => '/zh-cn'
 * - ('/pricing', 'zh-TW') => '/zh-tw/pricing'
 * - ('/blog', 'zh-CN') => '/zh-cn/blog'
 */
export function buildLocalizedRoutePath(
  basePath: string,
  lang: MarketingLanguageCode = 'en'
): string {
  const cleanBase = extractLocaleFromPathname(basePath).basePath;
  if (lang === 'en' || !isLocalizedMarketingBasePath(cleanBase)) {
    return cleanBase === '/' ? '/' : cleanBase;
  }

  const prefix = LANGUAGE_URL_PREFIXES[lang];
  return cleanBase === '/' ? prefix : `${prefix}${cleanBase}`;
}

/**
 * Builds a strict, HTTPS canonical URL:
 * - Enforces HTTPS & verified domain (default: https://eventframe.io)
 * - Strips marketing tracking parameters & redundant lang queries
 * - Canonicalizes legacy `?lang=zh-CN` on localized marketing routes to clean `/zh-cn/...` URLs
 * - Strips `/en` prefix to canonical unprefixed English URL
 * - Strips trailing slashes except root '/'
 */
export function buildCanonicalUrl(
  pathname: string,
  search?: string,
  customDomain?: string | null
): string {
  let baseDomain = SEO_CONFIG.productionDomain;
  if (customDomain && customDomain.startsWith('https://')) {
    baseDomain = customDomain.replace(/\/+$/, '');
  }

  let rawPath = pathname;
  let effectiveSearch = search;
  if (pathname.includes('?')) {
    const qIdx = pathname.indexOf('?');
    rawPath = pathname.slice(0, qIdx) || '/';
    if (!effectiveSearch) {
      effectiveSearch = pathname.slice(qIdx);
    }
  }

  const extracted = extractLocaleFromPathname(rawPath);
  let targetPath = extracted.hasExplicitEnglishPrefix
    ? extracted.basePath
    : normalizePathname(rawPath);
  let cleanSearch = '';

  if (effectiveSearch) {
    try {
      const params = new URLSearchParams(effectiveSearch);
      const filtered = new URLSearchParams();
      let queryLang: MarketingLanguageCode | null = null;

      params.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (TRACKING_PARAMS.has(lower)) return;
        if (lower === 'lang') {
          const parsedLang = normalizeLangParam(value);
          if (parsedLang) queryLang = parsedLang;
          return;
        }
        filtered.append(key, value);
      });

      if (
        !extracted.hasLocalePrefix &&
        queryLang &&
        isLocalizedMarketingBasePath(extracted.basePath)
      ) {
        targetPath = buildLocalizedRoutePath(extracted.basePath, queryLang);
      }

      const paramStr = filtered.toString();
      if (paramStr) {
        cleanSearch = `?${paramStr}`;
      }
    } catch {
      // Ignore query errors
    }
  }

  if (targetPath === '/') {
    return `${baseDomain}/${cleanSearch}`;
  }

  return `${baseDomain}${targetPath}${cleanSearch}`;
}

/**
 * Builds alternate hreflang URLs for localized public marketing routes.
 */
export function buildMarketingHreflangLinks(
  baseOrLocalizedPath: string,
  customDomain?: string | null
): Array<{ hreflang: string; href: string }> {
  const { basePath } = extractLocaleFromPathname(baseOrLocalizedPath);
  if (!isLocalizedMarketingBasePath(basePath)) {
    return [];
  }

  const defaultUrl = buildCanonicalUrl(basePath, undefined, customDomain);
  const links: Array<{ hreflang: string; href: string }> = MARKETING_HREFLANG_CODES.map(
    (code) => ({
      hreflang: code,
      href:
        code === 'en'
          ? defaultUrl
          : buildCanonicalUrl(buildLocalizedRoutePath(basePath, code), undefined, customDomain),
    })
  );

  links.push({
    hreflang: 'x-default',
    href: defaultUrl,
  });

  return links;
}
