import type { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import {
  getDeveloperOverview,
  listOrganizations,
  getOrganizationDetail,
  updateOrganizationStatus,
  listUsers,
  getUserDetail,
  suspendUserAccount,
  reactivateUserAccount,
  listPlatformEvents,
  getPlatformEventDetail,
  listPlatformPayments,
  listActivityLogs,
  getPlatformSettings,
  updatePlatformSettings,
  requireSuperAdminSession,
  resolveAuthenticatedSessionUser,
} from './developerAdminService';
import {
  issueAdminStripeRefund,
  retryStripeWebhookByIdOrPayment,
} from './billingService';

export function extractWorkerToken(c: any): string | null {
  const authHeader = c.req.header('Authorization');
  const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const cookieToken = getCookie(c, 'wedding_session');
  const token = bearer || (cookieToken && cookieToken !== 'null' && cookieToken !== 'undefined' ? cookieToken : null);
  return token || null;
}

export function getWorkerSupabase(c: any) {
  const supabaseUrl = c.env?.SUPABASE_URL || c.env?.VITE_SUPABASE_URL;
  const serviceRoleKey =
    c.env?.SUPABASE_SERVICE_ROLE_KEY ||
    c.env?.SUPABASE_SERVICE_KEY ||
    c.env?.SUPABASE_SECRET_KEY ||
    c.env?.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function verifyWorkerSessionWithDb(c: any) {
  const token = extractWorkerToken(c);
  if (!token) {
    return { ok: false as const, statusCode: 401, error: 'Not authenticated', code: 'UNAUTHENTICATED' };
  }

  const jwtSecret = c.env?.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';
  let payload: any;
  try {
    payload = await verify(token, jwtSecret, 'HS256');
  } catch (err: any) {
    return { ok: false as const, statusCode: 401, error: 'Invalid session', code: 'INVALID_SESSION' };
  }

  const supabase = getWorkerSupabase(c);
  const superAdminEmails = c.env?.SUPER_ADMIN_EMAILS;
  return resolveAuthenticatedSessionUser(supabase, payload, superAdminEmails);
}

export function registerWorkerDeveloperRoutes(app: Hono<any>) {
  // Enforce server-side super_admin authorization on EVERY /api/developer/* endpoint
  app.use('/api/developer/*', async (c, next) => {
    const token = extractWorkerToken(c);
    if (!token) {
      return c.json({ error: 'Authentication required', code: 'UNAUTHENTICATED' }, 401);
    }

    const jwtSecret = c.env?.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';
    let decoded: any;
    try {
      decoded = await verify(token, jwtSecret, 'HS256');
    } catch {
      return c.json({ error: 'Invalid or expired session', code: 'INVALID_SESSION' }, 401);
    }

    const supabase = getWorkerSupabase(c);
    if (!supabase) {
      return c.json({ error: 'Database configuration missing' }, 500);
    }

    const authCheck = await requireSuperAdminSession(supabase, decoded, c.env?.SUPER_ADMIN_EMAILS);
    if (authCheck.ok === false) {
      return c.json({ error: authCheck.error, code: authCheck.code }, authCheck.statusCode as any);
    }

    c.set('superAdmin', authCheck.admin);
    c.set('supabaseAdmin', supabase);
    await next();
  });

  app.get('/api/developer/me', (c) => {
    const admin = c.get('superAdmin');
    return c.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        picture: admin.picture || null,
        role: 'super_admin',
        status: admin.status || 'active',
      },
    });
  });

  app.get('/api/developer/overview', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const data = await getDeveloperOverview(supabase);
      return c.json({ success: true, ...data });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to load platform overview' }, 500);
    }
  });

  app.get('/api/developer/organizations', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const result = await listOrganizations(supabase, {
        search: c.req.query('search'),
        status: c.req.query('status'),
        userRole: c.req.query('userRole'),
        includeTest: c.req.query('includeTest') === 'true',
        sortBy: c.req.query('sortBy'),
        sortDir: c.req.query('sortDir') === 'asc' ? 'asc' : 'desc',
        page: c.req.query('page'),
        limit: c.req.query('limit'),
      });
      return c.json({ success: true, ...result });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to list organizations' }, 500);
    }
  });

  app.get('/api/developer/organizations/:id', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const detail = await getOrganizationDetail(supabase, c.req.param('id'));
      if (!detail) return c.json({ error: 'Organization not found' }, 404);
      return c.json({ success: true, ...detail });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to load organization details' }, 500);
    }
  });

  app.patch('/api/developer/organizations/:id/status', async (c) => {
    try {
      const { status } = await c.req.json().catch(() => ({}));
      if (!['active', 'suspended', 'inactive'].includes(status)) {
        return c.json({ error: 'Invalid organization status' }, 400);
      }
      const supabase = c.get('supabaseAdmin');
      const admin = c.get('superAdmin');
      const updated = await updateOrganizationStatus(supabase, c.req.param('id'), status, admin);
      if (!updated) return c.json({ error: 'Organization not found' }, 404);
      return c.json({ success: true, organization: updated });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to update organization status' }, 500);
    }
  });

  app.get('/api/developer/users', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const result = await listUsers(supabase, {
        search: c.req.query('search'),
        status: c.req.query('status'),
        role: c.req.query('role'),
        organizationId: c.req.query('organizationId'),
        registeredFrom: c.req.query('registeredFrom'),
        registeredTo: c.req.query('registeredTo'),
        includeTest: c.req.query('includeTest') === 'true',
        sortBy: c.req.query('sortBy'),
        sortDir: c.req.query('sortDir') === 'asc' ? 'asc' : 'desc',
        page: c.req.query('page'),
        limit: c.req.query('limit'),
      });
      return c.json({ success: true, ...result });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to list users' }, 500);
    }
  });

  app.get('/api/developer/users/:id', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const detail = await getUserDetail(supabase, c.req.param('id'));
      if (!detail) return c.json({ error: 'User not found' }, 404);
      return c.json({ success: true, ...detail });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to load user details' }, 500);
    }
  });

  app.post('/api/developer/users/:id/suspend', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const admin = c.get('superAdmin');
      const { reason } = await c.req.json().catch(() => ({}));
      const result = await suspendUserAccount(supabase, c.req.param('id'), reason, admin);
      if (!result.ok) {
        const errRes = result as { ok: false; statusCode: number; error: string };
        return c.json({ error: errRes.error }, errRes.statusCode as any);
      }
      return c.json({ success: true, user: result.user });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to suspend account' }, 500);
    }
  });

  app.post('/api/developer/users/:id/reactivate', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const admin = c.get('superAdmin');
      const result = await reactivateUserAccount(supabase, c.req.param('id'), admin);
      if (!result.ok) {
        const errRes = result as { ok: false; statusCode: number; error: string };
        return c.json({ error: errRes.error }, errRes.statusCode as any);
      }
      return c.json({ success: true, user: result.user });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to reactivate account' }, 500);
    }
  });

  app.get('/api/developer/events', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const result = await listPlatformEvents(supabase, {
        search: c.req.query('search'),
        status: c.req.query('status'),
        paymentStatus: c.req.query('paymentStatus'),
        organizationId: c.req.query('organizationId'),
        includeTest: c.req.query('includeTest') === 'true',
        sortBy: c.req.query('sortBy'),
        sortDir: c.req.query('sortDir') === 'asc' ? 'asc' : 'desc',
        page: c.req.query('page'),
        limit: c.req.query('limit'),
      });
      return c.json({ success: true, ...result });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to list events' }, 500);
    }
  });

  app.get('/api/developer/events/:id', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const detail = await getPlatformEventDetail(supabase, c.req.param('id'));
      if (!detail) return c.json({ error: 'Event not found' }, 404);
      return c.json({ success: true, ...detail });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to load event details' }, 500);
    }
  });

  app.get('/api/developer/payments', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const result = await listPlatformPayments(supabase, {
        search: c.req.query('search'),
        status: c.req.query('status'),
        provider: c.req.query('provider'),
        dateFrom: c.req.query('dateFrom'),
        dateTo: c.req.query('dateTo'),
        includeTest: c.req.query('includeTest') === 'true',
        page: c.req.query('page'),
        limit: c.req.query('limit'),
      });
      return c.json({ success: true, ...result });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to load payments' }, 500);
    }
  });

  app.post('/api/developer/payments/:id/refund', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const admin = c.get('superAdmin');
      const stripeSecret = c.env?.STRIPE_SECRET_KEY;
      const stripe =
        stripeSecret && (stripeSecret.startsWith('sk_test_') || stripeSecret.startsWith('sk_live_'))
          ? new Stripe(stripeSecret, { httpClient: Stripe.createFetchHttpClient() })
          : null;
      const body = await c.req.json().catch(() => ({}));

      const result = await issueAdminStripeRefund({
        supabase,
        stripe,
        stripeSecretKey: stripeSecret,
        paymentId: c.req.param('id'),
        amountCents: body?.amountCents !== undefined ? Number(body.amountCents) : undefined,
        reason: body?.reason,
        adminUser: { id: String(admin.id), email: String(admin.email) },
      });

      return c.json(result.body, result.statusCode as any);
    } catch (err: any) {
      return c.json({ error: err?.message || 'Failed to execute Stripe refund' }, 500);
    }
  });

  app.post('/api/developer/payments/:id/retry-webhook', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const admin = c.get('superAdmin');
      const stripeSecret = c.env?.STRIPE_SECRET_KEY;
      const stripe =
        stripeSecret && (stripeSecret.startsWith('sk_test_') || stripeSecret.startsWith('sk_live_'))
          ? new Stripe(stripeSecret, { httpClient: Stripe.createFetchHttpClient() })
          : null;

      const result = await retryStripeWebhookByIdOrPayment({
        supabase,
        stripe,
        targetId: c.req.param('id'),
        adminUser: { id: String(admin.id), email: String(admin.email) },
      });

      return c.json(result.body, result.statusCode as any);
    } catch (err: any) {
      return c.json({ error: err?.message || 'Failed to retry Stripe webhook' }, 500);
    }
  });

  app.get('/api/developer/activity-logs', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const result = await listActivityLogs(supabase, {
        action: c.req.query('action'),
        search: c.req.query('search'),
        organizationId: c.req.query('organizationId'),
        dateFrom: c.req.query('dateFrom'),
        dateTo: c.req.query('dateTo'),
        page: c.req.query('page'),
        limit: c.req.query('limit'),
      });
      return c.json({ success: true, ...result });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to load activity logs' }, 500);
    }
  });

  app.get('/api/developer/settings', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const data = await getPlatformSettings(supabase);
      return c.json({ success: true, ...data });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to load platform settings' }, 500);
    }
  });

  app.put('/api/developer/settings', async (c) => {
    try {
      const supabase = c.get('supabaseAdmin');
      const admin = c.get('superAdmin');
      const body = await c.req.json().catch(() => ({}));
      const data = await updatePlatformSettings(supabase, body, admin);
      return c.json({ success: true, ...data });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to update platform settings' }, 500);
    }
  });
}
