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
 * - Prevents duplicate slash variations
 */
export function buildCanonicalUrl(
  pathname: string,
  search?: string,
  customDomain?: string | null
): string {
  // Use verified custom domain if explicitly provided (e.g., custom agency domain),
  // otherwise strictly fall back to production canonical domain
  let baseDomain = SEO_CONFIG.productionDomain;
  if (customDomain && customDomain.startsWith('https://')) {
    baseDomain = customDomain.replace(/\/+$/, '');
  }

  const normalizedPath = normalizePathname(pathname);
  
  // Clean query parameters, removing tracking noise
  let cleanSearch = '';
  if (search) {
    try {
      const params = new URLSearchParams(search);
      const filtered = new URLSearchParams();
      
      params.forEach((value, key) => {
        if (!TRACKING_PARAMS.has(key.toLowerCase())) {
          filtered.append(key, value);
        }
      });
      
      const paramStr = filtered.toString();
      if (paramStr) {
        cleanSearch = `?${paramStr}`;
      }
    } catch {
      // Ignore query errors
    }
  }

  // Root case
  if (normalizedPath === '/') {
    return `${baseDomain}/${cleanSearch}`;
  }

  return `${baseDomain}${normalizedPath}${cleanSearch}`;
}
