import {
  isValidUuid,
  syncAuthenticatedUserRecord,
  type SyncUserResult,
} from './userSyncService';

export type PlatformUserRole = 'user' | 'agency_owner' | 'agency_member' | 'super_admin';
export type AccountStatus = 'active' | 'suspended';

export interface SanitizedUserRecord {
  id: string;
  externalUserId: string | null;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  authProvider: string;
  role: PlatformUserRole;
  status: AccountStatus;
  isVerified: boolean;
  isDeveloper: boolean;
  organizationCount: number;
  organizationIds: string[];
  organizationNames: string[];
  eventCount: number;
  createdAt: string;
  lastLoginAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  isTest: boolean;
  inferredFromAgency?: boolean;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  userRole: string;
  status: 'active' | 'suspended' | 'inactive';
  ownerUserId: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  memberCount: number;
  eventCount: number;
  activeEventCount: number;
  expiredEventCount: number;
  totalRevenueCents: number;
  totalRevenueUsd: number;
  isDemo: boolean;
  isTest: boolean;
  createdAt: string;
}

export interface PlatformEventSummary {
  id: string;
  name: string;
  slug: string;
  groomName: string;
  brideName: string;
  coupleNames: string;
  weddingDate: string | null;
  location: string | null;
  organizationId: string | null;
  organizationName: string;
  organizationSlug: string | null;
  status: string;
  lifecycleStatus: 'active' | 'expired' | 'pending_payment' | 'draft' | 'failed' | 'cancelled';
  paymentStatus: string;
  websiteStatus: string;
  hasAccessPassword: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
  isTest: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface PlatformPaymentRecord {
  id: string;
  transactionId: string;
  orderId: string | null;
  orderType: string | null;
  organizationId: string | null;
  organizationName: string;
  customerId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  eventId: string | null;
  eventName: string;
  eventSlug: string | null;
  amountCents: number;
  amountUsd: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded' | 'partially_refunded' | 'cancelled';
  provider: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeRefundId: string | null;
  refundStatus: 'none' | 'partial' | 'full';
  refundAmountCents: number;
  refundedAt: string | null;
  webhookEventId: string | null;
  webhookStatus: string | null;
  webhookErrorDetails: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
  isTest: boolean;
}

export interface ActivityLogRecord {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  organizationId: string | null;
  targetUserId: string | null;
  targetEventId: string | null;
  referenceId: string | null;
  summary: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface RegistrationAnalyticsBucket {
  key: string;
  label: string;
  users: number;
  organizations: number;
}

export interface RegistrationAnalyticsResult {
  daily: RegistrationAnalyticsBucket[];
  weekly: RegistrationAnalyticsBucket[];
  monthly: RegistrationAnalyticsBucket[];
  summary: {
    usersToday: number;
    usersThisWeek: number;
    usersThisMonth: number;
    usersLast30Days: number;
    orgsThisMonth: number;
    orgsPreviousMonth: number;
    userGrowthPct: number | null;
    orgGrowthPct: number | null;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PlatformSettingsMap {
  platform_name: string;
  support_email: string;
  allow_public_registration: boolean;
  maintenance_mode: boolean;
  default_event_price_usd: number;
  default_event_duration_months: number;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsMap = {
  platform_name: 'EventFrame.io',
  support_email: 'support@eventframe.io',
  allow_public_registration: true,
  maintenance_mode: false,
  default_event_price_usd: 5,
  default_event_duration_months: 12,
};

// ============================================================================
// Pure Utilities & Security Helpers
// ============================================================================

export function parseSuperAdminEmails(raw?: string | null): Set<string> {
  if (!raw || typeof raw !== 'string') return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function deriveEmailUserId(email: string): string {
  const normalized = (email || '').trim().toLowerCase();
  let encoded = '';
  if (typeof btoa === 'function') {
    encoded = btoa(normalized);
  } else if (typeof Buffer !== 'undefined') {
    encoded = Buffer.from(normalized, 'utf8').toString('base64');
  }
  return `email-${encoded.slice(0, 12)}`;
}

export function stripSensitiveUserFields<T extends Record<string, any>>(row: T | null | undefined): Omit<T, 'password_hash'> | null {
  if (!row || typeof row !== 'object') return null;
  const { password_hash: _ignored, ...rest } = row;
  return rest;
}

export function isGenuineOrganization(org: any): boolean {
  if (!org) return false;
  if (org.deleted_at) return false;
  if (org.is_test === true) return false;
  if (org.is_demo === true) return false;
  return true;
}

export function isGenuineUser(user: any): boolean {
  if (!user) return false;
  if (user.deleted_at) return false;
  if (user.is_test === true) return false;
  return true;
}

export function isGenuineEvent(event: any, orgMap?: Map<string, any>): boolean {
  if (!event) return false;
  if (event.deleted_at) return false;
  if (event.is_test === true) return false;
  if (event.agency_id && orgMap && orgMap.has(event.agency_id)) {
    const parentOrg = orgMap.get(event.agency_id);
    if (!isGenuineOrganization(parentOrg)) return false;
  }
  return true;
}

function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function computeEventLifecycleStatus(event: any, nowMs: number): PlatformEventSummary['lifecycleStatus'] {
  const paymentStatus = String(event.payment_status || 'unpaid').toLowerCase();
  const status = String(event.status || 'draft').toLowerCase();
  const expiresAtMs = event.expires_at ? new Date(event.expires_at).getTime() : null;

  if (paymentStatus === 'paid') {
    if (expiresAtMs && !Number.isNaN(expiresAtMs) && expiresAtMs <= nowMs) {
      return 'expired';
    }
    return 'active';
  }
  if (paymentStatus === 'pending_payment' || status === 'pending_payment') {
    return 'pending_payment';
  }
  if (paymentStatus === 'failed') return 'failed';
  if (paymentStatus === 'cancelled') return 'cancelled';
  if (status === 'active') {
    if (expiresAtMs && !Number.isNaN(expiresAtMs) && expiresAtMs <= nowMs) {
      return 'expired';
    }
    return 'active';
  }
  return 'draft';
}

// ============================================================================
// Safe Supabase Access Helpers
// ============================================================================

async function safeFetchTable(supabase: any, table: string, orderBy?: string): Promise<any[]> {
  if (!supabase) return [];
  try {
    let query = supabase.from(table).select('*');
    if (orderBy) {
      query = query.order(orderBy, { ascending: false });
    }
    const { data, error } = await query;
    if (error) {
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function findDbUserForIdentity(
  supabase: any,
  identity: {
    id?: string | null;
    sub?: string | null;
    dbUserId?: string | null;
    supabaseUserId?: string | null;
    externalUserId?: string | null;
    providerUserId?: string | null;
    email?: string | null;
  }
): Promise<any | null> {
  if (!supabase) return null;
  const email = normalizeEmail(identity.email);
  const candidateIds = Array.from(
    new Set(
      [
        identity.dbUserId,
        identity.id,
        identity.sub,
        identity.supabaseUserId,
        identity.externalUserId,
        identity.providerUserId,
      ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    )
  );

  try {
    if (email) {
      const { data: byEmail, error: emailErr } = await supabase
        .from('users_auth')
        .select('*')
        .ilike('email', email)
        .maybeSingle();
      if (!emailErr && byEmail) {
        return stripSensitiveUserFields(byEmail);
      }
      // Fallback exact match if fake/test client lacks ilike
      const { data: exactRows } = await supabase
        .from('users_auth')
        .select('*')
        .eq('email', email);
      if (Array.isArray(exactRows) && exactRows.length > 0) {
        return stripSensitiveUserFields(exactRows[0]);
      }
    }

    for (const cid of candidateIds) {
      if (isValidUuid(cid)) {
        const { data: bySbId, error: sbErr } = await supabase
          .from('users_auth')
          .select('*')
          .eq('supabase_user_id', cid)
          .maybeSingle();
        if (!sbErr && bySbId) return stripSensitiveUserFields(bySbId);
      }

      const { data: byProv, error: provErr } = await supabase
        .from('users_auth')
        .select('*')
        .eq('provider_user_id', cid)
        .maybeSingle();
      if (!provErr && byProv) return stripSensitiveUserFields(byProv);

      const { data: byExt } = await supabase
        .from('users_auth')
        .select('*')
        .eq('external_user_id', cid)
        .maybeSingle();
      if (byExt) return stripSensitiveUserFields(byExt);

      const { data: byId } = await supabase
        .from('users_auth')
        .select('*')
        .eq('id', cid)
        .maybeSingle();
      if (byId) return stripSensitiveUserFields(byId);
    }
  } catch {
    // Graceful fallback if table/columns missing
  }
  return null;
}

// ============================================================================
// Authoritative Server-Side Auth, Role Verification & Account Suspension
// ============================================================================

export function resolveDbUserIsDeveloper(dbUser: any): boolean {
  if (!dbUser || typeof dbUser !== 'object') return false;
  if (dbUser.deleted_at) return false;
  if (typeof dbUser.is_developer === 'boolean') {
    return dbUser.is_developer === true;
  }
  // Pre-migration fallback ONLY when `is_developer` column is absent in a legacy fixture
  if (dbUser.is_developer === undefined) {
    return String(dbUser.role || '').toLowerCase() === 'super_admin';
  }
  return false;
}

export async function isDeveloper(
  supabase: any,
  identityOrUserId: string | { id?: string | null; sub?: string | null; email?: string | null } | null | undefined
): Promise<boolean> {
  if (!supabase || !identityOrUserId) return false;
  const identity =
    typeof identityOrUserId === 'string'
      ? identityOrUserId.includes('@')
        ? { email: identityOrUserId }
        : { id: identityOrUserId, sub: identityOrUserId }
      : identityOrUserId;

  const dbUser = await findDbUserForIdentity(supabase, identity);
  if (!dbUser) return false;
  if (String(dbUser.status || 'active').toLowerCase() === 'suspended') return false;
  return resolveDbUserIsDeveloper(dbUser);
}

export async function resolveAuthenticatedSessionUser(
  supabase: any,
  decodedToken: any,
  _superAdminEmailsRaw?: string | null,
  options?: { ensureUserRecord?: boolean }
): Promise<
  | { ok: true; user: any }
  | { ok: false; statusCode: number; error: string; code: string; suspendedReason?: string | null }
> {
  if (!decodedToken || (!decodedToken.email && !decodedToken.id && !decodedToken.sub)) {
    return { ok: false, statusCode: 401, error: 'Not authenticated', code: 'UNAUTHENTICATED' };
  }

  const email = normalizeEmail(decodedToken.email);
  const rawTokenId = String(decodedToken.id || decodedToken.sub || '');
  const userId = String(rawTokenId || (email ? deriveEmailUserId(email) : ''));

  let dbUser = await findDbUserForIdentity(supabase, {
    id: decodedToken.supabaseUserId || decodedToken.id,
    sub: decodedToken.sub,
    dbUserId: decodedToken.dbUserId,
    supabaseUserId: decodedToken.supabaseUserId,
    externalUserId: decodedToken.externalUserId,
    providerUserId: decodedToken.providerUserId,
    email: decodedToken.email,
  });

  if (!dbUser && options?.ensureUserRecord && supabase && email) {
    const providerHint = String(decodedToken.authProvider || '').toLowerCase();
    const providerUserId =
      typeof decodedToken.providerUserId === 'string' && decodedToken.providerUserId.trim()
        ? decodedToken.providerUserId.trim()
        : typeof decodedToken.sub === 'string' && !isValidUuid(decodedToken.sub) && !decodedToken.sub.startsWith('email-')
          ? decodedToken.sub
          : null;
    const inferredProvider: 'google' | 'email' | 'supabase' =
      providerHint === 'google' || providerUserId ? 'google' : 'email';

    const syncAttempt = await syncAuthenticatedUserRecord(supabase, {
      supabaseUserId: isValidUuid(decodedToken.supabaseUserId)
        ? decodedToken.supabaseUserId
        : isValidUuid(rawTokenId)
          ? rawTokenId
          : null,
      email,
      fullName: typeof decodedToken.name === 'string' ? decodedToken.name : null,
      avatarUrl: typeof decodedToken.picture === 'string' ? decodedToken.picture : null,
      authProvider: inferredProvider,
      providerUserId,
      emailVerified: true,
    });

    if (syncAttempt.ok === false) {
      return {
        ok: false,
        statusCode: syncAttempt.statusCode,
        error: syncAttempt.error,
        code: syncAttempt.code,
      };
    }

    dbUser = syncAttempt.user;
  }

  // Strict server-side suspension enforcement
  if (dbUser && String(dbUser.status || 'active').toLowerCase() === 'suspended') {
    return {
      ok: false,
      statusCode: 403,
      error: 'Your account has been suspended. Please contact platform support.',
      code: 'ACCOUNT_SUSPENDED',
      suspendedReason: dbUser.suspended_reason || null,
    };
  }

  const userIsDeveloper = resolveDbUserIsDeveloper(dbUser);

  let resolvedRole: PlatformUserRole = 'user';
  const dbRole = String(dbUser?.role || '').toLowerCase();

  if (dbRole === 'agency_owner' || dbRole === 'agency_member') {
    resolvedRole = dbRole as PlatformUserRole;
  } else if (dbRole === 'super_admin' && userIsDeveloper) {
    resolvedRole = 'super_admin';
  } else if (supabase && (userId || email)) {
    try {
      const { data: ownedAgency } = await supabase
        .from('agencies')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (ownedAgency) {
        resolvedRole = 'agency_owner';
      } else if (email) {
        const { data: byEmailAgency } = await supabase
          .from('agencies')
          .select('id')
          .ilike('owner_email', email)
          .limit(1)
          .maybeSingle();
        if (byEmailAgency) {
          resolvedRole = 'agency_owner';
        }
      }
    } catch {
      // Ignore agency lookup failure
    }
  }

  const resolvedName =
    dbUser?.full_name ||
    decodedToken.name ||
    (email ? email.split('@')[0] : 'EventFrame User');

  const resolvedAvatar = dbUser?.avatar_url || decodedToken.picture || null;

  return {
    ok: true,
    user: {
      ...decodedToken,
      id: userId,
      sub: decodedToken.sub || userId,
      email: dbUser?.email || decodedToken.email || '',
      name: resolvedName,
      full_name: resolvedName,
      picture: resolvedAvatar,
      avatarUrl: resolvedAvatar,
      role: resolvedRole,
      is_developer: userIsDeveloper,
      isDeveloper: userIsDeveloper,
      status: 'active' as AccountStatus,
      dbUserId: dbUser?.id ? String(dbUser.id) : null,
      supabaseUserId: dbUser?.supabase_user_id ? String(dbUser.supabase_user_id) : null,
      externalUserId: dbUser?.external_user_id ? String(dbUser.external_user_id) : null,
      providerUserId: dbUser?.provider_user_id ? String(dbUser.provider_user_id) : null,
      organizationId: dbUser?.organization_id ? String(dbUser.organization_id) : null,
      authProvider: dbUser?.auth_provider || null,
      emailVerified: Boolean(dbUser?.email_verified ?? dbUser?.is_verified),
    },
  };
}

export async function requireDeveloper(
  supabase: any,
  decodedToken: any
): Promise<
  | { ok: true; admin: any }
  | { ok: false; statusCode: number; error: string; code: string }
> {
  const sessionCheck = await resolveAuthenticatedSessionUser(supabase, decodedToken);
  if (sessionCheck.ok === false) {
    return {
      ok: false,
      statusCode: sessionCheck.statusCode,
      error: sessionCheck.error,
      code: sessionCheck.code,
    };
  }

  if (sessionCheck.user.is_developer !== true) {
    return {
      ok: false,
      statusCode: 403,
      error: 'Forbidden: Developer authorization (is_developer) is required to access developer administration.',
      code: 'FORBIDDEN_DEVELOPER_ONLY',
    };
  }

  return { ok: true, admin: sessionCheck.user };
}

export async function requireSuperAdminSession(
  supabase: any,
  decodedToken: any,
  _superAdminEmailsRaw?: string | null
): Promise<
  | { ok: true; admin: any }
  | { ok: false; statusCode: number; error: string; code: string }
> {
  return requireDeveloper(supabase, decodedToken);
}

export async function syncUserOnLogin(
  supabase: any,
  params: {
    supabaseUserId?: string | null;
    externalUserId?: string | null;
    email: string;
    name?: string | null;
    picture?: string | null;
    provider: 'google' | 'email';
    emailVerified?: boolean;
  }
): Promise<
  | { allowed: true; isNewUser: boolean; linkedIdentity?: boolean; user: any | null }
  | { allowed: false; reason: string; code?: string; statusCode?: number }
> {
  const result: SyncUserResult = await syncAuthenticatedUserRecord(supabase, {
    supabaseUserId: params.supabaseUserId || null,
    email: params.email,
    fullName: params.name,
    avatarUrl: params.picture,
    authProvider: params.provider,
    providerUserId: params.externalUserId || null,
    emailVerified: params.emailVerified ?? params.provider === 'google',
  });

  if (result.ok === false) {
    return {
      allowed: false,
      reason: result.error,
      code: result.code,
      statusCode: result.statusCode,
    };
  }

  return {
    allowed: true,
    isNewUser: result.isNewUser,
    linkedIdentity: result.linkedIdentity,
    user: result.user,
  };
}

export async function recordPlatformActivity(
  supabase: any,
  entry: {
    actorId?: string | null;
    actorEmail?: string | null;
    actorRole?: string | null;
    action: string;
    organizationId?: string | null;
    targetUserId?: string | null;
    targetEventId?: string | null;
    referenceId?: string | null;
    summary?: string | null;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  if (!supabase || !entry.action) return;
  try {
    await supabase.from('platform_activity_logs').insert([
      {
        actor_id: entry.actorId || null,
        actor_email: entry.actorEmail || null,
        actor_role: entry.actorRole || null,
        action: entry.action,
        organization_id: entry.organizationId || null,
        target_user_id: entry.targetUserId || null,
        target_event_id: entry.targetEventId || null,
        reference_id: entry.referenceId || null,
        summary: entry.summary || null,
        metadata: entry.metadata || {},
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (err: any) {
    console.warn('[DeveloperAudit] Activity log skipped:', err?.message || err);
  }
}

// ============================================================================
// Pure Payment & Analytics Computation Engines (Thoroughly Unit-Tested)
// ============================================================================

export function computePaymentLedgerAndMetrics(
  rawPayments: any[],
  rawOrders: any[],
  rawProjects: any[],
  rawAgencies: any[],
  rawUsers: any[] = [],
  rawWebhooks: any[] = []
): {
  records: PlatformPaymentRecord[];
  summary: {
    totalRevenueCents: number;
    totalRevenueUsd: number;
    completedCount: number;
    pendingCount: number;
    failedCount: number;
    refundedCount: number;
    partiallyRefundedCount: number;
    cancelledCount: number;
    refundedAmountCents: number;
  };
} {
  const projectMap = new Map<string, any>();
  for (const p of rawProjects || []) {
    if (p?.id) projectMap.set(String(p.id), p);
  }

  const agencyMap = new Map<string, any>();
  for (const a of rawAgencies || []) {
    if (a?.id) agencyMap.set(String(a.id), a);
  }

  const orderMap = new Map<string, any>();
  for (const o of rawOrders || []) {
    if (o?.id) orderMap.set(String(o.id), o);
  }

  const userMap = new Map<string, any>();
  for (const u of rawUsers || []) {
    if (u?.id) userMap.set(String(u.id), u);
    if (u?.external_user_id) userMap.set(String(u.external_user_id), u);
    if (u?.email) userMap.set(normalizeEmail(u.email), u);
  }

  const webhookById = new Map<string, any>();
  const latestWebhookByOrder = new Map<string, any>();
  for (const w of rawWebhooks || []) {
    if (w?.id) webhookById.set(String(w.id), w);
    if (w?.related_order_id && !latestWebhookByOrder.has(String(w.related_order_id))) {
      latestWebhookByOrder.set(String(w.related_order_id), w);
    }
  }

  const records: PlatformPaymentRecord[] = [];
  const coveredOrderIds = new Set<string>();
  const coveredTxIds = new Set<string>();

  const normalizePayStatus = (
    rawStatus: unknown,
    rawRefundStatus?: unknown,
    linkedProject?: any
  ): PlatformPaymentRecord['status'] => {
    const s = String(rawStatus || 'pending').toLowerCase();
    const rs = String(rawRefundStatus || '').toLowerCase();
    if (s === 'refunded' || rs === 'full' || (linkedProject && String(linkedProject.payment_status || '').toLowerCase() === 'refunded' && s !== 'failed' && rs !== 'partial')) {
      return 'refunded';
    }
    if (s === 'partially_refunded' || rs === 'partial') {
      return 'partially_refunded';
    }
    if (s === 'succeeded' || s === 'paid' || s === 'completed') return 'succeeded';
    if (s === 'failed' || s === 'checkout_failed') return 'failed';
    if (s === 'cancelled' || s === 'canceled') return 'cancelled';
    return 'pending';
  };

  for (const pay of rawPayments || []) {
    const project = pay.event_id ? projectMap.get(String(pay.event_id)) : null;
    const order = pay.order_id ? orderMap.get(String(pay.order_id)) : null;
    const orgId = pay.agency_id || order?.agency_id || project?.agency_id || null;
    const agency = orgId ? agencyMap.get(String(orgId)) : null;

    if (pay.order_id) coveredOrderIds.add(String(pay.order_id));
    if (pay.provider_transaction_id) coveredTxIds.add(String(pay.provider_transaction_id));
    if (pay.stripe_checkout_session_id) coveredTxIds.add(String(pay.stripe_checkout_session_id));
    if (pay.stripe_payment_intent_id) coveredTxIds.add(String(pay.stripe_payment_intent_id));

    const status = normalizePayStatus(pay.payment_status, pay.refund_status, project);
    const amountCents = Number.isFinite(Number(pay.amount)) ? Number(pay.amount) : 0;
    const rawRefundCents = Number.isFinite(Number(pay.refund_amount)) ? Number(pay.refund_amount) : 0;
    const refundAmountCents = status === 'refunded' && rawRefundCents === 0 ? amountCents : rawRefundCents;
    const refundStatus: 'none' | 'partial' | 'full' =
      status === 'refunded'
        ? 'full'
        : status === 'partially_refunded'
          ? 'partial'
          : (pay.refund_status === 'full' || pay.refund_status === 'partial' ? pay.refund_status : 'none');

    const custId = pay.customer_id || order?.customer_id || null;
    const matchedCustomer = custId ? userMap.get(String(custId)) || userMap.get(normalizeEmail(custId)) : null;
    const wh =
      (pay.webhook_event_id && webhookById.get(String(pay.webhook_event_id))) ||
      (order?.last_webhook_event_id && webhookById.get(String(order.last_webhook_event_id))) ||
      (pay.order_id && latestWebhookByOrder.get(String(pay.order_id))) ||
      null;

    const stripeSessionId =
      pay.stripe_checkout_session_id ||
      order?.stripe_session_id ||
      (String(pay.provider_transaction_id || '').startsWith('cs_') ? String(pay.provider_transaction_id) : null);
    const stripePaymentIntentId =
      pay.stripe_payment_intent_id ||
      order?.stripe_payment_intent_id ||
      (String(pay.provider_transaction_id || '').startsWith('pi_') ? String(pay.provider_transaction_id) : null);

    const isTest = Boolean(
      pay.is_test === true ||
      project?.is_test === true ||
      (agency && !isGenuineOrganization(agency)) ||
      pay.provider === 'test_suite' ||
      pay.provider === 'mock'
    );

    records.push({
      id: String(pay.id || pay.provider_transaction_id || `pay_${records.length}`),
      transactionId: String(pay.provider_transaction_id || stripePaymentIntentId || stripeSessionId || pay.id || ''),
      orderId: pay.order_id ? String(pay.order_id) : null,
      orderType: order?.order_type ? String(order.order_type) : null,
      organizationId: orgId ? String(orgId) : null,
      organizationName: agency?.name || (orgId ? `Organization ${String(orgId).slice(0, 8)}` : 'Unknown Organization'),
      customerId: custId ? String(custId) : null,
      customerEmail: matchedCustomer?.email || agency?.owner_email || null,
      customerName: matchedCustomer?.full_name || null,
      eventId: pay.event_id ? String(pay.event_id) : null,
      eventName: project?.name || (pay.event_id ? `Event ${String(pay.event_id).slice(0, 8)}` : 'Unknown Event'),
      eventSlug: project?.slug || null,
      amountCents,
      amountUsd: Number((amountCents / 100).toFixed(2)),
      currency: String(pay.currency || 'usd').toUpperCase(),
      status,
      provider: String(pay.provider || 'stripe'),
      stripeSessionId,
      stripePaymentIntentId,
      stripeChargeId: pay.stripe_charge_id ? String(pay.stripe_charge_id) : null,
      stripeRefundId: pay.stripe_refund_id ? String(pay.stripe_refund_id) : null,
      refundStatus,
      refundAmountCents,
      refundedAt: pay.refunded_at || order?.refunded_at || null,
      webhookEventId: wh?.id || pay.webhook_event_id || order?.last_webhook_event_id || null,
      webhookStatus: wh?.processing_status || pay.webhook_status || order?.webhook_status || null,
      webhookErrorDetails: wh?.error_details || null,
      failureReason: pay.failure_message || order?.failure_reason || null,
      paidAt: pay.paid_at || null,
      createdAt: pay.created_at || pay.paid_at || new Date().toISOString(),
      isTest,
    });
  }

  for (const ord of rawOrders || []) {
    const ordId = String(ord.id || '');
    const txId = ord.stripe_session_id ? String(ord.stripe_session_id) : '';
    const piId = ord.stripe_payment_intent_id ? String(ord.stripe_payment_intent_id) : '';
    if ((ordId && coveredOrderIds.has(ordId)) || (txId && coveredTxIds.has(txId)) || (piId && coveredTxIds.has(piId))) {
      continue;
    }

    const project = ord.event_id ? projectMap.get(String(ord.event_id)) : null;
    const orgId = ord.agency_id || project?.agency_id || null;
    const agency = orgId ? agencyMap.get(String(orgId)) : null;
    const status = normalizePayStatus(ord.order_status, ord.refund_status, project);
    const amountCents = Number.isFinite(Number(ord.amount)) ? Number(ord.amount) : 0;
    const refundAmountCents = Number.isFinite(Number(ord.refund_amount)) ? Number(ord.refund_amount) : 0;
    const custId = ord.customer_id || null;
    const matchedCustomer = custId ? userMap.get(String(custId)) || userMap.get(normalizeEmail(custId)) : null;
    const wh =
      (ord.last_webhook_event_id && webhookById.get(String(ord.last_webhook_event_id))) ||
      (ordId && latestWebhookByOrder.get(ordId)) ||
      null;

    const isTest = Boolean(
      ord.is_test === true ||
      project?.is_test === true ||
      (agency && !isGenuineOrganization(agency))
    );

    records.push({
      id: ordId || `ord_${records.length}`,
      transactionId: piId || txId || ordId,
      orderId: ordId || null,
      orderType: ord.order_type ? String(ord.order_type) : null,
      organizationId: orgId ? String(orgId) : null,
      organizationName: agency?.name || (orgId ? `Organization ${String(orgId).slice(0, 8)}` : 'Unknown Organization'),
      customerId: custId ? String(custId) : null,
      customerEmail: matchedCustomer?.email || agency?.owner_email || null,
      customerName: matchedCustomer?.full_name || null,
      eventId: ord.event_id ? String(ord.event_id) : null,
      eventName: project?.name || (ord.event_id ? `Event ${String(ord.event_id).slice(0, 8)}` : 'Unknown Event'),
      eventSlug: project?.slug || null,
      amountCents,
      amountUsd: Number((amountCents / 100).toFixed(2)),
      currency: String(ord.currency || 'usd').toUpperCase(),
      status,
      provider: 'stripe',
      stripeSessionId: txId || null,
      stripePaymentIntentId: piId || null,
      stripeChargeId: null,
      stripeRefundId: null,
      refundStatus: status === 'refunded' ? 'full' : status === 'partially_refunded' ? 'partial' : 'none',
      refundAmountCents,
      refundedAt: ord.refunded_at || null,
      webhookEventId: wh?.id || ord.last_webhook_event_id || null,
      webhookStatus: wh?.processing_status || ord.webhook_status || null,
      webhookErrorDetails: wh?.error_details || null,
      failureReason: ord.failure_reason || null,
      paidAt: status === 'succeeded' ? (ord.completed_at || ord.updated_at || ord.created_at || null) : null,
      createdAt: ord.created_at || new Date().toISOString(),
      isTest,
    });
  }

  records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Revenue totals strictly include ONLY non-test, net collected revenue
  // (succeeded full amount + net remaining amount on partially_refunded; excludes refunded, pending, failed, cancelled)
  let totalRevenueCents = 0;
  let completedCount = 0;
  let pendingCount = 0;
  let failedCount = 0;
  let refundedCount = 0;
  let partiallyRefundedCount = 0;
  let cancelledCount = 0;
  let refundedAmountCents = 0;

  for (const r of records) {
    if (r.isTest) continue;
    if (r.status === 'succeeded') {
      totalRevenueCents += r.amountCents;
      completedCount += 1;
    } else if (r.status === 'partially_refunded') {
      const refundedPortion = Math.min(r.amountCents, Math.max(0, r.refundAmountCents || 0));
      totalRevenueCents += Math.max(0, r.amountCents - refundedPortion);
      completedCount += 1;
      partiallyRefundedCount += 1;
      refundedAmountCents += refundedPortion;
    } else if (r.status === 'pending') {
      pendingCount += 1;
    } else if (r.status === 'failed') {
      failedCount += 1;
    } else if (r.status === 'refunded') {
      refundedCount += 1;
      refundedAmountCents += r.refundAmountCents > 0 ? r.refundAmountCents : r.amountCents;
    } else if (r.status === 'cancelled') {
      cancelledCount += 1;
    }
  }

  return {
    records,
    summary: {
      totalRevenueCents,
      totalRevenueUsd: Number((totalRevenueCents / 100).toFixed(2)),
      completedCount,
      pendingCount,
      failedCount,
      refundedCount,
      partiallyRefundedCount,
      cancelledCount,
      refundedAmountCents,
    },
  };
}

export function computeRegistrationAnalytics(
  users: Array<{ createdAt: string; isTest?: boolean }>,
  organizations: Array<{ createdAt: string; isTest?: boolean; isDemo?: boolean }>,
  referenceNow: Date = new Date()
): RegistrationAnalyticsResult {
  const genuineUsers = users.filter((u) => !u.isTest && u.createdAt);
  const genuineOrgs = organizations.filter((o) => !o.isTest && !o.isDemo && o.createdAt);

  const utcDayKey = (d: Date) => d.toISOString().slice(0, 10);
  const utcMonthKey = (d: Date) => d.toISOString().slice(0, 7);

  // Start of UTC week (Monday)
  const getWeekStartUtc = (d: Date): Date => {
    const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = copy.getUTCDay();
    const diff = (day === 0 ? -6 : 1) - day;
    copy.setUTCDate(copy.getUTCDate() + diff);
    return copy;
  };

  const formatShortDay = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  const formatShortMonth = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });

  // 1. Daily buckets: last 14 UTC days
  const dailyMap = new Map<string, RegistrationAnalyticsBucket>();
  const dailyOrder: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.UTC(referenceNow.getUTCFullYear(), referenceNow.getUTCMonth(), referenceNow.getUTCDate() - i));
    const key = utcDayKey(d);
    dailyOrder.push(key);
    dailyMap.set(key, { key, label: formatShortDay(d), users: 0, organizations: 0 });
  }

  // 2. Weekly buckets: last 8 UTC weeks
  const currentWeekStart = getWeekStartUtc(referenceNow);
  const weeklyMap = new Map<string, RegistrationAnalyticsBucket>();
  const weeklyOrder: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(currentWeekStart);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const key = utcDayKey(d);
    weeklyOrder.push(key);
    weeklyMap.set(key, { key, label: `Wk ${formatShortDay(d)}`, users: 0, organizations: 0 });
  }

  // 3. Monthly buckets: last 6 UTC months
  const monthlyMap = new Map<string, RegistrationAnalyticsBucket>();
  const monthlyOrder: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(referenceNow.getUTCFullYear(), referenceNow.getUTCMonth() - i, 1));
    const key = utcMonthKey(d);
    monthlyOrder.push(key);
    monthlyMap.set(key, { key, label: formatShortMonth(d), users: 0, organizations: 0 });
  }

  const todayKey = utcDayKey(referenceNow);
  const currentWeekKey = utcDayKey(currentWeekStart);
  const currentMonthKey = utcMonthKey(referenceNow);
  const prevMonthDate = new Date(Date.UTC(referenceNow.getUTCFullYear(), referenceNow.getUTCMonth() - 1, 1));
  const prevMonthKey = utcMonthKey(prevMonthDate);
  const thirtyDaysAgoMs = referenceNow.getTime() - 30 * 24 * 60 * 60 * 1000;

  let usersToday = 0;
  let usersThisWeek = 0;
  let usersThisMonth = 0;
  let usersPreviousMonth = 0;
  let usersLast30Days = 0;

  for (const u of genuineUsers) {
    const dt = new Date(u.createdAt);
    if (Number.isNaN(dt.getTime())) continue;
    const dKey = utcDayKey(dt);
    const wKey = utcDayKey(getWeekStartUtc(dt));
    const mKey = utcMonthKey(dt);

    if (dailyMap.has(dKey)) dailyMap.get(dKey)!.users += 1;
    if (weeklyMap.has(wKey)) weeklyMap.get(wKey)!.users += 1;
    if (monthlyMap.has(mKey)) monthlyMap.get(mKey)!.users += 1;

    if (dKey === todayKey) usersToday += 1;
    if (wKey === currentWeekKey) usersThisWeek += 1;
    if (mKey === currentMonthKey) usersThisMonth += 1;
    if (mKey === prevMonthKey) usersPreviousMonth += 1;
    if (dt.getTime() >= thirtyDaysAgoMs && dt.getTime() <= referenceNow.getTime()) usersLast30Days += 1;
  }

  let orgsThisMonth = 0;
  let orgsPreviousMonth = 0;

  for (const o of genuineOrgs) {
    const dt = new Date(o.createdAt);
    if (Number.isNaN(dt.getTime())) continue;
    const dKey = utcDayKey(dt);
    const wKey = utcDayKey(getWeekStartUtc(dt));
    const mKey = utcMonthKey(dt);

    if (dailyMap.has(dKey)) dailyMap.get(dKey)!.organizations += 1;
    if (weeklyMap.has(wKey)) weeklyMap.get(wKey)!.organizations += 1;
    if (monthlyMap.has(mKey)) monthlyMap.get(mKey)!.organizations += 1;

    if (mKey === currentMonthKey) orgsThisMonth += 1;
    if (mKey === prevMonthKey) orgsPreviousMonth += 1;
  }

  const calcGrowthPct = (curr: number, prev: number): number | null => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Number((((curr - prev) / prev) * 100).toFixed(1));
  };

  return {
    daily: dailyOrder.map((k) => dailyMap.get(k)!),
    weekly: weeklyOrder.map((k) => weeklyMap.get(k)!),
    monthly: monthlyOrder.map((k) => monthlyMap.get(k)!),
    summary: {
      usersToday,
      usersThisWeek,
      usersThisMonth,
      usersLast30Days,
      orgsThisMonth,
      orgsPreviousMonth,
      userGrowthPct: calcGrowthPct(usersThisMonth, usersPreviousMonth),
      orgGrowthPct: calcGrowthPct(orgsThisMonth, orgsPreviousMonth),
    },
  };
}

// ============================================================================
// Batch Platform Dataset Aggregator (Zero N+1)
// ============================================================================

interface PlatformSnapshot {
  users: SanitizedUserRecord[];
  organizations: OrganizationSummary[];
  events: PlatformEventSummary[];
  paymentRecords: PlatformPaymentRecord[];
  paymentSummary: ReturnType<typeof computePaymentLedgerAndMetrics>['summary'];
  activityLogs: ActivityLogRecord[];
  rawAgencies: any[];
  rawProjects: any[];
  rawUsers: any[];
}

async function loadPlatformSnapshot(supabase: any, now: Date = new Date()): Promise<PlatformSnapshot> {
  const [rawUsersRaw, rawAgencies, rawProjects, rawOrders, rawPayments, rawLogs, rawWebhooks] = await Promise.all([
    safeFetchTable(supabase, 'users_auth', 'created_at'),
    safeFetchTable(supabase, 'agencies', 'created_at'),
    safeFetchTable(supabase, 'projects', 'created_at'),
    safeFetchTable(supabase, 'event_orders', 'created_at'),
    safeFetchTable(supabase, 'event_payments', 'created_at'),
    safeFetchTable(supabase, 'platform_activity_logs', 'created_at'),
    safeFetchTable(supabase, 'stripe_webhook_events', 'received_at'),
  ]);

  // Immediately strip password hashes from every user row
  const rawUsers = rawUsersRaw.map((u) => stripSensitiveUserFields(u)!).filter(Boolean);

  const nowMs = now.getTime();
  const orgMap = new Map<string, any>();
  for (const a of rawAgencies) {
    if (a?.id) orgMap.set(String(a.id), a);
  }

  // Index users by id, external_user_id, email, derived email id
  const userByLookupKey = new Map<string, any>();
  for (const u of rawUsers) {
    if (u.id) userByLookupKey.set(String(u.id), u);
    if (u.external_user_id) userByLookupKey.set(String(u.external_user_id), u);
    if (u.email) {
      const em = normalizeEmail(u.email);
      userByLookupKey.set(em, u);
      userByLookupKey.set(deriveEmailUserId(em), u);
    }
  }

  // Synthesize inferred owner records ONLY for legacy Google OAuth agencies that predate users_auth tracking
  const synthesizedUsers: SanitizedUserRecord[] = [];
  const seenUserKeys = new Set<string>();

  const findMatchedUser = (agency: any): any | null => {
    if (agency.user_id && userByLookupKey.has(String(agency.user_id))) {
      return userByLookupKey.get(String(agency.user_id));
    }
    if (agency.owner_email && userByLookupKey.has(normalizeEmail(agency.owner_email))) {
      return userByLookupKey.get(normalizeEmail(agency.owner_email));
    }
    return null;
  };

  // Group agencies & events by user and org
  const eventsByOrgId = new Map<string, any[]>();
  for (const p of rawProjects) {
    const aid = p.agency_id ? String(p.agency_id) : '';
    if (!eventsByOrgId.has(aid)) eventsByOrgId.set(aid, []);
    eventsByOrgId.get(aid)!.push(p);
  }

  const paymentData = computePaymentLedgerAndMetrics(
    rawPayments,
    rawOrders,
    rawProjects,
    rawAgencies,
    rawUsers,
    rawWebhooks
  );
  const revenueByOrgId = new Map<string, number>();
  for (const pay of paymentData.records) {
    if (!pay.isTest && (pay.status === 'succeeded' || pay.status === 'partially_refunded') && pay.organizationId) {
      const netCents = Math.max(
        0,
        pay.amountCents - (pay.status === 'partially_refunded' ? pay.refundAmountCents || 0 : 0)
      );
      revenueByOrgId.set(pay.organizationId, (revenueByOrgId.get(pay.organizationId) || 0) + netCents);
    }
  }

  // Build SanitizedUserRecord list from users_auth
  const userOrgsMap = new Map<string, any[]>();
  const assignOrgToUser = (userKey: string, agency: any) => {
    if (!userOrgsMap.has(userKey)) userOrgsMap.set(userKey, []);
    const list = userOrgsMap.get(userKey)!;
    if (!list.some((x) => String(x.id) === String(agency.id))) {
      list.push(agency);
    }
  };

  for (const u of rawUsers) {
    if (u.id) seenUserKeys.add(String(u.id));
    if (u.external_user_id) seenUserKeys.add(String(u.external_user_id));
    if (u.email) {
      const em = normalizeEmail(u.email);
      seenUserKeys.add(em);
      seenUserKeys.add(deriveEmailUserId(em));
    }
  }

  for (const a of rawAgencies) {
    const matched = findMatchedUser(a);
    if (matched) {
      const primaryKey = String(matched.id || matched.external_user_id || normalizeEmail(matched.email));
      assignOrgToUser(primaryKey, a);
    } else if (a.user_id && !seenUserKeys.has(String(a.user_id))) {
      // Legacy agency owner not yet in users_auth
      const uid = String(a.user_id);
      seenUserKeys.add(uid);
      const inferredEmail = a.owner_email || `${uid}@oauth-user.eventframe.io`;
      const isAgencyTest = !isGenuineOrganization(a);
      const orgEvents = (eventsByOrgId.get(String(a.id)) || []).filter((e) => !e.deleted_at && e.is_test !== true);
      synthesizedUsers.push({
        id: uid,
        externalUserId: uid,
        email: inferredEmail,
        fullName: a.name ? `${a.name} Owner` : 'Workspace Owner',
        avatarUrl: null,
        authProvider: uid.startsWith('email-') ? 'email' : 'google',
        role: 'agency_owner',
        status: 'active',
        isVerified: true,
        isDeveloper: false,
        organizationCount: isAgencyTest ? 0 : 1,
        organizationIds: [String(a.id)],
        organizationNames: [a.name || a.slug],
        eventCount: orgEvents.length,
        createdAt: a.created_at || new Date().toISOString(),
        lastLoginAt: null,
        suspendedAt: null,
        suspendedReason: null,
        isTest: isAgencyTest,
        inferredFromAgency: true,
      });
    }
  }

  // Also link explicit users_auth.organization_id memberships
  for (const u of rawUsers) {
    if (u.organization_id && orgMap.has(String(u.organization_id))) {
      const primaryKey = String(u.id || u.external_user_id || normalizeEmail(u.email));
      assignOrgToUser(primaryKey, orgMap.get(String(u.organization_id)));
    }
  }

  const users: SanitizedUserRecord[] = rawUsers.map((u) => {
    const primaryKey = String(u.id || u.external_user_id || normalizeEmail(u.email));
    const linkedOrgs = userOrgsMap.get(primaryKey) || [];
    const genuineLinkedOrgs = linkedOrgs.filter(isGenuineOrganization);
    const totalEvents = linkedOrgs.reduce((acc, org) => {
      const evs = (eventsByOrgId.get(String(org.id)) || []).filter((e) => !e.deleted_at && e.is_test !== true);
      return acc + evs.length;
    }, 0);

    const userIsDeveloper = resolveDbUserIsDeveloper(u);
    const rawRole = String(u.role || '').toLowerCase();
    const ownsOrg = linkedOrgs.some(
      (o) =>
        String(o.user_id) === String(u.id) ||
        String(o.user_id) === String(u.external_user_id) ||
        String(o.user_id) === deriveEmailUserId(u.email)
    );
    let role: PlatformUserRole = 'user';
    if (rawRole === 'agency_owner') role = 'agency_owner';
    else if (rawRole === 'agency_member') role = 'agency_member';
    else if (rawRole === 'super_admin' && userIsDeveloper) role = 'super_admin';
    else if (ownsOrg) role = 'agency_owner';
    else if (u.organization_id) role = 'agency_member';

    return {
      id: String(u.id || u.external_user_id || deriveEmailUserId(u.email)),
      externalUserId: u.external_user_id ? String(u.external_user_id) : null,
      email: String(u.email || ''),
      fullName: String(u.full_name || (u.email ? String(u.email).split('@')[0] : 'EventFrame User')),
      avatarUrl: u.avatar_url || null,
      authProvider: String(u.auth_provider || (String(u.external_user_id || '').startsWith('email-') ? 'email' : 'email')),
      role,
      status: String(u.status || 'active').toLowerCase() === 'suspended' ? 'suspended' : 'active',
      isVerified: Boolean(u.is_verified),
      isDeveloper: userIsDeveloper,
      organizationCount: genuineLinkedOrgs.length,
      organizationIds: linkedOrgs.map((o) => String(o.id)),
      organizationNames: linkedOrgs.map((o) => String(o.name || o.slug)),
      eventCount: totalEvents,
      createdAt: u.created_at || new Date().toISOString(),
      lastLoginAt: u.last_login_at || null,
      suspendedAt: u.suspended_at || null,
      suspendedReason: u.suspended_reason || null,
      isTest: Boolean(u.is_test === true || u.deleted_at),
    };
  });

  const allUsers = [...users, ...synthesizedUsers].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Build OrganizationSummary list
  const memberCountByOrg = new Map<string, number>();
  for (const u of allUsers) {
    if (u.isTest) continue;
    for (const orgId of u.organizationIds) {
      memberCountByOrg.set(orgId, (memberCountByOrg.get(orgId) || 0) + 1);
    }
  }

  const organizations: OrganizationSummary[] = rawAgencies
    .filter((a) => !a.deleted_at)
    .map((a) => {
      const orgId = String(a.id);
      const matchedOwner = findMatchedUser(a);
      const orgEvents = (eventsByOrgId.get(orgId) || []).filter((e) => !e.deleted_at && e.is_test !== true);
      let activeEventCount = 0;
      let expiredEventCount = 0;
      for (const ev of orgEvents) {
        const lc = computeEventLifecycleStatus(ev, nowMs);
        if (lc === 'active') activeEventCount += 1;
        else if (lc === 'expired') expiredEventCount += 1;
      }

      const rawStatus = String(a.status || 'active').toLowerCase();
      const status: OrganizationSummary['status'] =
        rawStatus === 'suspended' ? 'suspended' : rawStatus === 'inactive' ? 'inactive' : 'active';

      return {
        id: orgId,
        name: String(a.name || a.slug || 'Unnamed Organization'),
        slug: String(a.slug || ''),
        domain: a.domain || null,
        userRole: String(a.user_role || 'agency'),
        status,
        ownerUserId: a.user_id ? String(a.user_id) : null,
        ownerEmail: matchedOwner?.email || a.owner_email || null,
        ownerName: matchedOwner?.full_name || (matchedOwner?.email ? matchedOwner.email.split('@')[0] : null),
        memberCount: Math.max(memberCountByOrg.get(orgId) || 0, a.user_id ? 1 : 0),
        eventCount: orgEvents.length,
        activeEventCount,
        expiredEventCount,
        totalRevenueCents: revenueByOrgId.get(orgId) || 0,
        totalRevenueUsd: Number(((revenueByOrgId.get(orgId) || 0) / 100).toFixed(2)),
        isDemo: Boolean(a.is_demo === true),
        isTest: Boolean(a.is_test === true),
        createdAt: a.created_at || new Date().toISOString(),
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Build PlatformEventSummary list
  const events: PlatformEventSummary[] = rawProjects
    .filter((p) => !p.deleted_at)
    .map((p) => {
      const parentOrg = p.agency_id ? orgMap.get(String(p.agency_id)) : null;
      const isTest = !isGenuineEvent(p, orgMap);
      const groom = String(p.groom_name || '').trim();
      const bride = String(p.bride_name || '').trim();
      const coupleNames = groom && bride ? `${groom} & ${bride}` : groom || bride || '—';
      const lifecycleStatus = computeEventLifecycleStatus(p, nowMs);

      return {
        id: String(p.id),
        name: String(p.name || p.slug || 'Untitled Event'),
        slug: String(p.slug || ''),
        groomName: groom,
        brideName: bride,
        coupleNames,
        weddingDate: p.wedding_date || null,
        location: p.location || null,
        organizationId: p.agency_id ? String(p.agency_id) : null,
        organizationName: parentOrg?.name || 'Independent / Unassigned',
        organizationSlug: parentOrg?.slug || null,
        status: String(p.status || 'draft'),
        lifecycleStatus,
        paymentStatus: String(p.payment_status || 'unpaid'),
        websiteStatus: String(p.website_status || 'draft'),
        hasAccessPassword: Boolean(p.access_password && String(p.access_password).trim().length > 0),
        activatedAt: p.activated_at || null,
        expiresAt: p.expires_at || null,
        isTest,
        createdAt: p.created_at || new Date().toISOString(),
        updatedAt: p.updated_at || null,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activityLogs: ActivityLogRecord[] = (rawLogs || [])
    .map((log: any) => ({
      id: String(log.id || `log_${Math.random().toString(36).slice(2, 8)}`),
      actorId: log.actor_id ? String(log.actor_id) : null,
      actorEmail: log.actor_email ? String(log.actor_email) : null,
      actorRole: log.actor_role ? String(log.actor_role) : null,
      action: String(log.action || 'UNKNOWN'),
      organizationId: log.organization_id ? String(log.organization_id) : null,
      targetUserId: log.target_user_id ? String(log.target_user_id) : null,
      targetEventId: log.target_event_id ? String(log.target_event_id) : null,
      referenceId: log.reference_id ? String(log.reference_id) : null,
      summary: log.summary ? String(log.summary) : null,
      metadata: log.metadata && typeof log.metadata === 'object' ? log.metadata : {},
      createdAt: log.created_at || new Date().toISOString(),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    users: allUsers,
    organizations,
    events,
    paymentRecords: paymentData.records,
    paymentSummary: paymentData.summary,
    activityLogs,
    rawAgencies,
    rawProjects,
    rawUsers,
  };
}

function paginateItems<T>(items: T[], pageRaw?: number | string, limitRaw?: number | string): PaginatedResult<T> {
  const page = Math.max(1, Number(pageRaw) || 1);
  const limit = Math.max(1, Math.min(100, Number(limitRaw) || 20));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total,
    page: clampedPage,
    limit,
    totalPages,
  };
}

// ============================================================================
// Admin Panel Feature Endpoints
// ============================================================================

export async function getDeveloperOverview(supabase: any, now: Date = new Date()) {
  const snapshot = await loadPlatformSnapshot(supabase, now);

  const genuineOrgs = snapshot.organizations.filter((o) => !o.isTest && !o.isDemo);
  const genuineUsers = snapshot.users.filter((u) => !u.isTest);
  const genuineEvents = snapshot.events.filter((e) => !e.isTest);

  const activeEvents = genuineEvents.filter((e) => e.lifecycleStatus === 'active').length;
  const expiredEvents = genuineEvents.filter((e) => e.lifecycleStatus === 'expired').length;
  const suspendedUsers = genuineUsers.filter((u) => u.status === 'suspended').length;

  const registrationAnalytics = computeRegistrationAnalytics(genuineUsers, genuineOrgs, now);

  return {
    kpis: {
      totalOrganizations: genuineOrgs.length,
      totalUsers: genuineUsers.length,
      totalEvents: genuineEvents.length,
      activeEvents,
      expiredEvents,
      suspendedUsers,
      completedPaymentsCount: snapshot.paymentSummary.completedCount,
      totalRevenueCents: snapshot.paymentSummary.totalRevenueCents,
      totalRevenueUsd: snapshot.paymentSummary.totalRevenueUsd,
      pendingPaymentsCount: snapshot.paymentSummary.pendingCount,
      refundedPaymentsCount: snapshot.paymentSummary.refundedCount,
    },
    registrationAnalytics,
    recentOrganizations: genuineOrgs.slice(0, 6),
    recentUsers: genuineUsers.slice(0, 6),
    recentEvents: genuineEvents.slice(0, 6),
    recentPayments: snapshot.paymentRecords.filter((p) => !p.isTest).slice(0, 6),
    recentActivityLogs: snapshot.activityLogs.slice(0, 8),
  };
}

export async function listOrganizations(
  supabase: any,
  query: {
    search?: string;
    status?: string;
    userRole?: string;
    includeTest?: boolean;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page?: number | string;
    limit?: number | string;
  } = {}
): Promise<PaginatedResult<OrganizationSummary>> {
  const snapshot = await loadPlatformSnapshot(supabase);
  let list = snapshot.organizations.filter((o) => (query.includeTest ? true : !o.isTest && !o.isDemo));

  if (query.search && query.search.trim()) {
    const q = query.search.trim().toLowerCase();
    list = list.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        (o.domain || '').toLowerCase().includes(q) ||
        (o.ownerEmail || '').toLowerCase().includes(q)
    );
  }

  if (query.status && query.status !== 'all') {
    list = list.filter((o) => o.status === query.status);
  }

  if (query.userRole && query.userRole !== 'all') {
    list = list.filter((o) => o.userRole === query.userRole);
  }

  const sortBy = query.sortBy || 'created_at';
  const dir = query.sortDir === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name) * dir;
      case 'events_count':
        return (a.eventCount - b.eventCount) * dir;
      case 'revenue_cents':
        return (a.totalRevenueCents - b.totalRevenueCents) * dir;
      case 'created_at':
      default:
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    }
  });

  return paginateItems(list, query.page, query.limit);
}

export async function getOrganizationDetail(supabase: any, orgId: string) {
  const snapshot = await loadPlatformSnapshot(supabase);
  const organization = snapshot.organizations.find((o) => o.id === orgId);
  if (!organization) return null;

  const events = snapshot.events.filter((e) => e.organizationId === orgId);
  const payments = snapshot.paymentRecords.filter((p) => p.organizationId === orgId);
  const members = snapshot.users.filter((u) => u.organizationIds.includes(orgId));
  const owner =
    members.find(
      (m) =>
        m.id === organization.ownerUserId ||
        m.externalUserId === organization.ownerUserId ||
        (organization.ownerEmail && m.email.toLowerCase() === organization.ownerEmail.toLowerCase())
    ) ||
    members[0] ||
    null;

  const nowMs = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  let activeCount = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;
  let unpaidCount = 0;

  for (const ev of events) {
    if (ev.lifecycleStatus === 'active') {
      activeCount += 1;
      if (ev.expiresAt) {
        const diff = new Date(ev.expiresAt).getTime() - nowMs;
        if (diff > 0 && diff <= thirtyDaysMs) expiringSoonCount += 1;
      }
    } else if (ev.lifecycleStatus === 'expired') {
      expiredCount += 1;
    } else {
      unpaidCount += 1;
    }
  }

  const activityLogs = snapshot.activityLogs.filter((l) => l.organizationId === orgId).slice(0, 20);

  return {
    organization,
    owner,
    members,
    events,
    payments,
    expirySummary: {
      activeCount,
      expiringSoonCount,
      expiredCount,
      unpaidCount,
    },
    activityLogs,
  };
}

export async function updateOrganizationStatus(
  supabase: any,
  orgId: string,
  status: 'active' | 'suspended' | 'inactive',
  actor: { id?: string; email?: string; role?: string }
) {
  const { data: existing, error: fetchErr } = await supabase
    .from('agencies')
    .select('*')
    .eq('id', orgId)
    .maybeSingle();

  if (fetchErr || !existing) return null;

  const { data: updated, error: updateErr } = await supabase
    .from('agencies')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orgId)
    .select()
    .maybeSingle();

  if (updateErr) throw new Error(updateErr.message);

  await recordPlatformActivity(supabase, {
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role || 'super_admin',
    action: 'ORGANIZATION_STATUS_UPDATED',
    organizationId: orgId,
    summary: `Organization "${existing.name}" status changed to ${status}`,
    metadata: { previousStatus: existing.status || 'active', newStatus: status },
  });

  return updated || { ...existing, status };
}

export async function listUsers(
  supabase: any,
  query: {
    search?: string;
    status?: string;
    role?: string;
    isDeveloper?: string;
    organizationId?: string;
    registeredFrom?: string;
    registeredTo?: string;
    includeTest?: boolean;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page?: number | string;
    limit?: number | string;
  } = {}
): Promise<PaginatedResult<SanitizedUserRecord>> {
  const snapshot = await loadPlatformSnapshot(supabase);
  let list = snapshot.users.filter((u) => (query.includeTest ? true : !u.isTest));

  if (query.search && query.search.trim()) {
    const q = query.search.trim().toLowerCase();
    list = list.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.organizationNames.some((n) => n.toLowerCase().includes(q))
    );
  }

  if (query.status && query.status !== 'all') {
    list = list.filter((u) => u.status === query.status);
  }

  if (query.role && query.role !== 'all') {
    if (query.role === 'super_admin') {
      list = list.filter((u) => u.role === 'super_admin' || u.isDeveloper);
    } else {
      list = list.filter((u) => u.role === query.role);
    }
  }

  if (query.isDeveloper && query.isDeveloper !== 'all') {
    if (query.isDeveloper === 'developers' || query.isDeveloper === 'true') {
      list = list.filter((u) => u.isDeveloper === true);
    } else if (query.isDeveloper === 'non_developers' || query.isDeveloper === 'false') {
      list = list.filter((u) => !u.isDeveloper);
    }
  }

  if (query.organizationId && query.organizationId !== 'all') {
    list = list.filter((u) => u.organizationIds.includes(query.organizationId!));
  }

  if (query.registeredFrom) {
    const fromMs = new Date(query.registeredFrom).getTime();
    if (!Number.isNaN(fromMs)) {
      list = list.filter((u) => new Date(u.createdAt).getTime() >= fromMs);
    }
  }

  if (query.registeredTo) {
    const toDate = new Date(query.registeredTo);
    toDate.setUTCHours(23, 59, 59, 999);
    const toMs = toDate.getTime();
    if (!Number.isNaN(toMs)) {
      list = list.filter((u) => new Date(u.createdAt).getTime() <= toMs);
    }
  }

  const sortBy = query.sortBy || 'created_at';
  const dir = query.sortDir === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    switch (sortBy) {
      case 'email':
        return a.email.localeCompare(b.email) * dir;
      case 'full_name':
        return a.fullName.localeCompare(b.fullName) * dir;
      case 'last_login_at':
        return ((a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0) - (b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0)) * dir;
      case 'created_at':
      default:
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    }
  });

  return paginateItems(list, query.page, query.limit);
}

export async function getUserDetail(supabase: any, userId: string) {
  const snapshot = await loadPlatformSnapshot(supabase);
  const user = snapshot.users.find(
    (u) => u.id === userId || u.externalUserId === userId || u.email.toLowerCase() === userId.toLowerCase()
  );
  if (!user) return null;

  const organizations = snapshot.organizations.filter((o) => user.organizationIds.includes(o.id));
  const orgIdSet = new Set(organizations.map((o) => o.id));
  const events = snapshot.events.filter((e) => e.organizationId && orgIdSet.has(e.organizationId));
  const payments = snapshot.paymentRecords.filter((p) => p.organizationId && orgIdSet.has(p.organizationId));
  const activityLogs = snapshot.activityLogs
    .filter(
      (l) =>
        l.targetUserId === user.id ||
        l.targetUserId === user.externalUserId ||
        l.actorEmail?.toLowerCase() === user.email.toLowerCase()
    )
    .slice(0, 25);

  return {
    user,
    organizations,
    events,
    payments,
    activityLogs,
  };
}

export async function suspendUserAccount(
  supabase: any,
  targetUserId: string,
  reason: string | undefined,
  actor: { id?: string; email?: string; role?: string }
): Promise<{ ok: true; user: SanitizedUserRecord } | { ok: false; statusCode: number; error: string }> {
  const snapshot = await loadPlatformSnapshot(supabase);
  const target = snapshot.users.find(
    (u) => u.id === targetUserId || u.externalUserId === targetUserId || u.email.toLowerCase() === targetUserId.toLowerCase()
  );

  if (!target) {
    return { ok: false, statusCode: 404, error: 'User not found' };
  }

  if (actor.email && target.email.toLowerCase() === actor.email.toLowerCase()) {
    return { ok: false, statusCode: 400, error: 'You cannot suspend your own developer account.' };
  }

  if (target.isDeveloper) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Revoke developer access before suspending an active developer account.',
    };
  }

  const nowIso = new Date().toISOString();
  const cleanReason = (reason || 'Suspended by platform administrator').trim().slice(0, 500);

  // Update users_auth row by email (always present) or create row if user was inferred from agency
  const existingDbRow = await findDbUserForIdentity(supabase, { email: target.email, id: target.id });

  if (existingDbRow) {
    const { error } = await supabase
      .from('users_auth')
      .update({
        status: 'suspended',
        suspended_at: nowIso,
        suspended_reason: cleanReason,
        updated_at: nowIso,
      })
      .eq('email', existingDbRow.email);
    if (error) {
      return { ok: false, statusCode: 500, error: error.message };
    }
  } else {
    const { error } = await supabase
      .from('users_auth')
      .insert([
        {
          email: target.email,
          password_hash: null,
          full_name: target.fullName,
          external_user_id: target.externalUserId || target.id,
          auth_provider: target.authProvider || 'google',
          role: target.role,
          is_developer: false,
          status: 'suspended',
          suspended_at: nowIso,
          suspended_reason: cleanReason,
          is_verified: true,
          email_verified: true,
          is_test: false,
          created_at: target.createdAt || nowIso,
          updated_at: nowIso,
        },
      ]);
    if (error) {
      return { ok: false, statusCode: 500, error: error.message };
    }
  }

  await recordPlatformActivity(supabase, {
    actorId: actor.id || null,
    actorEmail: actor.email || null,
    actorRole: actor.role || 'developer',
    action: 'ACCOUNT_SUSPENDED',
    organizationId: target.organizationIds[0] || null,
    targetUserId: target.id,
    summary: `Account suspended for ${target.email}${cleanReason ? `: ${cleanReason}` : ''}`,
    metadata: {
      targetEmail: target.email,
      reason: cleanReason,
      preservedOrganizations: target.organizationIds.length,
      preservedEvents: target.eventCount,
    },
  });

  return {
    ok: true,
    user: {
      ...target,
      status: 'suspended',
      suspendedAt: nowIso,
      suspendedReason: cleanReason,
    },
  };
}

export async function reactivateUserAccount(
  supabase: any,
  targetUserId: string,
  actor: { id?: string; email?: string; role?: string }
): Promise<{ ok: true; user: SanitizedUserRecord } | { ok: false; statusCode: number; error: string }> {
  const snapshot = await loadPlatformSnapshot(supabase);
  const target = snapshot.users.find(
    (u) => u.id === targetUserId || u.externalUserId === targetUserId || u.email.toLowerCase() === targetUserId.toLowerCase()
  );

  if (!target) {
    return { ok: false, statusCode: 404, error: 'User not found' };
  }

  const nowIso = new Date().toISOString();
  const existingDbRow = await findDbUserForIdentity(supabase, { email: target.email, id: target.id });

  if (existingDbRow) {
    const { error } = await supabase
      .from('users_auth')
      .update({
        status: 'active',
        suspended_at: null,
        suspended_reason: null,
        updated_at: nowIso,
      })
      .eq('email', existingDbRow.email);
    if (error) {
      return { ok: false, statusCode: 500, error: error.message };
    }
  }

  await recordPlatformActivity(supabase, {
    actorId: actor.id || null,
    actorEmail: actor.email || null,
    actorRole: actor.role || 'developer',
    action: 'ACCOUNT_REACTIVATED',
    organizationId: target.organizationIds[0] || null,
    targetUserId: target.id,
    summary: `Account reactivated for ${target.email}`,
    metadata: { targetEmail: target.email },
  });

  return {
    ok: true,
    user: {
      ...target,
      status: 'active',
      suspendedAt: null,
      suspendedReason: null,
    },
  };
}

export async function updateUserDeveloperAccess(
  supabase: any,
  targetUserId: string,
  nextIsDeveloper: boolean,
  actor: { id?: string; dbUserId?: string | null; email?: string; role?: string }
): Promise<
  | { ok: true; user: SanitizedUserRecord; unchanged?: boolean }
  | { ok: false; statusCode: number; error: string; code?: string }
> {
  if (typeof nextIsDeveloper !== 'boolean') {
    return { ok: false, statusCode: 400, error: 'isDeveloper must be a boolean.', code: 'INVALID_INPUT' };
  }

  const actorAuthorized = await isDeveloper(supabase, {
    id: actor?.id,
    email: actor?.email,
  });
  if (!actorAuthorized) {
    return {
      ok: false,
      statusCode: 403,
      error: 'Forbidden: Developer authorization is required.',
      code: 'FORBIDDEN_DEVELOPER_ONLY',
    };
  }

  const snapshot = await loadPlatformSnapshot(supabase);
  const target = snapshot.users.find(
    (u) =>
      u.id === targetUserId ||
      u.externalUserId === targetUserId ||
      u.email.toLowerCase() === targetUserId.toLowerCase()
  );

  if (!target) {
    return { ok: false, statusCode: 404, error: 'User not found', code: 'USER_NOT_FOUND' };
  }

  const actorEmail = normalizeEmail(actor?.email);
  const targetEmail = normalizeEmail(target.email);
  const isSelfTarget =
    (actorEmail && targetEmail && actorEmail === targetEmail) ||
    (actor?.dbUserId && String(actor.dbUserId) === target.id) ||
    (actor?.id && (String(actor.id) === target.id || String(actor.id) === target.externalUserId));

  if (isSelfTarget) {
    return {
      ok: false,
      statusCode: 400,
      error: nextIsDeveloper
        ? 'You cannot modify developer access on your own account.'
        : 'You cannot revoke your own developer access.',
      code: 'SELF_MODIFICATION_FORBIDDEN',
    };
  }

  const existingDbRow = await findDbUserForIdentity(supabase, { email: target.email, id: target.id });
  const currentIsDeveloper = existingDbRow ? resolveDbUserIsDeveloper(existingDbRow) : target.isDeveloper;

  if (currentIsDeveloper === nextIsDeveloper) {
    return { ok: true, user: { ...target, isDeveloper: currentIsDeveloper }, unchanged: true };
  }

  // Prevent revoking the last remaining active developer in the system
  if (!nextIsDeveloper) {
    const activeDevelopers = snapshot.rawUsers.filter(
      (u) => !u.deleted_at && String(u.status || 'active').toLowerCase() !== 'suspended' && resolveDbUserIsDeveloper(u)
    );
    const remainingAfterRevoke = activeDevelopers.filter((u) => {
      const uEmail = normalizeEmail(u.email);
      const uId = String(u.id || '');
      const uExt = String(u.external_user_id || '');
      return !(
        (targetEmail && uEmail === targetEmail) ||
        uId === target.id ||
        (target.externalUserId && uExt === target.externalUserId)
      );
    });

    if (remainingAfterRevoke.length === 0) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Cannot revoke developer access from the last remaining active developer account.',
        code: 'LAST_DEVELOPER_PROTECTED',
      };
    }
  }

