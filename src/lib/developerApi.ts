import { API_BASE } from './config';
import { authenticatedFetch } from './auth';

export class DeveloperApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function devFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await authenticatedFetch(`${API_BASE}${path}`, options);
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new DeveloperApiError(
      res.status,
      data?.error || `Request failed with status ${res.status}`,
      data?.code
    );
  }
  return data as T;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      sp.set(k, String(v));
    }
  }
  const str = sp.toString();
  return str ? `?${str}` : '';
}

export interface DeveloperAdminIdentity {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
  role: 'super_admin';
  status: 'active';
}

export interface OverviewResponse {
  kpis: {
    totalOrganizations: number;
    totalUsers: number;
    totalEvents: number;
    activeEvents: number;
    expiredEvents: number;
    suspendedUsers: number;
    completedPaymentsCount: number;
    totalRevenueCents: number;
    totalRevenueUsd: number;
    pendingPaymentsCount: number;
    refundedPaymentsCount: number;
  };
  registrationAnalytics: {
    daily: Array<{ key: string; label: string; users: number; organizations: number }>;
    weekly: Array<{ key: string; label: string; users: number; organizations: number }>;
    monthly: Array<{ key: string; label: string; users: number; organizations: number }>;
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
  };
  recentOrganizations: OrganizationRow[];
  recentUsers: UserRow[];
  recentEvents: PlatformEventRow[];
  recentPayments: PaymentRow[];
  recentActivityLogs: ActivityLogRow[];
}

export interface OrganizationRow {
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

export interface UserRow {
  id: string;
  externalUserId: string | null;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  authProvider: string;
  role: 'user' | 'agency_owner' | 'agency_member' | 'super_admin';
  status: 'active' | 'suspended';
  isVerified: boolean;
  organizationCount: number;
  organizationIds: string[];
  organizationNames: string[];
  eventCount: number;
  createdAt: string;
  lastLoginAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  isTest: boolean;
}

export interface PlatformEventRow {
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

export interface PaymentRow {
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

export interface ActivityLogRow {
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

export interface PaginatedApiResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PlatformSettingsState {
  platform_name: string;
  support_email: string;
  allow_public_registration: boolean;
  maintenance_mode: boolean;
  default_event_price_usd: number;
  default_event_duration_months: number;
}

export const developerApi = {
  getMe: () => devFetch<{ success: boolean; admin: DeveloperAdminIdentity }>('/api/developer/me'),

  getOverview: () => devFetch<OverviewResponse>('/api/developer/overview'),

  getOrganizations: (params: Record<string, any> = {}) =>
    devFetch<PaginatedApiResponse<OrganizationRow>>(`/api/developer/organizations${buildQuery(params)}`),

  getOrganizationDetail: (id: string) =>
    devFetch<{
      organization: OrganizationRow;
      owner: UserRow | null;
      members: UserRow[];
      events: PlatformEventRow[];
      payments: PaymentRow[];
      expirySummary: {
        activeCount: number;
        expiringSoonCount: number;
        expiredCount: number;
        unpaidCount: number;
      };
      activityLogs: ActivityLogRow[];
    }>(`/api/developer/organizations/${encodeURIComponent(id)}`),

  updateOrganizationStatus: (id: string, status: 'active' | 'suspended' | 'inactive') =>
    devFetch<{ success: boolean; organization: any }>(`/api/developer/organizations/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),

  getUsers: (params: Record<string, any> = {}) =>
    devFetch<PaginatedApiResponse<UserRow>>(`/api/developer/users${buildQuery(params)}`),

  getUserDetail: (id: string) =>
    devFetch<{
      user: UserRow;
      organizations: OrganizationRow[];
      events: PlatformEventRow[];
      payments: PaymentRow[];
      activityLogs: ActivityLogRow[];
    }>(`/api/developer/users/${encodeURIComponent(id)}`),

  suspendUser: (id: string, reason: string) =>
    devFetch<{ success: boolean; user: UserRow }>(`/api/developer/users/${encodeURIComponent(id)}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }),

  reactivateUser: (id: string) =>
    devFetch<{ success: boolean; user: UserRow }>(`/api/developer/users/${encodeURIComponent(id)}/reactivate`, {
      method: 'POST',
    }),

  getEvents: (params: Record<string, any> = {}) =>
    devFetch<PaginatedApiResponse<PlatformEventRow>>(`/api/developer/events${buildQuery(params)}`),

  getEventDetail: (id: string) =>
    devFetch<{
      event: PlatformEventRow & {
        themeId?: string | null;
        packageId?: string;
        websitePublishedAt?: string | null;
        autoApproveMessages?: boolean;
      };
      organization: OrganizationRow | null;
      payments: PaymentRow[];
    }>(`/api/developer/events/${encodeURIComponent(id)}`),

  getPayments: (params: Record<string, any> = {}) =>
    devFetch<
      PaginatedApiResponse<PaymentRow> & {
        summary: {
          totalRevenueCents: number;
          totalRevenueUsd: number;
          completedCount: number;
          pendingCount: number;
          failedCount: number;
          refundedCount: number;
          partiallyRefundedCount?: number;
          cancelledCount: number;
          refundedAmountCents: number;
        };
      }
    >(`/api/developer/payments${buildQuery(params)}`),

  issuePaymentRefund: (id: string, payload: { amountCents?: number; reason?: string } = {}) =>
    devFetch<{
      success: boolean;
      refundId: string;
      amountRefundedCents: number;
      cumulativeRefundedCents: number;
      refundStatus: 'full' | 'partial';
      entitlementRevoked?: boolean;
    }>(`/api/developer/payments/${encodeURIComponent(id)}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  retryPaymentWebhook: (id: string) =>
    devFetch<{
      received?: boolean;
      activated?: boolean;
      retriedWebhookId?: string;
      eventType?: string;
      error?: string;
    }>(`/api/developer/payments/${encodeURIComponent(id)}/retry-webhook`, {
      method: 'POST',
    }),

  getActivityLogs: (params: Record<string, any> = {}) =>
    devFetch<PaginatedApiResponse<ActivityLogRow>>(`/api/developer/activity-logs${buildQuery(params)}`),

  getSettings: () =>
    devFetch<{
      settings: PlatformSettingsState;
      updatedAt: string | null;
      updatedBy: string | null;
    }>('/api/developer/settings'),

  updateSettings: (updates: Partial<PlatformSettingsState>) =>
    devFetch<{
      settings: PlatformSettingsState;
      updatedAt: string | null;
      updatedBy: string | null;
    }>('/api/developer/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }),
};
