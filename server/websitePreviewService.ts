/**
 * Isomorphic Website Preview Token, Publishing & Preview Data Service
 * Runs identically in Node.js (Express) and Cloudflare Workers (Hono) using Web Crypto.
 */
import { isEventActive } from '../src/lib/packages';
import {
  authorizeAgencyAccess,
  authorizeProjectAccess,
  sanitizePublicProject,
  type ServiceResult,
} from './agencyService';
import { hasExplicitAdminAgencyAccess, type BillingAuthUser } from './billingService';

export const DEFAULT_PREVIEW_TOKEN_TTL_MINUTES = 24 * 60; // 24 hours
export const MIN_PREVIEW_TOKEN_TTL_MINUTES = 5;
export const MAX_PREVIEW_TOKEN_TTL_MINUTES = 7 * 24 * 60; // 7 days

export const RESERVED_WEBSITE_SLUGS = [
  'login',
  'verify',
  'reset-password',
  'onboarding',
  'workspace',
  'editor',
  'website-studio',
  'templates',
  'pricing',
  'subscription',
  'api',
  'couple',
  'display',
  'guest',
  'rsvp',
  'invitation',
  'e',
  'g',
  'r',
  'event',
  'agency',
  'developer',
  'contact',
  'blog',
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function generateSecurePreviewToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return `efp_${encodeBase64Url(bytes)}`;
}

export async function hashPreviewToken(rawToken: string): Promise<string> {
  const normalized = String(rawToken || '').trim();
  const data = new TextEncoder().encode(normalized);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashBytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < hashBytes.length; i++) {
    hex += hashBytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function constantTimeEqual(a: string, b: string): boolean {
  const strA = String(a || '');
  const strB = String(b || '');
  if (!strA || !strB || strA.length !== strB.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < strA.length; i++) {
    diff |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return diff === 0;
}

function isMissingPreviewTokensTableError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '').toUpperCase();
  const message = String(err.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (message.includes('website_preview_tokens') &&
      (message.includes('does not exist') || message.includes('could not find the table')))
  );
}

function resolveTtlMinutes(rawTtl?: unknown): number {
  if (typeof rawTtl !== 'number' && typeof rawTtl !== 'string') {
    return DEFAULT_PREVIEW_TOKEN_TTL_MINUTES;
  }
  const parsed = Number(rawTtl);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PREVIEW_TOKEN_TTL_MINUTES;
  }
  return Math.min(MAX_PREVIEW_TOKEN_TTL_MINUTES, Math.max(MIN_PREVIEW_TOKEN_TTL_MINUTES, Math.floor(parsed)));
}

function buildPreviewUrl(slugOrId: string, rawToken: string): string {
  return `/${encodeURIComponent(slugOrId)}/website?preview=true&token=${encodeURIComponent(rawToken)}`;
}

export interface PreviewTokenIssuedData {
  success: true;
  token: string;
  previewToken: string;
  expires_at: string;
  expiresAt: string;
  projectId: string;
  previewUrl: string;
}

/**
 * Authenticates & authorizes the caller for the project, generates a cryptographically
 * random preview token, stores ONLY its SHA-256 hash bound to the project and expiration,
 * and returns the token + expiration + preview URL.
 */