  if (nextIsDeveloper && target.status === 'suspended') {
    return {
      ok: false,
      statusCode: 400,
      error: 'Reactivate this suspended account before granting developer access.',
      code: 'USER_SUSPENDED',
    };
  }

  const nowIso = new Date().toISOString();

  // Preserve independent agency role; only normalize legacy `super_admin` string on revoke
  let nextRole: PlatformUserRole = target.role;
  if (!nextIsDeveloper && target.role === 'super_admin') {
    nextRole = target.organizationIds.length > 0 ? 'agency_owner' : 'user';
  }

  if (existingDbRow) {
    const updatePatch: Record<string, any> = {
      is_developer: nextIsDeveloper,
      updated_at: nowIso,
    };
    if (!nextIsDeveloper && String(existingDbRow.role || '').toLowerCase() === 'super_admin') {
      updatePatch.role = nextRole;
    }

    const { error } = await supabase
      .from('users_auth')
      .update(updatePatch)
      .eq('email', existingDbRow.email);

    if (error) {
      return { ok: false, statusCode: 500, error: error.message, code: 'DB_ERROR' };
    }
  } else {
    const { error } = await supabase
      .from('users_auth')
      .insert([
        {
          email: target.email,
          password_hash: null,
          full_name: target.fullName,
          external_user_id: target.externalUserId || target.id,
          auth_provider: target.authProvider || 'google',
          role: nextRole,
          is_developer: nextIsDeveloper,
          status: target.status,
          is_verified: true,
          email_verified: true,
          is_test: false,
          created_at: target.createdAt || nowIso,
          updated_at: nowIso,
        },
      ]);

    if (error) {
      return { ok: false, statusCode: 500, error: error.message, code: 'DB_ERROR' };
    }
  }

