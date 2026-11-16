export interface VerifiedGoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  avatarUrl: string | null;
}

export interface SyncUserProfileInput {
  supabaseUserId?: string | null;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  authProvider: 'google' | 'email' | 'supabase';
  providerUserId?: string | null;
  emailVerified?: boolean;
}

export type SyncUserResult =
  | {
      ok: true;
      isNewUser: boolean;
      linkedIdentity: boolean;
      user: any;
    }
  | {
      ok: false;
      statusCode: number;
      code: string;
      error: string;
    };

export type GoogleSyncWorkflowResult =
  | {
      ok: true;
      isNewUser: boolean;
      linkedIdentity: boolean;
      canonicalUserId: string;
      supabaseUserId: string | null;
      user: any;
    }
  | {
      ok: false;
      statusCode: number;
      code: string;
      error: string;
    };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

export function normalizeSyncEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function stripPasswordHash<T extends Record<string, any>>(row: T | null | undefined): Omit<T, 'password_hash'> | null {
  if (!row || typeof row !== 'object') return null;
  const { password_hash: _ignored, ...rest } = row;
  return rest;
}

function isUniqueViolationError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '');
  return code === '23505' || /duplicate key|unique constraint/i.test(msg);
}

function generateCanonicalUuid(): string | null {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Ignore if unavailable
  }
  return null;
}

function isMissingSyncColumnError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '');
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    /supabase_user_id|provider_user_id|email_verified|is_test/i.test(msg)
  );
}

function isPasswordHashNotNullError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '');
  return (code === '23502' || /null value in column/i.test(msg)) && /password_hash/i.test(msg);
}

function omitAdditiveSyncColumns<T extends Record<string, any>>(payload: T): Record<string, any> {
  const {
    supabase_user_id: _s,
    provider_user_id: _p,
    email_verified: _e,
    is_test: _t,
    ...rest
  } = payload;
  return rest;
}