export async function createProjectPreviewToken(
  supabase: any,
  params: {
    projectId: string;
    authUser: BillingAuthUser | null | undefined;
    ttlMinutes?: unknown;
  }
): Promise<ServiceResult<PreviewTokenIssuedData>> {
  const authz = await authorizeProjectAccess(supabase, {
    projectId: params.projectId,
    authUser: params.authUser,
    allowPin: false,
    forbiddenMessage: 'You do not have permission to generate a preview token for this project.',
  });

  if (authz.ok === false) {
    return authz;
  }

  const { project } = authz.data;
  const ttlMinutes = resolveTtlMinutes(params.ttlMinutes);
  const expiresAtMs = Date.now() + ttlMinutes * 60 * 1000;
  const expiresAtIso = new Date(expiresAtMs).toISOString();

  const rawToken = generateSecurePreviewToken();
  const tokenHash = await hashPreviewToken(rawToken);
  const slugOrId = String(project.slug || project.id);
  const previewUrl = buildPreviewUrl(slugOrId, rawToken);

  if (String(project.id) === 'demo') {
    return {
      ok: true,
      statusCode: 200,
      data: {
        success: true,
        token: rawToken,
        previewToken: rawToken,
        expires_at: expiresAtIso,
        expiresAt: expiresAtIso,
        projectId: 'demo',
        previewUrl,
      },
    };
  }

  const createdByCandidate = params.authUser?.dbUserId || params.authUser?.id || null;
  const createdByUuid = isUuid(createdByCandidate) ? createdByCandidate : null;

  const { error: insertErr } = await supabase
    .from('website_preview_tokens')
    .insert({
      project_id: String(project.id),
      token_hash: tokenHash,
      created_by: createdByUuid,
      expires_at: expiresAtIso,
      revoked_at: null,
    });

  if (insertErr) {
    if (isMissingPreviewTokensTableError(insertErr)) {
      // Unmigrated DB fallback: store SHA-256 hash + expiration envelope in projects.website_preview_token
      // (never stores plaintext token).
      const hashedEnvelope = `v2.${expiresAtMs}.${tokenHash}`;
      const { error: fallbackErr } = await supabase
        .from('projects')
        .update({ website_preview_token: hashedEnvelope })
        .eq('id', project.id);

      if (fallbackErr) {
        return {
          ok: false,
          statusCode: 500,
          code: 'DATABASE_ERROR',
          error: 'Failed to persist website preview token.',
        };
      }
    } else {
      console.error('Failed to insert website preview token:', insertErr);
      return {
        ok: false,
        statusCode: 500,
        code: 'DATABASE_ERROR',
        error: 'Failed to create website preview token.',
      };
    }
  } else if (project.website_preview_token) {
    // Clear any legacy plaintext token on projects once the dedicated hashed token table is in use
    await supabase
      .from('projects')
      .update({ website_preview_token: null })
      .eq('id', project.id)
      .then(() => undefined)
      .catch(() => undefined);
  }

  return {
    ok: true,
    statusCode: 200,
    data: {
      success: true,
      token: rawToken,
      previewToken: rawToken,
      expires_at: expiresAtIso,
      expiresAt: expiresAtIso,
      projectId: String(project.id),
      previewUrl,
    },
  };
}

/**
 * Revokes either a specific preview token or all active preview tokens for a project.
 */
export async function revokeProjectPreviewTokens(
  supabase: any,
  params: {
    projectId: string;
    authUser: BillingAuthUser | null | undefined;
    token?: string | null;
  }
): Promise<ServiceResult<{ success: true; revokedAt: string }>> {
  const authz = await authorizeProjectAccess(supabase, {
    projectId: params.projectId,
    authUser: params.authUser,
    allowPin: false,
    forbiddenMessage: 'You do not have permission to revoke preview tokens for this project.',
  });

  if (authz.ok === false) {
    return authz;
  }

  const { project } = authz.data;
  const revokedAt = new Date().toISOString();
  const specificToken = typeof params.token === 'string' && params.token.trim() ? params.token.trim() : null;

  let query = supabase
    .from('website_preview_tokens')
    .update({ revoked_at: revokedAt })
    .eq('project_id', String(project.id))
    .is('revoked_at', null);

  if (specificToken) {
    const tokenHash = await hashPreviewToken(specificToken);
    query = query.eq('token_hash', tokenHash);
  }

  const { error: revokeErr } = await query;
  if (revokeErr && !isMissingPreviewTokensTableError(revokeErr)) {
    return {
      ok: false,
      statusCode: 500,
      code: 'DATABASE_ERROR',
      error: 'Failed to revoke website preview token.',
    };
  }

  if (project.website_preview_token) {
    await supabase
      .from('projects')
      .update({ website_preview_token: null })
      .eq('id', project.id)
      .then(() => undefined)
      .catch(() => undefined);
  }

  return {
    ok: true,
    statusCode: 200,
    data: { success: true, revokedAt },
  };
}

export type PreviewTokenValidationResult =
  | { ok: true; expiresAt: string | null }
  | { ok: false; statusCode: 401 | 403; code: string; error: string };

/**
 * Validates a raw preview token against `website_preview_tokens` (and fallback hashed column),
 * verifying project binding, non-revocation, and non-expiration.
 */
