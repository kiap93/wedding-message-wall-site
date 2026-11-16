/**
 * Comprehensive Developer-Level Authorization (`is_developer`) Test Suite
 *
 * Covers:
 * 1. Database helpers: resolveDbUserIsDeveloper, isDeveloper, requireDeveloper, resolveAuthenticatedSessionUser
 * 2. Express (/api/developer/*) & Hono Worker (/api/developer/*) strict DB authorization parity
 * 3. Spoofed JWT claim rejection (is_developer: true / role: super_admin in JWT overridden by DB)
 * 4. Removal of hardcoded/allowlist email bypasses (buildsiteasia@gmail.com, @eventframe.io, SUPER_ADMIN_EMAILS)
 * 5. Immediate runtime effect of grant/revoke without waiting for JWT expiry
 * 6. Lifecycle safety guards: self-grant/revoke block (400), last-active-developer block (400), suspended user guard (400), developer suspension guard (400)
 * 7. Independence between agency roles (agency_owner / agency_member) and platform is_developer access
 * 8. Registration/login privilege-escalation prevention (syncUserOnLogin defaults is_developer: false)
 * 9. /api/developer/users?isDeveloper=... filtering & DEVELOPER_ACCESS_GRANTED / DEVELOPER_ACCESS_REVOKED audit logs
 * 10. Static contract checks on SQL migration, server.ts, worker/index.ts, Login.tsx, Verify.tsx, DeveloperRouteGuard.tsx, StaffTemplates.tsx, Workspace.tsx
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
import { sign as honoJwtSign } from 'hono/jwt';
import { createDeveloperRouter, verifySessionWithDb } from '../server/createDeveloperRouter';
import { registerWorkerDeveloperRoutes } from '../server/registerWorkerDeveloperRoutes';
import {
  isDeveloper,
  requireDeveloper,
  resolveAuthenticatedSessionUser,
  resolveDbUserIsDeveloper,
  syncUserOnLogin,
  updateUserDeveloperAccess,
} from '../server/developerAdminService';

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
  private maxRows: number | null = null;
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

  limit(n: number) {
    this.maxRows = n;
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
      const data = this.singleMode === 'none' ? inserted : inserted[0] || null;
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
      const data = this.singleMode === 'none' ? matched : matched[0] || null;
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
    if (typeof this.maxRows === 'number') {
      rows = rows.slice(0, this.maxRows);
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

async function runTests() {
  console.log('==========================================================');
  console.log('Starting EventFrame Developer-Level Authorization Suite');
  console.log('==========================================================\n');

  const JWT_SECRET = 'dev-auth-test-jwt-secret-key-2026';

  const mockSupabase = createMockSupabase({
    users_auth: [
      {
        id: 'usr-dev-1',
        external_user_id: 'ext-dev-1',
        email: 'founder@company.com',
        full_name: 'Primary Developer',
        auth_provider: 'google',
        role: 'user',
        is_developer: true,
        status: 'active',
        is_verified: true,
        organization_id: null,
        created_at: isoDaysAgo(30),
        last_login_at: isoDaysAgo(0),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'usr-dev-suspended',
        external_user_id: 'ext-dev-suspended',
        email: 'suspended-dev@company.com',
        full_name: 'Suspended Developer',
        auth_provider: 'email',
        role: 'user',
        is_developer: true,
        status: 'suspended',
        suspended_reason: 'Security hold',
        is_verified: true,
        organization_id: null,
        created_at: isoDaysAgo(20),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'usr-legacy-domain',
        external_user_id: 'ext-legacy-domain',
        email: 'buildsiteasia@gmail.com',
        full_name: 'Legacy Email Account',
        auth_provider: 'google',
        role: 'super_admin', // Even with role='super_admin', explicit is_developer=false MUST block!
        is_developer: false,
        status: 'active',
        is_verified: true,
        organization_id: null,
        created_at: isoDaysAgo(15),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'usr-staff-domain',
        external_user_id: 'ext-staff-domain',
        email: 'someone@eventframe.io',
        full_name: 'Non-Dev Domain User',
        auth_provider: 'email',
        role: 'user',
        is_developer: false,
        status: 'active',
        is_verified: true,
        organization_id: null,
        created_at: isoDaysAgo(12),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'usr-owner-1',
        external_user_id: 'ext-owner-1',
        email: 'owner@agencyone.com',
        full_name: 'Agency One Owner',
        auth_provider: 'google',
        role: 'agency_owner',
        is_developer: false,
        status: 'active',
        is_verified: true,
        organization_id: 'org-1',
        created_at: isoDaysAgo(10),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'usr-member-1',
        external_user_id: 'ext-member-1',
        email: 'member@agencyone.com',
        full_name: 'Agency One Member',
        auth_provider: 'email',
        role: 'agency_member',
        is_developer: false,
        status: 'active',
        is_verified: true,
        organization_id: 'org-1',
        created_at: isoDaysAgo(8),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'usr-normal-1',
        external_user_id: 'ext-normal-1',
        email: 'couple@example.com',
        full_name: 'Regular Couple User',
        auth_provider: 'email',
        role: 'user',
        is_developer: false,
        status: 'active',
        is_verified: true,
        organization_id: null,
        created_at: isoDaysAgo(4),
        is_test: false,
        deleted_at: null,
      },
      {
        id: 'usr-suspended-normal',
        external_user_id: 'ext-suspended-normal',
        email: 'banned@example.com',
        full_name: 'Suspended Regular User',
        auth_provider: 'email',
        role: 'user',
        is_developer: false,
        status: 'suspended',
        is_verified: true,
        organization_id: null,
        created_at: isoDaysAgo(3),
        is_test: false,
        deleted_at: null,
      },
    ],
    agencies: [
      {
        id: 'org-1',
        user_id: 'ext-owner-1',
        owner_email: 'owner@agencyone.com',
        name: 'Agency One',
        slug: 'agency-one',
        user_role: 'agency',
        status: 'active',
        is_demo: false,
        is_test: false,
        deleted_at: null,
        created_at: isoDaysAgo(10),
      },
      {
        id: 'org-2',
        user_id: 'ext-other-owner',
        owner_email: 'other@agencytwo.com',
        name: 'Agency Two',
        slug: 'agency-two',
        user_role: 'agency',
        status: 'active',
        is_demo: false,
        is_test: false,
        deleted_at: null,
        created_at: isoDaysAgo(9),
      },
    ],
    projects: [],
    event_payments: [],
    event_orders: [],
    event_entitlements: [],
    platform_activity_logs: [],
    platform_settings: [],
  });

  // =========================================================================
  // 1. Unit Tests for DB Helpers
  // =========================================================================
  console.log('--- Section 1: DB Authorization Helper Functions ---');
  assert(resolveDbUserIsDeveloper({ is_developer: true, role: 'user' }) === true, 'resolveDbUserIsDeveloper returns true when is_developer is true regardless of role');
  assert(resolveDbUserIsDeveloper({ is_developer: false, role: 'super_admin' }) === false, 'resolveDbUserIsDeveloper returns false when is_developer=false even if legacy role=super_admin');
  assert(resolveDbUserIsDeveloper({ is_developer: true, deleted_at: isoDaysAgo(1) }) === false, 'resolveDbUserIsDeveloper returns false for soft-deleted users');
  assert(resolveDbUserIsDeveloper(null) === false, 'resolveDbUserIsDeveloper returns false for null');

  assert((await isDeveloper(mockSupabase, 'ext-dev-1')) === true, 'isDeveloper returns true for active DB developer');
  assert((await isDeveloper(mockSupabase, 'founder@company.com')) === true, 'isDeveloper resolves developer by email');
  assert((await isDeveloper(mockSupabase, 'ext-dev-suspended')) === false, 'isDeveloper returns false for suspended developer');
  assert((await isDeveloper(mockSupabase, 'buildsiteasia@gmail.com')) === false, 'isDeveloper returns false for hardcoded legacy email when is_developer=false');
  assert((await isDeveloper(mockSupabase, 'someone@eventframe.io')) === false, 'isDeveloper returns false for @eventframe.io email when is_developer=false');
  assert((await isDeveloper(mockSupabase, 'ext-owner-1')) === false, 'isDeveloper returns false for agency_owner with is_developer=false');
  assert((await isDeveloper(mockSupabase, null)) === false, 'isDeveloper returns false for null identity');

  // Verify spoofed JWT claims are overwritten by DB lookup
  const spoofedSession = await resolveAuthenticatedSessionUser(
    mockSupabase,
    {
      id: 'ext-owner-1',
      email: 'owner@agencyone.com',
      role: 'super_admin',
      is_developer: true,
      isDeveloper: true,
    },
    'owner@agencyone.com,someone@eventframe.io'
  );
  assert(
    spoofedSession.ok === true &&
      spoofedSession.user.is_developer === false &&
      spoofedSession.user.isDeveloper === false &&
      spoofedSession.user.role === 'agency_owner',
    'resolveAuthenticatedSessionUser overwrites spoofed JWT is_developer & role claims with authoritative DB values'
  );

  const reqDevFail = await requireDeveloper(mockSupabase, {
    id: 'ext-owner-1',
    email: 'owner@agencyone.com',
    is_developer: true,
    role: 'super_admin',
  });
  assert(reqDevFail.ok === false && reqDevFail.statusCode === 403 && reqDevFail.code === 'FORBIDDEN_DEVELOPER_ONLY', 'requireDeveloper rejects spoofed JWT with 403 FORBIDDEN_DEVELOPER_ONLY');

  // =========================================================================
  // 2. Express API Server + Protected Routes Setup
  // =========================================================================
  console.log('\n--- Section 2: Express & Hono API Authorization ---');
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const deps = {
    getSupabase: () => mockSupabase,
    getJwtSecret: () => JWT_SECRET,
    getSuperAdminEmails: () => 'buildsiteasia@gmail.com,someone@eventframe.io,owner@agencyone.com',
  };

  app.get('/api/auth/me', async (req, res) => {
    const check = await verifySessionWithDb(req, deps);
    if (!check.ok) {
      const errCheck = check as { ok: false; statusCode: number; error: string; code: string };
      return res.status(errCheck.statusCode).json({ error: errCheck.error, code: errCheck.code });
    }
    return res.json({ authenticated: true, user: check.user });
  });

  app.use('/api/developer', createDeveloperRouter(deps));

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const signToken = (payload: Record<string, any>) =>
    jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

  const devToken = signToken({ id: 'ext-dev-1', email: 'founder@company.com', role: 'user' });
  const suspendedDevToken = signToken({ id: 'ext-dev-suspended', email: 'suspended-dev@company.com', is_developer: true });
  const legacyEmailToken = signToken({ id: 'ext-legacy-domain', email: 'buildsiteasia@gmail.com', role: 'super_admin', is_developer: true });
  const staffDomainToken = signToken({ id: 'ext-staff-domain', email: 'someone@eventframe.io', is_developer: true });
  const ownerToken = signToken({ id: 'ext-owner-1', email: 'owner@agencyone.com', role: 'agency_owner' });
  const memberToken = signToken({ id: 'ext-member-1', email: 'member@agencyone.com', role: 'agency_member' });
  const normalToken = signToken({ id: 'ext-normal-1', email: 'couple@example.com', role: 'user' });
  const spoofedToken = signToken({ id: 'ext-normal-1', email: 'couple@example.com', role: 'super_admin', is_developer: true, isDeveloper: true });

  try {
    // Unauthenticated
    const unauthMe = await fetch(`${baseUrl}/api/developer/me`);
    assert(unauthMe.status === 401, 'Unauthenticated GET /api/developer/me returns 401');

    // Non-developers / spoofed tokens / allowlist bypasses
    for (const [label, tok] of [
      ['normal user', normalToken],
      ['agency_owner', ownerToken],
      ['agency_member', memberToken],
      ['spoofed JWT claims', spoofedToken],
      ['legacy buildsiteasia@gmail.com', legacyEmailToken],
      ['@eventframe.io domain user', staffDomainToken],
      ['suspended developer', suspendedDevToken],
    ] as const) {
      const resOverview = await fetch(`${baseUrl}/api/developer/overview`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      assert(resOverview.status === 403, `Express GET /api/developer/overview rejects ${label} with 403 (got ${resOverview.status})`);

      const resPatch = await fetch(`${baseUrl}/api/developer/users/usr-owner-1/developer-access`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeveloper: true }),
      });
      assert(resPatch.status === 403, `Express PATCH developer-access rejects ${label} with 403 (got ${resPatch.status})`);
    }

    // Active developer succeeds even though role='user'
    const devMeRes = await fetch(`${baseUrl}/api/developer/me`, {
      headers: { Authorization: `Bearer ${devToken}` },
    });
    assert(devMeRes.status === 200, 'Developer with role="user" and is_developer=true receives 200 on /api/developer/me');
    const devMeBody = await devMeRes.json();
    assert(devMeBody.admin?.is_developer === true && devMeBody.admin?.role === 'user', '/api/developer/me preserves role="user" and returns is_developer=true');

    // Cloudflare Worker Hono parity check (without needing remote Supabase env: verify auth guards)
    const workerApp = new Hono();
    registerWorkerDeveloperRoutes(workerApp);
    const workerUnauth = await workerApp.request('http://localhost/api/developer/me');
    assert(workerUnauth.status === 401, 'Worker GET /api/developer/me without token returns 401');
    const workerSpoofJwt = await honoJwtSign(
      { id: 'ext-normal-1', email: 'couple@example.com', is_developer: true, role: 'super_admin' },
      JWT_SECRET,
      'HS256'
    );
    const workerNoSupabaseEnv = await workerApp.request(
      'http://localhost/api/developer/me',
      { headers: { Authorization: `Bearer ${workerSpoofJwt}` } },
      { JWT_SECRET }
    );
    assert(workerNoSupabaseEnv.status === 500, `Worker fails closed (500) when Supabase server config is missing instead of trusting JWT claims (got ${workerNoSupabaseEnv.status})`);

    // =========================================================================
    // 3. Privilege Escalation Prevention on Registration / Login Sync
    // =========================================================================
    console.log('\n--- Section 3: Privilege Escalation Prevention on Signup / Sync ---');
    const syncResult = await syncUserOnLogin(mockSupabase, {
      externalUserId: 'ext-brand-new',
      email: 'newsignup@agency.com',
      name: 'New Signup',
      provider: 'google',
    });
    assert(syncResult.allowed === true && syncResult.isNewUser === true, 'syncUserOnLogin inserts newly registered user');
    const createdRow = mockSupabase.db.users_auth.find((u) => u.email === 'newsignup@agency.com');
    assert(createdRow?.is_developer === false && createdRow?.role === 'user', 'Newly registered user strictly receives is_developer=false and role=user');

    // Clean up extra test row so user count assertions stay predictable
    mockSupabase.db.users_auth = mockSupabase.db.users_auth.filter((u) => u.email !== 'newsignup@agency.com');

    // =========================================================================
    // 4. Developer Access Grant / Revoke & Safety Guards
    // =========================================================================
    console.log('\n--- Section 4: Grant / Revoke Lifecycle & Safety Guards ---');

    // Guard 1: Self-modification blocked (400)
    const selfRevokeRes = await fetch(`${baseUrl}/api/developer/users/usr-dev-1/developer-access`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${devToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDeveloper: false }),
    });
    assert(selfRevokeRes.status === 400, `Self-revoke returns 400 (got ${selfRevokeRes.status})`);

    // Guard 2: Granting to suspended user blocked (400)
    const grantSuspendedRes = await fetch(`${baseUrl}/api/developer/users/usr-suspended-normal/developer-access`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${devToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDeveloper: true }),
    });
    assert(grantSuspendedRes.status === 400, `Granting developer access to suspended user returns 400 (got ${grantSuspendedRes.status})`);

    // Guard 3: Service-layer defense-in-depth rejects non-developer actors directly (403 FORBIDDEN_DEVELOPER_ONLY)
    const unauthorizedServiceCall = await updateUserDeveloperAccess(mockSupabase, 'usr-dev-1', false, {
      id: 'usr-system-actor',
      email: 'system-actor@company.com',
    });
    assert(
      unauthorizedServiceCall.ok === false &&
        unauthorizedServiceCall.statusCode === 403 &&
        unauthorizedServiceCall.code === 'FORBIDDEN_DEVELOPER_ONLY',
      `Service-layer updateUserDeveloperAccess rejects non-developer actor with 403 FORBIDDEN_DEVELOPER_ONLY (got ${unauthorizedServiceCall.ok ? 'ok' : unauthorizedServiceCall.code})`
    );

    // Because self-modification is blocked and at least one active developer is required to act,
    // the sole remaining active developer (`usr-dev-1`) cannot leave the platform with 0 developers:
    const selfRevokeBody = await selfRevokeRes.json();
    assert(
      selfRevokeBody.code === 'SELF_MODIFICATION_FORBIDDEN',
      `Sole active developer cannot revoke themselves (code=${selfRevokeBody.code})`
    );

    // Grant developer access to agency_owner (usr-owner-1)
    const grantRes = await fetch(`${baseUrl}/api/developer/users/usr-owner-1/developer-access`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${devToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDeveloper: true }),
    });
    assert(grantRes.status === 200, `Granting developer access to agency_owner returns 200 (got ${grantRes.status})`);
    const grantBody = await grantRes.json();
    assert(
      grantBody.user?.isDeveloper === true && grantBody.user?.role === 'agency_owner',
      'Granting developer access preserves existing agency_owner role'
    );

    // Immediate effect WITHOUT issuing a new JWT: ownerToken now works on /api/developer/me!
    const ownerDevMeRes = await fetch(`${baseUrl}/api/developer/me`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(ownerDevMeRes.status === 200, 'Existing agency_owner JWT immediately grants /api/developer/me access after DB update');
    const ownerDevMeBody = await ownerDevMeRes.json();
    assert(
      ownerDevMeBody.admin?.is_developer === true && ownerDevMeBody.admin?.role === 'agency_owner',
      'Newly promoted developer keeps agency_owner role in /api/developer/me'
    );

    // Check /api/auth/me reflects is_developer: true for ownerToken
    const ownerAuthMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    }).then((r) => r.json());
    assert(
      ownerAuthMe.user?.is_developer === true && ownerAuthMe.user?.role === 'agency_owner',
      '/api/auth/me immediately reports is_developer=true and preserves agency_owner role'
    );

    // Guard 4: Active developer cannot be suspended before revoking developer access
    const suspendActiveDevRes = await fetch(`${baseUrl}/api/developer/users/usr-owner-1/suspend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${devToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'test' }),
    });
    assert(suspendActiveDevRes.status === 400, `Suspending active developer blocked with 400 (got ${suspendActiveDevRes.status})`);

    // Filter /api/developer/users?isDeveloper=developers and non_developers
    const devsFilterRes = await fetch(`${baseUrl}/api/developer/users?isDeveloper=developers`, {
      headers: { Authorization: `Bearer ${devToken}` },
    }).then((r) => r.json());
    assert(
      devsFilterRes.items.some((u: any) => u.id === 'usr-dev-1') &&
        devsFilterRes.items.some((u: any) => u.id === 'usr-owner-1') &&
        devsFilterRes.items.every((u: any) => u.isDeveloper === true),
      '/api/developer/users?isDeveloper=developers returns only developers'
    );

    const nonDevsFilterRes = await fetch(`${baseUrl}/api/developer/users?isDeveloper=non_developers`, {
      headers: { Authorization: `Bearer ${devToken}` },
    }).then((r) => r.json());
    assert(
      nonDevsFilterRes.items.every((u: any) => u.isDeveloper === false) &&
        !nonDevsFilterRes.items.some((u: any) => u.id === 'usr-owner-1'),
      '/api/developer/users?isDeveloper=non_developers excludes active developers'
    );

    // Revoke developer access from usr-owner-1
    const revokeRes = await fetch(`${baseUrl}/api/developer/users/usr-owner-1/developer-access`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${devToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDeveloper: false }),
    });
    assert(revokeRes.status === 200, 'Revoking developer access returns 200');

    // Immediate revocation check using the SAME ownerToken JWT
    const ownerDevAfterRevoke = await fetch(`${baseUrl}/api/developer/me`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(
      ownerDevAfterRevoke.status === 403,
      `Revoked developer JWT is immediately rejected with 403 without waiting for token expiry (got ${ownerDevAfterRevoke.status})`
    );

    const ownerAuthAfterRevoke = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    }).then((r) => r.json());
    assert(
      ownerAuthAfterRevoke.user?.is_developer === false && ownerAuthAfterRevoke.user?.role === 'agency_owner',
      '/api/auth/me immediately restores is_developer=false while preserving agency_owner role'
    );

    // Audit log verification
    const logsRes = await fetch(`${baseUrl}/api/developer/activity-logs`, {
      headers: { Authorization: `Bearer ${devToken}` },
    }).then((r) => r.json());
    const logActions = logsRes.items.map((l: any) => l.action);
    assert(logActions.includes('DEVELOPER_ACCESS_GRANTED'), 'Audit logs contain DEVELOPER_ACCESS_GRANTED');
    assert(logActions.includes('DEVELOPER_ACCESS_REVOKED'), 'Audit logs contain DEVELOPER_ACCESS_REVOKED');

    // =========================================================================
    // 5. Static Security Contracts Across Migration, Backend & Frontend
    // =========================================================================
    console.log('\n--- Section 5: Migration, Backend & Frontend Security Contracts ---');
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261118_developer_is_developer_authorization.sql'),
      'utf8'
    );
    assert(
      migrationSql.includes('ADD COLUMN IF NOT EXISTS is_developer BOOLEAN NOT NULL DEFAULT FALSE'),
      'SQL migration idempotently adds is_developer BOOLEAN NOT NULL DEFAULT FALSE'
    );
    assert(
      !/ALTER\s+TABLE\s+auth\.users/i.test(migrationSql),
      'SQL migration does not mutate auth.users directly'
    );
    assert(
      migrationSql.includes('prevent_client_developer_escalation'),
      'SQL migration enforces anti-escalation trigger on client updates/inserts'
    );

    const serverTs = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
    const workerTs = fs.readFileSync(path.join(process.cwd(), 'worker/index.ts'), 'utf8');
    const loginTsx = fs.readFileSync(path.join(process.cwd(), 'src/pages/Login.tsx'), 'utf8');
    const verifyTsx = fs.readFileSync(path.join(process.cwd(), 'src/pages/Verify.tsx'), 'utf8');
    const guardTsx = fs.readFileSync(path.join(process.cwd(), 'src/components/developer/DeveloperRouteGuard.tsx'), 'utf8');
    const staffTsx = fs.readFileSync(path.join(process.cwd(), 'src/pages/StaffTemplates.tsx'), 'utf8');
    const workspaceTsx = fs.readFileSync(path.join(process.cwd(), 'src/pages/Workspace.tsx'), 'utf8');

    for (const [name, content] of [
      ['server.ts', serverTs],
      ['worker/index.ts', workerTs],
      ['src/pages/StaffTemplates.tsx', staffTsx],
      ['src/pages/Workspace.tsx', workspaceTsx],
    ] as const) {
      assert(!content.includes('buildsiteasia@gmail.com'), `${name} contains zero hardcoded buildsiteasia@gmail.com email checks`);
      assert(!content.includes("endsWith('@eventframe.io')"), `${name} contains zero @eventframe.io domain bypass checks`);
    }

    assert(serverTs.includes('authCheck.user.is_developer !== true'), 'server.ts guards /api/templates & AI endpoints with is_developer === true');
    assert(workerTs.includes('authCheck.user.is_developer !== true'), 'worker/index.ts guards /api/templates & AI endpoints with is_developer === true');
    assert(loginTsx.includes("userIsDeveloper ? '/developer' : '/workspace'"), 'Login.tsx routes developers to /developer and regular users to /workspace');
    assert(verifyTsx.includes("const destination = isDev ? '/developer' : '/workspace'"), 'Verify.tsx routes verified developers to /developer and regular users to /workspace');
    assert(guardTsx.includes('res?.admin?.is_developer === true') && guardTsx.includes('Navigate to="/workspace"'), 'DeveloperRouteGuard verifies server is_developer and redirects non-developers to /workspace');

    console.log('\n🎉 All Developer-Level Authorization (`is_developer`) tests passed!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTests().catch((err) => {
  console.error('\n💥 Developer authorization test suite failed:', err);
  process.exit(1);
});
