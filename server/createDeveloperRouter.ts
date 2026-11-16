import express from 'express';
import jwt from 'jsonwebtoken';
import type Stripe from 'stripe';
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

export interface DeveloperRouterDeps {
  getSupabase: () => any;
  getJwtSecret: () => string;
  getSuperAdminEmails?: () => string | undefined;
  getStripe?: () => Stripe | null;
  getStripeSecretKey?: () => string | undefined;
}

export function extractBearerOrCookieToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const cookieToken = req.cookies?.wedding_session;
  const token = bearer || (cookieToken && cookieToken !== 'null' && cookieToken !== 'undefined' ? cookieToken : null);
  return token || null;
}

/**
 * Reusable Express middleware validating active (non-suspended) user sessions.
 * Useful on /api/auth/me or protected routes.
 */
export async function verifySessionWithDb(
  req: express.Request,
  deps: DeveloperRouterDeps
): Promise<
  | { ok: true; user: any; token: string }
  | { ok: false; statusCode: number; error: string; code: string; suspendedReason?: string | null }
> {
  const token = extractBearerOrCookieToken(req);
  if (!token) {
    return { ok: false, statusCode: 401, error: 'Not authenticated', code: 'UNAUTHENTICATED' };
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, deps.getJwtSecret(), { algorithms: ['HS256'] });
  } catch (err: any) {
    return { ok: false, statusCode: 401, error: 'Invalid session', code: 'INVALID_SESSION' };
  }

  let supabase: any = null;
  try {
    supabase = deps.getSupabase();
  } catch {
    supabase = null;
  }

  const check = await resolveAuthenticatedSessionUser(
    supabase,
    decoded,
    deps.getSuperAdminEmails ? deps.getSuperAdminEmails() : undefined
  );
  if (check.ok === false) {
    return check;
  }

  return { ok: true, user: check.user, token };
}

