/**
 * Edge-Compatible Contact Us Service for EventFrame.io
 *
 * Shared identically by Express (server.ts / createDeveloperRouter.ts)
 * and Cloudflare Worker (worker/index.ts / registerWorkerDeveloperRoutes.ts).
 */

import { sendEventFrameEmail, sanitizeEmailHeaderValue } from './emailService';
import { recordPlatformActivity } from './developerAdminService';

export const CONTACT_ADMIN_RECIPIENT = 'eventframeio@gmail.com' as const;

export const CONTACT_ENQUIRY_CATEGORIES = [
  { id: 'general', label: 'General Enquiries' },
  { id: 'technical_support', label: 'Technical Support' },
  { id: 'partnerships', label: 'Business Partnerships' },
  { id: 'billing', label: 'Billing & Payments' },
] as const;

export type ContactEnquiryType = (typeof CONTACT_ENQUIRY_CATEGORIES)[number]['id'];

export const CONTACT_INQUIRY_STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED'] as const;
export type ContactInquiryStatus = (typeof CONTACT_INQUIRY_STATUSES)[number];

export interface ContactInquiryRecord {
  id: string;
  name: string;
  email: string;
  enquiryType: ContactEnquiryType;
  enquiryTypeLabel: string;
  subject: string;
  eventName: string | null;
  message: string;
  status: ContactInquiryStatus;
  internalNotes: string | null;
  adminNotificationSent: boolean;
  customerAckSent: boolean;
  notificationError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactSubmissionInput {
  name?: unknown;
  email?: unknown;
  enquiryType?: unknown;
  enquiry_type?: unknown;
  subject?: unknown;
  eventName?: unknown;
  event_name?: unknown;
  message?: unknown;
  website?: unknown;
  companyWebsite?: unknown;
  honeypot?: unknown;
}

export interface NormalizedContactSubmission {
  name: string;
  email: string;
  enquiryType: ContactEnquiryType;
  enquiryTypeLabel: string;
  subject: string;
  eventName: string | null;
  message: string;
}

export interface ValidationIssue {
  field: 'name' | 'email' | 'enquiryType' | 'subject' | 'eventName' | 'message';
  message: string;
}

export function getEnquiryCategoryLabel(category: string): string {
  const found = CONTACT_ENQUIRY_CATEGORIES.find((c) => c.id === category);
  return found ? found.label : 'General Enquiries';
}

export function normalizeEnquiryType(raw: unknown): ContactEnquiryType | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'general' || normalized === 'general_enquiries') return 'general';
  if (normalized === 'technical_support' || normalized === 'technical' || normalized === 'support') {
    return 'technical_support';
  }
  if (
    normalized === 'partnerships' ||
    normalized === 'business_partnerships' ||
    normalized === 'partnership'
  ) {
    return 'partnerships';
  }
  if (
    normalized === 'billing' ||
    normalized === 'billing_&_payments' ||
    normalized === 'billing_and_payments' ||
    normalized === 'payments'
  ) {
    return 'billing';
  }
  return null;
}

export function normalizeInquiryStatus(raw: unknown): ContactInquiryStatus | null {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (upper === 'NEW' || upper === 'IN_PROGRESS' || upper === 'RESOLVED') {
    return upper;
  }
  return null;
}

export function sanitizeSingleLineText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return sanitizeEmailHeaderValue(raw).replace(/\s+/g, ' ').slice(0, maxLen).trim();
}

export function sanitizeMultilineText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"']+@[^\s@<>()[\]\\,;:"']+\.[a-zA-Z]{2,}$/;

