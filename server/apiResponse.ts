/**
 * Standardized API response, error formatting, and CSRF helpers.
 * Isomorphic across Node Express (server.ts) and Cloudflare Workers (worker/index.ts).
 */

export interface StandardizedApiErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface StandardizedApiSuccessPayload<T = any> {
  success: true;
  data: T;
}

export function buildSuccessResponse<T = any>(
  data: T,
  extra?: Record<string, any>
): StandardizedApiSuccessPayload<T> & Record<string, any> {
  return {
    success: true,
    data,
    ...(extra || {}),
  };
}

export function buildErrorResponse(
  code: string,
  message: string
): StandardizedApiErrorPayload {
  return {
    success: false,
    error: {
      code: String(code || 'INTERNAL_ERROR'),
      message: String(message || 'An unexpected error occurred.'),
    },
  };
}

/**
 * Generates a cryptographically strong CSRF token safe for double-submit cookies.
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const CSRF_EXEMPT_PATH_PREFIXES = [
  '/api/webhook',
  '/api/auth/email',
  '/api/auth/verify',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/couple/login',
  '/api/demo/',
  '/api/rsvps',
  '/api/messages',
];

/**
 * Checks whether a cookie-authenticated mutation satisfies CSRF requirements:
 * - Safe methods (GET, HEAD, OPTIONS) are always allowed.
 * - Requests explicitly carrying a Bearer Authorization token or X-Event-PIN header are not vulnerable to passive browser cookie CSRF.
 * - Public unauthenticated guest submissions / Stripe webhooks / login endpoints are exempt when no session cookie is relied upon.
 * - Cookie-authenticated mutations require a matching double-submit CSRF token header (`X-CSRF-Token` == `wedding_csrf` cookie), OR same-origin `Origin`/`Referer` + `X-Requested-With`.
 */
export function validateCookieMutationCsrf(params: {
  method: string;
  path: string;
  hasSessionCookie: boolean;
  hasBearerToken: boolean;
  hasEventPin: boolean;
  csrfCookie?: string | null;
  csrfHeader?: string | null;
  origin?: string | null;
  host?: string | null;
  requestedWith?: string | null;
}): { ok: true } | { ok: false; statusCode: 403; code: string; message: string } {
  const method = String(params.method || 'GET').toUpperCase();
  if (!MUTATING_METHODS.has(method)) {
    return { ok: true };
  }

  // Only enforce cookie-CSRF when cookie auth could be used without explicit token headers
  if (!params.hasSessionCookie || params.hasBearerToken || params.hasEventPin) {
    return { ok: true };
  }

  const normalizedPath = params.path || '';
  if (CSRF_EXEMPT_PATH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    // Moderation / highlight / AI / VIP endpoints MUST enforce CSRF if cookie-only!
    const isMessageProtectedAction =
      normalizedPath === '/api/messages/ai-suggest' ||
      normalizedPath.includes('/status') ||
      normalizedPath.includes('/highlight');
    const isRsvpProtectedAction = normalizedPath.startsWith('/api/rsvps/') && normalizedPath.includes('/vip');
    if (!isMessageProtectedAction && !isRsvpProtectedAction) {
      return { ok: true };
    }
  }

  const headerToken = (params.csrfHeader || '').trim();
  const cookieToken = (params.csrfCookie || '').trim();
  if (headerToken && cookieToken && headerToken === cookieToken) {
    return { ok: true };
  }

  // Verify same-origin fallback strictly if custom header X-Requested-With is attached
  if (params.origin && params.host) {
    try {
      const originHost = new URL(params.origin).host.toLowerCase();
      const reqHost = params.host.toLowerCase();
      const isTrustedSameHost =
        originHost === reqHost ||
        (originHost.endsWith('.eventframe.io') && reqHost.endsWith('.eventframe.io'));
      if (isTrustedSameHost && params.requestedWith === 'EventFrame') {
        return { ok: true };
      }
    } catch {
      // Invalid Origin header
    }
  }

  return {
    ok: false,
    statusCode: 403,
    code: 'CSRF_VALIDATION_FAILED',
    message: 'Security validation failed (missing or invalid CSRF token). Please refresh and retry.',
  };
}