  await recordPlatformActivity(supabase, {
    actorId: actor.id || null,
    actorEmail: actor.email || null,
    actorRole: 'developer',
    action: nextIsDeveloper ? 'DEVELOPER_ACCESS_GRANTED' : 'DEVELOPER_ACCESS_REVOKED',
    organizationId: target.organizationIds[0] || null,
    targetUserId: target.id,
    summary: nextIsDeveloper
      ? `Granted platform developer access to ${target.email}`
      : `Revoked platform developer access from ${target.email}`,
    metadata: {
      targetEmail: target.email,
      previousIsDeveloper: currentIsDeveloper,
      newIsDeveloper: nextIsDeveloper,
      preservedRole: nextRole,
    },
  });

  return {
    ok: true,
    user: {
      ...target,
      role: nextRole,
      isDeveloper: nextIsDeveloper,
    },
  };
}

export async function listPlatformEvents(
  supabase: any,
  query: {
    search?: string;
    status?: string;
    paymentStatus?: string;
    organizationId?: string;
    includeTest?: boolean;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page?: number | string;
    limit?: number | string;
  } = {}
): Promise<PaginatedResult<PlatformEventSummary>> {
  const snapshot = await loadPlatformSnapshot(supabase);
  let list = snapshot.events.filter((e) => (query.includeTest ? true : !e.isTest));

  if (query.search && query.search.trim()) {
    const q = query.search.trim().toLowerCase();
    list = list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.slug.toLowerCase().includes(q) ||
        e.coupleNames.toLowerCase().includes(q) ||
        e.organizationName.toLowerCase().includes(q)
    );
  }