export async function validateProjectPreviewToken(
  supabase: any,
  params: {
    project: any;
    rawToken: string;
  }
): Promise<PreviewTokenValidationResult> {
  const cleanToken = String(params.rawToken || '').trim();
  if (!cleanToken) {
    return {
      ok: false,
      statusCode: 403,
      code: 'INVALID_PREVIEW_TOKEN',
      error: 'A valid preview token is required.',
    };
  }

  const tokenHash = await hashPreviewToken(cleanToken);
  const targetProjectId = String(params.project.id);

  const { data: tokenRow, error: lookupErr } = await supabase
    .from('website_preview_tokens')
    .select('id, project_id, token_hash, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .limit(1)
    .maybeSingle();

  if (!lookupErr && tokenRow) {
    if (String(tokenRow.project_id) !== targetProjectId) {
      return {
        ok: false,
        statusCode: 403,
        code: 'PREVIEW_TOKEN_PROJECT_MISMATCH',
        error: 'This preview token does not belong to the requested project.',
      };
    }

    if (tokenRow.revoked_at) {
      return {
        ok: false,
        statusCode: 403,
        code: 'PREVIEW_TOKEN_REVOKED',
        error: 'This preview link has been revoked.',
      };
    }

    const expiresAtMs = new Date(tokenRow.expires_at).getTime();
    if (!Number.isFinite(expiresAtMs) || Date.now() >= expiresAtMs) {
      return {
        ok: false,
        statusCode: 401,
        code: 'PREVIEW_TOKEN_EXPIRED',
        error: 'This preview link has expired. Please generate a new preview token.',
      };
    }

    // Best-effort usage telemetry without blocking preview response
    if (tokenRow.id) {
      Promise.resolve(
        supabase
          .from('website_preview_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', tokenRow.id)
      ).catch(() => undefined);
    }

    return { ok: true, expiresAt: tokenRow.expires_at || null };
  }

  if (lookupErr && !isMissingPreviewTokensTableError(lookupErr)) {
    console.error('Preview token lookup error:', lookupErr);
  }

  // Fallback check against `projects.website_preview_token` (v2 hashed envelope or legacy plaintext)
  const storedColumn = params.project.website_preview_token;
  if (typeof storedColumn === 'string' && storedColumn.trim()) {
    if (storedColumn.startsWith('v2.')) {
      const parts = storedColumn.split('.');
      if (parts.length === 3) {
        const expiresMs = Number(parts[1]);
        const storedHash = parts[2];
        if (constantTimeEqual(storedHash, tokenHash)) {
          if (!Number.isFinite(expiresMs) || Date.now() >= expiresMs) {
            return {
              ok: false,
              statusCode: 401,
              code: 'PREVIEW_TOKEN_EXPIRED',
              error: 'This preview link has expired. Please generate a new preview token.',
            };
          }
          return { ok: true, expiresAt: new Date(expiresMs).toISOString() };
        }
      }
    } else if (constantTimeEqual(storedColumn, cleanToken)) {
      return { ok: true, expiresAt: null };
    }
  }

  // Check if token matches a DIFFERENT project in legacy/fallback column so cross-project returns 403 explicitly
  if (lookupErr && isMissingPreviewTokensTableError(lookupErr)) {
    const { data: otherProjects } = await supabase
      .from('projects')
      .select('id, website_preview_token')
      .ilike('website_preview_token', `%.${tokenHash}`)
      .limit(1);
    if (Array.isArray(otherProjects) && otherProjects.some((p: any) => String(p.id) !== targetProjectId)) {
      return {
        ok: false,
        statusCode: 403,
        code: 'PREVIEW_TOKEN_PROJECT_MISMATCH',
        error: 'This preview token does not belong to the requested project.',
      };
    }
  }

  return {
    ok: false,
    statusCode: 403,
    code: 'INVALID_PREVIEW_TOKEN',
    error: 'This preview link is invalid or has been revoked.',
  };
}

/**
 * Publishes a project website after verifying project access, event license eligibility, and slug validity.
 */
export async function publishProjectWebsite(
  supabase: any,
  params: {
    projectId: string;
    authUser: BillingAuthUser | null | undefined;
    pin?: string | null;
    websiteConfig?: any;
  }
): Promise<ServiceResult<any>> {
  const authz = await authorizeProjectAccess(supabase, {
    projectId: params.projectId,
    authUser: params.authUser,
    pin: params.pin || null,
    allowPin: true,
    forbiddenMessage: 'Unauthorized to publish this website',
  });

  if (authz.ok === false) {
    return authz;
  }

  const { project, agency } = authz.data;
  if (!isEventActive(project, agency)) {
    return {
      ok: false,
      statusCode: 402,
      code: 'PAYMENT_REQUIRED',
      error: 'Event license payment required ($5.00 USD for 12 months) before publishing.',
    };
  }

  const normalizedSlug = String(project.slug || '').trim().toLowerCase();
  if (!normalizedSlug || RESERVED_WEBSITE_SLUGS.includes(normalizedSlug)) {
    return {
      ok: false,
      statusCode: 400,
      code: 'RESERVED_SLUG',
      error: `Event slug '${project.slug}' is reserved or invalid. Please update the event slug.`,
    };
  }

  const configToPublish = params.websiteConfig || project.website_config;
  if (!configToPublish) {
    return {
      ok: false,
      statusCode: 400,
      code: 'MISSING_WEBSITE_CONFIG',
      error: 'No website configuration found to publish',
    };
  }

  const publishedAt = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    website_status: 'published',
    website_published_at: publishedAt,
    website_published_config: configToPublish,
    updated_at: publishedAt,
  };
  if (params.websiteConfig) {
    updatePayload.website_config = params.websiteConfig;
  }

  const { data: updated, error: updateErr } = await supabase
    .from('projects')
    .update(updatePayload)
    .eq('id', project.id)
    .select()
    .single();

  if (updateErr) {
    return {
      ok: false,
      statusCode: 500,
      code: 'DATABASE_ERROR',
      error: updateErr.message || 'Failed to publish website',
    };
  }

  return {
    ok: true,
    statusCode: 200,
    data: {
      success: true,
      status: 'published',
      publishedAt,
      publicUrl: `/${project.slug}/website`,
      project: sanitizePublicProject(updated) || updated,
    },
  };
}