export function createDeveloperRouter(deps: DeveloperRouterDeps): express.Router {
  const router = express.Router();

  // Strict server-side authorization middleware protecting EVERY /api/developer/* endpoint
  router.use(async (req, res, next) => {
    const token = extractBearerOrCookieToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, deps.getJwtSecret(), { algorithms: ['HS256'] });
    } catch (err: any) {
      return res.status(401).json({ error: 'Invalid or expired session', code: 'INVALID_SESSION' });
    }

    let supabase: any;
    try {
      supabase = deps.getSupabase();
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Database client unavailable' });
    }

    const authCheck = await requireSuperAdminSession(
      supabase,
      decoded,
      deps.getSuperAdminEmails ? deps.getSuperAdminEmails() : undefined
    );

    if (authCheck.ok === false) {
      return res.status(authCheck.statusCode).json({
        error: authCheck.error,
        code: authCheck.code,
      });
    }

    (req as any).superAdmin = authCheck.admin;
    (req as any).supabaseAdmin = supabase;
    next();
  });

  // 1. Current Super Admin Identity
  router.get('/me', (req, res) => {
    const admin = (req as any).superAdmin;
    res.json({
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

  // 2. Platform Overview KPIs & Registration Analytics
  router.get('/overview', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const data = await getDeveloperOverview(supabase);
      res.json({ success: true, ...data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load platform overview' });
    }
  });

  // 3. Organizations List
  router.get('/organizations', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const result = await listOrganizations(supabase, {
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        userRole: req.query.userRole as string | undefined,
        includeTest: req.query.includeTest === 'true',
        sortBy: req.query.sortBy as string | undefined,
        sortDir: req.query.sortDir === 'asc' ? 'asc' : 'desc',
        page: req.query.page as string | undefined,
        limit: req.query.limit as string | undefined,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list organizations' });
    }
  });

  // 4. Organization Detail
  router.get('/organizations/:id', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const detail = await getOrganizationDetail(supabase, req.params.id);
      if (!detail) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      res.json({ success: true, ...detail });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load organization details' });
    }
  });

  // 5. Organization Status Update
  router.patch('/organizations/:id/status', async (req, res) => {
    try {
      const { status } = req.body || {};
      if (!['active', 'suspended', 'inactive'].includes(status)) {
        return res.status(400).json({ error: 'Invalid organization status. Must be active, suspended, or inactive.' });
      }
      const supabase = (req as any).supabaseAdmin;
      const admin = (req as any).superAdmin;
      const updated = await updateOrganizationStatus(supabase, req.params.id, status, admin);
      if (!updated) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      res.json({ success: true, organization: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update organization status' });
    }
  });

  // 6. Users List
  router.get('/users', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const result = await listUsers(supabase, {
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        role: req.query.role as string | undefined,
        organizationId: req.query.organizationId as string | undefined,
        registeredFrom: req.query.registeredFrom as string | undefined,
        registeredTo: req.query.registeredTo as string | undefined,
        includeTest: req.query.includeTest === 'true',
        sortBy: req.query.sortBy as string | undefined,
        sortDir: req.query.sortDir === 'asc' ? 'asc' : 'desc',
        page: req.query.page as string | undefined,
        limit: req.query.limit as string | undefined,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list users' });
    }
  });

  // 7. User Detail
  router.get('/users/:id', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const detail = await getUserDetail(supabase, req.params.id);
      if (!detail) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ success: true, ...detail });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load user details' });
    }
  });

  // 8. Suspend User Account (Server-Side Enforced, Preserves Org & Event Data)
  router.post('/users/:id/suspend', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const admin = (req as any).superAdmin;
      const { reason } = req.body || {};
      const result = await suspendUserAccount(supabase, req.params.id, reason, admin);
      if (!result.ok) {
        return res.status((result as { ok: false; statusCode: number; error: string }).statusCode).json({
          error: (result as { ok: false; statusCode: number; error: string }).error,
        });
      }
      res.json({ success: true, user: result.user });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to suspend account' });
    }
  });

  // 9. Reactivate User Account
  router.post('/users/:id/reactivate', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const admin = (req as any).superAdmin;
      const result = await reactivateUserAccount(supabase, req.params.id, admin);
      if (!result.ok) {
        return res.status((result as { ok: false; statusCode: number; error: string }).statusCode).json({
          error: (result as { ok: false; statusCode: number; error: string }).error,
        });
      }
      res.json({ success: true, user: result.user });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to reactivate account' });
    }
  });

  // 10. Cross-Organization Events Inspection (Strictly Read-Only)
  router.get('/events', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const result = await listPlatformEvents(supabase, {
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        paymentStatus: req.query.paymentStatus as string | undefined,
        organizationId: req.query.organizationId as string | undefined,
        includeTest: req.query.includeTest === 'true',
        sortBy: req.query.sortBy as string | undefined,
        sortDir: req.query.sortDir === 'asc' ? 'asc' : 'desc',
        page: req.query.page as string | undefined,
        limit: req.query.limit as string | undefined,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list platform events' });
    }
  });

  router.get('/events/:id', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const detail = await getPlatformEventDetail(supabase, req.params.id);
      if (!detail) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json({ success: true, ...detail });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load event details' });
    }
  });

  // 11. Platform Payments Ledger & Verified Revenue Summary
  router.get('/payments', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const result = await listPlatformPayments(supabase, {
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        provider: req.query.provider as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        includeTest: req.query.includeTest === 'true',
        page: req.query.page as string | undefined,
        limit: req.query.limit as string | undefined,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load platform payments' });
    }
  });

  // 11b. Issue Full or Partial Stripe Refund (Super Admin only)
  router.post('/payments/:id/refund', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const admin = (req as any).superAdmin;
      const stripe = deps.getStripe ? deps.getStripe() : null;
      const stripeSecretKey = deps.getStripeSecretKey ? deps.getStripeSecretKey() : process.env.STRIPE_SECRET_KEY;
      const { amountCents, reason } = req.body || {};

      const result = await issueAdminStripeRefund({
        supabase,
        stripe,
        stripeSecretKey,
        paymentId: req.params.id,
        amountCents: amountCents !== undefined ? Number(amountCents) : undefined,
        reason,
        adminUser: { id: String(admin.id), email: String(admin.email) },
      });

      return res.status(result.statusCode).json(result.body);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to execute Stripe refund' });
    }
  });

  // 11c. Retry Stored Stripe Webhook Event (Super Admin only)
  router.post('/payments/:id/retry-webhook', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const admin = (req as any).superAdmin;
      const stripe = deps.getStripe ? deps.getStripe() : null;

      const result = await retryStripeWebhookByIdOrPayment({
        supabase,
        stripe,
        targetId: req.params.id,
        adminUser: { id: String(admin.id), email: String(admin.email) },
      });

      return res.status(result.statusCode).json(result.body);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to retry Stripe webhook' });
    }
  });

  // 12. Platform Activity Logs
  router.get('/activity-logs', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const result = await listActivityLogs(supabase, {
        action: req.query.action as string | undefined,
        search: req.query.search as string | undefined,
        organizationId: req.query.organizationId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page as string | undefined,
        limit: req.query.limit as string | undefined,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load activity logs' });
    }
  });

  // 13. Platform Settings
  router.get('/settings', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const data = await getPlatformSettings(supabase);
      res.json({ success: true, ...data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load platform settings' });
    }
  });

  router.put('/settings', async (req, res) => {
    try {
      const supabase = (req as any).supabaseAdmin;
      const admin = (req as any).superAdmin;
      const data = await updatePlatformSettings(supabase, req.body || {}, admin);
      res.json({ success: true, ...data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update platform settings' });
    }
  });

  return router;
}