  if (query.status && query.status !== 'all') {
    list = list.filter((e) => e.lifecycleStatus === query.status || e.status === query.status);
  }

  if (query.paymentStatus && query.paymentStatus !== 'all') {
    list = list.filter((e) => e.paymentStatus === query.paymentStatus);
  }

  if (query.organizationId && query.organizationId !== 'all') {
    list = list.filter((e) => e.organizationId === query.organizationId);
  }

  const sortBy = query.sortBy || 'created_at';
  const dir = query.sortDir === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name) * dir;
      case 'wedding_date':
        return ((a.weddingDate ? new Date(a.weddingDate).getTime() : 0) - (b.weddingDate ? new Date(b.weddingDate).getTime() : 0)) * dir;
      case 'expires_at':
        return ((a.expiresAt ? new Date(a.expiresAt).getTime() : 0) - (b.expiresAt ? new Date(b.expiresAt).getTime() : 0)) * dir;
      case 'created_at':
      default:
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    }
  });

  return paginateItems(list, query.page, query.limit);
}

export async function getPlatformEventDetail(supabase: any, eventId: string) {
  const snapshot = await loadPlatformSnapshot(supabase);
  const event = snapshot.events.find((e) => e.id === eventId);
  if (!event) return null;

  const rawProject = snapshot.rawProjects.find((p) => String(p.id) === eventId) || {};
  const organization = event.organizationId
    ? snapshot.organizations.find((o) => o.id === event.organizationId) || null
    : null;
  const payments = snapshot.paymentRecords.filter((p) => p.eventId === eventId);

  return {
    event: {
      ...event,
      themeId: rawProject.theme_id || null,
      packageId: rawProject.package_id || 'standard',
      websitePublishedAt: rawProject.website_published_at || null,
      autoApproveMessages: Boolean(rawProject.auto_approve_messages),
    },
    organization,
    payments,
  };
}