export function isValidContactEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  if (/[\r\n\s]/.test(email)) return false;
  return EMAIL_PATTERN.test(email);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function validateContactSubmission(
  input: ContactSubmissionInput
):
  | { ok: true; data: NormalizedContactSubmission }
  | { ok: false; statusCode: number; code: string; error: string; issues?: ValidationIssue[] } {
  // Honeypot spam protection
  const honeypotValues = [input.website, input.companyWebsite, input.honeypot];
  for (const hp of honeypotValues) {
    if (typeof hp === 'string' && hp.trim().length > 0) {
      return {
        ok: false,
        statusCode: 400,
        code: 'SPAM_DETECTED',
        error: 'Your submission could not be processed. Please try again.',
      };
    }
  }

  const issues: ValidationIssue[] = [];

  const name = sanitizeSingleLineText(input.name, 120);
  if (!name) {
    issues.push({ field: 'name', message: 'Full name is required.' });
  } else if (name.length < 2) {
    issues.push({ field: 'name', message: 'Full name must be at least 2 characters.' });
  }

  const email = sanitizeSingleLineText(input.email, 254).toLowerCase();
  if (!email) {
    issues.push({ field: 'email', message: 'Email address is required.' });
  } else if (!isValidContactEmail(email)) {
    issues.push({ field: 'email', message: 'Please enter a valid email address.' });
  }

  const enquiryType = normalizeEnquiryType(input.enquiryType ?? input.enquiry_type);
  if (!enquiryType) {
    issues.push({ field: 'enquiryType', message: 'Please select an enquiry category.' });
  }

  const subject = sanitizeSingleLineText(input.subject, 180);
  if (!subject) {
    issues.push({ field: 'subject', message: 'Subject is required.' });
  } else if (subject.length < 2) {
    issues.push({ field: 'subject', message: 'Subject must be at least 2 characters.' });
  }

  const rawEventName = sanitizeSingleLineText(input.eventName ?? input.event_name, 160);
  const eventName = rawEventName.length > 0 ? rawEventName : null;

  const message = sanitizeMultilineText(input.message, 5000);
  if (!message) {
    issues.push({ field: 'message', message: 'Message is required.' });
  } else if (message.length < 10) {
    issues.push({ field: 'message', message: 'Message must be at least 10 characters.' });
  }

  if (issues.length > 0 || !enquiryType) {
    return {
      ok: false,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      error: issues[0]?.message || 'Please check the required contact form fields.',
      issues,
    };
  }

  return {
    ok: true,
    data: {
      name,
      email,
      enquiryType,
      enquiryTypeLabel: getEnquiryCategoryLabel(enquiryType),
      subject,
      eventName,
      message,
    },
  };
}

// Sliding-window in-memory rate limiter for public contact endpoint
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 6;
const MAX_PER_EMAIL = 4;

const ipBuckets = new Map<string, number[]>();
const emailBuckets = new Map<string, number[]>();

