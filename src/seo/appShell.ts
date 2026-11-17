import { extractLocaleFromPathname, isBlogArticlePath, normalizePathname } from './canonical';
import { PUBLIC_SEO_ROUTES } from './routes';

export const APP_SHELL_ROUTE_PATH = '/app-shell/';

const STATIC_ASSET_EXTENSIONS = new Set([
  'js',
  'mjs',
  'cjs',
  'css',
  'map',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'avif',
  'gif',
  'svg',
  'ico',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  'json',
  'xml',
  'txt',
  'pdf',
  'mp3',
  'mp4',
  'webm',
  'webmanifest',
]);

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'developer',
  'demo',
  'mail',
  'cdn',
  'static',
  'assets',
  'status',
  'support',
]);

const PLATFORM_PREVIEW_SUFFIXES = [
  '.run.app',
  '.pages.dev',
  '.workers.dev',
  '.vercel.app',
  '.netlify.app',
];

export function isStaticAssetPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  if (normalized.startsWith('/assets/') || normalized.startsWith('/images/')) {
    return true;
  }
  const lastSegment = normalized.split('/').pop() || '';
  const dotIdx = lastSegment.lastIndexOf('.');
  if (dotIdx <= 0) return false;
  const ext = lastSegment.slice(dotIdx + 1).toLowerCase();
  return STATIC_ASSET_EXTENSIONS.has(ext);
}

export function isAgencySubdomainHost(hostname?: string): boolean {
  if (!hostname) return false;
  const host = hostname.trim().toLowerCase().split(':')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
    return false;
  }
  if (host === 'eventframe.io' || host === 'www.eventframe.io') {
    return false;
  }
  for (const suffix of PLATFORM_PREVIEW_SUFFIXES) {
    if (host.endsWith(suffix)) return false;
  }
  const parts = host.split('.').filter(Boolean);
  if (parts.length > 2) {
    const candidate = parts[0];
    if (!candidate || RESERVED_SUBDOMAINS.has(candidate) || candidate.startsWith('ais-')) {
      return false;
    }
    return true;
  }
  return false;
}

export function isPrerenderedMarketingPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  const { basePath } = extractLocaleFromPathname(normalized);
  return Boolean(PUBLIC_SEO_ROUTES[basePath]) || isBlogArticlePath(basePath);
}

/**
 * Determines whether a request should be served the clean, non-prerendered SPA shell
 * (`dist/app-shell/index.html`) instead of the prerendered marketing homepage `dist/index.html`.
 */
export function shouldServeCleanAppShell(pathname: string, hostname?: string): boolean {
  const normalized = normalizePathname(pathname);
  if (normalized === '/api' || normalized.startsWith('/api/')) {
    return false;
  }
  if (isStaticAssetPath(normalized)) {
    return false;
  }
  if (isAgencySubdomainHost(hostname)) {
    return true;
  }
  return !isPrerenderedMarketingPath(normalized);
}
