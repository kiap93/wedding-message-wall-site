import { SEO_CONFIG } from './config';

const TRACKING_PARAMS = new Set([
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

const MARKETING_HREFLANG_CODES = ['en', 'zh-CN', 'zh-TW', 'ms'] as const;

/**
 * Normalizes a URL path:
 * - Ensures leading slash
 * - Strips trailing slash (except root '/')
 * - Lowercases path
 */
export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';

  // Clean multiple slashes
  let clean = pathname.replace(/\/+/g, '/');

  // Remove trailing slash if longer than 1 character
  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }

  return clean.toLowerCase();
}

/**
 * Builds a strict, secure canonical URL.
 * - Enforces HTTPS
 * - Uses verified canonical base domain (default: https://eventframe.io)
 * - Strips marketing tracking parameters
 * - Strips redundant `?lang=en` so default English stays clean
 * - Prevents duplicate slash variations
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

  const normalizedPath = normalizePathname(pathname);

  // Clean query parameters, removing tracking noise and redundant lang=en
  let cleanSearch = '';
  if (search) {
    try {
      const params = new URLSearchParams(search);
      const filtered = new URLSearchParams();

      params.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (TRACKING_PARAMS.has(lower)) return;
        if (lower === 'lang' && value === 'en') return;
        filtered.append(key, value);
      });

      const paramStr = filtered.toString();
      if (paramStr) {
        cleanSearch = `?${paramStr}`;
      }
    } catch {
      // Ignore query errors
    }
  }

  if (normalizedPath === '/') {
    return `${baseDomain}/${cleanSearch}`;
  }

  return `${baseDomain}${normalizedPath}${cleanSearch}`;
}

/**
 * Builds alternate hreflang URLs for public marketing routes across all supported languages.
 */
export function buildMarketingHreflangLinks(
  canonicalPath: string,
  customDomain?: string | null
): Array<{ hreflang: string; href: string }> {
  const defaultUrl = buildCanonicalUrl(canonicalPath, undefined, customDomain);
  const links: Array<{ hreflang: string; href: string }> = MARKETING_HREFLANG_CODES.map(
    (code) => ({
      hreflang: code,
      href:
        code === 'en'
          ? defaultUrl
          : buildCanonicalUrl(canonicalPath, `?lang=${code}`, customDomain),
    })
  );

  links.push({
    hreflang: 'x-default',
    href: defaultUrl,
  });

  return links;
}