export async function listPlatformPayments(
  supabase: any,
  query: {
    search?: string;
    status?: string;
    provider?: string;
    dateFrom?: string;
    dateTo?: string;
    includeTest?: boolean;
    page?: number | string;
    limit?: number | string;
  } = {}
) {
  const snapshot = await loadPlatformSnapshot(supabase);
  let list = snapshot.paymentRecords.filter((p) => (query.includeTest ? true : !p.isTest));

  if (query.search && query.search.trim()) {
    const q = query.search.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.transactionId.toLowerCase().includes(q) ||
        (p.orderId || '').toLowerCase().includes(q) ||
        (p.stripeSessionId || '').toLowerCase().includes(q) ||
        (p.stripePaymentIntentId || '').toLowerCase().includes(q) ||
        (p.customerEmail || '').toLowerCase().includes(q) ||
        (p.customerName || '').toLowerCase().includes(q) ||
        p.organizationName.toLowerCase().includes(q) ||
        p.eventName.toLowerCase().includes(q) ||
        (p.eventSlug || '').toLowerCase().includes(q)
    );
  }

  if (query.status && query.status !== 'all') {
    list = list.filter((p) => p.status === query.status);
  }

  if (query.provider && query.provider !== 'all') {
    list = list.filter((p) => p.provider === query.provider);
  }

  if (query.dateFrom) {
    const fromMs = new Date(query.dateFrom).getTime();
    if (!Number.isNaN(fromMs)) {
      list = list.filter((p) => new Date(p.createdAt).getTime() >= fromMs);
    }
  }

  if (query.dateTo) {
    const toDate = new Date(query.dateTo);
    toDate.setUTCHours(23, 59, 59, 999);
    const toMs = toDate.getTime();
    if (!Number.isNaN(toMs)) {
      list = list.filter((p) => new Date(p.createdAt).getTime() <= toMs);
    }
  }

  return {
    ...paginateItems(list, query.page, query.limit),
    summary: snapshot.paymentSummary,
  };
}