function pruneAndCount(bucket: Map<string, number[]>, key: string, now: number, max: number): boolean {
  const existing = (bucket.get(key) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (existing.length >= max) {
    bucket.set(key, existing);
    return false;
  }
  existing.push(now);
  bucket.set(key, existing);
  if (bucket.size > 2000) {
    for (const [k, list] of bucket.entries()) {
      const fresh = list.filter((ts) => now - ts < RATE_WINDOW_MS);
      if (fresh.length === 0) bucket.delete(k);
      else bucket.set(k, fresh);
    }
  }
  return true;
}

export function checkContactRateLimit(params: { ip?: string; email?: string; now?: number }): boolean {
  const now = params.now ?? Date.now();
  const cleanIp = (params.ip || '').trim();
  const cleanEmail = (params.email || '').trim().toLowerCase();

  if (cleanIp && !pruneAndCount(ipBuckets, cleanIp, now, MAX_PER_IP)) {
    return false;
  }
  if (cleanEmail && !pruneAndCount(emailBuckets, cleanEmail, now, MAX_PER_EMAIL)) {
    return false;
  }
  return true;
}

export function resetContactRateLimitStore(): void {
  ipBuckets.clear();
  emailBuckets.clear();
}

export function buildContactAdminEmailContent(params: {
  inquiryId: string;
  data: NormalizedContactSubmission;
  submittedAtIso: string;
}): { subject: string; html: string; text: string } {
  const { inquiryId, data, submittedAtIso } = params;
  const subject = sanitizeEmailHeaderValue(
    `[EventFrame Contact] ${data.enquiryTypeLabel} – ${data.subject}`
  );

  const safeName = escapeHtml(data.name);
  const safeEmail = escapeHtml(data.email);
  const safeCategory = escapeHtml(data.enquiryTypeLabel);
  const safeSubject = escapeHtml(data.subject);
  const safeEventName = data.eventName ? escapeHtml(data.eventName) : null;
  const safeMessageHtml = escapeHtml(data.message).replace(/\n/g, '<br />');
  const safeSubmittedAt = escapeHtml(
    new Date(submittedAtIso).toUTCString()
  );
  const safeId = escapeHtml(inquiryId);

  const eventRowHtml = safeEventName
    ? `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #EFEFEA;color:#777777;font-size:13px;width:145px;vertical-align:top;">Event Name</td>
        <td style="padding:10px 0;border-bottom:1px solid #EFEFEA;color:#252525;font-size:14px;font-weight:500;">${safeEventName}</td>
      </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F7F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#252525;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7F7F5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#FFFFFF;border:1px solid #E8E8E5;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #E8E8E5;background-color:#FAF9F7;">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8B806F;font-weight:600;">EventFrame Contact Desk</div>
              <h1 style="margin:6px 0 0;font-size:20px;line-height:1.35;color:#252525;font-weight:600;">${safeSubject}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #EFEFEA;color:#777777;font-size:13px;width:145px;vertical-align:top;">Customer Name</td>
                  <td style="padding:10px 0;border-bottom:1px solid #EFEFEA;color:#252525;font-size:14px;font-weight:600;">${safeName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #EFEFEA;color:#777777;font-size:13px;vertical-align:top;">Customer Email</td>
                  <td style="padding:10px 0;border-bottom:1px solid #EFEFEA;color:#252525;font-size:14px;">
                    <a href="mailto:${safeEmail}" style="color:#252525;text-decoration:underline;">${safeEmail}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #EFEFEA;color:#777777;font-size:13px;vertical-align:top;">Category</td>
                  <td style="padding:10px 0;border-bottom:1px solid #EFEFEA;color:#252525;font-size:14px;font-weight:500;">${safeCategory}</td>
                </tr>
                ${eventRowHtml}
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #EFEFEA;color:#777777;font-size:13px;vertical-align:top;">Submitted</td>
                  <td style="padding:10px 0;border-bottom:1px solid #EFEFEA;color:#555555;font-size:13px;">${safeSubmittedAt}</td>
                </tr>
              </table>

              <div style="margin-top:22px;">
                <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#8B806F;font-weight:600;margin-bottom:8px;">Message</div>
                <div style="background-color:#FAF9F7;border:1px solid #E8E8E5;border-radius:8px;padding:16px 18px;font-size:14px;line-height:1.65;color:#252525;">
                  ${safeMessageHtml}
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background-color:#FAF9F7;border-top:1px solid #E8E8E5;font-size:12px;color:#777777;">
              Reply directly to this email to respond to ${safeName} (${safeEmail}). Reference ID: <span style="font-family:monospace;color:#555555;">${safeId}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textLines = [
    `EventFrame Contact Submission (${data.enquiryTypeLabel})`,
    `----------------------------------------`,
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Category: ${data.enquiryTypeLabel}`,
    `Subject: ${data.subject}`,
    ...(data.eventName ? [`Event Name: ${data.eventName}`] : []),
    `Submitted: ${new Date(submittedAtIso).toUTCString()}`,
    `Reference ID: ${inquiryId}`,
    ``,
    `Message:`,
    data.message,
  ];

  return {
    subject,
    html,
    text: textLines.join('\n'),
  };
}

