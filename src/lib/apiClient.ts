import { API_BASE } from './config';

const SESSION_TOKEN_KEY = 'wedding_session_token';
const CSRF_COOKIE_NAME = 'wedding_csrf';

let inMemoryCsrfToken: string | null = null;
let clientAuthEpoch = 0;
let activeRefreshPromise: Promise<{ token?: string; csrfToken?: string } | null> | null = null;

export function getClientAuthEpoch(): number {
  return clientAuthEpoch;
}

export function bumpClientAuthEpoch(): number {
  clientAuthEpoch += 1;
  activeRefreshPromise = null;
  return clientAuthEpoch;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem('token');
}

export function setCsrfTokenMemory(token?: string | null): void {
  inMemoryCsrfToken = token ? String(token).trim() : null;
}

/**
 * Clears all EventFrame authentication and user/organization-scoped client caches
 * while preserving unrelated UI/language preferences (e.g. `ef_marketing_lang`, `ef_lang_*`).
 */
export function clearClientAuthStorage(): void {
  bumpClientAuthEpoch();
  removeAuthToken();
  setCsrfTokenMemory(null);
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('ef_active_agency_')) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
}

export function getCsrfToken(): string | null {
  if (typeof document !== 'undefined' && document.cookie) {
    const cookies = document.cookie.split(';');
    for (const part of cookies) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const name = part.slice(0, idx).trim();
      if (name === CSRF_COOKIE_NAME) {
        const value = decodeURIComponent(part.slice(idx + 1).trim());
        if (value) return value;
      }
    }
  }
  return inMemoryCsrfToken;
}

/**
 * Extracts a human-readable error message from either standardized backend error envelopes
 * (`{ success: false, error: { code, message } }`) or legacy `{ error: string }` / `{ message: string }`.
 */
export function extractApiErrorMessage(body: any, fallback: string = 'Request failed'): string {
  if (!body) return fallback;
  if (typeof body === 'string') return body || fallback;
  if (typeof body.error === 'string' && body.error.trim()) return body.error;
  if (body.error && typeof body.error === 'object') {
    if (typeof body.error.message === 'string' && body.error.message.trim()) {
      return body.error.message;
    }
    if (typeof body.error.code === 'string' && body.error.code.trim()) {
      return body.error.code;
    }
  }
  if (typeof body.message === 'string' && body.message.trim()) {
    return body.message;
  }
  return fallback;
}

/**
 * Unwraps `{ success: true, data: ... }` payloads while remaining compatible with direct JSON responses.
 */
export function unwrapApiData<T = any>(body: any): T {
  if (body && typeof body === 'object' && 'data' in body && body.data !== undefined) {
    return body.data as T;
  }
  return body as T;
}

function isMutatingMethod(method?: string): boolean {
  const normalized = (method || 'GET').toUpperCase();
  return normalized !== 'GET' && normalized !== 'HEAD' && normalized !== 'OPTIONS';
}

function buildRequestHeaders(
  rawHeaders: HeadersInit | undefined,
  method: string,
  overrideToken?: string | null,
  overrideCsrf?: string | null
): Headers {
  const headers = new Headers(rawHeaders || {});
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'EventFrame');
  }

  const token = overrideToken !== undefined ? overrideToken : getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (isMutatingMethod(method) && !headers.has('X-CSRF-Token')) {
    const csrf = overrideCsrf !== undefined ? overrideCsrf : getCsrfToken();
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  return headers;
}

export async function refreshAuthSession(): Promise<{ token?: string; csrfToken?: string } | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  const requestEpoch = clientAuthEpoch;
  activeRefreshPromise = (async () => {
    try {
      const token = getAuthToken();
      const csrf = getCsrfToken();
      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Requested-With': 'EventFrame',
      });
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (csrf) headers.set('X-CSRF-Token', csrf);

      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers,
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok || requestEpoch !== clientAuthEpoch) {
        return null;
      }

      const json = await res.json().catch(() => null);
      if (requestEpoch !== clientAuthEpoch) {
        return null;
      }
      const data = unwrapApiData<any>(json) || {};
      const nextToken = data.token || json?.token;
      const nextCsrf = data.csrfToken || json?.csrfToken;

      if (nextToken && typeof nextToken === 'string') {
        setAuthToken(nextToken);
      }
      if (nextCsrf && typeof nextCsrf === 'string') {
        setCsrfTokenMemory(nextCsrf);
      }

      return { token: nextToken, csrfToken: nextCsrf };
    } catch {
      return null;
    } finally {
      if (requestEpoch === clientAuthEpoch) {
        activeRefreshPromise = null;
      }
    }
  })();

  return activeRefreshPromise;
}

export interface ApiFetchOptions extends RequestInit {
  skipAuthRefresh?: boolean;
}

export async function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { skipAuthRefresh = false, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const requestEpoch = clientAuthEpoch;
  const initialHeaders = buildRequestHeaders(fetchOptions.headers, method);

  const response = await fetch(url, {
    ...fetchOptions,
    method,
    headers: initialHeaders,
    credentials: 'include',
    cache: fetchOptions.cache ?? 'no-store',
  });

  const isAuthUtilityRoute =
    url.includes('/api/auth/me') ||
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/logout') ||
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/signup');

  if (response.status === 401 && !skipAuthRefresh && !isAuthUtilityRoute) {
    const refreshed = await refreshAuthSession();
    if (requestEpoch === clientAuthEpoch && (refreshed?.token || refreshed?.csrfToken)) {
      const retryHeaders = new Headers(fetchOptions.headers || {});
      retryHeaders.set('X-Requested-With', 'EventFrame');
      if (refreshed.token) {
        retryHeaders.set('Authorization', `Bearer ${refreshed.token}`);
      }
      if (isMutatingMethod(method) && (refreshed.csrfToken || getCsrfToken())) {
        retryHeaders.set('X-CSRF-Token', refreshed.csrfToken || getCsrfToken()!);
      }

      return fetch(url, {
        ...fetchOptions,
        method,
        headers: retryHeaders,
        credentials: 'include',
        cache: fetchOptions.cache ?? 'no-store',
      });
    }
  }

  return response;
}

export async function apiRequest<T = any>(
  url: string,
  options: ApiFetchOptions = {},
  fallbackError: string = 'Request failed'
): Promise<T> {
  const res = await apiFetch(url, options);
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    throw new Error(extractApiErrorMessage(body, fallbackError));
  }
  return unwrapApiData<T>(body);
}