export async function listActivityLogs(
  supabase: any,
  query: {
    action?: string;
    search?: string;
    organizationId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number | string;
    limit?: number | string;
  } = {}
): Promise<PaginatedResult<ActivityLogRecord>> {
  const snapshot = await loadPlatformSnapshot(supabase);
  let list = snapshot.activityLogs;

  if (query.action && query.action !== 'all') {
    list = list.filter((l) => l.action === query.action);
  }

  if (query.organizationId && query.organizationId !== 'all') {
    list = list.filter((l) => l.organizationId === query.organizationId);
  }

  if (query.search && query.search.trim()) {
    const q = query.search.trim().toLowerCase();
    list = list.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        (l.actorEmail || '').toLowerCase().includes(q) ||
        (l.summary || '').toLowerCase().includes(q) ||
        (l.targetUserId || '').toLowerCase().includes(q) ||
        (l.organizationId || '').toLowerCase().includes(q)
    );
  }

  if (query.dateFrom) {
    const fromMs = new Date(query.dateFrom).getTime();
    if (!Number.isNaN(fromMs)) {
      list = list.filter((l) => new Date(l.createdAt).getTime() >= fromMs);
    }
  }

  if (query.dateTo) {
    const toDate = new Date(query.dateTo);
    toDate.setUTCHours(23, 59, 59, 999);
    const toMs = toDate.getTime();
    if (!Number.isNaN(toMs)) {
      list = list.filter((l) => new Date(l.createdAt).getTime() <= toMs);
    }
  }

  return paginateItems(list, query.page, query.limit);
}