/**
 * Takes a wedding website offline cleanly without discarding its draft configuration.
 */
export async function unpublishProjectWebsite(
  supabase: any,
  params: {
    projectId: string;
    authUser: BillingAuthUser | null | undefined;
    pin?: string | null;
  }
): Promise<ServiceResult<any>> {
  const authz = await authorizeProjectAccess(supabase, {
    projectId: params.projectId,
    authUser: params.authUser,
    pin: params.pin || null,
    allowPin: true,
    forbiddenMessage: 'Unauthorized to unpublish this website',
  });

  if (authz.ok === false) {
    return authz;
  }

  const { project } = authz.data;
  const { data: updated, error: updateErr } = await supabase
    .from('projects')
    .update({
      website_status: 'unpublished',
      updated_at: new Date().toISOString(),
    })
    .eq('id', project.id)
    .select()
    .single();

  if (updateErr) {
    return {
      ok: false,
      statusCode: 500,
      code: 'DATABASE_ERROR',
      error: updateErr.message || 'Failed to unpublish website',
    };
  }

  return {
    ok: true,
    statusCode: 200,
    data: {
      success: true,
      status: 'unpublished',
      project: sanitizePublicProject(updated) || updated,
    },
  };
}

/**
 * Resolves public or preview website data for `GET /api/events/:slug/website-data`.
 *
 * Security rules:
 * - When `previewToken` is provided, strictly validates project binding, revocation, and expiration;
 *   returns unpublished/draft `website_config` on success, or 401/403 on failure (never falls back to
 *   leaking private config).
 * - When no `previewToken` is provided:
 *   - Returns `website_published_config` if `website_status === 'published'`.
 *   - Checks authenticated agency/admin session if site is draft/unpublished -> 200 preview if authorized.
 *   - Otherwise returns 403 without exposing `config` or sensitive tokens.
 */