async function logUserRegisteredActivity(
  supabase: any,
  params: {
    actorId: string | null;
    email: string;
    provider: string;
    supabaseUserId: string | null;
  }
) {
  if (!supabase) return;
  try {
    await supabase.from('platform_activity_logs').insert([
      {
        actor_id: params.actorId,
        actor_email: params.email,
        actor_role: 'user',
        action: 'USER_REGISTERED',
        target_user_id: params.actorId || params.email,
        summary: `New user registered via ${params.provider}: ${params.email}`,
        metadata: {
          provider: params.provider,
          ...(params.supabaseUserId ? { supabaseUserId: params.supabaseUserId } : {}),
        },
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (err: any) {
    console.warn('[UserSync] Non-fatal activity log skip:', err?.message || err);
  }
}

/**
 * Verifies Google OAuth tokens for runtimes without google-auth-library (e.g. Cloudflare Workers).
 * Validates `id_token` via Google's tokeninfo endpoint (aud, sub, email, email_verified)
 * and enriches profile info via userinfo. Never returns or persists Google OAuth tokens.
 */
export async function resolveVerifiedGoogleProfile(
  tokens: { id_token?: string | null; access_token?: string | null },
  googleClientId: string,
  fetchFn: typeof fetch = fetch
): Promise<
  | { ok: true; profile: VerifiedGoogleProfile }
  | { ok: false; statusCode: number; code: string; error: string }
> {
  if (!tokens || (!tokens.id_token && !tokens.access_token)) {
    return {
      ok: false,
      statusCode: 401,
      code: 'MISSING_GOOGLE_TOKENS',
      error: 'Google authentication did not return valid verification tokens.',
    };
  }

  let tokenInfo: any = null;
  if (tokens.id_token) {
    const infoRes = await fetchFn(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`
    );
    if (!infoRes.ok) {
      return {
        ok: false,
        statusCode: 401,
        code: 'INVALID_GOOGLE_ID_TOKEN',
        error: 'Google ID token verification failed.',
      };
    }
    tokenInfo = await infoRes.json().catch(() => null);
    if (!tokenInfo || tokenInfo.error || (googleClientId && tokenInfo.aud !== googleClientId)) {
      return {
        ok: false,
        statusCode: 401,
        code: 'INVALID_GOOGLE_AUDIENCE',
        error: 'Google ID token audience mismatch.',
      };
    }
  }

  let userInfo: any = null;
  if (tokens.access_token) {
    const userRes = await fetchFn('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok && !tokenInfo) {
      return {
        ok: false,
        statusCode: 401,
        code: 'GOOGLE_USERINFO_FAILED',
        error: 'Failed to retrieve verified Google profile.',
      };
    }
    if (userRes.ok) {
      userInfo = await userRes.json().catch(() => null);
    }
  }

  if (tokenInfo?.sub && userInfo?.sub && String(tokenInfo.sub) !== String(userInfo.sub)) {
    return {
      ok: false,
      statusCode: 401,
      code: 'PROVIDER_IDENTITY_MISMATCH',
      error: 'Google token subject mismatch.',
    };
  }

  const sub = String(tokenInfo?.sub || userInfo?.sub || '').trim();
  const email = normalizeSyncEmail(tokenInfo?.email || userInfo?.email);
  const rawVerified = tokenInfo?.email_verified ?? userInfo?.email_verified;
  const emailVerified = rawVerified === true || rawVerified === 'true';

  if (!sub || !email) {
    return {
      ok: false,
      statusCode: 400,
      code: 'MISSING_GOOGLE_PROFILE',
      error: 'Google account did not provide a valid subject ID and email address.',
    };
  }

  if (!emailVerified) {
    return {
      ok: false,
      statusCode: 403,
      code: 'GOOGLE_EMAIL_NOT_VERIFIED',
      error: 'Your Google email address must be verified before signing in.',
    };
  }

  const fullName =
    String(userInfo?.name || tokenInfo?.name || '').trim() ||
    [userInfo?.given_name || tokenInfo?.given_name, userInfo?.family_name || tokenInfo?.family_name]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    email.split('@')[0];

  const avatarUrl = String(userInfo?.picture || tokenInfo?.picture || '').trim() || null;

  return {
    ok: true,
    profile: {
      sub,
      email,
      emailVerified: true,
      fullName,
      avatarUrl,
    },
  };
}

/**
 * Ensures an authenticated Google/OAuth user exists in Supabase Auth (`auth.users`)
 * via backend service-role admin APIs and returns their authoritative Supabase UUID.
 * Never embeds privilege claims (`is_developer`, `role`) or Google tokens in metadata.
 */
export async function ensureSupabaseAuthUser(
  supabase: any,
  profile: {
    email: string;
    fullName?: string | null;
    avatarUrl?: string | null;
    authProvider: 'google' | 'email' | 'supabase';
    providerUserId?: string | null;
    emailVerified?: boolean;
    existingSupabaseUserId?: string | null;
  }
): Promise<
  | { ok: true; supabaseUserId: string | null; created: boolean }
  | { ok: false; statusCode: number; code: string; error: string }
> {
  if (isValidUuid(profile.existingSupabaseUserId)) {
    return { ok: true, supabaseUserId: profile.existingSupabaseUserId, created: false };
  }

  const adminAuth = supabase?.auth?.admin;
  if (!adminAuth || typeof adminAuth.createUser !== 'function') {
    return { ok: true, supabaseUserId: null, created: false };
  }

  const email = normalizeSyncEmail(profile.email);
  if (!email) {
    return { ok: false, statusCode: 400, code: 'MISSING_EMAIL', error: 'Email is required for Supabase Auth sync.' };
  }

  try {
    const createRes = await adminAuth.createUser({
      email,
      email_confirm: profile.emailVerified !== false,
      user_metadata: {
        full_name: profile.fullName || email.split('@')[0],
        ...(profile.avatarUrl ? { avatar_url: profile.avatarUrl } : {}),
        provider: profile.authProvider,
        ...(profile.providerUserId ? { sub: profile.providerUserId } : {}),
      },
    });

    if (!createRes.error && createRes.data?.user?.id) {
      return {
        ok: true,
        supabaseUserId: String(createRes.data.user.id),
        created: true,
      };
    }

    const errMsg = String(createRes.error?.message || '');
    const errCode = String(createRes.error?.code || '');
    const alreadyExists =
      errCode === 'email_exists' ||
      createRes.error?.status === 422 ||
      /already been registered|already exists|duplicate/i.test(errMsg);

    if (!alreadyExists) {
      console.error('[UserSync] Supabase auth.admin.createUser failed:', errMsg);
      return {
        ok: false,
        statusCode: 502,
        code: 'SUPABASE_AUTH_SYNC_FAILED',
        error: `Failed to provision Supabase Auth user: ${errMsg || 'Unknown error'}`,
      };
    }

    // Look up existing user UUID in auth.users cleanly via admin listUsers
    if (typeof adminAuth.listUsers === 'function') {
      let page = 1;
      const perPage = 200;
      while (page <= 10) {
        const listRes = await adminAuth.listUsers({ page, perPage });
        if (listRes.error) {
          console.error('[UserSync] Supabase auth.admin.listUsers failed:', listRes.error.message);
          return {
            ok: false,
            statusCode: 502,
            code: 'SUPABASE_AUTH_LOOKUP_FAILED',
            error: `Failed to locate existing Supabase Auth user: ${listRes.error.message}`,
          };
        }
        const users = listRes.data?.users || [];
        const match = users.find((u: any) => normalizeSyncEmail(u?.email) === email);
        if (match?.id) {
          return { ok: true, supabaseUserId: String(match.id), created: false };
        }
        if (users.length < perPage) break;
        page += 1;
      }
    }

    return {
      ok: false,
      statusCode: 502,
      code: 'SUPABASE_AUTH_USER_NOT_FOUND',
      error: 'Supabase Auth reported an existing user but UUID lookup returned no match.',
    };
  } catch (err: any) {
    console.error('[UserSync] Unexpected Supabase Auth admin error:', err?.message || err);
    return {
      ok: false,
      statusCode: 502,
      code: 'SUPABASE_AUTH_SYNC_FAILED',
      error: err?.message || 'Unexpected error synchronizing Supabase Auth user.',
    };
  }
}

async function lookupExistingUsersAuthRow(
  supabase: any,
  criteria: {
    supabaseUserId?: string | null;
    providerUserId?: string | null;
    email?: string | null;
  }
): Promise<{ ok: true; row: any | null } | { ok: false; error: any }> {
  const trySingleQuery = async (column: string, value: string, caseInsensitive = false) => {
    let q = supabase.from('users_auth').select('*');
    q = caseInsensitive && typeof q.ilike === 'function' ? q.ilike(column, value) : q.eq(column, value);
    const { data, error } = await q.maybeSingle();
    if (error) {
      if (isMissingSyncColumnError(error)) {
        return { ok: true as const, row: null };
      }
      return { ok: false as const, error };
    }
    return { ok: true as const, row: data || null };
  };

  if (isValidUuid(criteria.supabaseUserId)) {
    const bySbUuid = await trySingleQuery('supabase_user_id', criteria.supabaseUserId);
    if (!bySbUuid.ok) return bySbUuid;
    if (bySbUuid.row) return bySbUuid;

    const byPk = await trySingleQuery('id', criteria.supabaseUserId);
    if (!byPk.ok) return byPk;
    if (byPk.row) return byPk;
  }

  if (criteria.providerUserId && criteria.providerUserId.trim()) {
    const pid = criteria.providerUserId.trim();
    const byProvider = await trySingleQuery('provider_user_id', pid);
    if (!byProvider.ok) return byProvider;
    if (byProvider.row) return byProvider;

    const byExternal = await trySingleQuery('external_user_id', pid);
    if (!byExternal.ok) return byExternal;
    if (byExternal.row) return byExternal;
  }

  if (criteria.email) {
    const norm = normalizeSyncEmail(criteria.email);
    const byEmail = await trySingleQuery('email', norm, true);
    if (!byEmail.ok) return byEmail;
    if (byEmail.row) return byEmail;
  }

  return { ok: true, row: null };
}

async function updateExistingUsersAuthRow(
  supabase: any,
  existing: any,
  input: SyncUserProfileInput
): Promise<SyncUserResult> {
  if (existing.deleted_at) {
    return {
      ok: false,
      statusCode: 403,
      code: 'ACCOUNT_DELETED',
      error: 'This account is no longer active. Please contact support.',
    };
  }

  if (String(existing.status || 'active').toLowerCase() === 'suspended') {
    return {
      ok: false,
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
      error: existing.suspended_reason || 'Account suspended. Please contact support.',
    };
  }

  const nowIso = new Date().toISOString();
  const cleanName = typeof input.fullName === 'string' && input.fullName.trim() ? input.fullName.trim() : null;
  const cleanAvatar = typeof input.avatarUrl === 'string' && input.avatarUrl.trim() ? input.avatarUrl.trim() : null;
  const cleanProviderId =
    typeof input.providerUserId === 'string' && input.providerUserId.trim()
      ? input.providerUserId.trim()
      : null;

  const prevProvider = String(existing.auth_provider || '').toLowerCase();
  const linkedIdentity = Boolean(
    input.authProvider === 'google' &&
      ((prevProvider && prevProvider !== 'google') ||
        (cleanProviderId && !existing.provider_user_id))
  );

  const patchData: Record<string, any> = {
    last_login_at: nowIso,
    updated_at: nowIso,
  };

  if (cleanName && cleanName !== existing.full_name) {
    patchData.full_name = cleanName;
  }
  if (cleanAvatar && cleanAvatar !== existing.avatar_url) {
    patchData.avatar_url = cleanAvatar;
  }
  if (input.emailVerified) {
    if (!existing.is_verified) patchData.is_verified = true;
    if (!existing.email_verified) patchData.email_verified = true;
  }
  if (isValidUuid(input.supabaseUserId) && !existing.supabase_user_id) {
    patchData.supabase_user_id = input.supabaseUserId;
  }
  if (cleanProviderId && !existing.provider_user_id) {
    patchData.provider_user_id = cleanProviderId;
  }
  if ((cleanProviderId || input.supabaseUserId) && !existing.external_user_id) {
    patchData.external_user_id = cleanProviderId || input.supabaseUserId;
  }
  // Preserve password_hash/email auth capability if an email account links Google;
  // only backfill auth_provider when missing. Never touch `is_developer` or `role`.
  if (!existing.auth_provider) {
    patchData.auth_provider = input.authProvider;
  }

  const filterCol = existing.id ? 'id' : 'email';
  const filterVal = existing.id ? existing.id : existing.email;

  let updateRes = await supabase
    .from('users_auth')
    .update(patchData)
    .eq(filterCol, filterVal)
    .select()
    .maybeSingle();

  if (updateRes.error && isMissingSyncColumnError(updateRes.error)) {
    const safePatch = omitAdditiveSyncColumns(patchData);
    updateRes = await supabase
      .from('users_auth')
      .update(safePatch)
      .eq(filterCol, filterVal)
      .select()
      .maybeSingle();
  }

  if (updateRes.error) {
    console.error('[UserSync] Failed to update users_auth record:', updateRes.error.message || updateRes.error);
    return {
      ok: false,
      statusCode: 500,
      code: 'USER_SYNC_FAILED',
      error: `Failed to update user record: ${updateRes.error.message || 'Database error'}`,
    };
  }

  const merged = stripPasswordHash(updateRes.data || { ...existing, ...patchData });
  return {
    ok: true,
    isNewUser: false,
    linkedIdentity,
    user: merged,
  };
}

/**
 * Centralized, idempotent user synchronization for `public.users_auth`.
 * - Resolves existing users by Supabase UUID, provider ID, external ID, or email.
 * - Creates missing users with `is_developer = false` and `role = 'user'`.
 * - Updates existing profile metadata safely without overwriting `is_developer` or `role`.
 * - Handles duplicate OAuth callbacks (`23505`) atomically via retry lookup + update.
 * - Never swallows database errors.
 */
export async function syncAuthenticatedUserRecord(
  supabase: any,
  input: SyncUserProfileInput
): Promise<SyncUserResult> {
  if (!supabase) {
    return {
      ok: false,
      statusCode: 500,
      code: 'DB_UNAVAILABLE',
      error: 'Database service client is not configured for user synchronization.',
    };
  }

  const email = normalizeSyncEmail(input.email);
  if (!email) {
    return {
      ok: false,
      statusCode: 400,
      code: 'MISSING_EMAIL',
      error: 'A verified email address is required to synchronize your account.',
    };
  }

  const cleanProviderId =
    typeof input.providerUserId === 'string' && input.providerUserId.trim()
      ? input.providerUserId.trim()
      : null;

  if (input.authProvider === 'google' && !cleanProviderId) {
    return {
      ok: false,
      statusCode: 400,
      code: 'MISSING_PROVIDER_ID',
      error: 'Google provider subject identifier is missing.',
    };
  }

  const lookup = await lookupExistingUsersAuthRow(supabase, {
    supabaseUserId: input.supabaseUserId,
    providerUserId: cleanProviderId,
    email,
  });

  if (lookup.ok === false) {
    console.error('[UserSync] Lookup failed on users_auth:', lookup.error?.message || lookup.error);
    return {
      ok: false,
      statusCode: 500,
      code: 'USER_SYNC_FAILED',
      error: `Failed to query user record: ${lookup.error?.message || 'Database error'}`,
    };
  }

  if (lookup.row) {
    return updateExistingUsersAuthRow(supabase, lookup.row, { ...input, email });
  }

  const nowIso = new Date().toISOString();
  const cleanName =
    typeof input.fullName === 'string' && input.fullName.trim()
      ? input.fullName.trim()
      : email.split('@')[0];
  const cleanAvatar =
    typeof input.avatarUrl === 'string' && input.avatarUrl.trim() ? input.avatarUrl.trim() : null;
  const validSbUuid = isValidUuid(input.supabaseUserId) ? input.supabaseUserId.trim() : null;
  const canonicalId = validSbUuid || generateCanonicalUuid();

  const insertPayload: Record<string, any> = {
    ...(canonicalId ? { id: canonicalId } : {}),
    supabase_user_id: validSbUuid,
    email,
    password_hash: null, // Never generate fake hashes or store OAuth tokens in password_hash
    full_name: cleanName,
    avatar_url: cleanAvatar,
    auth_provider: input.authProvider,
    provider_user_id: cleanProviderId,
    external_user_id: cleanProviderId || validSbUuid || canonicalId || null,
    is_verified: Boolean(input.emailVerified),
    email_verified: Boolean(input.emailVerified),
    role: 'user',
    is_developer: false, // Security: NEVER accept is_developer from OAuth metadata or frontend
    status: 'active',
    is_test: false,
    last_login_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
  };

  let insertRes = await supabase.from('users_auth').insert([insertPayload]).select().maybeSingle();

  if (insertRes.error && isMissingSyncColumnError(insertRes.error)) {
    const compatPayload = omitAdditiveSyncColumns(insertPayload);
    insertRes = await supabase.from('users_auth').insert([compatPayload]).select().maybeSingle();
  }

  // Handle duplicate concurrent callback race condition (`23505` unique violation)
  if (insertRes.error && isUniqueViolationError(insertRes.error)) {
    const retryLookup = await lookupExistingUsersAuthRow(supabase, {
      supabaseUserId: validSbUuid,
      providerUserId: cleanProviderId,
      email,
    });
    if (retryLookup.ok && retryLookup.row) {
      return updateExistingUsersAuthRow(supabase, retryLookup.row, { ...input, email });
    }
  }

  if (insertRes.error || !insertRes.data) {
    if (isPasswordHashNotNullError(insertRes.error)) {
      console.error('[UserSync] Schema error: public.users_auth.password_hash violates NOT NULL constraint.');
      return {
        ok: false,
        statusCode: 500,
        code: 'SCHEMA_MIGRATION_REQUIRED',
        error: 'Database migration required: public.users_auth.password_hash must allow NULL values for OAuth users (apply 20261120_users_auth_password_hash_nullable.sql).',
      };
    }
    const errMsg = insertRes.error?.message || 'Insert returned empty result';
    console.error('[UserSync] Failed to insert users_auth record:', errMsg);
    return {
      ok: false,
      statusCode: 500,
      code: 'USER_SYNC_FAILED',
      error: `Failed to synchronize user record: ${errMsg}`,
    };
  }

  const inserted = stripPasswordHash(insertRes.data);
  await logUserRegisteredActivity(supabase, {
    actorId: inserted?.id ? String(inserted.id) : (validSbUuid || cleanProviderId),
    email,
    provider: input.authProvider,
    supabaseUserId: validSbUuid,
  });

  return {
    ok: true,
    isNewUser: true,
    linkedIdentity: false,
    user: inserted,
  };
}

/**
 * Full Google OAuth -> Supabase Auth -> public.users_auth synchronization pipeline.
 * Ensures a Supabase Auth UUID exists (when Supabase Auth Admin is active),
 * synchronizes `users_auth` atomically, and surfaces all errors explicitly.
 */
export async function syncGoogleOAuthUser(
  supabase: any,
  profile: VerifiedGoogleProfile
): Promise<GoogleSyncWorkflowResult> {
  if (!supabase) {
    return {
      ok: false,
      statusCode: 500,
      code: 'DB_UNAVAILABLE',
      error: 'Database service client is missing. Cannot synchronize Google user.',
    };
  }

  const email = normalizeSyncEmail(profile.email);
  if (!email || !profile.sub) {
    return {
      ok: false,
      statusCode: 400,
      code: 'MISSING_GOOGLE_PROFILE',
      error: 'Google profile is missing required email or subject identifier.',
    };
  }

  const preLookup = await lookupExistingUsersAuthRow(supabase, {
    providerUserId: profile.sub,
    email,
  });
  if (preLookup.ok === false) {
    return {
      ok: false,
      statusCode: 500,
      code: 'USER_SYNC_FAILED',
      error: `Failed to inspect existing user account: ${preLookup.error?.message || 'Database error'}`,
    };
  }

  const authEnsure = await ensureSupabaseAuthUser(supabase, {
    email,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    authProvider: 'google',
    providerUserId: profile.sub,
    emailVerified: profile.emailVerified,
    existingSupabaseUserId: preLookup.row?.supabase_user_id || null,
  });

  if (authEnsure.ok === false) {
    return authEnsure;
  }

  const syncRes = await syncAuthenticatedUserRecord(supabase, {
    supabaseUserId: authEnsure.supabaseUserId,
    email,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    authProvider: 'google',
    providerUserId: profile.sub,
    emailVerified: profile.emailVerified,
  });

  if (syncRes.ok === false) {
    return syncRes;
  }

  const canonicalUserId = String(
    syncRes.user?.id || authEnsure.supabaseUserId || syncRes.user?.external_user_id || profile.sub
  );

  return {
    ok: true,
    isNewUser: syncRes.isNewUser,
    linkedIdentity: syncRes.linkedIdentity,
    canonicalUserId,
    supabaseUserId: syncRes.user?.supabase_user_id || authEnsure.supabaseUserId || null,
    user: syncRes.user,
  };
}

/**
 * Verifies a caller's backend token (either a Supabase Auth access token or an
 * EventFrame session JWT) and synchronizes their `public.users_auth` row.
 * Never trusts frontend-supplied user IDs, roles, or `is_developer` values.
 */
export async function verifyTokenAndSyncUser(
  supabase: any,
  token: string,
  options: {
    verifyInternalJwt: (token: string) => Promise<any> | any;
  }
): Promise<GoogleSyncWorkflowResult> {
  if (!supabase) {
    return {
      ok: false,
      statusCode: 500,
      code: 'DB_UNAVAILABLE',
      error: 'Database service client unavailable.',
    };
  }
  if (!token || !token.trim()) {
    return {
      ok: false,
      statusCode: 401,
      code: 'UNAUTHENTICATED',
      error: 'Authentication token is required.',
    };
  }

  // 1. Try verifying as a Supabase Auth JWT (`supabase.auth.getUser(token)`)
  if (typeof supabase?.auth?.getUser === 'function') {
    try {
      const sbRes = await supabase.auth.getUser(token);
      if (!sbRes?.error && sbRes?.data?.user?.id && sbRes?.data?.user?.email) {
        const sbUser = sbRes.data.user;
        const meta = sbUser.user_metadata || {};
        const appMeta = sbUser.app_metadata || {};
        const googleIdentity = Array.isArray(sbUser.identities)
          ? sbUser.identities.find((i: any) => i?.provider === 'google')
          : null;
        const rawProvider = String(
          googleIdentity ? 'google' : appMeta.provider || meta.provider || 'supabase'
        ).toLowerCase();
        const authProvider: 'google' | 'email' | 'supabase' =
          rawProvider === 'google' ? 'google' : rawProvider === 'email' ? 'email' : 'supabase';

        const providerUserId =
          googleIdentity?.id ||
          googleIdentity?.identity_data?.sub ||
          (typeof meta.sub === 'string' ? meta.sub : null);

        const syncRes = await syncAuthenticatedUserRecord(supabase, {
          supabaseUserId: String(sbUser.id),
          email: normalizeSyncEmail(sbUser.email),
          fullName: String(meta.full_name || meta.name || '').trim() || null,
          avatarUrl: String(meta.avatar_url || meta.picture || '').trim() || null,
          authProvider,
          providerUserId,
          emailVerified: Boolean(sbUser.email_confirmed_at || meta.email_verified),
        });

        if (syncRes.ok === false) return syncRes;

        return {
          ok: true,
          isNewUser: syncRes.isNewUser,
          linkedIdentity: syncRes.linkedIdentity,
          canonicalUserId: String(syncRes.user?.id || sbUser.id),
          supabaseUserId: syncRes.user?.supabase_user_id || String(sbUser.id),
          user: syncRes.user,
        };
      }
    } catch {
      // Fall through to internal EventFrame JWT verification
    }
  }

  // 2. Verify EventFrame-signed HS256 JWT
  let decoded: any = null;
  try {
    decoded = await options.verifyInternalJwt(token);
  } catch {
    decoded = null;
  }

  if (!decoded || !decoded.email) {
    return {
      ok: false,
      statusCode: 401,
      code: 'INVALID_SESSION',
      error: 'Invalid or expired authentication token.',
    };
  }

  const email = normalizeSyncEmail(decoded.email);
  const decodedId = String(decoded.supabaseUserId || decoded.id || decoded.sub || '').trim();
  const providerUserId =
    String(decoded.providerUserId || decoded.sub || (!isValidUuid(decoded.id) ? decoded.id : '') || '').trim() || null;

  const syncRes = await syncAuthenticatedUserRecord(supabase, {
    supabaseUserId: isValidUuid(decodedId) ? decodedId : null,
    email,
    fullName: typeof decoded.name === 'string' ? decoded.name : null,
    avatarUrl: typeof decoded.picture === 'string' ? decoded.picture : null,
    authProvider: providerUserId && !providerUserId.startsWith('email-') ? 'google' : 'email',
    providerUserId: providerUserId && !providerUserId.startsWith('email-') ? providerUserId : null,
    emailVerified: true,
  });

  if (syncRes.ok === false) return syncRes;

  return {
    ok: true,
    isNewUser: syncRes.isNewUser,
    linkedIdentity: syncRes.linkedIdentity,
    canonicalUserId: String(syncRes.user?.id || decodedId || email),
    supabaseUserId: syncRes.user?.supabase_user_id || (isValidUuid(decodedId) ? decodedId : null),
    user: syncRes.user,
  };
}

/**
 * Registers a new email/password account (or prepares verification resend for an
 * existing unverified email signup) while keeping existing verified or Google-linked
 * accounts protected and strictly preserving `is_developer = false` and `role = 'user'`.
 */
export async function registerEmailPasswordUser(
  supabase: any,
  input: {
    email: string;
    password?: string | null;
    fullName?: string | null;
  },
  deps: {
    hashPassword: (password: string) => Promise<string> | string;
  }
): Promise<
  | { ok: true; isNewUser: boolean; user: any }
  | { ok: false; statusCode: number; code: string; error: string }
> {
  if (!supabase) {
    return { ok: false, statusCode: 500, code: 'DB_UNAVAILABLE', error: 'Database client unavailable.' };
  }

  const email = normalizeSyncEmail(input.email);
  if (!email) {
    return { ok: false, statusCode: 400, code: 'MISSING_EMAIL', error: 'Email is required' };
  }

  const lookup = await lookupExistingUsersAuthRow(supabase, { email });
  if (lookup.ok === false) {
    return {
      ok: false,
      statusCode: 500,
      code: 'DB_ERROR',
      error: lookup.error?.message || 'Failed to inspect existing user account.',
    };
  }

  const existingUser = lookup.row;
  if (existingUser) {
    if (existingUser.deleted_at) {
      return {
        ok: false,
        statusCode: 403,
        code: 'ACCOUNT_DELETED',
        error: 'This account is no longer active. Please contact support.',
      };
    }
    if (String(existingUser.status || 'active').toLowerCase() === 'suspended') {
      return {
        ok: false,
        statusCode: 403,
        code: 'ACCOUNT_SUSPENDED',
        error: existingUser.suspended_reason || 'Account suspended. Please contact support.',
      };
    }
    if (existingUser.is_verified) {
      if (!existingUser.password_hash) {
        return {
          ok: false,
          statusCode: 400,
          code: 'OAUTH_ACCOUNT_EXISTS',
          error: 'An account with this email already exists via Google Sign-In. Please continue with Google or use Forgot Password to set a password.',
        };
      }
      return {
        ok: false,
        statusCode: 400,
        code: 'ACCOUNT_EXISTS',
        error: 'User already exists and is verified. Please log in.',
      };
    }
    // Existing unverified signup: reuse cleanly without clearing existing hash/role/permissions
    return { ok: true, isNewUser: false, user: stripPasswordHash(existingUser) };
  }

  const rawPassword = typeof input.password === 'string' ? input.password : '';
  if (!rawPassword) {
    return { ok: false, statusCode: 400, code: 'MISSING_PASSWORD', error: 'Password is required' };
  }

  const passwordHash = await deps.hashPassword(rawPassword);
  const nowIso = new Date().toISOString();
  const cleanName =
    typeof input.fullName === 'string' && input.fullName.trim()
      ? input.fullName.trim()
      : email.split('@')[0];

  const authEnsure = await ensureSupabaseAuthUser(supabase, {
    email,
    fullName: cleanName,
    authProvider: 'email',
    emailVerified: false,
  });

  const validSbUuid = authEnsure.ok && isValidUuid(authEnsure.supabaseUserId) ? authEnsure.supabaseUserId : null;
  const canonicalId = validSbUuid || generateCanonicalUuid();

  const insertPayload: Record<string, any> = {
    ...(canonicalId ? { id: canonicalId } : {}),
    supabase_user_id: validSbUuid,
    email,
    full_name: cleanName,
    password_hash: passwordHash,
    is_verified: false,
    email_verified: false,
    role: 'user',
    is_developer: false, // Security: NEVER accept is_developer from signup payload
    status: 'active',
    is_test: false,
    auth_provider: 'email',
    external_user_id: validSbUuid || canonicalId || null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  let insertRes = await supabase.from('users_auth').insert([insertPayload]).select().maybeSingle();
  if (insertRes.error && isMissingSyncColumnError(insertRes.error)) {
    insertRes = await supabase.from('users_auth').insert([omitAdditiveSyncColumns(insertPayload)]).select().maybeSingle();
  }

  if (insertRes.error && isUniqueViolationError(insertRes.error)) {
    return {
      ok: false,
      statusCode: 400,
      code: 'ACCOUNT_EXISTS',
      error: 'User already exists. Please log in.',
    };
  }

  if (insertRes.error || !insertRes.data) {
    return {
      ok: false,
      statusCode: 500,
      code: 'SIGNUP_FAILED',
      error: insertRes.error?.message || 'Failed to register email account.',
    };
  }

  await logUserRegisteredActivity(supabase, {
    actorId: insertRes.data?.id ? String(insertRes.data.id) : (validSbUuid || email),
    email,
    provider: 'email',
    supabaseUserId: validSbUuid,
  });

  return {
    ok: true,
    isNewUser: true,
    user: stripPasswordHash(insertRes.data),
  };
}

/**
 * Authenticates an email/password account against `public.users_auth.password_hash`.
 * Preserves existing password hashes, rejects Google-only null-password accounts cleanly
 * (HTTP 400 instead of 500 crash), and blocks suspended/deleted accounts.
 */
export async function authenticateEmailPasswordUser(
  supabase: any,
  input: {
    email: string;
    password?: string | null;
  },
  deps: {
    verifyPassword: (password: string, storedHash: string) => Promise<boolean> | boolean;
  }
): Promise<
  | { ok: true; user: any }
  | { ok: false; statusCode: number; code: string; error: string }
> {
  if (!supabase) {
    return { ok: false, statusCode: 500, code: 'DB_UNAVAILABLE', error: 'Database client unavailable.' };
  }

  const email = normalizeSyncEmail(input.email);
  if (!email) {
    return { ok: false, statusCode: 400, code: 'MISSING_EMAIL', error: 'Email is required' };
  }

  const lookup = await lookupExistingUsersAuthRow(supabase, { email });
  if (lookup.ok === false) {
    return {
      ok: false,
      statusCode: 500,
      code: 'DB_ERROR',
      error: lookup.error?.message || 'Failed to query account.',
    };
  }

  const existingUser = lookup.row;
  if (!existingUser || existingUser.deleted_at) {
    return { ok: false, statusCode: 404, code: 'ACCOUNT_NOT_FOUND', error: 'Account not found' };
  }

  if (String(existingUser.status || 'active').toLowerCase() === 'suspended') {
    return {
      ok: false,
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
      error: existingUser.suspended_reason || 'Account suspended. Please contact support.',
    };
  }

  const rawPassword = typeof input.password === 'string' ? input.password : '';
  if (!rawPassword) {
    return { ok: false, statusCode: 400, code: 'MISSING_PASSWORD', error: 'Password is required' };
  }

  if (!existingUser.password_hash || typeof existingUser.password_hash !== 'string' || !existingUser.password_hash.includes(':')) {
    return {
      ok: false,
      statusCode: 400,
      code: 'PASSWORD_NOT_SET',
      error: 'This account uses Google Sign-In and has no password set. Please continue with Google or reset your password.',
    };
  }

  const isValid = await deps.verifyPassword(rawPassword, existingUser.password_hash);
  if (!isValid) {
    return { ok: false, statusCode: 401, code: 'INVALID_PASSWORD', error: 'Invalid password' };
  }

  return {
    ok: true,
    user: stripPasswordHash(existingUser),
  };
}

/**
 * Completes email magic-link verification / login and preserves canonical UUID identity,
 * role, `is_developer`, and `password_hash`.
 */
export async function verifyEmailAccountTokenUser(
  supabase: any,
  rawEmail: string
): Promise<
  | { ok: true; canonicalUserId: string; supabaseUserId: string | null; user: any }
  | { ok: false; statusCode: number; code: string; error: string }
> {
  if (!supabase) {
    return { ok: false, statusCode: 500, code: 'DB_UNAVAILABLE', error: 'Database client unavailable.' };
  }

  const email = normalizeSyncEmail(rawEmail);
  if (!email) {
    return { ok: false, statusCode: 400, code: 'MISSING_EMAIL', error: 'Invalid verification email.' };
  }

  const lookup = await lookupExistingUsersAuthRow(supabase, { email });
  if (lookup.ok === false) {
    return {
      ok: false,
      statusCode: 500,
      code: 'DB_ERROR',
      error: lookup.error?.message || 'Failed to look up user during verification.',
    };
  }

  const existing = lookup.row;
  if (existing?.deleted_at) {
    return {
      ok: false,
      statusCode: 403,
      code: 'ACCOUNT_DELETED',
      error: 'This account is no longer active. Please contact support.',
    };
  }
  if (existing && String(existing.status || 'active').toLowerCase() === 'suspended') {
    return {
      ok: false,
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
      error: existing.suspended_reason || 'Account suspended. Please contact support.',
    };
  }

  const nowIso = new Date().toISOString();
  if (existing) {
    const patch: Record<string, any> = {
      is_verified: true,
      email_verified: true,
      last_login_at: nowIso,
      updated_at: nowIso,
    };
    const filterCol = existing.id ? 'id' : 'email';
    const filterVal = existing.id ? existing.id : existing.email;

    let patchRes = await supabase
      .from('users_auth')
      .update(patch)
      .eq(filterCol, filterVal)
      .select()
      .maybeSingle();

    if (patchRes.error && isMissingSyncColumnError(patchRes.error)) {
      patchRes = await supabase
        .from('users_auth')
        .update({ is_verified: true, last_login_at: nowIso })
        .eq(filterCol, filterVal)
        .select()
        .maybeSingle();
    }

    if (patchRes.error) {
      return {
        ok: false,
        statusCode: 500,
        code: 'VERIFY_UPDATE_FAILED',
        error: patchRes.error.message || 'Failed to verify account.',
      };
    }

    const updated = stripPasswordHash(patchRes.data || { ...existing, ...patch });
    const supabaseUserId = updated?.supabase_user_id || (isValidUuid(updated?.id) ? updated.id : null);
    const canonicalUserId = String(updated?.id || supabaseUserId || existing.external_user_id || email);
    return { ok: true, canonicalUserId, supabaseUserId, user: updated };
  }

  // Fallback for unexpected verified link where row was removed
  const syncFallback = await syncAuthenticatedUserRecord(supabase, {
    email,
    authProvider: 'email',
    emailVerified: true,
  });
  if (syncFallback.ok === false) return syncFallback;
  const supabaseUserId = syncFallback.user?.supabase_user_id || (isValidUuid(syncFallback.user?.id) ? syncFallback.user.id : null);
  const canonicalUserId = String(syncFallback.user?.id || supabaseUserId || email);
  return { ok: true, canonicalUserId, supabaseUserId, user: syncFallback.user };
}

/**
 * Updates `password_hash` on password reset without altering `role`, `is_developer`,
 * `organization_id`, or `supabase_user_id`.
 */
export async function resetUserPasswordWithHash(
  supabase: any,
  input: {
    email: string;
    password: string;
  },
  deps: {
    hashPassword: (password: string) => Promise<string> | string;
  }
): Promise<{ ok: true } | { ok: false; statusCode: number; code: string; error: string }> {
  if (!supabase) {
    return { ok: false, statusCode: 500, code: 'DB_UNAVAILABLE', error: 'Database client unavailable.' };
  }

  const email = normalizeSyncEmail(input.email);
  if (!email || !input.password) {
    return { ok: false, statusCode: 400, code: 'INVALID_INPUT', error: 'Email and password are required.' };
  }

  const lookup = await lookupExistingUsersAuthRow(supabase, { email });
  if (lookup.ok === false) {
    return { ok: false, statusCode: 500, code: 'DB_ERROR', error: lookup.error?.message || 'Failed to find user.' };
  }
  if (!lookup.row || lookup.row.deleted_at) {
    return { ok: false, statusCode: 404, code: 'ACCOUNT_NOT_FOUND', error: 'Account not found.' };
  }
  if (String(lookup.row.status || 'active').toLowerCase() === 'suspended') {
    return { ok: false, statusCode: 403, code: 'ACCOUNT_SUSPENDED', error: 'Account suspended. Please contact support.' };
  }

  const passwordHash = await deps.hashPassword(input.password);
  const nowIso = new Date().toISOString();
  const filterCol = lookup.row.id ? 'id' : 'email';
  const filterVal = lookup.row.id ? lookup.row.id : lookup.row.email;

  let updateRes = await supabase
    .from('users_auth')
    .update({ password_hash: passwordHash, updated_at: nowIso })
    .eq(filterCol, filterVal);

  if (updateRes.error && isMissingSyncColumnError(updateRes.error)) {
    updateRes = await supabase
      .from('users_auth')
      .update({ password_hash: passwordHash })
      .eq(filterCol, filterVal);
  }

  if (updateRes.error) {
    return { ok: false, statusCode: 500, code: 'PASSWORD_RESET_FAILED', error: updateRes.error.message || 'Failed to update password.' };
  }

  return { ok: true };
}

