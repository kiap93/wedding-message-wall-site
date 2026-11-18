/**
 * Comprehensive Agency & Project Authorization Test Suite
 *
 * Covers all 10 required scenarios across:
 * - Database/service layer (developerAdminService, billingService, agencyService)
 * - Express HTTP API routes (/api/projects, /api/projects/:id, /api/agencies/me)
 * - Cloudflare Worker Hono routes (/api/projects, /api/projects/:id, /api/agencies/me)
 * - Frontend React WorkspaceContext + Workspace + DashboardLayout multi-agency switching & stale state cleanup
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
import { sign as honoJwtSign } from 'hono/jwt';
import { JSDOM } from 'jsdom';
import { createServer, ViteDevServer } from 'vite';

import {
  resolveAuthenticatedSessionUser,
} from '../server/developerAdminService';
import {
  hasExplicitAdminAgencyAccess,
  resolveUserOrganizationsWithMetadata,
} from '../server/billingService';
import {
  authorizeAgencyAccess,
  authorizeProjectAccess,
  findAgenciesForUser,
  listProjectsForUser,
  getProjectForAuthorizedUser,
  createProjectForUser,
} from '../server/agencyService';
import { verifySessionWithDb } from '../server/createDeveloperRouter';
import { registerWorkerDeveloperRoutes } from '../server/registerWorkerDeveloperRoutes';

const JWT_SECRET = 'test-agency-project-auth-secret-v1';

// Deterministic UUID fixtures matching production IDs (including the reported failing agency ID)
const REPORTED_AGENCY_ID = 'd0e0f0d4-1c7f-4ac2-b92d-2ace37c6b2d1';
const OTHER_AGENCY_ID = 'e1f1a1e5-2d8a-4bd3-8a3e-3bdf48d7c3e2';
const MULTI_ORG_AGENCY_ID = 'f2a2b2f6-3e9b-4ce4-9b4f-4cef59e8d4f3';
const MISSING_AGENCY_UUID = '99999999-9999-4999-8999-999999999999';

const OWNER_INTERNAL_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_INTERNAL_ID = '22222222-2222-4222-8222-222222222222';
const GOOGLE_MEMBER_INTERNAL_ID = '33333333-3333-4333-8333-333333333333';
const NO_ORG_USER_INTERNAL_ID = '44444444-4444-4444-8444-444444444444';
const DEV_INTERNAL_ID = '55555555-5555-4555-8555-555555555555';
const FAKE_ADMIN_INTERNAL_ID = '66666666-6666-4666-8666-666666666666';
const MULTI_ORG_MEMBER_INTERNAL_ID = '77777777-7777-4777-8777-777777777777';

const PROJECT_REPORTED_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT_OTHER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROJECT_MULTI_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

type TableRows = Record<string, any[]>;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class AuthMockQueryBuilder {
  private table: string;
  private db: TableRows;
  private filters: Array<(row: any) => boolean> = [];
  private invalidUuidError = false;
  private orderCol: string | null = null;
  private orderAsc = true;
  private maxRows: number | null = null;
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
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
    // Simulate Postgres UUID column type rejection (22P02) on agencies.id / projects.id
    if ((col === 'id' || col === 'user_id') && (this.table === 'agencies' || this.table === 'projects' || this.table === 'users_auth')) {
      if (col === 'id' && val && !UUID_REGEX.test(String(val))) {
        this.invalidUuidError = true;
      }
    }
    this.filters.push((r) => r?.[col] === val);
    return this;
  }

  ilike(col: string, val: string) {
    const target = String(val || '').toLowerCase();
    this.filters.push((r) => String(r?.[col] || '').toLowerCase() === target);
    return this;
  }

  in(col: string, vals: any[]) {
    this.filters.push((r) => vals.includes(r?.[col]));
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

  delete() {
    this.op = 'delete';
    return this;
  }

  private exec() {
    if (this.invalidUuidError) {
      return {
        data: null,
        error: {
          code: '22P02',
          message: 'invalid input syntax for type uuid',
        },
      };
    }

    const arr = this.db[this.table] || [];

    if (this.op === 'insert') {
      const inserted = this.payload.map((item: any, i: number) => ({
        id: item.id || `99990000-0000-4000-8000-00000000000${i}`,
        created_at: item.created_at || new Date().toISOString(),
        ...item,
      }));
      arr.push(...inserted);
      return { data: this.singleMode === 'none' ? inserted : inserted[0] || null, error: null };
    }

    if (this.op === 'update') {
      const updated: any[] = [];
      for (const row of arr) {
        if (this.filters.every((fn) => fn(row))) {
          Object.assign(row, this.payload);
          updated.push({ ...row });
        }
      }
      return { data: this.singleMode === 'none' ? updated : updated[0] || null, error: null };
    }

    if (this.op === 'upsert') {
      for (const item of this.payload) {
        const idx = arr.findIndex((r) =>
          this.table === 'agency_members'
            ? r.agency_id === item.agency_id && r.user_id === item.user_id
            : r.id === item.id
        );
        if (idx >= 0) {
          arr[idx] = { ...arr[idx], ...item };
        } else {
          arr.push({ id: item.id || `mem-${Date.now()}`, ...item });
        }
      }
      return { data: this.payload, error: null };
    }

    if (this.op === 'delete') {
      this.db[this.table] = arr.filter((r) => !this.filters.every((fn) => fn(r)));
      return { data: [], error: null };
    }

    let rows = arr.filter((r) => this.filters.every((fn) => fn(r))).map((r) => ({ ...r }));
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
      if (!rows[0]) return { data: null, error: { code: 'PGRST116', message: 'Row not found' } };
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

function createFixtureSupabase() {
  const db: TableRows = {
    users_auth: [
      {
        id: OWNER_INTERNAL_ID,
        email: 'owner@atelierlumiere.com',
        name: 'Agency Owner',
        role: 'agency_owner',
        is_developer: false,
        status: 'active',
        organization_id: REPORTED_AGENCY_ID,
      },
      {
        id: MEMBER_INTERNAL_ID,
        email: 'planner@atelierlumiere.com',
        name: 'Team Planner',
        role: 'agency_member',
        is_developer: false,
        status: 'active',
        supabase_user_id: 'supa-auth-uuid-member-1',
        organization_id: null, // Only authorized via agency_members join table
      },
      {
        id: GOOGLE_MEMBER_INTERNAL_ID,
        email: 'google.planner@gmail.com',
        name: 'Google Planner',
        role: 'agency_member',
        is_developer: false,
        status: 'active',
        provider_user_id: 'google-oauth-sub-987654321',
        external_user_id: 'google-oauth-sub-987654321',
        auth_provider: 'google',
        organization_id: null,
      },
      {
        id: NO_ORG_USER_INTERNAL_ID,
        email: 'newuser@example.com',
        name: 'Unassigned User',
        role: 'user',
        is_developer: false,
        status: 'active',
        organization_id: null,
      },
      {
        id: DEV_INTERNAL_ID,
        email: 'platform-dev@partner.org',
        name: 'Platform Developer',
        role: 'user',
        is_developer: true,
        status: 'active',
        organization_id: null,
      },
      {
        id: FAKE_ADMIN_INTERNAL_ID,
        email: 'spoof@eventframe.io',
        name: 'Non-Dev With SuperAdmin Role',
        role: 'super_admin',
        is_developer: false,
        status: 'active',
        organization_id: null,
      },
      {
        id: MULTI_ORG_MEMBER_INTERNAL_ID,
        email: 'lead@multiagency.com',
        name: 'Multi-Agency Lead',
        role: 'agency_member',
        is_developer: false,
        status: 'active',
        organization_id: REPORTED_AGENCY_ID,
      },
    ],
    agencies: [
      {
        id: REPORTED_AGENCY_ID,
        name: 'Atelier Lumiere',
        slug: 'atelier-lumiere',
        user_role: 'agency',
        user_id: OWNER_INTERNAL_ID,
        owner_email: 'owner@atelierlumiere.com',
        subscription_status: 'active',
        status: 'active',
        deleted_at: null,
      },
      {
        id: OTHER_AGENCY_ID,
        name: 'Maison Noir Events',
        slug: 'maison-noir',
        user_role: 'agency',
        user_id: 'other-owner-999',
        owner_email: 'other@maisonnoir.com',
        subscription_status: 'active',
        status: 'active',
        deleted_at: null,
      },
      {
        id: MULTI_ORG_AGENCY_ID,
        name: 'Villa Como Weddings',
        slug: 'villa-como',
        user_role: 'agency',
        user_id: 'another-owner-888',
        owner_email: 'owner@villacomo.com',
        subscription_status: 'active',
        status: 'active',
        deleted_at: null,
      },
    ],
    agency_members: [
      {
        id: 'mem-owner-1',
        agency_id: REPORTED_AGENCY_ID,
        user_id: OWNER_INTERNAL_ID,
        role: 'owner',
        status: 'active',
      },
      {
        id: 'mem-member-1',
        agency_id: REPORTED_AGENCY_ID,
        user_id: MEMBER_INTERNAL_ID,
        role: 'member',
        status: 'active',
      },
      {
        id: 'mem-google-1',
        agency_id: REPORTED_AGENCY_ID,
        user_id: GOOGLE_MEMBER_INTERNAL_ID,
        role: 'member',
        status: 'active',
      },
      {
        id: 'mem-revoked-1',
        agency_id: OTHER_AGENCY_ID,
        user_id: MEMBER_INTERNAL_ID,
        role: 'member',
        status: 'revoked', // Must NOT grant access!
      },
      {
        id: 'mem-multi-1',
        agency_id: REPORTED_AGENCY_ID,
        user_id: MULTI_ORG_MEMBER_INTERNAL_ID,
        role: 'admin',
        status: 'active',
      },
      {
        id: 'mem-multi-2',
        agency_id: MULTI_ORG_AGENCY_ID,
        user_id: MULTI_ORG_MEMBER_INTERNAL_ID,
        role: 'member',
        status: 'active',
      },
    ],
    projects: [
      {
        id: PROJECT_REPORTED_ID,
        agency_id: REPORTED_AGENCY_ID,
        name: 'Camille & Theo',
        groom_name: 'Theo',
        bride_name: 'Camille',
        slug: 'camille-theo',
        wedding_date: '2026-08-18',
        status: 'active',
        deleted_at: null,
      },
      {
        id: PROJECT_OTHER_ID,
        agency_id: OTHER_AGENCY_ID,
        name: 'Private Other Wedding',
        groom_name: 'Marc',
        bride_name: 'Julie',
        slug: 'marc-julie',
        wedding_date: '2026-09-10',
        status: 'active',
        deleted_at: null,
      },
      {
        id: PROJECT_MULTI_ID,
        agency_id: MULTI_ORG_AGENCY_ID,
        name: 'Lorenzo & Giulia',
        groom_name: 'Lorenzo',
        bride_name: 'Giulia',
        slug: 'lorenzo-giulia',
        wedding_date: '2026-10-02',
        status: 'active',
        deleted_at: null,
      },
    ],
  };

  return {
    db,
    from(table: string) {
      return new AuthMockQueryBuilder(db, table);
    },
  };
}

function buildTestServers(supabase: any) {
  // Express Server matching server.ts routes
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/agencies/me', async (req, res) => {
    const authCheck = await verifySessionWithDb(req, {
      getSupabase: () => supabase,
      getJwtSecret: () => JWT_SECRET,
      getSuperAdminEmails: () => '',
    });
    if (authCheck.ok === false) {
      return res.status(authCheck.statusCode).json({ error: authCheck.error, code: authCheck.code });
    }
    const result = await findAgenciesForUser(supabase, authCheck.user);
    if (result.ok === false) {
      return res.status(result.statusCode).json({ error: result.error, code: result.code });
    }
    return res.json({ agencies: result.data.agencies, agency: result.data.primaryAgency });
  });

  app.get('/api/projects', async (req, res) => {
    const authCheck = await verifySessionWithDb(req, {
      getSupabase: () => supabase,
      getJwtSecret: () => JWT_SECRET,
      getSuperAdminEmails: () => '',
    });
    if (authCheck.ok === false) {
      return res.status(authCheck.statusCode).json({ error: authCheck.error, code: authCheck.code });
    }
    const agencyId = typeof req.query.agency_id === 'string' ? req.query.agency_id : undefined;
    const result = await listProjectsForUser(supabase, authCheck.user, agencyId);
    if (result.ok === false) {
      return res.status(result.statusCode).json({ error: result.error, code: result.code });
    }
    return res.json({ success: true, data: result.data });
  });

  app.get('/api/projects/:id', async (req, res) => {
    const authCheck = await verifySessionWithDb(req, {
      getSupabase: () => supabase,
      getJwtSecret: () => JWT_SECRET,
      getSuperAdminEmails: () => '',
    });
    if (authCheck.ok === false) {
      return res.status(authCheck.statusCode).json({ error: authCheck.error, code: authCheck.code });
    }
    const result = await getProjectForAuthorizedUser(supabase, authCheck.user, req.params.id);
    if (result.ok === false) {
      return res.status(result.statusCode).json({ error: result.error, code: result.code });
    }
    return res.json({ success: true, data: result.data.project, agency: result.data.agency });
  });

  // Hono Worker App matching worker/index.ts routes
  const workerApp = new Hono();
  const verifyWorker = async (c: any) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return { ok: false as const, statusCode: 401, code: 'UNAUTHENTICATED', error: 'Not authenticated' };
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return resolveAuthenticatedSessionUser(supabase, decoded, '');
    } catch {
      return { ok: false as const, statusCode: 401, code: 'UNAUTHENTICATED', error: 'Invalid or expired session' };
    }
  };

  registerWorkerDeveloperRoutes(workerApp, {
    getSupabase: () => supabase,
    getJwtSecret: () => JWT_SECRET,
    getSuperAdminEmails: () => '',
  });

  workerApp.get('/api/projects', async (c) => {
    const check = await verifyWorker(c);
    if (!check.ok) {
      return c.json({ error: check.error, code: check.code }, check.statusCode as any);
    }
    const agencyId = c.req.query('agency_id');
    const result = await listProjectsForUser(supabase, check.user, agencyId);
    if (result.ok === false) {
      return c.json({ error: result.error, code: result.code }, result.statusCode as any);
    }
    return c.json({ success: true, data: result.data });
  });

  return { app, workerApp };
}

async function runBackendAndParityTests() {
  console.log('\n--- Agency & Project Authorization Tests (All 10 Scenarios) ---');
  const supabase = createFixtureSupabase();
  const { app, workerApp } = buildTestServers(supabase);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const signToken = (payload: Record<string, any>, expiresIn: string | number = '1h') =>
    jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Agency owner accesses projects -> 200
    // -------------------------------------------------------------------------
    const ownerToken = signToken({
      id: OWNER_INTERNAL_ID,
      email: 'owner@atelierlumiere.com',
      role: 'agency_owner',
    });
    const res1Exp = await fetch(`${baseUrl}/api/projects?agency_id=${REPORTED_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res1Exp.status, 200, 'Scenario 1 (Express): Agency owner accesses projects -> 200');
    const body1Exp = await res1Exp.json();
    assert.equal(body1Exp.data.length, 1);
    assert.equal(body1Exp.data[0].id, PROJECT_REPORTED_ID);

    const res1Worker = await workerApp.request(
      `http://worker/api/projects?agency_id=${REPORTED_AGENCY_ID}`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    assert.equal(res1Worker.status, 200, 'Scenario 1 (Worker): Agency owner accesses projects -> 200');
    console.log('✓ Scenario 1 passed: Agency owner accesses projects (200)');

    // -------------------------------------------------------------------------
    // Scenario 2: Agency member accesses projects (including external supabase_user_id -> internal users_auth.id lookup) -> 200
    // -------------------------------------------------------------------------
    const memberTokenWithSupaId = signToken({
      id: 'supa-auth-uuid-member-1', // External Supabase Auth UUID, NOT internal users_auth.id!
      sub: 'supa-auth-uuid-member-1',
      email: 'planner@atelierlumiere.com',
      role: 'agency_member',
    });
    const res2Exp = await fetch(`${baseUrl}/api/projects?agency_id=${REPORTED_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${memberTokenWithSupaId}` },
    });
    assert.equal(res2Exp.status, 200, 'Scenario 2 (Express): Active agency_members user accesses projects -> 200');
    const body2Exp = await res2Exp.json();
    assert.equal(body2Exp.data[0].id, PROJECT_REPORTED_ID);

    const res2Worker = await workerApp.request(
      `http://worker/api/projects?agency_id=${REPORTED_AGENCY_ID}`,
      { headers: { Authorization: `Bearer ${memberTokenWithSupaId}` } }
    );
    assert.equal(res2Worker.status, 200, 'Scenario 2 (Worker): Active agency_members user accesses projects -> 200');
    console.log('✓ Scenario 2 passed: Agency member (resolved to internal users_auth.id) accesses projects (200)');

    // -------------------------------------------------------------------------
    // Scenario 3: User without agency membership -> 403 FORBIDDEN_AGENCY_ACCESS
    // -------------------------------------------------------------------------
    const noOrgToken = signToken({
      id: NO_ORG_USER_INTERNAL_ID,
      email: 'newuser@example.com',
      role: 'user',
    });
    const res3Exp = await fetch(`${baseUrl}/api/projects?agency_id=${REPORTED_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${noOrgToken}` },
    });
    assert.equal(res3Exp.status, 403, 'Scenario 3 (Express): User without membership -> 403');
    const body3Exp = await res3Exp.json();
    assert.equal(body3Exp.code, 'FORBIDDEN_AGENCY_ACCESS');

    const res3Worker = await workerApp.request(
      `http://worker/api/projects?agency_id=${REPORTED_AGENCY_ID}`,
      { headers: { Authorization: `Bearer ${noOrgToken}` } }
    );
    assert.equal(res3Worker.status, 403, 'Scenario 3 (Worker): User without membership -> 403');
    console.log('✓ Scenario 3 passed: User without agency membership rejected (403 FORBIDDEN_AGENCY_ACCESS)');

    // -------------------------------------------------------------------------
    // Scenario 4: User accesses another agency (and revoked membership) -> 403 FORBIDDEN_AGENCY_ACCESS
    // -------------------------------------------------------------------------
    const res4OwnerOther = await fetch(`${baseUrl}/api/projects?agency_id=${OTHER_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res4OwnerOther.status, 403, 'Scenario 4: Owner accessing another agency -> 403');
    const body4 = await res4OwnerOther.json();
    assert.equal(body4.code, 'FORBIDDEN_AGENCY_ACCESS');

    // Member has a 'revoked' row on OTHER_AGENCY_ID -> must STILL be 403!
    const res4Revoked = await fetch(`${baseUrl}/api/projects?agency_id=${OTHER_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${memberTokenWithSupaId}` },
    });
    assert.equal(res4Revoked.status, 403, 'Scenario 4: Revoked member accessing another agency -> 403');

    // Direct project access on another agency must also return 403
    const res4SingleProj = await fetch(`${baseUrl}/api/projects/${PROJECT_OTHER_ID}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res4SingleProj.status, 403, 'Scenario 4: Accessing single project in another agency -> 403');
    console.log('✓ Scenario 4 passed: Cross-agency & revoked membership access blocked (403)');

    // -------------------------------------------------------------------------
    // Scenario 5: Invalid / non-existent agency ID -> 404 AGENCY_NOT_FOUND
    // -------------------------------------------------------------------------
    const res5Missing = await fetch(`${baseUrl}/api/projects?agency_id=${MISSING_AGENCY_UUID}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res5Missing.status, 404, 'Scenario 5: Non-existent agency UUID -> 404');
    assert.equal((await res5Missing.json()).code, 'AGENCY_NOT_FOUND');

    const res5Malformed = await fetch(`${baseUrl}/api/projects?agency_id=not-a-valid-uuid`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res5Malformed.status, 404, 'Scenario 5: Malformed agency ID -> 404 AGENCY_NOT_FOUND (not 403/422)');
    assert.equal((await res5Malformed.json()).code, 'AGENCY_NOT_FOUND');

    const res5Undefined = await fetch(`${baseUrl}/api/projects?agency_id=undefined`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res5Undefined.status, 404, 'Scenario 5: Literal undefined agency ID -> 404 AGENCY_NOT_FOUND');
    console.log('✓ Scenario 5 passed: Missing/invalid agency IDs cleanly return 404 AGENCY_NOT_FOUND');

    // -------------------------------------------------------------------------
    // Scenario 6: Expired / missing / invalid JWT session -> 401 UNAUTHENTICATED
    // -------------------------------------------------------------------------
    const res6Missing = await fetch(`${baseUrl}/api/projects?agency_id=${REPORTED_AGENCY_ID}`);
    assert.equal(res6Missing.status, 401, 'Scenario 6: Missing token -> 401');

    const expiredToken = jwt.sign(
      { id: OWNER_INTERNAL_ID, email: 'owner@atelierlumiere.com', exp: Math.floor(Date.now() / 1000) - 60 },
      JWT_SECRET
    );
    const res6Expired = await fetch(`${baseUrl}/api/projects?agency_id=${REPORTED_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(res6Expired.status, 401, 'Scenario 6: Expired token -> 401');

    const res6WorkerExpired = await workerApp.request(
      `http://worker/api/projects?agency_id=${REPORTED_AGENCY_ID}`,
      { headers: { Authorization: `Bearer ${expiredToken}` } }
    );
    assert.equal(res6WorkerExpired.status, 401, 'Scenario 6 (Worker): Expired token -> 401');
    console.log('✓ Scenario 6 passed: Missing/expired sessions return 401');

    // -------------------------------------------------------------------------
    // Scenario 7: Google authenticated user with valid membership -> 200
    // -------------------------------------------------------------------------
    // Google JWT uses provider `sub` (`google-oauth-sub-987654321`) that differs from `users_auth.id`!
    const googleToken = signToken({
      id: 'google-oauth-sub-987654321',
      sub: 'google-oauth-sub-987654321',
      email: 'google.planner@gmail.com',
      auth_provider: 'google',
      organizationId: OTHER_AGENCY_ID, // Spoofed JWT org claim must NEVER grant OTHER_AGENCY_ID!
    });

    const res7GoogleAllowed = await fetch(`${baseUrl}/api/projects?agency_id=${REPORTED_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${googleToken}` },
    });
    assert.equal(res7GoogleAllowed.status, 200, 'Scenario 7: Google OAuth user resolves internal users_auth.id & accesses authorized agency -> 200');
    const body7 = await res7GoogleAllowed.json();
    assert.equal(body7.data[0].id, PROJECT_REPORTED_ID);

    // Ensure spoofed JWT organizationId cannot grant access to OTHER_AGENCY_ID
    const res7SpoofedOrg = await fetch(`${baseUrl}/api/projects?agency_id=${OTHER_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${googleToken}` },
    });
    assert.equal(res7SpoofedOrg.status, 403, 'Scenario 7: Spoofed JWT organizationId ignored (403 FORBIDDEN_AGENCY_ACCESS)');
    console.log('✓ Scenario 7 passed: Google OAuth user resolved to canonical internal ID -> 200, spoofed claims ignored');

    // -------------------------------------------------------------------------
    // Scenario 8 & 9: Multi-agency user switches to another authorized agency (200) vs unauthorized agency (403)
    // -------------------------------------------------------------------------
    const multiOrgToken = signToken({
      id: MULTI_ORG_MEMBER_INTERNAL_ID,
      email: 'lead@multiagency.com',
      role: 'agency_member',
    });

    const res8First = await fetch(`${baseUrl}/api/projects?agency_id=${REPORTED_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${multiOrgToken}` },
    });
    assert.equal(res8First.status, 200, 'Scenario 8: Multi-org user accesses first authorized agency -> 200');
    assert.equal((await res8First.json()).data[0].id, PROJECT_REPORTED_ID);

    const res8Second = await fetch(`${baseUrl}/api/projects?agency_id=${MULTI_ORG_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${multiOrgToken}` },
    });
    assert.equal(res8Second.status, 200, 'Scenario 8: Multi-org user switches to second authorized agency -> 200');
    assert.equal((await res8Second.json()).data[0].id, PROJECT_MULTI_ID);

    const res9Unauthorized = await fetch(`${baseUrl}/api/projects?agency_id=${OTHER_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${multiOrgToken}` },
    });
    assert.equal(res9Unauthorized.status, 403, 'Scenario 9: Multi-org user switches to unauthorized agency -> 403');
    assert.equal((await res9Unauthorized.json()).code, 'FORBIDDEN_AGENCY_ACCESS');
    console.log('✓ Scenarios 8 & 9 passed: Multi-agency authorized switching (200) & unauthorized switching (403)');

    // -------------------------------------------------------------------------
    // Scenario 10: Developer accesses agency under explicit admin permission -> 200; spoofed/role-only denied -> 403
    // -------------------------------------------------------------------------
    const devToken = signToken({
      id: DEV_INTERNAL_ID,
      email: 'platform-dev@partner.org',
      is_developer: true,
    });
    const res10Dev = await fetch(`${baseUrl}/api/projects?agency_id=${OTHER_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${devToken}` },
    });
    assert.equal(res10Dev.status, 200, 'Scenario 10: Active developer accesses any existing agency under explicit admin policy -> 200');
    assert.equal((await res10Dev.json()).data[0].id, PROJECT_OTHER_ID);

    // Worker parity for developer admin permission
    const res10WorkerDev = await workerApp.request(
      `http://worker/api/projects?agency_id=${OTHER_AGENCY_ID}`,
      { headers: { Authorization: `Bearer ${devToken}` } }
    );
    assert.equal(res10WorkerDev.status, 200, 'Scenario 10 (Worker): Explicit developer admin access -> 200');

    // Spoofed JWT claiming is_developer: true & role: super_admin when DB says is_developer: false
    const spoofedDevToken = signToken({
      id: NO_ORG_USER_INTERNAL_ID,
      email: 'newuser@example.com',
      role: 'super_admin',
      is_developer: true,
    });
    const res10Spoof = await fetch(`${baseUrl}/api/projects?agency_id=${OTHER_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${spoofedDevToken}` },
    });
    assert.equal(res10Spoof.status, 403, 'Scenario 10: Spoofed JWT is_developer/super_admin claims rejected against DB (403)');

    // DB user with role='super_admin' but is_developer=false must NOT get admin agency override
    const legacyRoleOnlyToken = signToken({
      id: FAKE_ADMIN_INTERNAL_ID,
      email: 'spoof@eventframe.io',
      role: 'super_admin',
    });
    const res10RoleOnly = await fetch(`${baseUrl}/api/projects?agency_id=${OTHER_AGENCY_ID}`, {
      headers: { Authorization: `Bearer ${legacyRoleOnlyToken}` },
    });
    assert.equal(res10RoleOnly.status, 403, 'Scenario 10: User with role=super_admin but is_developer=false cannot bypass agency ownership');

    // Direct unit check on hasExplicitAdminAgencyAccess & createProjectForUser authorization
    assert.equal(hasExplicitAdminAgencyAccess({ id: 'x', email: 'a@b.c', is_developer: false, role: 'super_admin' }), false);
    assert.equal(hasExplicitAdminAgencyAccess({ id: 'x', email: 'a@b.c', is_developer: true, status: 'suspended' }), false);
    assert.equal(hasExplicitAdminAgencyAccess({ id: 'x', email: 'a@b.c', is_developer: true, status: 'active' }), true);

    const directCreateForbidden = await createProjectForUser(
      supabase,
      { id: NO_ORG_USER_INTERNAL_ID, email: 'newuser@example.com', is_developer: false },
      { agency_id: REPORTED_AGENCY_ID, groom_name: 'A', bride_name: 'B', slug: 'a-b' }
    );
    assert.equal(directCreateForbidden.ok, false);
    assert.equal(directCreateForbidden.statusCode, 403);

    const devAuthCtx = await authorizeAgencyAccess(
      supabase,
      { id: DEV_INTERNAL_ID, email: 'platform-dev@partner.org', is_developer: true, status: 'active' },
      REPORTED_AGENCY_ID
    );
    assert.equal(devAuthCtx.ok, true);
    if (devAuthCtx.ok) {
      assert.equal(devAuthCtx.data.accessType, 'admin');
      assert.equal(devAuthCtx.data.isAdminOverride, true);
    }

    const memberMeta = await resolveUserOrganizationsWithMetadata(supabase, {
      id: MEMBER_INTERNAL_ID,
      email: 'planner@atelierlumiere.com',
    });
    assert.equal(memberMeta.internalUserId, MEMBER_INTERNAL_ID);
    assert.equal(memberMeta.membershipByAgencyId.get(REPORTED_AGENCY_ID), 'member');
    assert.equal(memberMeta.membershipByAgencyId.has(OTHER_AGENCY_ID), false);

    // Ensure Worker Hono token also works cleanly
    const workerHonoToken = await honoJwtSign(
      { id: OWNER_INTERNAL_ID, email: 'owner@atelierlumiere.com', exp: Math.floor(Date.now() / 1000) + 3600 },
      JWT_SECRET
    );
    const workerAuthzRes = await workerApp.request(
      `http://worker/api/projects?agency_id=${REPORTED_AGENCY_ID}`,
      { headers: { Authorization: `Bearer ${workerHonoToken}` } }
    );
    assert.equal(workerAuthzRes.status, 200);

    console.log('✓ Scenario 10 passed: Explicit developer admin override works & non-dev/spoofed claims rejected');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function runFrontendWorkspaceContextTests() {
  console.log('\n--- Frontend WorkspaceContext & Agency Switching DOM Tests ---');

  // Mount at another agency's subdomain while user only owns agency-1 & agency-2!
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://unauthorized-studio.eventframe.io/workspace?view=grid',
  });
  const win = dom.window;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).window = win;
  (globalThis as any).document = win.document;
  (globalThis as any).HTMLElement = win.HTMLElement;
  (globalThis as any).HTMLSelectElement = win.HTMLSelectElement;
  (globalThis as any).Element = win.Element;
  (globalThis as any).Node = win.Node;
  (globalThis as any).Event = win.Event;
  (globalThis as any).PopStateEvent = win.PopStateEvent;
  (globalThis as any).CustomEvent = win.CustomEvent;
  (globalThis as any).MutationObserver = win.MutationObserver;
  (globalThis as any).localStorage = win.localStorage;
  (globalThis as any).sessionStorage = win.sessionStorage;

  Object.defineProperty(globalThis, 'navigator', {
    value: win.navigator,
    configurable: true,
  });

  if (!win.matchMedia) {
    win.matchMedia = () =>
      ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as any;
  }

  const AGENCY_1_ID = 'aaaa1111-1111-4111-8111-111111111111';
  const AGENCY_2_ID = 'bbbb2222-2222-4222-8222-222222222222';
  const requestedProjectAgencyIds: string[] = [];

  (globalThis as any).fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/api/auth/me')) {
      return new Response(
        JSON.stringify({
          user: { id: 'usr-1', email: 'multi@atelier.com', role: 'agency_owner', is_developer: false },
          csrfToken: 'csrf-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Subdomain branding resolves to unauthorized agency ID — private workspace must NOT request its projects!
    if (url.includes('/api/agencies/resolve')) {
      return new Response(
        JSON.stringify({
          found: true,
          agency: {
            id: REPORTED_AGENCY_ID,
            name: 'Other Studio Brand',
            slug: 'unauthorized-studio',
            user_role: 'agency',
            subscription_status: 'active',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('/api/agencies/me')) {
      return new Response(
        JSON.stringify({
          agencies: [
            {
              id: AGENCY_1_ID,
              name: 'Atelier One',
              slug: 'atelier-one',
              user_role: 'agency',
              subscription_status: 'active',
            },
            {
              id: AGENCY_2_ID,
              name: 'Atelier Two',
              slug: 'atelier-two',
              user_role: 'agency',
              subscription_status: 'active',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('/api/projects')) {
      const parsed = new URL(url, 'https://eventframe.io');
      const agencyId = parsed.searchParams.get('agency_id') || '';
      requestedProjectAgencyIds.push(agencyId);

      if (agencyId === AGENCY_1_ID) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: '11110000-0000-4000-8000-000000000001',
                agency_id: AGENCY_1_ID,
                name: 'Alpha Wedding',
                groom_name: 'Alpha',
                bride_name: 'One',
                slug: 'alpha-one',
                wedding_date: '2026-06-15',
                status: 'active',
                rsvp_fields: [],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (agencyId === AGENCY_2_ID) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: '22220000-0000-4000-8000-000000000002',
                agency_id: AGENCY_2_ID,
                name: 'Beta Wedding',
                groom_name: 'Beta',
                bride_name: 'Two',
                slug: 'beta-two',
                wedding_date: '2026-07-20',
                status: 'active',
                rsvp_fields: [],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          error: 'You do not have permission to access projects for this agency.',
          code: 'FORBIDDEN_AGENCY_ACCESS',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  };

  let vite: ViteDevServer | null = null;
  try {
    vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });
    const { runAgencyFrontendDomScenarios } = await vite.ssrLoadModule(
      '/tests/helpers/agencyContextDomHarness.tsx'
    );
    await runAgencyFrontendDomScenarios();

    assert.equal(
      requestedProjectAgencyIds.includes(REPORTED_AGENCY_ID),
      false,
      'Frontend MUST NOT request /api/projects for unverified subdomain or stale localStorage agency ID'
    );
    assert.deepEqual(
      requestedProjectAgencyIds,
      [AGENCY_1_ID, AGENCY_2_ID],
      'Frontend only requests /api/projects for verified authorized agencies in sequence'
    );

    console.log('✓ Frontend WorkspaceContext & multi-agency switching DOM tests passed');
  } finally {
    if (vite) await vite.close();
    dom.window.close();
  }
}

async function runMigrationContractChecks() {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261123_agency_members_and_auth_hardening.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.agency_members'), 'Migration creates agency_members table');
  assert.ok(sql.includes('REFERENCES public.users_auth(id) ON DELETE CASCADE'), 'agency_members FK references users_auth(id)');
  assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'), 'Migration enables RLS on agency_members');
  assert.ok(sql.includes('REVOKE INSERT, UPDATE, DELETE ON TABLE public.agency_members'), 'Migration restricts client writes on agency_members');
  assert.ok(sql.includes('CREATE POLICY "Authenticated users select own agencies"'), 'Migration updates agencies SELECT RLS policy');
  assert.ok(sql.includes('CREATE POLICY "Authenticated users manage own agency projects"'), 'Migration updates projects ALL RLS policy');
  console.log('✓ SQL migration schema & RLS contract checks passed');
}

async function main() {
  await runMigrationContractChecks();
  await runBackendAndParityTests();
  await runFrontendWorkspaceContextTests();
  console.log('\n🎉 All Agency Project Access Authorization tests passed!');
}

main().catch((err) => {
  console.error('\n💥 Agency project authorization tests failed:', err);
  process.exit(1);
});
