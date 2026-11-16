/**
 * Google OAuth & Application User Synchronization Test Suite
 *
 * Covers:
 * 1. New Google user registration -> Supabase Auth UUID + users_auth row + USER_REGISTERED log + zero Google tokens persisted
 * 2. Existing Google user login -> updates last_login_at & updated_at without duplicating rows
 * 3. Existing email account -> links Google identity cleanly while preserving password_hash, role, organization_id & agency ownership
 * 4. Missing users_auth row recovery -> verifyTokenAndSyncUser, resolveAuthenticatedSessionUser(..., { ensureUserRecord: true }), Express & Worker routes
 * 5. Duplicate concurrent OAuth callbacks & forced 23505 unique-constraint recovery -> exactly 1 users_auth record
 * 6. Google profile update -> updates full_name & avatar_url on subsequent login
 * 7. Developer permission preservation & anti-escalation -> keeps existing is_developer=true; rejects/ignores client-supplied is_developer=true
 * 8. Invalid tokens, wrong audience, missing sub/email, unverified email & suspended user (403) rejection without DB mutation
 * 9. Database & service-role sync failures -> explicit error surfaces (never silent swallow; fail-closed without SUPABASE_SERVICE_ROLE_KEY)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
import { sign as honoJwtSign, verify as honoJwtVerify } from 'hono/jwt';
import crypto from 'crypto';
import {
  ensureSupabaseAuthUser,
  resolveVerifiedGoogleProfile,
  syncAuthenticatedUserRecord,
  syncGoogleOAuthUser,
  verifyTokenAndSyncUser,
  registerEmailPasswordUser,
  authenticateEmailPasswordUser,
  verifyEmailAccountTokenUser,
  resetUserPasswordWithHash,
} from '../server/userSyncService';
import { resolveAuthenticatedSessionUser } from '../server/developerAdminService';
import { verifySessionWithDb } from '../server/createDeveloperRouter';
import { getWorkerServiceSupabase } from '../server/registerWorkerDeveloperRoutes';
import { resolveUserOrganizations } from '../server/billingService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✓ PASSED: ${message}`);
}

type TableRows = Record<string, any[]>;

interface MockDbOptions {
  failInsertOnceWith23505?: boolean;
  failAllWritesWithRls?: boolean;
  enforcePasswordHashNotNull?: boolean;
}

class SyncMockQueryBuilder {
  private table: string;
  private db: TableRows;
  private opts: MockDbOptions;
  private filters: Array<(row: any) => boolean> = [];
  private op: 'select' | 'insert' | 'update' = 'select';
  private payload: any = null;
  private singleMode: 'none' | 'maybe' | 'single' = 'none';

  constructor(db: TableRows, table: string, opts: MockDbOptions) {
    this.db = db;
    this.table = table;
    this.opts = opts;
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

  order() {
    return this;
  }

  limit() {
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

  private exec() {
    const tableArr = this.db[this.table] || [];

    if (this.op === 'insert') {
      if (this.opts.failAllWritesWithRls && this.table === 'users_auth') {
        return {
          data: null,
          error: { code: '42501', message: 'new row violates row-level security policy for table "users_auth"' },
        };
      }

      if (this.opts.failInsertOnceWith23505 && this.table === 'users_auth') {
        this.opts.failInsertOnceWith23505 = false;
        // Simulate another concurrent worker finishing the insert right before us
        const incoming = this.payload[0];
        if (!tableArr.some((r) => String(r.email).toLowerCase() === String(incoming.email).toLowerCase())) {
          tableArr.push({
            id: incoming.id || '88888888-8888-4888-8888-888888888888',
            supabase_user_id: incoming.supabase_user_id || '88888888-8888-4888-8888-888888888888',
            email: incoming.email,
            full_name: incoming.full_name,
            avatar_url: incoming.avatar_url,
            auth_provider: incoming.auth_provider,
            provider_user_id: incoming.provider_user_id,
            external_user_id: incoming.external_user_id,
            is_verified: true,
            email_verified: true,
            role: 'user',
            is_developer: false,
            status: 'active',
            created_at: new Date().toISOString(),
          });
        }
        return {
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_users_auth_email_lower"' },
        };
      }

      for (const incoming of this.payload) {
        if (this.table === 'users_auth') {
          if (this.opts.enforcePasswordHashNotNull && (incoming.password_hash === null || incoming.password_hash === undefined)) {
            return {
              data: null,
              error: {
                code: '23502',
                message: 'null value in column "password_hash" of relation "users_auth" violates not-null constraint',
              },
            };
          }
          const dup = tableArr.some(
            (r) =>
              (incoming.id && r.id === incoming.id) ||
              (incoming.supabase_user_id && r.supabase_user_id === incoming.supabase_user_id) ||
              (incoming.provider_user_id && r.provider_user_id === incoming.provider_user_id) ||
              (incoming.email && String(r.email || '').toLowerCase() === String(incoming.email).toLowerCase())
          );
          if (dup) {
            return {
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_users_auth_email_lower"' },
            };
          }
        }
      }

      const inserted = this.payload.map((item: any, idx: number) => ({
        id: item.id || `${this.table}-${Date.now()}-${idx}`,
        created_at: item.created_at || new Date().toISOString(),
        ...item,
      }));
      tableArr.push(...inserted);
      const data = this.singleMode === 'none' ? inserted : inserted[0] || null;
      return { data, error: null };
    }

    if (this.op === 'update') {
      if (this.opts.failAllWritesWithRls && this.table === 'users_auth') {
        return {
          data: null,
          error: { code: '42501', message: 'new row violates row-level security policy for table "users_auth"' },
        };
      }
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

    const rows = tableArr.filter((r) => this.filters.every((fn) => fn(r))).map((r) => ({ ...r }));
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

function createSyncMockSupabase(
  initial: TableRows,
  opts: MockDbOptions = {}
) {
  const db: TableRows = JSON.parse(JSON.stringify(initial));
  const authUsers: Array<{
    id: string;
    email: string;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
    identities?: Array<Record<string, any>>;
  }> = [];

  const validTokens = new Map<string, any>();
  let uuidCounter = 1000;

  return {
    db,
    authUsers,
    validTokens,
    opts,
    from(table: string) {
      return new SyncMockQueryBuilder(db, table, opts);
    },
    auth: {
      admin: {
        async createUser(input: { email: string; email_confirm?: boolean; user_metadata?: Record<string, any> }) {
          const email = String(input.email || '').trim().toLowerCase();
          const existing = authUsers.find((u) => u.email === email);
          if (existing) {
            return { data: { user: null }, error: { code: 'email_exists', status: 422, message: 'A user with this email address has already been registered' } };
          }
          uuidCounter += 1;
          const id = `11111111-1111-4111-8111-${String(uuidCounter).padStart(12, '0')}`;
          const created = {
            id,
            email,
            email_confirmed_at: input.email_confirm ? new Date().toISOString() : null,
            user_metadata: input.user_metadata || {},
            app_metadata: { provider: input.user_metadata?.provider || 'google' },
            identities: input.user_metadata?.sub
              ? [{ provider: 'google', id: input.user_metadata.sub, identity_data: { sub: input.user_metadata.sub } }]
              : [],
          };
          authUsers.push(created);
          return { data: { user: created }, error: null };
        },
        async listUsers() {
          return { data: { users: [...authUsers] }, error: null };
        },
      },
      async getUser(token: string) {
        const user = validTokens.get(token);
        if (!user) {
          return { data: { user: null }, error: { message: 'invalid JWT: unable to parse or verify signature' } };
        }
        return { data: { user }, error: null };
      },
    },
  };
}

async function runTests() {
  console.log('==========================================================');
  console.log('Starting EventFrame Google OAuth & User Sync Test Suite');
  console.log('==========================================================\n');

  const JWT_SECRET = 'google-sync-test-secret-2026';

  // Seed initial DB with existing email account, agency, existing developer, and suspended user
  const mockSupabase = createSyncMockSupabase({
    users_auth: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        supabase_user_id: null,
        external_user_id: 'email-existing-owner',
        provider_user_id: null,
        email: 'owner@existingagency.com',
        full_name: 'Existing Agency Owner',
        password_hash: 'salt:hashedpassword',
        avatar_url: null,
        auth_provider: 'email',
        role: 'agency_owner',
        is_developer: false,
        status: 'active',
        is_verified: true,
        email_verified: true,
        organization_id: 'org-existing-1',
        last_login_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        supabase_user_id: '33333333-3333-4333-8333-333333333333',
        external_user_id: 'google-dev-sub-1',
        provider_user_id: 'google-dev-sub-1',
        email: 'platform-dev@eventframe.io',
        full_name: 'Platform Developer',
        auth_provider: 'google',
        role: 'user',
        is_developer: true,
        status: 'active',
        is_verified: true,
        email_verified: true,
        organization_id: null,
        last_login_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        supabase_user_id: null,
        external_user_id: 'google-suspended-sub',
        provider_user_id: 'google-suspended-sub',
        email: 'suspended@example.com',
        full_name: 'Suspended User',
        auth_provider: 'google',
        role: 'user',
        is_developer: false,
        status: 'suspended',
        suspended_reason: 'Chargeback abuse',
        is_verified: true,
        email_verified: true,
        organization_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
    agencies: [
      {
        id: 'org-existing-1',
        user_id: 'email-existing-owner',
        owner_email: 'owner@existingagency.com',
        name: 'Existing Agency',
        slug: 'existing-agency',
        status: 'active',
      },
    ],
    platform_activity_logs: [],
  });

  // =========================================================================
  // Test 1: New Google user registration
  // =========================================================================
  console.log('--- Test 1: New Google User Registration ---');
  const newGoogleRes = await syncGoogleOAuthUser(mockSupabase, {
    sub: 'google-sub-new-1',
    email: 'NewBride@Example.com',
    emailVerified: true,
    fullName: 'Clara Tan',
    avatarUrl: 'https://lh3.googleusercontent.com/clara-v1',
  });

  assert(newGoogleRes.ok === true, 'Test 1a: New Google user registration succeeds');
  if (!newGoogleRes.ok) throw new Error(newGoogleRes.error);
  assert(newGoogleRes.isNewUser === true, 'Test 1b: Marks newly created Google user with isNewUser=true');
  assert(Boolean(newGoogleRes.supabaseUserId), 'Test 1c: Creates and returns a Supabase Auth UUID');
  const createdRow = mockSupabase.db.users_auth.find((u) => u.email === 'newbride@example.com');
  assert(
    Boolean(createdRow) &&
      createdRow.id === newGoogleRes.supabaseUserId &&
      createdRow.supabase_user_id === newGoogleRes.supabaseUserId &&
      createdRow.password_hash === null &&
      createdRow.auth_provider === 'google' &&
      createdRow.provider_user_id === 'google-sub-new-1' &&
      createdRow.full_name === 'Clara Tan' &&
      createdRow.avatar_url === 'https://lh3.googleusercontent.com/clara-v1' &&
      createdRow.email_verified === true &&
      createdRow.is_verified === true &&
      createdRow.is_developer === false &&
      createdRow.role === 'user',
    'Test 1d: Created users_auth row populates all profile fields, sets password_hash=null (no fake hash), Supabase UUID, and defaults is_developer=false, role=user'
  );
  assert(
    !('access_token' in createdRow) && !('id_token' in createdRow) && !('refresh_token' in createdRow),
    'Test 1e: Google OAuth tokens are NOT persisted in users_auth'
  );
  assert(
    mockSupabase.db.platform_activity_logs.some(
      (l) => l.action === 'USER_REGISTERED' && l.actor_email === 'newbride@example.com'
    ),
    'Test 1f: USER_REGISTERED audit log entry created for new Google user'
  );

  // =========================================================================
  // Test 2: Existing Google user login
  // =========================================================================
  console.log('\n--- Test 2: Existing Google User Login (No Duplicates) ---');
  const prevLoginTs = createdRow.last_login_at;
  await new Promise((r) => setTimeout(r, 15));
  const repeatGoogleRes = await syncGoogleOAuthUser(mockSupabase, {
    sub: 'google-sub-new-1',
    email: 'newbride@example.com',
    emailVerified: true,
    fullName: 'Clara Tan',
    avatarUrl: 'https://lh3.googleusercontent.com/clara-v1',
  });
  assert(repeatGoogleRes.ok === true && repeatGoogleRes.isNewUser === false, 'Test 2a: Subsequent Google login resolves existing user without re-inserting');
  const matchingNewBrideRows = mockSupabase.db.users_auth.filter((u) => u.email === 'newbride@example.com');
  assert(matchingNewBrideRows.length === 1, 'Test 2b: Exactly 1 users_auth record exists after repeat Google login');
  assert(
    matchingNewBrideRows[0].last_login_at !== prevLoginTs && Boolean(matchingNewBrideRows[0].updated_at),
    'Test 2c: Repeat Google login updates last_login_at and updated_at'
  );

  // =========================================================================
  // Test 3: Existing email account linking Google identity safely
  // =========================================================================
  console.log('\n--- Test 3: Existing Email Account Linked to Google Safely ---');
  const linkedRes = await syncGoogleOAuthUser(mockSupabase, {
    sub: 'google-sub-owner-link',
    email: 'OWNER@existingagency.com',
    emailVerified: true,
    fullName: 'Existing Agency Owner',
    avatarUrl: 'https://lh3.googleusercontent.com/owner-pic',
  });
  assert(linkedRes.ok === true && linkedRes.isNewUser === false && linkedRes.linkedIdentity === true, 'Test 3a: Existing email account safely links Google identity (linkedIdentity=true)');
  const linkedOwnerRow = mockSupabase.db.users_auth.find((u) => u.email === 'owner@existingagency.com');
  assert(
    linkedOwnerRow.password_hash === 'salt:hashedpassword' &&
      linkedOwnerRow.role === 'agency_owner' &&
      linkedOwnerRow.organization_id === 'org-existing-1' &&
      linkedOwnerRow.provider_user_id === 'google-sub-owner-link' &&
      Boolean(linkedOwnerRow.supabase_user_id) &&
      linkedOwnerRow.avatar_url === 'https://lh3.googleusercontent.com/owner-pic',
    'Test 3b: Linked email account preserves password_hash, role=agency_owner, and organization_id'
  );
  const resolvedOrgs = await resolveUserOrganizations(mockSupabase, {
    id: linkedOwnerRow.id,
    supabaseUserId: linkedOwnerRow.supabase_user_id,
    externalUserId: linkedOwnerRow.external_user_id,
    email: linkedOwnerRow.email,
    organizationId: linkedOwnerRow.organization_id,
    role: linkedOwnerRow.role,
  });
  assert(resolvedOrgs.length === 1 && resolvedOrgs[0].id === 'org-existing-1', 'Test 3c: Existing agency ownership resolves cleanly after Google account linking');

  // =========================================================================
  // Test 4: Missing users_auth record recovery (/api/auth/sync & ensureUserRecord)
  // =========================================================================
  console.log('\n--- Test 4: Missing users_auth Record Recovery ---');
  const sbOnlyUuid = '55555555-5555-4555-8555-555555555555';
  const sbToken = 'sb-access-token-missing-row';
  mockSupabase.validTokens.set(sbToken, {
    id: sbOnlyUuid,
    email: 'missingrow@example.com',
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: 'google' },
    user_metadata: {
      full_name: 'Recovered Google User',
      avatar_url: 'https://lh3.googleusercontent.com/recovered',
      sub: 'google-sub-missing-row',
      is_developer: true, // Attempted privilege escalation in metadata MUST be ignored
    },
    identities: [{ provider: 'google', id: 'google-sub-missing-row', identity_data: { sub: 'google-sub-missing-row' } }],
  });

  // 4a. Direct verifyTokenAndSyncUser with Supabase token
  const recoverSync = await verifyTokenAndSyncUser(mockSupabase, sbToken, {
    verifyInternalJwt: (t) => jwt.verify(t, JWT_SECRET),
  });
  assert(recoverSync.ok === true && recoverSync.isNewUser === true, 'Test 4a: verifyTokenAndSyncUser creates missing users_auth row from verified Supabase JWT');
  const recoveredRow = mockSupabase.db.users_auth.find((u) => u.id === sbOnlyUuid);
  assert(
    Boolean(recoveredRow) &&
      recoveredRow.email === 'missingrow@example.com' &&
      recoveredRow.is_developer === false &&
      recoveredRow.role === 'user',
    'Test 4b: Recovered users_auth row uses Supabase UUID and enforces is_developer=false despite metadata claim'
  );

  // 4c. Express POST /api/auth/sync + /api/auth/me with ensureUserRecord: true for deleted/missing local row
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.post('/api/auth/sync', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const syncRes = await verifyTokenAndSyncUser(mockSupabase, token, {
      verifyInternalJwt: (t) => jwt.verify(t, JWT_SECRET),
    });
    if (syncRes.ok === false) return res.status(syncRes.statusCode).json({ error: syncRes.error, code: syncRes.code });
    return res.json({ success: true, user: syncRes.user, isNewUser: syncRes.isNewUser });
  });
  app.get('/api/auth/me', async (req, res) => {
    const check = await verifySessionWithDb(
      req,
      { getSupabase: () => mockSupabase, getJwtSecret: () => JWT_SECRET },
      { ensureUserRecord: true }
    );
    if (!check.ok) {
      const errCheck = check as { ok: false; statusCode: number; error: string; code: string };
      return res.status(errCheck.statusCode).json({ error: errCheck.error, code: errCheck.code });
    }
    return res.json({ user: check.user });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Delete row to test Express /api/auth/me recovery
    mockSupabase.db.users_auth = mockSupabase.db.users_auth.filter((u) => u.email !== 'missingrow@example.com');
    const sessionJwtForMissingRow = jwt.sign(
      {
        id: sbOnlyUuid,
        supabaseUserId: sbOnlyUuid,
        sub: 'google-sub-missing-row',
        email: 'missingrow@example.com',
        name: 'Recovered Google User',
        is_developer: true, // Spoofed JWT claim must NOT grant developer access
      },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    const meRecoverRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${sessionJwtForMissingRow}` },
    });
    assert(meRecoverRes.status === 200, `Test 4c: GET /api/auth/me recovers missing users_auth row (got ${meRecoverRes.status})`);
    const meRecoverBody = await meRecoverRes.json();
    assert(
      meRecoverBody.user?.email === 'missingrow@example.com' && meRecoverBody.user?.is_developer === false,
      'Test 4d: Recovered /api/auth/me session sets is_developer=false and creates missing users_auth row'
    );

    // Express POST /api/auth/sync endpoint test
    const syncHttpRes = await fetch(`${baseUrl}/api/auth/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sbToken}` },
    });
    assert(syncHttpRes.status === 200, 'Test 4e: POST /api/auth/sync returns 200 for valid Supabase JWT');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // =========================================================================
  // Test 5: Duplicate OAuth callback (23505 race condition & concurrency)
  // =========================================================================
  console.log('\n--- Test 5: Duplicate OAuth Callback Concurrency & 23505 Recovery ---');
  mockSupabase.opts.failInsertOnceWith23505 = true;
  const [raceA, raceB] = await Promise.all([
    syncAuthenticatedUserRecord(mockSupabase, {
      supabaseUserId: '88888888-8888-4888-8888-888888888888',
      email: 'race@example.com',
      fullName: 'Race User A',
      avatarUrl: 'https://lh3.googleusercontent.com/race-a',
      authProvider: 'google',
      providerUserId: 'google-sub-race',
      emailVerified: true,
    }),
    syncAuthenticatedUserRecord(mockSupabase, {
      supabaseUserId: '88888888-8888-4888-8888-888888888888',
      email: 'race@example.com',
      fullName: 'Race User B',
      avatarUrl: 'https://lh3.googleusercontent.com/race-b',
      authProvider: 'google',
      providerUserId: 'google-sub-race',
      emailVerified: true,
    }),
  ]);
  assert(raceA.ok === true && raceB.ok === true, 'Test 5a: Both concurrent OAuth callbacks succeed cleanly despite 23505 unique violation');
  const raceRows = mockSupabase.db.users_auth.filter((u) => u.email === 'race@example.com');
  assert(raceRows.length === 1, `Test 5b: Concurrent callbacks produce exact 1 users_auth record (got ${raceRows.length})`);

  // =========================================================================
  // Test 6: Profile Update on Subsequent Google Login
  // =========================================================================
  console.log('\n--- Test 6: Google Profile Metadata Updates on Subsequent Login ---');
  const updatedProfileRes = await syncGoogleOAuthUser(mockSupabase, {
    sub: 'google-sub-new-1',
    email: 'newbride@example.com',
    emailVerified: true,
    fullName: 'Clara Tan-Lim',
    avatarUrl: 'https://lh3.googleusercontent.com/clara-v2',
  });
  assert(updatedProfileRes.ok === true, 'Test 6a: Profile sync succeeds when Google name/avatar change');
  const updatedBride = mockSupabase.db.users_auth.find((u) => u.email === 'newbride@example.com');
  assert(
    updatedBride.full_name === 'Clara Tan-Lim' && updatedBride.avatar_url === 'https://lh3.googleusercontent.com/clara-v2',
    'Test 6b: Updated Google full_name and avatar_url persist in users_auth'
  );

  // =========================================================================
  // Test 7: Developer Permission Preservation & Anti-Escalation
  // =========================================================================
  console.log('\n--- Test 7: Developer Permission Preservation & Anti-Escalation ---');
  const devSyncRes = await syncGoogleOAuthUser(mockSupabase, {
    sub: 'google-dev-sub-1',
    email: 'platform-dev@eventframe.io',
    emailVerified: true,
    fullName: 'Platform Developer Updated',
    avatarUrl: 'https://lh3.googleusercontent.com/dev-pic',
  });
  assert(
    devSyncRes.ok === true && devSyncRes.user?.is_developer === true,
    'Test 7a: Existing platform developer retains is_developer=true across Google OAuth login'
  );
  const attackerJwt = jwt.sign(
    {
      id: '99999999-9999-4999-8999-999999999999',
      supabaseUserId: '99999999-9999-4999-8999-999999999999',
      email: 'attacker@example.com',
      name: 'Attacker',
      is_developer: true,
      role: 'super_admin',
    },
    JWT_SECRET
  );
  const attackerSync = await verifyTokenAndSyncUser(mockSupabase, attackerJwt, {
    verifyInternalJwt: (t) => jwt.verify(t, JWT_SECRET),
  });
  assert(
    attackerSync.ok === true && attackerSync.user?.is_developer === false && attackerSync.user?.role === 'user',
    'Test 7b: Spoofed is_developer/role claims during sync are stripped; newly created user has is_developer=false and role=user'
  );

  // =========================================================================
  // Test 8: Invalid Token, Wrong Audience, Missing Fields, Unverified Email, Suspended User
  // =========================================================================
  console.log('\n--- Test 8: Rejection of Invalid Tokens, Unverified Emails & Suspended Accounts ---');
  const rowCountBeforeInvalid = mockSupabase.db.users_auth.length;

  const wrongAudProfile = await resolveVerifiedGoogleProfile(
    { id_token: 'wrong-aud-id-token' },
    'expected-client-id',
    (async () =>
      new Response(
        JSON.stringify({ sub: 'sub-1', email: 'a@b.com', email_verified: 'true', aud: 'evil-client-id' }),
        { status: 200 }
      )) as any
  );
  assert(wrongAudProfile.ok === false && wrongAudProfile.code === 'INVALID_GOOGLE_AUDIENCE', 'Test 8a: Rejects Google id_token with mismatched audience');

  const unverifiedProfile = await resolveVerifiedGoogleProfile(
    { id_token: 'unverified-id-token' },
    'expected-client-id',
    (async () =>
      new Response(
        JSON.stringify({ sub: 'sub-2', email: 'unverified@example.com', email_verified: 'false', aud: 'expected-client-id' }),
        { status: 200 }
      )) as any
  );
  assert(unverifiedProfile.ok === false && unverifiedProfile.code === 'GOOGLE_EMAIL_NOT_VERIFIED', 'Test 8b: Rejects unverified Google email address');

  const missingSubProfile = await resolveVerifiedGoogleProfile(
    { id_token: 'missing-sub-token' },
    'expected-client-id',
    (async () =>
      new Response(
        JSON.stringify({ email: 'nosub@example.com', email_verified: 'true', aud: 'expected-client-id' }),
        { status: 200 }
      )) as any
  );
  assert(missingSubProfile.ok === false && missingSubProfile.code === 'MISSING_GOOGLE_PROFILE', 'Test 8c: Rejects Google payload missing sub identifier');

  const invalidTokenSync = await verifyTokenAndSyncUser(mockSupabase, 'totally-invalid-token', {
    verifyInternalJwt: (t) => jwt.verify(t, JWT_SECRET),
  });
  assert(invalidTokenSync.ok === false && invalidTokenSync.statusCode === 401, 'Test 8d: Rejects invalid/expired token with 401 without creating user');

  const suspendedSync = await syncGoogleOAuthUser(mockSupabase, {
    sub: 'google-suspended-sub',
    email: 'suspended@example.com',
    emailVerified: true,
    fullName: 'Suspended User',
    avatarUrl: null,
  });
  assert(suspendedSync.ok === false && suspendedSync.statusCode === 403 && suspendedSync.code === 'ACCOUNT_SUSPENDED', 'Test 8e: Rejects suspended user with 403 ACCOUNT_SUSPENDED');
  assert(mockSupabase.db.users_auth.length === rowCountBeforeInvalid, 'Test 8f: Rejected requests create zero database rows');

  // =========================================================================
  // Test 9: Database & Service-Role Failures Never Silently Swallowed
  // =========================================================================
  console.log('\n--- Test 9: Explicit Failure Surfacing & Fail-Closed Service-Role Enforcement ---');
  const noDbRes = await syncGoogleOAuthUser(null, {
    sub: 'sub-no-db',
    email: 'nodb@example.com',
    emailVerified: true,
    fullName: 'No DB',
    avatarUrl: null,
  });
  assert(noDbRes.ok === false && noDbRes.statusCode === 500 && noDbRes.code === 'DB_UNAVAILABLE', 'Test 9a: Missing Supabase service client returns explicit 500 DB_UNAVAILABLE');

  const rlsSupabase = createSyncMockSupabase({ users_auth: [] }, { failAllWritesWithRls: true });
  const rlsFailRes = await syncGoogleOAuthUser(rlsSupabase, {
    sub: 'sub-rls-fail',
    email: 'rlsfail@example.com',
    emailVerified: true,
    fullName: 'RLS Fail',
    avatarUrl: null,
  });
  assert(rlsFailRes.ok === false && rlsFailRes.statusCode === 500 && rlsFailRes.code === 'USER_SYNC_FAILED', 'Test 9b: RLS write error (42501) surfaces as 500 USER_SYNC_FAILED instead of silent fallback');

  // Worker getWorkerServiceSupabase must return null if ONLY anon key is present (fail-closed)
  const workerClientNoServiceKey = getWorkerServiceSupabase({
    env: { SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-only-key' },
  });
  assert(workerClientNoServiceKey === null, 'Test 9c: getWorkerServiceSupabase refuses VITE_SUPABASE_ANON_KEY fallback');

  // Express /api/auth/me & /api/auth/sync return 500 when ensureUserRecord fails on DB write error
  const rlsAuthSession = await resolveAuthenticatedSessionUser(
    rlsSupabase,
    { id: '66666666-6666-4666-8666-666666666666', email: 'rls-session@example.com', name: 'RLS Session' },
    undefined,
    { ensureUserRecord: true }
  );
  assert(
    rlsAuthSession.ok === false && rlsAuthSession.statusCode === 500 && rlsAuthSession.code === 'USER_SYNC_FAILED',
    'Test 9d: resolveAuthenticatedSessionUser({ ensureUserRecord: true }) fails explicitly when missing user insert fails'
  );

  // Also ensure Hono JWT helpers interoperate cleanly for Worker tokens
  const workerJwt = await honoJwtSign(
    { id: sbOnlyUuid, supabaseUserId: sbOnlyUuid, email: 'missingrow@example.com' },
    JWT_SECRET,
    'HS256'
  );
  const workerVerifySync = await verifyTokenAndSyncUser(mockSupabase, workerJwt, {
    verifyInternalJwt: (t) => honoJwtVerify(t, JWT_SECRET, 'HS256'),
  });
  assert(workerVerifySync.ok === true && workerVerifySync.canonicalUserId === sbOnlyUuid, 'Test 9e: Hono Worker JWT verifies and syncs against canonical Supabase UUID');

  // =========================================================================
  // Static Contract Checks (Migration, Express, Worker, Login UI)
  // =========================================================================
  console.log('\n--- Section 10: Static Security & Schema Contracts ---');
  const migrationSql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20261119_google_oauth_user_sync.sql'),
    'utf8'
  );
  assert(/ADD COLUMN IF NOT EXISTS supabase_user_id uuid/i.test(migrationSql), 'Contract 10a: Migration adds supabase_user_id uuid column to public.users_auth');
  assert(/ADD COLUMN IF NOT EXISTS provider_user_id text/i.test(migrationSql), 'Contract 10b: Migration adds provider_user_id text column');
  assert(migrationSql.includes('uq_users_auth_supabase_user_id'), 'Contract 10c: Migration adds unique partial index on supabase_user_id');
  assert(!/ALTER\s+TABLE\s+auth\.users/i.test(migrationSql), 'Contract 10d: Migration does not alter auth.users schema directly');

  const serverTs = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
  const workerTs = fs.readFileSync(path.join(process.cwd(), 'worker/index.ts'), 'utf8');
  const loginTsx = fs.readFileSync(path.join(process.cwd(), 'src/pages/Login.tsx'), 'utf8');

  assert(serverTs.includes("apiRouter.post('/auth/sync'") && serverTs.includes('syncGoogleOAuthUser('), 'Contract 10e: server.ts exposes POST /api/auth/sync and uses centralized syncGoogleOAuthUser');
  assert(serverTs.includes('user_sync_failed') && !serverTs.includes("User sync on login error (non-blocking)"), 'Contract 10f: server.ts never silently swallows Google sync failures');
  assert(workerTs.includes("app.post('/api/auth/sync'") && workerTs.includes('resolveVerifiedGoogleProfile(') && workerTs.includes('syncGoogleOAuthUser('), 'Contract 10g: worker/index.ts exposes POST /api/auth/sync, verifies Google tokens, and uses syncGoogleOAuthUser');
  const workerCallbackSection = workerTs.slice(
    workerTs.indexOf("app.get('/api/auth/callback'"),
    workerTs.indexOf("app.get('/api/auth/me'")
  );
  assert(!workerCallbackSection.includes('Math.random()'), 'Contract 10h: worker/index.ts callback does not fall back to random provider sub IDs');
  assert(loginTsx.includes('user_sync_failed') && loginTsx.includes('email_not_verified'), 'Contract 10i: Login.tsx renders clear UI feedback for user_sync_failed and email_not_verified');

  // Verify ensureSupabaseAuthUser directly creates auth user when admin API is available
  const freshEnsure = await ensureSupabaseAuthUser(mockSupabase, {
    email: 'ensure-direct@example.com',
    fullName: 'Ensure Direct',
    authProvider: 'google',
    providerUserId: 'sub-ensure-direct',
    emailVerified: true,
  });
  assert(freshEnsure.ok === true && Boolean(freshEnsure.supabaseUserId) && freshEnsure.created === true, 'Contract 10j: ensureSupabaseAuthUser provisions new auth.users UUID via admin API');

  // =========================================================================
  // Section 11: Email/Password Registration, Login, Verification & Reset Parity
  // =========================================================================
  console.log('\n--- Section 11: Email/Password Auth Preservation & Null-Hash Safety ---');
  const hashPbkdf2 = (password: string) => {
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  };
  const verifyPbkdf2 = (password: string, stored: string) => {
    if (!stored || !stored.includes(':')) return false;
    const [saltHex, originalHashHex] = stored.split(':');
    const hash = crypto.pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), 100000, 32, 'sha256');
    return hash.toString('hex') === originalHashHex;
  };

  // Seed a pre-existing verified email/password user with a real PBKDF2 hash and agency role
  const legacyPasswordHash = hashPbkdf2('ExistingSecret!2026');
  mockSupabase.db.users_auth.push({
    id: '77777777-7777-4777-8777-777777777777',
    supabase_user_id: null,
    external_user_id: 'email-legacy-user',
    email: 'planner@legacyagency.com',
    password_hash: legacyPasswordHash,
    full_name: 'Legacy Planner',
    auth_provider: 'email',
    role: 'agency_owner',
    is_developer: true,
    status: 'active',
    is_verified: true,
    email_verified: true,
    organization_id: 'org-legacy-9',
    created_at: '2025-11-01T00:00:00.000Z',
  });

  // 11a. New email/password registration creates Supabase UUID, hashes password cleanly, defaults is_developer=false
  const emailSignupRes = await registerEmailPasswordUser(
    mockSupabase,
    { email: 'NewPlanner@Studio.io', password: 'StrongPassword123!', fullName: 'Studio Owner' },
    { hashPassword: hashPbkdf2 }
  );
  assert(emailSignupRes.ok === true && emailSignupRes.isNewUser === true, 'Test 11a: New email/password registration succeeds');
  const emailSignupRow = mockSupabase.db.users_auth.find((u) => u.email === 'newplanner@studio.io');
  assert(
    Boolean(emailSignupRow?.password_hash) &&
      emailSignupRow.password_hash.includes(':') &&
      Boolean(emailSignupRow.supabase_user_id) &&
      emailSignupRow.id === emailSignupRow.supabase_user_id &&
      emailSignupRow.is_developer === false &&
      emailSignupRow.role === 'user' &&
      emailSignupRow.is_verified === false,
    'Test 11b: New email signup stores real PBKDF2 password_hash, Supabase UUID, and defaults role=user, is_developer=false'
  );

  // 11c. New email/password login verifies hash & /api/auth/verify marks verified preserving hash
  const emailLoginRes = await authenticateEmailPasswordUser(
    mockSupabase,
    { email: 'newplanner@studio.io', password: 'StrongPassword123!' },
    { verifyPassword: verifyPbkdf2 }
  );
  assert(emailLoginRes.ok === true, 'Test 11c: Newly registered email user authenticates with valid password');
  const badPasswordRes = await authenticateEmailPasswordUser(
    mockSupabase,
    { email: 'newplanner@studio.io', password: 'WrongPassword!' },
    { verifyPassword: verifyPbkdf2 }
  );
  assert(badPasswordRes.ok === false && badPasswordRes.statusCode === 401, 'Test 11d: Wrong password returns 401');

  const verifyEmailRes = await verifyEmailAccountTokenUser(mockSupabase, 'newplanner@studio.io');
  assert(
    verifyEmailRes.ok === true && verifyEmailRes.canonicalUserId === emailSignupRow.id,
    'Test 11e: Email verification returns canonical Supabase UUID instead of synthetic email- prefix'
  );
  assert(
    mockSupabase.db.users_auth.find((u) => u.email === 'newplanner@studio.io')?.password_hash === emailSignupRow.password_hash,
    'Test 11f: Email verification preserves stored password_hash'
  );

  // 11g. Pre-existing email/password user continues logging in & preserves developer/role/org + hash
  const legacyLoginRes = await authenticateEmailPasswordUser(
    mockSupabase,
    { email: 'PLANNER@legacyagency.com', password: 'ExistingSecret!2026' },
    { verifyPassword: verifyPbkdf2 }
  );
  assert(
    legacyLoginRes.ok === true &&
      legacyLoginRes.user?.is_developer === true &&
      legacyLoginRes.user?.role === 'agency_owner' &&
      legacyLoginRes.user?.organization_id === 'org-legacy-9',
    'Test 11g: Pre-existing email/password user authenticates cleanly and preserves is_developer, role, and organization_id'
  );

  // 11h. Google-only account (password_hash=null) attempting password login returns clean 400 instead of 500 TypeError
  const googleOnlyPasswordAttempt = await authenticateEmailPasswordUser(
    mockSupabase,
    { email: 'newbride@example.com', password: 'any-password' },
    { verifyPassword: verifyPbkdf2 }
  );
  assert(
    googleOnlyPasswordAttempt.ok === false &&
      googleOnlyPasswordAttempt.statusCode === 400 &&
      googleOnlyPasswordAttempt.code === 'PASSWORD_NOT_SET',
    'Test 11h: Google-only user with null password_hash returns 400 PASSWORD_NOT_SET cleanly without crashing'
  );

  // 11i. Unauthenticated signup attempt against an existing verified Google email is blocked
  const hijackAttempt = await registerEmailPasswordUser(
    mockSupabase,
    { email: 'newbride@example.com', password: 'AttackerPassword123' },
    { hashPassword: hashPbkdf2 }
  );
  assert(
    hijackAttempt.ok === false && hijackAttempt.statusCode === 400 && hijackAttempt.code === 'OAUTH_ACCOUNT_EXISTS',
    'Test 11i: Prevents password takeover of verified Google OAuth email via signup'
  );

  // 11j. Password reset sets hash safely while preserving role, is_developer, and organization_id
  const resetPwdRes = await resetUserPasswordWithHash(
    mockSupabase,
    { email: 'planner@legacyagency.com', password: 'UpdatedSecret!2027' },
    { hashPassword: hashPbkdf2 }
  );
  assert(resetPwdRes.ok === true, 'Test 11j: resetUserPasswordWithHash updates password cleanly');
  const legacyAfterReset = mockSupabase.db.users_auth.find((u) => u.email === 'planner@legacyagency.com');
  assert(
    legacyAfterReset.password_hash !== legacyPasswordHash &&
      legacyAfterReset.is_developer === true &&
      legacyAfterReset.role === 'agency_owner' &&
      legacyAfterReset.organization_id === 'org-legacy-9',
    'Test 11k: Password reset updates password_hash while preserving is_developer, role, and organization_id'
  );

  // =========================================================================
  // Section 12: Missing Google Profile Metadata & 23502 Schema Diagnostics
  // =========================================================================
  console.log('\n--- Section 12: Missing Profile Metadata & 23502 Migration Contracts ---');
  const minimalGoogleProfileRes = await resolveVerifiedGoogleProfile(
    { id_token: 'minimal-google-token' },
    'expected-client-id',
    (async () =>
      new Response(
        JSON.stringify({ sub: 'sub-minimal-meta', email: 'minimal.meta@gmail.com', email_verified: 'true', aud: 'expected-client-id' }),
        { status: 200 }
      )) as any
  );
  assert(
    minimalGoogleProfileRes.ok === true &&
      minimalGoogleProfileRes.profile.fullName === 'minimal.meta' &&
      minimalGoogleProfileRes.profile.avatarUrl === null,
    'Test 12a: Google profile missing name and picture falls back safely to email local-part and null avatar'
  );
  if (minimalGoogleProfileRes.ok) {
    const minimalSyncRes = await syncGoogleOAuthUser(mockSupabase, minimalGoogleProfileRes.profile);
    assert(
      minimalSyncRes.ok === true &&
        minimalSyncRes.user?.full_name === 'minimal.meta' &&
        minimalSyncRes.user?.password_hash === undefined &&
        mockSupabase.db.users_auth.find((u) => u.email === 'minimal.meta@gmail.com')?.password_hash === null,
      'Test 12b: Minimal Google user syncs into users_auth with fallback full_name and null password_hash'
    );
  }

  // Simulate an unmigrated database that still has `password_hash NOT NULL`
  const unmigratedDb = createSyncMockSupabase({ users_auth: [] }, { enforcePasswordHashNotNull: true });
  const unmigratedSync = await syncGoogleOAuthUser(unmigratedDb, {
    sub: 'sub-unmigrated',
    email: 'unmigrated@gmail.com',
    emailVerified: true,
    fullName: 'Unmigrated User',
    avatarUrl: null,
  });
  assert(
    unmigratedSync.ok === false &&
      unmigratedSync.statusCode === 500 &&
      unmigratedSync.code === 'SCHEMA_MIGRATION_REQUIRED',
    'Test 12c: Unmigrated password_hash NOT NULL returns explicit 500 SCHEMA_MIGRATION_REQUIRED instead of generating a fake password hash'
  );

  // Verify 20261120 SQL migration file contracts
  const migration20261120 = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20261120_users_auth_password_hash_nullable.sql'),
    'utf8'
  );
  assert(
    migration20261120.includes('ALTER TABLE public.users_auth ALTER COLUMN password_hash DROP NOT NULL'),
    'Contract 12d: 20261120 migration alters public.users_auth.password_hash DROP NOT NULL'
  );
  assert(
    migration20261120.includes('SET DEFAULT false') && migration20261120.includes('SET DEFAULT gen_random_uuid()'),
    'Contract 12e: 20261120 migration audits and guarantees defaults on NOT NULL columns'
  );
  assert(
    migrationSql.includes('ALTER TABLE public.users_auth ALTER COLUMN password_hash DROP NOT NULL'),
    'Contract 12f: 20261119 migration safely drops NOT NULL on password_hash before backfilling'
  );

  console.log('\n🎉 All Google OAuth, password_hash nullable & email/password synchronization tests passed!');
}

runTests().catch((err) => {
  console.error('\n💥 Google OAuth synchronization test suite failed:', err);
  process.exit(1);
});