export async function getEventWebsiteData(
  supabase: any,
  params: {
    slug: string;
    previewToken?: string | null;
    authUser?: BillingAuthUser | null;
  }
): Promise<{ statusCode: number; isNoStore: boolean; body: Record<string, any> }> {
  const cleanSlug = String(params.slug || '').trim();
  const cleanPreviewToken = typeof params.previewToken === 'string' ? params.previewToken.trim() : '';

  if (cleanSlug === 'demo') {
    return {
      statusCode: 200,
      isNoStore: Boolean(cleanPreviewToken),
      body: {
        status: 'published',
        published: true,
        isPreview: Boolean(cleanPreviewToken),
        isPasswordProtected: false,
        project: {
          id: 'demo',
          slug: 'demo',
          name: 'Lucas & Sofia Wedding',
          groom_name: 'Lucas',
          bride_name: 'Sofia',
          wedding_date: '2025-09-20',
          location: 'San Francisco, CA',
          website_status: 'published',
        },
      },
    };
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select(
      'id, agency_id, name, slug, groom_name, bride_name, wedding_date, location, theme_id, image_url, website_status, website_published_at, website_published_config, website_config, website_preview_token, access_password, deleted_at'
    )
    .eq('slug', cleanSlug)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (error || !project || project.deleted_at) {
    return {
      statusCode: 404,
      isNoStore: true,
      body: { error: 'Wedding celebration not found', code: 'PROJECT_NOT_FOUND' },
    };
  }

  const isPublished = project.website_status === 'published';
  const isPasswordProtected = Boolean(
    project.access_password && String(project.access_password).trim().length > 0
  );

  const safeProject = {
    id: project.id,
    name: project.name,
    slug: project.slug,
    groom_name: project.groom_name,
    bride_name: project.bride_name,
    wedding_date: project.wedding_date,
    location: project.location,
    theme_id: project.theme_id,
    image_url: project.image_url,
    website_status: project.website_status,
    website_published_at: project.website_published_at,
  };

  // 1. Explicit preview token supplied -> validate strictly (shows draft `website_config` when valid)
  if (cleanPreviewToken) {
    const validation = await validateProjectPreviewToken(supabase, {
      project,
      rawToken: cleanPreviewToken,
    });

    if (validation.ok === false) {
      return {
        statusCode: validation.statusCode,
        isNoStore: true,
        body: {
          status: project.website_status || 'draft',
          published: false,
          isPreview: false,
          isPasswordProtected,
          code: validation.code,
          error: validation.error,
          project: safeProject,
        },
      };
    }

    return {
      statusCode: 200,
      isNoStore: true,
      body: {
        status: project.website_status || 'draft',
        published: false,
        isPreview: true,
        isPasswordProtected,
        previewExpiresAt: validation.expiresAt,
        config: project.website_config,
        project: safeProject,
      },
    };
  }

  // 2. Public published website (no preview token requested)
  if (isPublished) {
    return {
      statusCode: 200,
      isNoStore: false,
      body: {
        status: 'published',
        published: true,
        isPreview: false,
        isPasswordProtected,
        config: project.website_published_config || project.website_config,
        project: safeProject,
      },
    };
  }

  // 3. Unpublished / Draft without preview token -> check authorized owner/member/admin session
  if (params.authUser) {
    let authorizedBySession = hasExplicitAdminAgencyAccess(params.authUser);
    if (!authorizedBySession && project.agency_id) {
      const agencyAuth = await authorizeAgencyAccess(supabase, params.authUser, String(project.agency_id));
      authorizedBySession = agencyAuth.ok === true;
    }

    if (authorizedBySession) {
      return {
        statusCode: 200,
        isNoStore: true,
        body: {
          status: project.website_status || 'draft',
          published: false,
          isPreview: true,
          isPasswordProtected,
          config: project.website_config,
          project: safeProject,
        },
      };
    }
  }

  // 4. Unauthorized & missing preview token on unpublished website
  const isUnpublished = project.website_status === 'unpublished';
  return {
    statusCode: 403,
    isNoStore: true,
    body: {
      status: project.website_status || 'draft',
      published: false,
      isPreview: false,
      isPasswordProtected,
      code: isUnpublished ? 'WEBSITE_UNPUBLISHED' : 'WEBSITE_PRIVATE_DRAFT',
      error: isUnpublished
        ? 'This wedding website is currently unpublished.'
        : 'This wedding website is currently in private draft mode.',
      project: safeProject,
    },
  };
}