export function buildContactCustomerAckContent(params: {
  name: string;
}): { subject: string; text: string; html: string } {
  const cleanName = sanitizeSingleLineText(params.name, 120) || 'there';
  const subject = `We've received your message – EventFrame`;
  const text = [
    `Hi ${cleanName},`,
    ``,
    `Thank you for contacting EventFrame!`,
    ``,
    `We've successfully received your enquiry and our team will review your message.`,
    ``,
    `We'll get back to you as soon as possible.`,
    ``,
    `Best regards,`,
    `EventFrame Team`,
    `https://eventframe.io`,
  ].join('\n');

  const safeName = escapeHtml(cleanName);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F7F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#252525;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7F7F5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#FFFFFF;border:1px solid #E8E8E5;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #E8E8E5;background-color:#FAF9F7;">
              <div style="font-size:15px;font-weight:600;color:#252525;letter-spacing:-0.01em;">EventFrame<span style="color:#8B806F;">.io</span></div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-size:14px;line-height:1.7;color:#252525;">
              <p style="margin:0 0 14px;">Hi ${safeName},</p>
              <p style="margin:0 0 14px;">Thank you for contacting EventFrame!</p>
              <p style="margin:0 0 14px;">We've successfully received your enquiry and our team will review your message.</p>
              <p style="margin:0 0 22px;">We'll get back to you as soon as possible.</p>
              <p style="margin:0;color:#555555;">Best regards,<br /><strong style="color:#252525;">EventFrame Team</strong><br /><a href="https://eventframe.io" style="color:#8B806F;text-decoration:none;">https://eventframe.io</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export function mapContactInquiryRow(row: any): ContactInquiryRecord {
  const enquiryType = normalizeEnquiryType(row?.enquiry_type) || 'general';
  const status = normalizeInquiryStatus(row?.status) || 'NEW';
  return {
    id: String(row.id),
    name: String(row.name || ''),
    email: String(row.email || ''),
    enquiryType,
    enquiryTypeLabel: getEnquiryCategoryLabel(enquiryType),
    subject: String(row.subject || ''),
    eventName: row.event_name ? String(row.event_name) : null,
    message: String(row.message || ''),
    status,
    internalNotes: row.internal_notes ? String(row.internal_notes) : null,
    adminNotificationSent: Boolean(row.admin_notification_sent),
    customerAckSent: Boolean(row.customer_ack_sent),
    notificationError: row.notification_error ? String(row.notification_error) : null,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  };
}

export interface SubmitContactInquiryDeps {
  supabase: any;
  resendApiKey?: string | null;
  clientIp?: string;
  fetchImpl?: typeof fetch;
}

export type SubmitContactInquiryResult =
  | {
      ok: true;
      statusCode: 201;
      inquiry: ContactInquiryRecord;
      message: string;
    }
  | {
      ok: false;
      statusCode: number;
      code: string;
      error: string;
      issues?: ValidationIssue[];
      saved?: boolean;
      inquiryId?: string;
    };

