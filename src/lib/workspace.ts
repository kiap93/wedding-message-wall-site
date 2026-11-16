import { Agency } from '../types';
import { API_BASE } from './config';
import { authenticatedFetch } from './auth';

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

export async function resolveWorkspaceBySlug(slug: string): Promise<Agency | null> {
  const normalized = (slug || '').trim().toLowerCase();
  if (!normalized || RESERVED_SUBDOMAINS.has(normalized)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `${API_BASE}/api/agencies/resolve?slug=${encodeURIComponent(normalized)}`,
      { signal: controller.signal, credentials: 'include' }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to resolve workspace (HTTP ${response.status})`);
    }

    const payload = await response.json();
    const agency = payload?.agency || payload?.data?.agency || (payload?.data?.id ? payload.data : null);
    return (payload?.found || payload?.success) && agency ? (agency as Agency) : null;
  } catch (e) {
    console.error('Error resolving workspace:', e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getUserWorkspaces(_userId?: string): Promise<Agency[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await authenticatedFetch(`${API_BASE}/api/agencies/me`, {
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch workspaces (HTTP ${response.status})`);
    }

    const payload = await response.json();
    const agencies = payload?.agencies || payload?.data?.agencies;
    return Array.isArray(agencies) ? (agencies as Agency[]) : [];
  } catch (e) {
    console.error('Error fetching user workspaces:', e);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export function getCurrentSubdomain(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname.trim().toLowerCase();
  if (!hostname) return null;

  // Ignore local development
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return null;

  // Ignore internal cloud run & platform preview domains
  for (const suffix of PLATFORM_PREVIEW_SUFFIXES) {
    if (hostname.endsWith(suffix)) return null;
  }

  // Explicitly ignore root and www on the production domain
  if (hostname === 'eventframe.io' || hostname === 'www.eventframe.io') return null;

  const parts = hostname.split('.').filter(Boolean);
  if (parts.length > 2) {
    const candidate = parts[0];
    if (!candidate || RESERVED_SUBDOMAINS.has(candidate) || candidate.startsWith('ais-')) {
      return null;
    }
    return candidate;
  }

  return null;
}
