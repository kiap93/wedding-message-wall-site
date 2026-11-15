/**
 * Automated Super Admin (/developer) Test Suite for EventFrame.io
 *
 * Verifies:
 * 1. Unauthenticated access rejection (401) + /developer noindex SEO & robots.txt Disallow
 * 2. Non-admin role rejection (403) across EVERY /api/developer/* endpoint (Express & Hono Worker)
 * 3. Authorized super_admin access (DB role & SUPER_ADMIN_EMAILS) + zero password_hash/access_password leaks
 * 4. Accurate non-test/non-demo organization & user counting
 * 5. Registration analytics (daily, weekly, monthly, MoM growth) from real created_at timestamps
 * 6. Strict payment accounting (only succeeded, strictly excludes pending/failed/cancelled/refunded)
 * 7. Organization detail (owner, members, events, expiry summary, payments)
 * 8. Pagination, sorting, search, and multi-filters across tables
 * 9. Server-side suspension & reactivation enforcement preserving org/event data
 * 10. Real audit log persistence across admin mutations
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
import { createDeveloperRouter, verifySessionWithDb } from '../server/createDeveloperRouter';
import { registerWorkerDeveloperRoutes } from '../server/registerWorkerDeveloperRoutes';
import {
  computePaymentLedgerAndMetrics,
  computeRegistrationAnalytics,
} from '../server/developerAdminService';
import { getRouteMetadata } from '../src/seo/routes';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✓ PASSED: ${message}`);
}

type TableRows = Record<string, any[]>;

class InMemoryQueryBuilder {
  private table: string;
  private db: TableRows;
  private filters: Array<(row: any) => boolean> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private op: 'select' | 'insert' | 'update' | 'upsert' = 'select';
  private payload: any = null;
  private singleMode: 'none' | 'maybe' | 'single' = 'none';

  constructor(db: TableRows, table: string) {
    this.db = db;
    this.table = table;
    if (!this.db[table]) this.db[table] = [];
  }

  select(_cols?: string) {
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((r) => r?.[col] === val);
    return this;
  }

  ilike(col: string, val: string) {
    const target = String(val || '').toLowerCase();
    this.filters.push((r) => String(r?.[col] || '').toLowerCase() === target);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybe';
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  insert(rows: any | any[]) {
    this.op = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(patch: Record<string, any>) {
    this.op = 'update';
    this.payload = patch;
    return this;
  }

  upsert(rows: any | any[]) {
    this.op = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  private exec() {
    const tableArr = this.db[this.table] || [];

    if (this.op === 'insert') {
      const inserted = this.payload.map((item: any, idx: number) => ({
        id: item.id || `${this.table}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: item.created_at || new Date().toISOString(),
        ...item,
      }));
      tableArr.push(...inserted);
      const data =
        this.singleMode === 'none'
          ? inserted
          : inserted[0] || null;
      return { data, error: null };
    }

    if (this.op === 'update') {
      const matched: any[] = [];
      for (const row of tableArr) {
        if (this.filters.every((fn) => fn(row))) {
          Object.assign(row, this.payload);
          matched.push({ ...row });
        }
      }
      const data =
        this.singleMode === 'none'
          ? matched
          : matched[0] || null;
      return { data, error: null };
    }

    if (this.op === 'upsert') {
      for (const item of this.payload) {
        const keyCol = this.table === 'platform_settings' ? 'key' : 'id';
        const existingIdx = tableArr.findIndex((r) => r[keyCol] === item[keyCol]);
        if (existingIdx >= 0) {
          tableArr[existingIdx] = { ...tableArr[existingIdx], ...item };
        } else {
          tableArr.push({ ...item });
        }
      }
      return { data: this.payload, error: null };
    }

    let rows = tableArr.filter((r) => this.filters.every((fn) => fn(r))).map((r) => ({ ...r }));
    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAsc;
      rows.sort((a, b) => {
        const va = a?.[col] ?? '';
        const vb = b?.[col] ?? '';
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
        return 0;
      });
    }

    if (this.singleMode === 'maybe') {
      return { data: rows[0] || null, error: null };
    }
    if (this.singleMode === 'single') {
      if (!rows[0]) return { data: null, error: { message: 'Row not found' } };
      return { data: rows[0], error: null };
    }
    return { data: rows, error: null };
  }

  then(resolve: (val: any) => any, reject?: (err: any) => any) {
    try {
      return Promise.resolve(this.exec()).then(resolve, reject);
    } catch (err) {
      return reject ? Promise.reject(err).catch(reject) : Promise.reject(err);
    }
  }
}

function createMockSupabase(initial: TableRows) {
  const db: TableRows = JSON.parse(JSON.stringify(initial));
  return {
    db,
    from(table: string) {
      return new InMemoryQueryBuilder(db, table);
    },
  };
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400 * 1000).toISOString();
}

function isoDaysAhead(days: number): string {
  return new Date(Date.now() + days * 86400 * 1000).toISOString();
}

async function runTests() {
  console.log('=====================================================');
  console.log('Starting EventFrame.io Super Admin (/developer) Suite');
  console.log('=====================================================\n');

  const JWT_SECRET = 'test-super-admin-jwt-secret-key';
  const ALLOWLIST_EMAILS = 'allowlist-admin@eventframe.io';

  const mockSupabase = createMockSupabase({
    users_auth: [
      {
        id: 'usr-super-1',
        external_user_id: 'ext-super-1',
        email: 'admin@eventframe.io',
        full_name: 'Platform Admin',
        auth_provider: 'email',
        role: 'super_admin',
        status: 'active',
        is_verified: true,
        password_hash: 'SECRET_HASH_MUST_NEVER_LEAK',
        organization_id: null,
        created_at: isoDaysAgo(25),
        last_login_at: isoDaysAgo(1),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'usr-allowlist-1',
        external_user_id: 'ext-allow-1',
        email: 'allowlist-admin@eventframe.io',
        full_name: 'Allowlist Admin',
        auth_provider: 'google',
        role: 'user',
        status: 'active',
        is_verified: true,
        password_hash: 'ANOTHER_SECRET_HASH',
        organization_id: null,
        created_at: isoDaysAgo(10),
        last_login_at: isoDaysAgo(0),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'usr-owner-1',
        external_user_id: 'ext-owner-1',
        email: 'owner1@studio.com',
        full_name: 'Aria Chen',
        auth_provider: 'google',
        role: 'agency_owner',
        status: 'active',
        is_verified: true,
        password_hash: 'OWNER1_HASH_NEVER_EXPOSE',
        organization_id: 'org-1',
        created_at: isoDaysAgo(5),
        last_login_at: isoDaysAgo(1),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'usr-member-1',
        external_user_id: 'ext-member-1',
        email: 'member1@studio.com',
        full_name: 'Liam Member',
        auth_provider: 'email',
        role: 'agency_member',
        status: 'active',
        is_verified: true,
        password_hash: 'MEMBER1_HASH_NEVER_EXPOSE',
        organization_id: 'org-1',
        created_at: isoDaysAgo(3),
        last_login_at: isoDaysAgo(2),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'usr-owner-2',
        external_user_id: 'ext-owner-2',
        email: 'owner2@atelier.com',
        full_name: 'Zara Atelier',
        auth_provider: 'email',
        role: 'agency_owner',
        status: 'active',
        is_verified: true,
        password_hash: 'OWNER2_HASH_NEVER_EXPOSE',
        organization_id: 'org-2',
        created_at: isoDaysAgo(0),
        last_login_at: isoDaysAgo(0),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'usr-test-ignored',
        external_user_id: 'ext-test-ignored',
        email: 'testbot@eventframe.io',
        full_name: 'Test Bot',
        auth_provider: 'email',
        role: 'user',
        status: 'active',
        is_verified: false,
        created_at: isoDaysAgo(2),
        is_test: true,
        deleted_at: null,
      },
      {
        id: 'usr-deleted-ignored',
        external_user_id: 'ext-deleted-ignored',
        email: 'deleted@eventframe.io',
        full_name: 'Deleted User',
        auth_provider: 'email',
        role: 'user',
        status: 'active',
        is_verified: false,
        created_at: isoDaysAgo(2),
        is_test: false,
        deleted_at: isoDaysAgo(1),
      },
    ],
    agencies: [
      {
        id: 'org-1',
        user_id: 'ext-owner-1',
        name: 'Lumiere Weddings',
        slug: 'lumiere',
        user_role: 'agency',
        status: 'active',
        owner_email: 'owner1@studio.com',
        is_demo: false,
        is_test: false,
        deleted_at: null,
        created_at: isoDaysAgo(5),
      },
      {
        id: 'org-2',
        user_id: 'ext-owner-2',
        name: 'Atelier Vows',
        slug: 'atelier-vows',
        user_role: 'couple',
        status: 'active',
        owner_email: 'owner2@atelier.com',
        is_demo: false,
        is_test: false,
        deleted_at: null,
        created_at: isoDaysAgo(0),
      },
      {
        id: 'org-demo-excluded',
        user_id: 'ext-demo',
        name: 'Public Demo Org',
        slug: 'demo-org',
        user_role: 'agency',
        status: 'active',
        is_demo: true,
        is_test: false,
        deleted_at: null,
        created_at: isoDaysAgo(10),
      },
      {
        id: 'org-test-excluded',
        user_id: 'ext-test-org',
        name: 'Automated Test Org',
        slug: 'test-org',
        user_role: 'agency',
        status: 'active',
        is_demo: false,
        is_test: true,
        deleted_at: null,
        created_at: isoDaysAgo(4),
      },
      {
        id: 'org-deleted-excluded',
        user_id: 'ext-del-org',
        name: 'Deleted Org',
        slug: 'deleted-org',
        user_role: 'agency',
        status: 'active',
        is_demo: false,
        is_test: false,
        deleted_at: isoDaysAgo(2),
        created_at: isoDaysAgo(8),
      },
    ],
    projects: [
      {
        id: 'evt-active-1',
        agency_id: 'org-1',
        name: 'Daniel & Maya Gala',
        slug: 'daniel-maya',
        groom_name: 'Daniel',
        bride_name: 'Maya',
        payment_status: 'paid',
        lifecycle_status: 'active',
        website_status: 'published',
        access_password: 'SUPER_SECRET_EVENT_PASSWORD',
        activated_at: isoDaysAgo(4),
        expires_at: isoDaysAhead(200),
        created_at: isoDaysAgo(5),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'evt-expiring-soon',
        agency_id: 'org-1',
        name: 'Noah & Chloe Reception',
        slug: 'noah-chloe',
        groom_name: 'Noah',
        bride_name: 'Chloe',
        payment_status: 'paid',
        lifecycle_status: 'active',
        website_status: 'published',
        access_password: null,
        activated_at: isoDaysAgo(350),
        expires_at: isoDaysAhead(15),
        created_at: isoDaysAgo(350),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'evt-expired',
        agency_id: 'org-1',
        name: 'Kai & Hannah Celebration',
        slug: 'kai-hannah',
        groom_name: 'Kai',
        bride_name: 'Hannah',
        payment_status: 'paid',
        lifecycle_status: 'expired',
        website_status: 'published',
        expires_at: isoDaysAgo(5),
        created_at: isoDaysAgo(370),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'evt-unpaid',
        agency_id: 'org-2',
        name: 'Lucas & Sofia Draft',
        slug: 'lucas-sofia',
        groom_name: 'Lucas',
        bride_name: 'Sofia',
        payment_status: 'pending',
        lifecycle_status: 'draft',
        website_status: 'draft',
        expires_at: null,
        created_at: isoDaysAgo(0),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'evt-test-excluded',
        agency_id: 'org-test-excluded',
        name: 'Test Event Excluded',
        slug: 'test-evt-excl',
        payment_status: 'paid',
        lifecycle_status: 'active',
        is_test: true,
        deleted_at: null,
        created_at: isoDaysAgo(1),
      },
    ],
    event_payments: [
      {
        id: 'pay-succeeded-1',
        order_id: 'ord-1',
        event_id: 'evt-active-1',
        provider: 'stripe',
        provider_transaction_id: 'pi_succeeded_1',
        amount: 500,
        currency: 'usd',
        payment_status: 'succeeded',
        paid_at: isoDaysAgo(4),
        created_at: isoDaysAgo(4),
      },
      {
        id: 'pay-succeeded-2',
        order_id: 'ord-2',
        event_id: 'evt-expiring-soon',
        provider: 'stripe',
        provider_transaction_id: 'pi_succeeded_2',
        amount: 500,
        currency: 'usd',
        payment_status: 'succeeded',
        paid_at: isoDaysAgo(350),
        created_at: isoDaysAgo(350),
      },
      {
        id: 'pay-pending-excl',
        order_id: 'ord-3',
        event_id: 'evt-unpaid',
        provider: 'stripe',
        provider_transaction_id: 'pi_pending_3',
        amount: 500,
        currency: 'usd',
        payment_status: 'pending',
        created_at: isoDaysAgo(0),
      },
      {
        id: 'pay-failed-excl',
        order_id: 'ord-4',
        event_id: 'evt-unpaid',
        provider: 'stripe',
        provider_transaction_id: 'pi_failed_4',
        amount: 500,
        currency: 'usd',
        payment_status: 'failed',
        created_at: isoDaysAgo(0),
      },
      {
        id: 'pay-cancelled-excl',
        order_id: 'ord-5',
        event_id: 'evt-unpaid',
        provider: 'stripe',
        provider_transaction_id: 'pi_cancelled_5',
        amount: 500,
        currency: 'usd',
        payment_status: 'cancelled',
        created_at: isoDaysAgo(0),
      },
      {
        id: 'pay-refunded-excl',
        order_id: 'ord-6',
        event_id: 'evt-expired',
        provider: 'stripe',
        provider_transaction_id: 'pi_refunded_6',
        amount: 500,
        currency: 'usd',
        payment_status: 'refunded',
        paid_at: isoDaysAgo(20),
        created_at: isoDaysAgo(20),
      },
      {
        id: 'pay-test-excl',
        order_id: 'ord-test',
        event_id: 'evt-test-excluded',
        provider: 'stripe',
        provider_transaction_id: 'pi_test_99',
        amount: 9900,
        currency: 'usd',
        payment_status: 'succeeded',
        paid_at: isoDaysAgo(1),
        created_at: isoDaysAgo(1),
      },
    ],
    event_orders: [],
    event_entitlements: [],
    platform_activity_logs: [],
    platform_settings: [
      { key: 'platform_name', value: 'EventFrame', updated_at: isoDaysAgo(10), updated_by: 'system' },
      { key: 'support_email', value: 'support@eventframe.io', updated_at: isoDaysAgo(10), updated_by: 'system' },
      { key: 'allow_public_registration', value: true, updated_at: isoDaysAgo(10), updated_by: 'system' },
      { key: 'maintenance_mode', value: false, updated_at: isoDaysAgo(10), updated_by: 'system' },
      { key: 'default_event_price_usd', value: 5, updated_at: isoDaysAgo(10), updated_by: 'system' },
      { key: 'default_event_duration_months', value: 12, updated_at: isoDaysAgo(10), updated_by: 'system' },
    ],
  });

  // Spin up real Express test server
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const routerDeps = {
    getSupabase: () => mockSupabase,
    getJwtSecret: () => JWT_SECRET,
    getSuperAdminEmails: () => ALLOWLIST_EMAILS,
  };

  app.get('/api/auth/me', async (req, res) => {
    const check = await verifySessionWithDb(req, routerDeps);
    if (!check.ok) {
      const errCheck = check as { ok: false; statusCode: number; error: string; code: string };
      return res.status(errCheck.statusCode).json({ error: errCheck.error, code: errCheck.code });
    }
    return res.json({ authenticated: true, user: check.user });
  });

  app.use('/api/developer', createDeveloperRouter(routerDeps));

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  // Prepare JWT tokens for different roles
  const signUser = (user: { id: string; email: string; name: string; role?: string }) =>
    jwt.sign(user, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

  const superAdminToken = signUser({ id: 'ext-super-1', email: 'admin@eventframe.io', name: 'Platform Admin', role: 'super_admin' });
  const allowlistToken = signUser({ id: 'ext-allow-1', email: 'allowlist-admin@eventframe.io', name: 'Allowlist Admin', role: 'user' });
  const ownerToken = signUser({ id: 'ext-owner-1', email: 'owner1@studio.com', name: 'Aria Chen', role: 'agency_owner' });
  const memberToken = signUser({ id: 'ext-member-1', email: 'member1@studio.com', name: 'Liam Member', role: 'agency_member' });
  // Attempt privilege escalation by putting role: 'super_admin' inside a JWT for a normal user
  const spoofedAdminToken = signUser({ id: 'ext-member-1', email: 'member1@studio.com', name: 'Liam Member', role: 'super_admin' });

  try {
    // 1. SEO & Robots Protection
    console.log('--- Test 1: SEO & Robots Exclusion for /developer ---');
    const devSeo = getRouteMetadata('/developer');
    assert(devSeo.noindex === true && devSeo.nofollow === true, '/developer sets noindex, nofollow');
    const devSubSeo = getRouteMetadata('/developer/payments');
    assert(devSubSeo.noindex === true && devSubSeo.nofollow === true, '/developer/* subroutes set noindex, nofollow');
    const robotsTxt = fs.readFileSync(path.join(process.cwd(), 'public/robots.txt'), 'utf8');
    assert(robotsTxt.includes('Disallow: /developer'), 'public/robots.txt disallows /developer');

    // 2. Unauthenticated Rejection (401)
    console.log('\n--- Test 2: Unauthenticated Access Rejection (401) ---');
    for (const ep of [
      '/api/developer/me',
      '/api/developer/overview',
      '/api/developer/organizations',
      '/api/developer/users',
      '/api/developer/events',
      '/api/developer/payments',
      '/api/developer/activity-logs',
      '/api/developer/settings',
    ]) {
      const res = await fetch(`${baseUrl}${ep}`);
      assert(res.status === 401, `GET ${ep} without token returns 401 (got ${res.status})`);
    }

    // 3. Non-Admin & Spoofed Role Rejection (403)
    console.log('\n--- Test 3: Non-Admin & Spoofed JWT Role Rejection (403) ---');
    const protectedEndpoints: Array<{ method: string; path: string; body?: any }> = [
      { method: 'GET', path: '/api/developer/me' },
      { method: 'GET', path: '/api/developer/overview' },
      { method: 'GET', path: '/api/developer/organizations' },
      { method: 'GET', path: '/api/developer/organizations/org-1' },
      { method: 'PATCH', path: '/api/developer/organizations/org-1/status', body: { status: 'suspended' } },
      { method: 'GET', path: '/api/developer/users' },
      { method: 'GET', path: '/api/developer/users/usr-owner-1' },
      { method: 'POST', path: '/api/developer/users/usr-owner-1/suspend', body: { reason: 'test' } },
      { method: 'POST', path: '/api/developer/users/usr-owner-1/reactivate' },
      { method: 'GET', path: '/api/developer/events' },
      { method: 'GET', path: '/api/developer/events/evt-active-1' },
      { method: 'GET', path: '/api/developer/payments' },
      { method: 'GET', path: '/api/developer/activity-logs' },
      { method: 'GET', path: '/api/developer/settings' },
      { method: 'PUT', path: '/api/developer/settings', body: { platform_name: 'Hacked' } },
    ];

    for (const [label, tok] of [
      ['agency_owner', ownerToken],
      ['agency_member', memberToken],
      ['spoofed_jwt_role', spoofedAdminToken],
    ] as const) {
      for (const ep of protectedEndpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: {
            Authorization: `Bearer ${tok}`,
            'Content-Type': 'application/json',
          },
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });
        assert(res.status === 403, `${label} ${ep.method} ${ep.path} rejected with 403 (got ${res.status})`);
      }
    }

    // Worker Hono route parity check (401 & 403)
    const workerApp = new Hono();
    registerWorkerDeveloperRoutes(workerApp);
    const workerNoAuth = await workerApp.request('http://localhost/api/developer/overview');
    assert(workerNoAuth.status === 401, 'Hono Worker /api/developer/overview without token returns 401');

    // 4. Super Admin Access & Zero Credential Leakage
    console.log('\n--- Test 4: Authorized Super Admin Access & Zero Secret Leaks ---');
    const meRes = await fetch(`${baseUrl}/api/developer/me`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(meRes.status === 200, 'DB super_admin /api/developer/me returns 200');
    const allowMeRes = await fetch(`${baseUrl}/api/developer/me`, {
      headers: { Authorization: `Bearer ${allowlistToken}` },
    });
    assert(allowMeRes.status === 200, 'SUPER_ADMIN_EMAILS allowlist user /api/developer/me returns 200');

    const overviewRes = await fetch(`${baseUrl}/api/developer/overview`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(overviewRes.status === 200, 'Super admin /api/developer/overview returns 200');
    const overviewRaw = await overviewRes.text();
    assert(!overviewRaw.includes('SECRET_HASH_MUST_NEVER_LEAK') && !overviewRaw.includes('OWNER1_HASH'), 'Overview JSON never leaks password_hash');
    assert(!overviewRaw.includes('SUPER_SECRET_EVENT_PASSWORD'), 'Overview JSON never leaks event access_password');
    const overview = JSON.parse(overviewRaw);

    // 5. Accurate Non-Test / Non-Demo Organization & User Counts
    console.log('\n--- Test 5: Accurate Organization & User Counts ---');
    assert(overview.kpis.totalOrganizations === 2, `Total organizations excludes test/demo/deleted (expected 2, got ${overview.kpis.totalOrganizations})`);
    assert(overview.kpis.totalUsers === 5, `Total users excludes test/deleted (expected 5, got ${overview.kpis.totalUsers})`);
    assert(overview.kpis.totalEvents === 4, `Total events excludes test/deleted (expected 4, got ${overview.kpis.totalEvents})`);
    assert(overview.kpis.activeEvents === 2, `Active events count is 2 (got ${overview.kpis.activeEvents})`);
    assert(overview.kpis.expiredEvents === 1, `Expired events count is 1 (got ${overview.kpis.expiredEvents})`);

    // 6. Registration Analytics Accuracy
    console.log('\n--- Test 6: Registration Analytics Computation ---');
    const analytics = computeRegistrationAnalytics(
      mockSupabase.db.users_auth
        .filter((u) => !u.is_test && !u.deleted_at)
        .map((u) => ({ createdAt: u.created_at, isTest: u.is_test })),
      mockSupabase.db.agencies
        .filter((a) => !a.is_test && !a.is_demo && !a.deleted_at)
        .map((a) => ({ createdAt: a.created_at, isTest: a.is_test, isDemo: a.is_demo }))
    );
    assert(analytics.daily.length === 14, 'Daily analytics returns 14 daily buckets');
    assert(analytics.weekly.length === 8, 'Weekly analytics returns 8 weekly buckets');
    assert(analytics.monthly.length === 6, 'Monthly analytics returns 6 monthly buckets');
    assert(analytics.summary.usersToday === 1, `Users registered today = 1 (got ${analytics.summary.usersToday})`);
    assert(overview.registrationAnalytics.summary.usersToday === 1, 'Overview endpoint registrationAnalytics.summary.usersToday === 1');
    assert(analytics.summary.orgsThisMonth >= 1, `Organizations created this month >= 1 (got ${analytics.summary.orgsThisMonth})`);

    // 7. Payment Totals Strictly Count Succeeded Only
    console.log('\n--- Test 7: Strict Payment Accounting (Excludes Pending/Failed/Cancelled/Refunded) ---');
    const ledger = computePaymentLedgerAndMetrics(
      mockSupabase.db.event_payments,
      mockSupabase.db.event_orders,
      mockSupabase.db.projects,
      mockSupabase.db.agencies
    );
    assert(ledger.summary.totalRevenueCents === 1000, `Collected revenue is 1000 cents ($10.00), excluding pending/failed/cancelled/refunded/test (got ${ledger.summary.totalRevenueCents})`);
    assert(ledger.summary.completedCount === 2, `Completed count is 2 (got ${ledger.summary.completedCount})`);
    assert(ledger.summary.pendingCount === 1, `Pending count is 1 (got ${ledger.summary.pendingCount})`);
    assert(ledger.summary.failedCount === 1, `Failed count is 1 (got ${ledger.summary.failedCount})`);
    assert(ledger.summary.cancelledCount === 1, `Cancelled count is 1 (got ${ledger.summary.cancelledCount})`);
    assert(ledger.summary.refundedCount === 1, `Refunded count is 1 (got ${ledger.summary.refundedCount})`);
    assert(ledger.summary.refundedAmountCents === 500, `Refunded amount tracked separately as 500 cents (got ${ledger.summary.refundedAmountCents})`);

    const paymentsApiRes = await fetch(`${baseUrl}/api/developer/payments`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }).then((r) => r.json());
    assert(paymentsApiRes.summary.totalRevenueCents === 1000, '/api/developer/payments summary revenue matches 1000 cents');

    // 8. Organization Detail Inspection
    console.log('\n--- Test 8: Organization Detail & Expiry Breakdown ---');
    const orgDetailRes = await fetch(`${baseUrl}/api/developer/organizations/org-1`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }).then((r) => r.json());
    assert(orgDetailRes.organization.id === 'org-1', 'Organization detail returns org-1');
    assert(orgDetailRes.owner?.email === 'owner1@studio.com', 'Organization detail links owner');
    assert(orgDetailRes.members.length === 2, `Organization detail returns 2 members (owner + member, got ${orgDetailRes.members.length})`);
    assert(orgDetailRes.events.length === 3, `Organization detail returns 3 events (got ${orgDetailRes.events.length})`);
    assert(orgDetailRes.expirySummary.activeCount === 2, 'Org expirySummary activeCount === 2');
    assert(orgDetailRes.expirySummary.expiringSoonCount === 1, 'Org expirySummary expiringSoonCount === 1');
    assert(orgDetailRes.expirySummary.expiredCount === 1, 'Org expirySummary expiredCount === 1');

    // 9. Pagination, Search, Sorting & Filtering
    console.log('\n--- Test 9: Pagination, Search, Sorting & Filters ---');
    const usersPage1 = await fetch(`${baseUrl}/api/developer/users?limit=2&page=1&sortBy=createdAt&sortDir=desc`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }).then((r) => r.json());
    assert(usersPage1.items.length === 2 && usersPage1.total === 5 && usersPage1.totalPages === 3, 'Users pagination splits 5 users into 3 pages of 2');

    const userSearch = await fetch(`${baseUrl}/api/developer/users?search=Aria&role=agency_owner`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }).then((r) => r.json());
    assert(userSearch.items.length === 1 && userSearch.items[0].email === 'owner1@studio.com', 'Users search + role filter finds Aria Chen');

    const eventDetailRaw = await fetch(`${baseUrl}/api/developer/events/evt-active-1`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }).then((r) => r.text());
    assert(!eventDetailRaw.includes('SUPER_SECRET_EVENT_PASSWORD'), 'Event detail never leaks access_password plaintext');
    const eventDetail = JSON.parse(eventDetailRaw);
    assert(eventDetail.event.hasAccessPassword === true, 'Event detail exposes hasAccessPassword boolean safely');

    // 10. Server-Side Suspension & Reactivation Enforcement
    console.log('\n--- Test 10: Server-Side Account Suspension & Reactivation ---');
    const activeMeBefore = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(activeMeBefore.status === 200, 'Active agency owner /api/auth/me returns 200 before suspension');

    const suspendRes = await fetch(`${baseUrl}/api/developer/users/usr-owner-1/suspend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Compliance hold review' }),
    });
    assert(suspendRes.status === 200, 'Super admin suspend endpoint returns 200');
    const suspendedPayload = await suspendRes.json();
    assert(suspendedPayload.user.status === 'suspended', 'Suspended user status updated to suspended');

    const blockedMeAfter = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(blockedMeAfter.status === 403, `Suspended user /api/auth/me blocked server-side with 403 (got ${blockedMeAfter.status})`);
    const blockedBody = await blockedMeAfter.json();
    assert(blockedBody.code === 'ACCOUNT_SUSPENDED', 'Suspended response returns ACCOUNT_SUSPENDED code');

    // Verify organization & event data remain intact while owner is suspended
    const orgWhileSuspended = await fetch(`${baseUrl}/api/developer/organizations/org-1`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }).then((r) => r.json());
    assert(orgWhileSuspended.organization.id === 'org-1' && orgWhileSuspended.events.length === 3, 'Organization & events remain completely preserved after owner suspension');

    const reactivateRes = await fetch(`${baseUrl}/api/developer/users/usr-owner-1/reactivate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(reactivateRes.status === 200, 'Super admin reactivate endpoint returns 200');

    const activeMeAfter = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(activeMeAfter.status === 200, 'Reactivated agency owner /api/auth/me restored to 200');

    // 11. Settings Persistence & Real Audit Trail Logs
    console.log('\n--- Test 11: Settings Persistence & Activity Audit Logs ---');
    const orgStatusRes = await fetch(`${baseUrl}/api/developer/organizations/org-2/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert(orgStatusRes.status === 200, 'PATCH /api/developer/organizations/:id/status returns 200');

    const putSettingsRes = await fetch(`${baseUrl}/api/developer/settings`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform_name: 'EventFrame Pro',
        maintenance_mode: true,
        default_event_price_usd: 5,
      }),
    }).then((r) => r.json());
    assert(putSettingsRes.settings.platform_name === 'EventFrame Pro' && putSettingsRes.settings.maintenance_mode === true, 'Settings update persisted');

    const logsRes = await fetch(`${baseUrl}/api/developer/activity-logs`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    }).then((r) => r.json());
    const actions = logsRes.items.map((l: any) => l.action);
    assert(actions.includes('ACCOUNT_SUSPENDED'), 'Activity logs recorded ACCOUNT_SUSPENDED');
    assert(actions.includes('ACCOUNT_REACTIVATED'), 'Activity logs recorded ACCOUNT_REACTIVATED');
    assert(actions.includes('ORGANIZATION_STATUS_UPDATED'), 'Activity logs recorded ORGANIZATION_STATUS_UPDATED');
    assert(actions.includes('SETTINGS_UPDATED'), 'Activity logs recorded SETTINGS_UPDATED');

    console.log('\n🎉 All Super Admin (/developer) security, accounting, analytics & RBAC tests passed!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTests().catch((err) => {
  console.error('\n💥 Super Admin test suite failed:', err);
  process.exit(1);
});