export async function getPlatformSettings(supabase: any): Promise<{
  settings: PlatformSettingsMap;
  updatedAt: string | null;
  updatedBy: string | null;
}> {
  const rows = await safeFetchTable(supabase, 'platform_settings');
  const settings: PlatformSettingsMap = { ...DEFAULT_PLATFORM_SETTINGS };
  let latestUpdate: string | null = null;
  let latestActor: string | null = null;

  for (const row of rows) {
    if (!row?.key) continue;
    const key = String(row.key);
    if (key in settings) {
      (settings as any)[key] = row.value;
    }
    if (row.updated_at && (!latestUpdate || new Date(row.updated_at).getTime() > new Date(latestUpdate).getTime())) {
      latestUpdate = row.updated_at;
      latestActor = row.updated_by || null;
    }
  }

  return {
    settings,
    updatedAt: latestUpdate,
    updatedBy: latestActor,
  };
}

export async function updatePlatformSettings(
  supabase: any,
  updates: Partial<PlatformSettingsMap>,
  actor: { id?: string; email?: string; role?: string }
) {
  const nowIso = new Date().toISOString();
  const allowedKeys: Array<keyof PlatformSettingsMap> = [
    'platform_name',
    'support_email',
    'allow_public_registration',
    'maintenance_mode',
    'default_event_price_usd',
    'default_event_duration_months',
  ];

  const rowsToUpsert: any[] = [];
  for (const key of allowedKeys) {
    if (updates[key] !== undefined) {
      rowsToUpsert.push({
        key,
        value: updates[key],
        updated_by: actor.email || actor.id || 'super_admin',
        updated_at: nowIso,
      });
    }
  }

  if (rowsToUpsert.length > 0) {
    const { error } = await supabase.from('platform_settings').upsert(rowsToUpsert);
    if (error) {
      throw new Error(error.message);
    }

    await recordPlatformActivity(supabase, {
      actorId: actor.id || null,
      actorEmail: actor.email || null,
      actorRole: actor.role || 'super_admin',
      action: 'SETTINGS_UPDATED',
      summary: `Updated platform settings (${rowsToUpsert.map((r) => r.key).join(', ')})`,
      metadata: { updatedKeys: rowsToUpsert.map((r) => r.key) },
    });
  }

  return getPlatformSettings(supabase);
}