export async function submitContactInquiry(
  deps: SubmitContactInquiryDeps,
  input: ContactSubmissionInput
): Promise<SubmitContactInquiryResult> {
  const validated = validateContactSubmission(input);
  if (validated.ok === false) {
    return validated;
  }

  const { data } = validated;

  if (!checkContactRateLimit({ ip: deps.clientIp, email: data.email })) {
    return {
      ok: false,
      statusCode: 429,
      code: 'RATE_LIMITED',
      error: 'Too many contact requests in a short period. Please wait a few minutes and try again.',
    };
  }

  if (!deps.supabase) {
    return {
      ok: false,
      statusCode: 500,
      code: 'DATABASE_UNAVAILABLE',
      error: 'Unable to submit your enquiry right now. Please try again shortly.',
    };
  }

  // 1. Persist enquiry first so customer submission is never lost if email delivery fails
  const { data: insertedRow, error: insertError } = await deps.supabase
    .from('contact_inquiries')
    .insert({
      name: data.name,
      email: data.email,
      enquiry_type: data.enquiryType,
      subject: data.subject,
      event_name: data.eventName,
      message: data.message,
      status: 'NEW',
      admin_notification_sent: false,
      customer_ack_sent: false,
    })
    .select('*')
    .single();

  if (insertError || !insertedRow) {
    console.error('[ContactService] Failed to store contact enquiry:', insertError?.message || 'Unknown error');
    return {
      ok: false,
      statusCode: 500,
      code: 'CONTACT_SAVE_FAILED',
      error: 'We could not save your enquiry right now. Please try again shortly.',
    };
  }

  const inquiryId = String(insertedRow.id);
  const submittedAtIso = String(insertedRow.created_at || new Date().toISOString());

  // 2. Send Admin Notification Email TO eventframeio@gmail.com with Reply-To customer email and NO CC/BCC
  const adminContent = buildContactAdminEmailContent({
    inquiryId,
    data,
    submittedAtIso,
  });

  const adminEmailResult = await sendEventFrameEmail({
    apiKey: deps.resendApiKey,
    category: 'contact_admin_notification',
    to: CONTACT_ADMIN_RECIPIENT,
    replyTo: data.email,
    subject: adminContent.subject,
    html: adminContent.html,
    text: adminContent.text,
    fetchImpl: deps.fetchImpl,
  });

  if (adminEmailResult.ok === false) {
    const safeErrorCode = `${adminEmailResult.code}${adminEmailResult.providerStatus ? ` (${adminEmailResult.providerStatus})` : ''}`;
    console.error(`[ContactService] Admin notification failed for inquiry ${inquiryId}: ${safeErrorCode}`);

    await deps.supabase
      .from('contact_inquiries')
      .update({
        admin_notification_sent: false,
        customer_ack_sent: false,
        notification_error: safeErrorCode,
      })
      .eq('id', inquiryId)
      .catch(() => {});

    return {
      ok: false,
      statusCode: 502,
      code: 'NOTIFICATION_DELIVERY_FAILED',
      error: 'We were unable to deliver your enquiry notification right now. Please try again shortly or email eventframeio@gmail.com directly.',
      saved: true,
      inquiryId,
    };
  }

  // 3. Send Customer Acknowledgement Email TO customer email with NO CC and NO BCC
  const customerContent = buildContactCustomerAckContent({ name: data.name });
  const customerAckResult = await sendEventFrameEmail({
    apiKey: deps.resendApiKey,
    category: 'contact_customer_acknowledgement',
    to: data.email,
    subject: customerContent.subject,
    html: customerContent.html,
    text: customerContent.text,
    fetchImpl: deps.fetchImpl,
  });

  const ackSent = customerAckResult.ok;
  let ackError: string | null = null;
  if (customerAckResult.ok === false) {
    ackError = `ACK_${customerAckResult.code}${customerAckResult.providerStatus ? ` (${customerAckResult.providerStatus})` : ''}`;
    console.error(`[ContactService] Customer acknowledgement failed for inquiry ${inquiryId}: ${ackError}`);
  }

  const { data: updatedRow } = await deps.supabase
    .from('contact_inquiries')
    .update({
      admin_notification_sent: true,
      customer_ack_sent: ackSent,
      notification_error: ackError,
    })
    .eq('id', inquiryId)
    .select('*')
    .single();

  return {
    ok: true,
    statusCode: 201,
    inquiry: mapContactInquiryRow(updatedRow || { ...insertedRow, admin_notification_sent: true, customer_ack_sent: ackSent }),
    message:
      "Thank you for reaching out! Your message has been sent successfully. Our team will get back to you as soon as possible.",
  };
}

