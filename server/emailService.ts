/**
 * Centralized Resend Email Service for EventFrame
 *
 * Edge-compatible (Cloudflare Workers + Node.js) email delivery service.
 * Enforces canonical sender identity (`EventFrame <noreply@eventframe.io>`) and
 * category-based CC policy (`eventframeio@gmail.com` ONLY for approved general
 * business/non-sensitive notifications; never for auth, security, or unknown categories).
 */

export const RESEND_API_ENDPOINT = 'https://api.resend.com/emails' as const;

export const EVENTFRAME_EMAIL_CONFIG = {
  provider: 'resend',
  senderName: 'EventFrame',
  senderAddress: 'noreply@eventframe.io',
  from: 'EventFrame <noreply@eventframe.io>',
  verifiedDomain: 'eventframe.io',
  defaultBusinessCc: 'eventframeio@gmail.com',
} as const;

export const BUSINESS_CC_EMAIL_CATEGORIES = [
  'new_event_notification',
  'contact_submission',
  'business_notification',
  'admin_notification',
] as const;

export const SECURITY_NO_CC_EMAIL_CATEGORIES = [
  'login_verification',
  'magic_link',
  'email_verification',
  'password_reset',
  'otp_code',
  'password_change_notification',
  'account_security_notification',
] as const;

export const DIRECT_NO_CC_EMAIL_CATEGORIES = [
  'contact_admin_notification',
  'contact_customer_acknowledgement',
] as const;

export type BusinessEmailCategory = (typeof BUSINESS_CC_EMAIL_CATEGORIES)[number];
export type SecurityEmailCategory = (typeof SECURITY_NO_CC_EMAIL_CATEGORIES)[number];
export type DirectNoCcEmailCategory = (typeof DIRECT_NO_CC_EMAIL_CATEGORIES)[number];
export type EmailCategory =
  | BusinessEmailCategory
  | SecurityEmailCategory
  | DirectNoCcEmailCategory;

export interface EmailCcPolicy {
  category: string;
  classification: 'business_cc' | 'security_no_cc' | 'direct_no_cc' | 'unknown_no_cc';
  allowCc: boolean;
  defaultCc: string | null;
}

export interface SendEventFrameEmailParams {
  apiKey?: string | null;
  category: EmailCategory | string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | string[];
  /**
   * Optional caller-supplied CC addresses.
   * Strictly ignored/blocked for authentication, security, direct contact, and unknown categories.
   */
  cc?: string | string[];
  fetchImpl?: typeof fetch;
}

export interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string[];
  cc?: string[];
}

export type SendEmailResult =
  | {
      ok: true;
      id: string | null;
      provider: 'resend';
      category: string;
      from: string;
      to: string[];
      ccApplied: boolean;
      cc: string[];
    }
  | {
      ok: false;
      statusCode: number;
      code: string;
      error: string;
      provider: 'resend';
      category: string;
      providerStatus?: number;
      providerMessage?: string;
    };

const BUSINESS_CC_SET = new Set<string>(BUSINESS_CC_EMAIL_CATEGORIES);
const SECURITY_NO_CC_SET = new Set<string>(SECURITY_NO_CC_EMAIL_CATEGORIES);
const DIRECT_NO_CC_SET = new Set<string>(DIRECT_NO_CC_EMAIL_CATEGORIES);

export function sanitizeEmailHeaderValue(value: string): string {
  return value.replace(/[\r\n\0\x01-\x1F\x7F]+/g, ' ').trim();
}

