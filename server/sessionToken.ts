/**
 * Isomorphic session token selection, logout-marker validation, and cache-header helpers.
 * Shared by Node Express (server.ts / routers) and Cloudflare Workers (worker/index.ts).
 */

export const SESSION_COOKIE_NAME = 'wedding_session';
export const CSRF_COOKIE_NAME = 'wedding_csrf';
export const LOGOUT_MARKER_COOKIE_NAME = 'wedding_logged_out_at';

const NO_STORE_PATH_PREFIXES = [
  '/api/auth/',
  '/api/agencies/me',
  '/api/projects',
  '/api/developer',
  '/api/billing',
  '/api/onboard',
  '/api/upload',
];

export function isNoStoreApiPath(pathname: string): boolean {
  const normalized = String(pathname || '').split('?')[0];
  return NO_STORE_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix)
  );
}

export function normalizeTokenCandidate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  return trimmed;
}

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    if (typeof atob === 'function') {
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8');
    }
    return null;
  } catch {
    return null;
  }
}

export function decodeJwtPayloadUnsafe(token: string | null | undefined): Record<string, any> | null {
  const clean = normalizeTokenCandidate(token);
  if (!clean) return null;
  const parts = clean.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  const decoded = decodeBase64Url(parts[1]);
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function getTokenIssuedAtMs(token: string | null | undefined): number {
  const payload = decodeJwtPayloadUnsafe(token);
  if (!payload) return 0;
  if (typeof payload.auth_ts === 'number' && Number.isFinite(payload.auth_ts) && payload.auth_ts > 0) {
    return payload.auth_ts;
  }
  if (typeof payload.iat === 'number' && Number.isFinite(payload.iat) && payload.iat > 0) {
    return payload.iat * 1000;
  }
  return 0;
}

export function parseLogoutMarkerMs(rawCookieValue: unknown): number {
  if (typeof rawCookieValue !== 'string' && typeof rawCookieValue !== 'number') return 0;
  const parsed = Number(String(rawCookieValue).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

export function isTokenInvalidatedByLogout(
  token: string | null | undefined,
  loggedOutAtMs: number
): boolean {
  if (!token || loggedOutAtMs <= 0) return false;
  const issuedAtMs = getTokenIssuedAtMs(token);
  if (issuedAtMs <= 0) {
    // Tokens without timestamp cannot outlive an explicit logout timestamp
    return true;
  }
  return issuedAtMs <= loggedOutAtMs;
}

export function isTokenForDifferentUser(
  token: string | null | undefined,
  user: { id?: unknown; sub?: unknown; email?: unknown } | null | undefined
): boolean {
  if (!token || !user) return false;
  const payload = decodeJwtPayloadUnsafe(token);
  if (!payload) return false;

  const tokenEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const userEmail = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (tokenEmail && userEmail && tokenEmail !== userEmail) {
    return true;
  }

  const tokenId = typeof payload.id === 'string' ? payload.id.trim() : '';
  const userId = typeof user.id === 'string' ? user.id.trim() : '';
  if (tokenId && userId && tokenId !== userId) {
    return true;
  }

  return false;
}

/**
 * Selects the authoritative session token from a request's Authorization Bearer header
 * and HttpOnly `wedding_session` cookie while enforcing cross-subdomain logout markers.
 *
 * Security / account-switching guarantees:
 * 1. If a logout marker (`wedding_logged_out_at`) is present and a token was issued at or
 *    before the logout timestamp, that token is rejected (blocks stale origin-scoped
 *    `localStorage` tokens after logging out on another subdomain).
 * 2. When BOTH a valid HttpOnly cookie and a different Bearer token are sent, the newer
 *    token (`auth_ts` / `iat`) wins; on timestamp ties, the shared HttpOnly cookie wins
 *    over origin-scoped `localStorage` so an old `eventframe.io` `localStorage` token
 *    cannot override a newer `.eventframe.io` login cookie.
 */
export function selectPreferredSessionToken(params: {
  bearerToken?: string | null;
  cookieToken?: string | null;
  loggedOutAtCookie?: string | null;
}): string | null {
  const loggedOutAtMs = parseLogoutMarkerMs(params.loggedOutAtCookie);

  let bearer = normalizeTokenCandidate(params.bearerToken);
  let cookie = normalizeTokenCandidate(params.cookieToken);

  if (bearer && isTokenInvalidatedByLogout(bearer, loggedOutAtMs)) {
    bearer = null;
  }
  if (cookie && isTokenInvalidatedByLogout(cookie, loggedOutAtMs)) {
    cookie = null;
  }

  if (bearer && cookie) {
    if (bearer === cookie) {
      return cookie;
    }
    const bearerTs = getTokenIssuedAtMs(bearer);
    const cookieTs = getTokenIssuedAtMs(cookie);

    if (bearerTs > cookieTs) {
      return bearer;
    }
    // Cookie is newer or equally recent -> prefer shared HttpOnly session cookie
    return cookie;
  }

  return cookie || bearer || null;
}

export function extractBearerFromAuthHeader(authHeader: unknown): string | null {
  if (typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return normalizeTokenCandidate(authHeader.slice(7));
}