export async function listContactInquiries(
  supabase: any,
  query: {
    search?: string;
    enquiryType?: string;
    status?: string;
    page?: string | number;
    limit?: string | number;
  } = {}
) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const search = (query.search || '').trim().toLowerCase();
  const categoryFilter = normalizeEnquiryType(query.enquiryType);
  const statusFilter = normalizeInquiryStatus(query.status);

  const { data: rows, error } = await supabase
    .from('contact_inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load contact enquiries');
  }

  const allMapped = (rows || []).map(mapContactInquiryRow);

  const summary = {
    total: allMapped.length,
    newCount: allMapped.filter((r: ContactInquiryRecord) => r.status === 'NEW').length,
    inProgressCount: allMapped.filter((r: ContactInquiryRecord) => r.status === 'IN_PROGRESS').length,
    resolvedCount: allMapped.filter((r: ContactInquiryRecord) => r.status === 'RESOLVED').length,
  };

  let filtered = allMapped;
  if (categoryFilter) {
    filtered = filtered.filter((r: ContactInquiryRecord) => r.enquiryType === categoryFilter);
  }
  if (statusFilter) {
    filtered = filtered.filter((r: ContactInquiryRecord) => r.status === statusFilter);
  }
  if (search) {
    filtered = filtered.filter(
      (r: ContactInquiryRecord) =>
        r.name.toLowerCase().includes(search) ||
        r.email.toLowerCase().includes(search) ||
        r.subject.toLowerCase().includes(search) ||
        (r.eventName || '').toLowerCase().includes(search) ||
        r.message.toLowerCase().includes(search)
    );
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;

  return {
    items: filtered.slice(offset, offset + limit),
    total,
    page: safePage,
    limit,
    totalPages,
    summary,
  };
}

export async function getContactInquiryById(
  supabase: any,
  id: string
): Promise<ContactInquiryRecord | null> {
  if (!id || typeof id !== 'string') return null;
  const { data, error } = await supabase
    .from('contact_inquiries')
    .select('*')
    .eq('id', id.trim())
    .maybeSingle();

  if (error || !data) return null;
  return mapContactInquiryRow(data);
}

export async function updateContactInquiry(
  supabase: any,
  id: string,
  updates: { status?: unknown; internalNotes?: unknown; internal_notes?: unknown },
  admin: { id: string; email: string; role?: string }
): Promise<
  | { ok: true; inquiry: ContactInquiryRecord }
  | { ok: false; statusCode: number; error: string }
> {
  if (!id || typeof id !== 'string') {
    return { ok: false, statusCode: 400, error: 'Invalid enquiry ID.' };
  }

  const { data: existing, error: fetchError } = await supabase
    .from('contact_inquiries')
    .select('*')
    .eq('id', id.trim())
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false, statusCode: 404, error: 'Contact enquiry not found.' };
  }

  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status !== undefined) {
    const nextStatus = normalizeInquiryStatus(updates.status);
    if (!nextStatus) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Invalid status. Must be NEW, IN_PROGRESS, or RESOLVED.',
      };
    }
    patch.status = nextStatus;
  }

  const rawNotes = updates.internalNotes !== undefined ? updates.internalNotes : updates.internal_notes;
  if (rawNotes !== undefined) {
    if (rawNotes === null || rawNotes === '') {
      patch.internal_notes = null;
    } else if (typeof rawNotes === 'string') {
      patch.internal_notes = sanitizeMultilineText(rawNotes, 4000) || null;
    } else {
      return { ok: false, statusCode: 400, error: 'Internal notes must be text.' };
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('contact_inquiries')
    .update(patch)
    .eq('id', existing.id)
    .select('*')
    .single();

  if (updateError || !updated) {
    return {
      ok: false,
      statusCode: 500,
      error: updateError?.message || 'Failed to update contact enquiry.',
    };
  }

  await recordPlatformActivity(supabase, {
    actorId: admin.id,
    actorEmail: admin.email,
    actorRole: admin.role || 'super_admin',
    action: 'CONTACT_INQUIRY_UPDATED',
    referenceId: updated.id,
    summary: `Updated contact enquiry "${updated.subject}" status to ${updated.status}`,
    metadata: {
      inquiry_id: updated.id,
      previous_status: existing.status,
      new_status: updated.status,
      has_internal_notes: Boolean(updated.internal_notes),
    },
  }).catch(() => {});

  return { ok: true, inquiry: mapContactInquiryRow(updated) };
}