export function normalizeEmailRecipientList(
  input: string | string[] | undefined | null
): string[] {
  if (!input) return [];
  const rawList = Array.isArray(input) ? input : [input];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of rawList) {
    if (typeof item !== 'string') continue;
    const trimmed = sanitizeEmailHeaderValue(item);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

/**
 * Classifies email category and determines whether CC is permitted.
 * Unknown, security, and direct contact categories default strictly to NO CC.
 */
export function resolveEmailCcPolicy(category: EmailCategory | string): EmailCcPolicy {
  const normalizedCategory = typeof category === 'string' ? category.trim() : '';

  if (BUSINESS_CC_SET.has(normalizedCategory)) {
    return {
      category: normalizedCategory,
      classification: 'business_cc',
      allowCc: true,
      defaultCc: EVENTFRAME_EMAIL_CONFIG.defaultBusinessCc,
    };
  }

  if (SECURITY_NO_CC_SET.has(normalizedCategory)) {
    return {
      category: normalizedCategory,
      classification: 'security_no_cc',
      allowCc: false,
      defaultCc: null,
    };
  }

  if (DIRECT_NO_CC_SET.has(normalizedCategory)) {
    return {
      category: normalizedCategory,
      classification: 'direct_no_cc',
      allowCc: false,
      defaultCc: null,
    };
  }

  return {
    category: normalizedCategory || 'unknown',
    classification: 'unknown_no_cc',
    allowCc: false,
    defaultCc: null,
  };
}

/**
 * Builds the Resend API JSON payload while enforcing sender identity and CC rules.
 * Caller-supplied CC values cannot override authentication, security, direct, or unknown-category restrictions.
 * Also ensures TO recipients are never duplicated inside CC.
 */
export function buildResendEmailPayload(
  params: Omit<SendEventFrameEmailParams, 'apiKey' | 'fetchImpl'>
): ResendEmailPayload {
  const policy = resolveEmailCcPolicy(params.category);
  const to = normalizeEmailRecipientList(params.to);
  const replyTo = normalizeEmailRecipientList(params.replyTo);

  const payload: ResendEmailPayload = {
    from: EVENTFRAME_EMAIL_CONFIG.from,
    to,
    subject: typeof params.subject === 'string' ? sanitizeEmailHeaderValue(params.subject) : '',
  };

  if (typeof params.html === 'string' && params.html.trim().length > 0) {
    payload.html = params.html;
  }
  if (typeof params.text === 'string' && params.text.trim().length > 0) {
    payload.text = params.text;
  }
  if (replyTo.length > 0) {
    payload.reply_to = replyTo;
  }

  if (policy.allowCc && policy.defaultCc) {
    const toLowerSet = new Set(to.map((addr) => addr.toLowerCase()));
    const ccRecipients = normalizeEmailRecipientList([
      policy.defaultCc,
      ...(normalizeEmailRecipientList(params.cc)),
    ]).filter((addr) => !toLowerSet.has(addr.toLowerCase()));
    if (ccRecipients.length > 0) {
      payload.cc = ccRecipients;
    }
  }

  return payload;
}

export function mapResendHttpError(
  status: number,
  rawBody: string
): {
  statusCode: number;
  code: string;
  error: string;
  providerStatus: number;
  providerMessage?: string;
} {
  let providerMessage: string | undefined;
  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody);
      if (typeof parsed?.message === 'string' && parsed.message.trim()) {
        providerMessage = parsed.message.trim();
      } else if (typeof parsed?.error === 'string' && parsed.error.trim()) {
        providerMessage = parsed.error.trim();
      }
    } catch {
      const trimmed = rawBody.trim();
      if (trimmed) providerMessage = trimmed;
    }
  }

  if (status === 401) {
    return {
      statusCode: 401,
      code: 'RESEND_INVALID_API_KEY',
      error: 'Email authentication failed: invalid Resend API key.',
      providerStatus: 401,
      providerMessage,
    };
  }

  if (status === 403) {
    return {
      statusCode: 403,
      code: 'RESEND_FORBIDDEN',
      error: `Email sending restricted or domain ${EVENTFRAME_EMAIL_CONFIG.verifiedDomain} is not verified in Resend.`,
      providerStatus: 403,
      providerMessage,
    };
  }

  if (status === 422) {
    return {
      statusCode: 422,
      code: 'RESEND_INVALID_PAYLOAD',
      error: providerMessage || 'Invalid email payload rejected by Resend.',
      providerStatus: 422,
      providerMessage,
    };
  }

  if (status === 429) {
    return {
      statusCode: 429,
      code: 'RESEND_RATE_LIMITED',
      error: 'Email provider rate limit exceeded. Please try again shortly.',
      providerStatus: 429,
      providerMessage,
    };
  }

  if (status >= 500 && status <= 599) {
    return {
      statusCode: status,
      code: 'RESEND_PROVIDER_FAILURE',
      error: 'Email delivery failed due to a Resend provider outage.',
      providerStatus: status,
      providerMessage,
    };
  }

  return {
    statusCode: status >= 400 && status < 600 ? status : 502,
    code: 'RESEND_REQUEST_FAILED',
    error: providerMessage || 'Failed to send email via Resend.',
    providerStatus: status,
    providerMessage,
  };
}

/**
 * Sends a transactional or notification email through Resend with centralized
 * EventFrame sender configuration and category-enforced CC policy.
 * Never reports failed email submissions as successful.
 */
export async function sendEventFrameEmail(
  params: SendEventFrameEmailParams
): Promise<SendEmailResult> {
  const category = typeof params.category === 'string' && params.category.trim()
    ? params.category.trim()
    : 'unknown';

  const apiKey = typeof params.apiKey === 'string' ? params.apiKey.trim() : '';
  if (!apiKey) {
    return {
      ok: false,
      statusCode: 500,
      code: 'EMAIL_SERVICE_UNCONFIGURED',
      error: 'Email delivery service is not configured (missing RESEND_API_KEY).',
      provider: 'resend',
      category,
    };
  }

  const payload = buildResendEmailPayload(params);

  if (payload.to.length === 0) {
    return {
      ok: false,
      statusCode: 422,
      code: 'RESEND_INVALID_PAYLOAD',
      error: 'At least one valid recipient email address is required.',
      provider: 'resend',
      category,
    };
  }

  if (!payload.subject) {
    return {
      ok: false,
      statusCode: 422,
      code: 'RESEND_INVALID_PAYLOAD',
      error: 'Email subject is required.',
      provider: 'resend',
      category,
    };
  }

  if (!payload.html && !payload.text) {
    return {
      ok: false,
      statusCode: 422,
      code: 'RESEND_INVALID_PAYLOAD',
      error: 'Email html or text body is required.',
      provider: 'resend',
      category,
    };
  }

  const doFetch = params.fetchImpl || fetch;

  try {
    const response = await doFetch(RESEND_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const rawBody = await response.text().catch(() => '');

    if (!response.ok) {
      const mapped = mapResendHttpError(response.status, rawBody);
      return {
        ok: false,
        provider: 'resend',
        category,
        ...mapped,
      };
    }

    let messageId: string | null = null;
    if (rawBody) {
      try {
        const parsed = JSON.parse(rawBody);
        if (typeof parsed?.id === 'string' && parsed.id.trim()) {
          messageId = parsed.id.trim();
        }
      } catch {
        // Non-JSON 2xx body still succeeded
      }
    }

    const appliedCc = Array.isArray(payload.cc) ? payload.cc : [];
    return {
      ok: true,
      id: messageId,
      provider: 'resend',
      category,
      from: payload.from,
      to: payload.to,
      ccApplied: appliedCc.length > 0,
      cc: appliedCc,
    };
  } catch (err: any) {
    return {
      ok: false,
      statusCode: 502,
      code: 'RESEND_NETWORK_ERROR',
      error: 'Unable to reach Resend email provider.',
      provider: 'resend',
      category,
      providerMessage: err?.message || String(err),
    };
  }
}
