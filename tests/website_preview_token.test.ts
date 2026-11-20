import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import {
  createProjectPreviewToken,
  revokeProjectPreviewTokens,
  getEventWebsiteData,
  hashPreviewToken,
} from '../server/websitePreviewService';
import { verifySessionWithDb } from '../server/createDeveloperRouter';
import workerApp from '../worker/index';
import { useWebsiteStore } from '../src/website-builder/store/websiteStore';

const JWT_SECRET = 'wedding-v1-sync-key-2024-secret-auth-v2';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const OUTSIDER_ID = '33333333-3333-4333-8333-333333333333';

const AGENCY_1_ID = 'aaaa1111-1111-4111-8111-111111111111';
const AGENCY_2_ID = 'bbbb2222-2222-4222-8222-222222222222';

const PROJECT_1_ID = 'e3d36dfc-9489-4462-a62e-adf907a8bb78';
const PROJECT_2_ID = 'f4e47efd-859a-4573-b73f-bef018b9cc89';

function createDbState() {
  return {
    users_auth: [
      {
        id: OWNER_ID,
        supabase_user_id: 'supa-owner-1',
        email: 'owner@atelier.com',
        full_name: 'Owner Planner',
        role: 'agency_owner',
        is_developer: false,
        organization_id: AGENCY_1_ID,
        status: 'active',
        deleted_at: null,
      },
      {
        id: MEMBER_ID,
        supabase_user_id: 'supa-member-1',
        email: 'member@atelier.com',
        full_name: 'Member Coordinator',
        role: 'agency_member',
        is_developer: false,
        organization_id: AGENCY_1_ID,
        status: 'active',
        deleted_at: null,
      },
      {
        id: OUTSIDER_ID,
        supabase_user_id: 'supa-outsider-1',
        email: 'outsider@other.com',
        full_name: 'Other Studio User',
        role: 'agency_owner',
        is_developer: false,
        organization_id: AGENCY_2_ID,
        status: 'active',
        deleted_at: null,
      },
    ],
    agencies: [
      {
        id: AGENCY_1_ID,
        user_id: OWNER_ID,
        owner_email: 'owner@atelier.com',
        name: 'Atelier Lumiere',
        slug: 'atelier',
        subscription_status: 'active',
        deleted_at: null,
      },
      {
        id: AGENCY_2_ID,
        user_id: OUTSIDER_ID,
        owner_email: 'outsider@other.com',
        name: 'Other Events',
        slug: 'other-events',
        subscription_status: 'active',
        deleted_at: null,
      },
    ],
    agency_members: [
      {
        id: 'mem-1',
        agency_id: AGENCY_1_ID,
        user_id: OWNER_ID,
        role: 'owner',
        status: 'active',
      },
      {
        id: 'mem-2',
        agency_id: AGENCY_1_ID,
        user_id: MEMBER_ID,
        role: 'member',
        status: 'active',
      },
      {
        id: 'mem-3',
        agency_id: AGENCY_2_ID,
        user_id: OUTSIDER_ID,
        role: 'owner',
        status: 'active',
      },
    ],
    projects: [
      {
        id: PROJECT_1_ID,
        agency_id: AGENCY_1_ID,
        name: 'Julian & Claire Draft',
        groom_name: 'Julian',
        bride_name: 'Claire',
        slug: 'julian-claire-draft',
        wedding_date: '2027-06-12',
        location: 'Lake Como, Italy',
        theme_id: 'minimal_luxury',
        website_status: 'draft',
        website_published_at: null,
        website_published_config: null,
        website_config: {
          design: { themeId: 'minimal_luxury' },
          sections: [
            {
              id: 'sec-hero',
              type: 'hero',
              enabled: true,
              content: { headline: 'Secret Unpublished Draft Headline' },
            },
          ],
          settings: { siteTitle: 'Julian & Claire' },
        },
        website_preview_token: null,
        access_password: null,
        deleted_at: null,
      },
      {
        id: PROJECT_2_ID,
        agency_id: AGENCY_2_ID,
        name: 'Published With Draft Edits',
        groom_name: 'Marco',
        bride_name: 'Elena',
        slug: 'marco-elena',
        wedding_date: '2027-09-18',
        location: 'Florence, Italy',
        theme_id: 'minimal_luxury',
        website_status: 'published',
        website_published_at: '2026-10-01T10:00:00.000Z',
        website_published_config: {
          design: { themeId: 'minimal_luxury' },
          sections: [
            {
              id: 'sec-hero',
              type: 'hero',
              enabled: true,
              content: { headline: 'Public Live Headline v1' },
            },
          ],
          settings: { siteTitle: 'Marco & Elena Public' },
        },
        website_config: {
          design: { themeId: 'minimal_luxury' },
          sections: [
            {
              id: 'sec-hero',
              type: 'hero',
              enabled: true,
              content: { headline: 'Unpublished Draft Update v2' },
            },
          ],
          settings: { siteTitle: 'Marco & Elena Draft v2' },
        },
        website_preview_token: null,
        access_password: null,
        deleted_at: null,
      },
    ],
    website_preview_tokens: [] as any[],
  };
}

class InMemoryQueryBuilder implements PromiseLike<any> {
  private filters: Array<(row: any) => boolean> = [];
  private op: 'select' | 'insert' | 'update' = 'select';
  private payload: any = null;
  private singleMode: 'none' | 'single' | 'maybeSingle' = 'none';
  private rowLimit: number | null = null;

  constructor(private db: Record<string, any[]>, private table: string) {}

  select(_cols?: string) {
    return this;
  }

  insert(values: any) {
    this.op = 'insert';
    this.payload = values;
    return this;
  }

  update(values: any) {
    this.op = 'update';
    this.payload = values;
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((row) => String(row?.[col] ?? '') === String(val ?? ''));
    return this;
  }

  ilike(col: string, pattern: string) {
    const clean = String(pattern || '').replace(/%/g, '').toLowerCase();
    this.filters.push((row) => String(row?.[col] ?? '').toLowerCase().includes(clean));
    return this;
  }

  is(col: string, val: any) {
    this.filters.push((row) => (val === null ? row?.[col] == null : row?.[col] === val));
    return this;
  }

  or(expr: string) {
    const clauses = expr.split(',').map((part) => part.trim()).filter(Boolean);
    this.filters.push((row) =>
      clauses.some((clause) => {
        const eqIdx = clause.indexOf('.eq.');
        if (eqIdx > 0) {
          const col = clause.slice(0, eqIdx);
          const val = clause.slice(eqIdx + 4);
          return String(row?.[col] ?? '') === val;
        }
        const ilikeIdx = clause.indexOf('.ilike.');
        if (ilikeIdx > 0) {
          const col = clause.slice(0, ilikeIdx);
          const val = clause.slice(ilikeIdx + 7).toLowerCase();
          return String(row?.[col] ?? '').toLowerCase() === val;
        }
        return false;
      })
    );
    return this;
  }

  order() {
    return this;
  }

  limit(n: number) {
    this.rowLimit = n;
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  private execute() {
    const rows = this.db[this.table];
    if (!rows) {
      return {
        data: null,
        error: { code: '42P01', message: `relation "public.${this.table}" does not exist` },
      };
    }

    if (this.op === 'insert') {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((item, idx) => ({
        id: item.id || `${this.table}-${rows.length + idx + 1}`,
        created_at: item.created_at || new Date().toISOString(),
        ...item,
      }));
      rows.push(...items);
      const data = this.singleMode === 'none' ? items : items[0];
      return { data, error: null };
    }

    const matched = rows.filter((row) => this.filters.every((fn) => fn(row)));

    if (this.op === 'update') {
      for (const row of matched) {
        Object.assign(row, this.payload);
      }
      if (this.singleMode === 'single') {
        return matched[0]
          ? { data: matched[0], error: null }
          : { data: null, error: { code: 'PGRST116', message: 'Not found' } };
      }
      if (this.singleMode === 'maybeSingle') {
        return { data: matched[0] ?? null, error: null };
      }
      return { data: matched, error: null };
    }

    const limited = this.rowLimit != null ? matched.slice(0, this.rowLimit) : matched;
    if (this.singleMode === 'single') {
      return limited[0]
        ? { data: limited[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: 'Not found' } };
    }
    if (this.singleMode === 'maybeSingle') {
      return { data: limited[0] ?? null, error: null };
    }
    return { data: limited, error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

function createMockSupabase(db: Record<string, any[]>) {
  return {
    db,
    from(table: string) {
      return new InMemoryQueryBuilder(db, table);
    },
  };
}

/**
 * Simulates Supabase PostgREST HTTP API so the REAL Cloudflare Worker (`worker/index.ts`)
 * can execute end-to-end via `workerApp.request(...)`.
 */
function installPostgrestFetchShim(db: Record<string, any[]>, supabaseHost: string) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!rawUrl.startsWith(`${supabaseHost}/rest/v1/`)) {
      return originalFetch(input as any, init);
    }

    const parsed = new URL(rawUrl);
    const table = parsed.pathname.replace(/^\/rest\/v1\//, '').split('/')[0];
    const rows = db[table];
    if (!rows) {
      return new Response(
        JSON.stringify({ code: '42P01', message: `relation "public.${table}" does not exist` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const bodyText =
      typeof init?.body === 'string'
        ? init.body
        : input instanceof Request && method !== 'GET' && method !== 'HEAD'
          ? await input.clone().text()
          : '';
    const payload = bodyText ? JSON.parse(bodyText) : null;

    const filterRow = (row: any): boolean => {
      for (const [key, val] of parsed.searchParams.entries()) {
        if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset') continue;
        if (key === 'or') {
          const inner = val.replace(/^\(/, '').replace(/\)$/, '');
          const clauses = inner.split(',').map((c) => c.trim());
          const ok = clauses.some((clause) => {
            if (clause.includes('.eq.')) {
              const [c, v] = clause.split('.eq.');
              return String(row?.[c] ?? '') === v;
            }
            if (clause.includes('.ilike.')) {
              const [c, v] = clause.split('.ilike.');
              return String(row?.[c] ?? '').toLowerCase() === v.toLowerCase();
            }
            return false;
          });
          if (!ok) return false;
          continue;
        }
        if (val.startsWith('eq.')) {
          if (String(row?.[key] ?? '') !== val.slice(3)) return false;
        } else if (val.startsWith('is.')) {
          const expected = val.slice(3);
          if (expected === 'null' && row?.[key] != null) return false;
          if (expected !== 'null' && String(row?.[key]) !== expected) return false;
        } else if (val.startsWith('ilike.')) {
          const clean = val.slice(6).replace(/%/g, '').toLowerCase();
          if (!String(row?.[key] ?? '').toLowerCase().includes(clean)) return false;
        }
      }
      return true;
    };

    const acceptHeader = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined)).get('Accept') || '';
    const isSingle = acceptHeader.includes('application/vnd.pgrst.object+json');

    if (method === 'POST') {
      const items = (Array.isArray(payload) ? payload : [payload]).map((item, idx) => ({
        id: item.id || `${table}-${rows.length + idx + 1}`,
        created_at: item.created_at || new Date().toISOString(),
        ...item,
      }));
      rows.push(...items);
      return new Response(JSON.stringify(isSingle ? items[0] : items), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const matched = rows.filter(filterRow);
    if (method === 'PATCH') {
      for (const r of matched) Object.assign(r, payload);
      if (isSingle) {
        if (!matched[0]) {
          return new Response(JSON.stringify({ code: 'PGRST116', message: 'Not found' }), {
            status: 406,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(matched[0]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(matched), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const limitParam = parsed.searchParams.get('limit');
    const result = limitParam ? matched.slice(0, Number(limitParam)) : matched;
    if (isSingle) {
      if (!result[0]) {
        return new Response(JSON.stringify({ code: 'PGRST116', message: 'Not found' }), {
          status: 406,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(result[0]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as any;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function createExpressAppForTest(supabase: any) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.post('/api/projects/:id/website/preview-token', async (req, res) => {
    const authCheck = await verifySessionWithDb(req, {
      getSupabase: () => supabase,
      getJwtSecret: () => JWT_SECRET,
      getSuperAdminEmails: () => '',
    });
    if (authCheck.ok === false) {
      return res.status(authCheck.statusCode).json({ error: authCheck.error, code: authCheck.code });
    }
    const result = await createProjectPreviewToken(supabase, {
      projectId: req.params.id,
      authUser: authCheck.user,
      ttlMinutes: req.body?.ttlMinutes,
    });
    if (result.ok === false) {
      return res.status(result.statusCode).json({ error: result.error, code: result.code });
    }
    return res.status(200).json(result.data);
  });

  app.post('/api/projects/:id/website/preview-token/revoke', async (req, res) => {
    const authCheck = await verifySessionWithDb(req, {
      getSupabase: () => supabase,
      getJwtSecret: () => JWT_SECRET,
      getSuperAdminEmails: () => '',
    });
    if (authCheck.ok === false) {
      return res.status(authCheck.statusCode).json({ error: authCheck.error, code: authCheck.code });
    }
    const result = await revokeProjectPreviewTokens(supabase, {
      projectId: req.params.id,
      authUser: authCheck.user,
      token: req.body?.token || null,
    });
    if (result.ok === false) {
      return res.status(result.statusCode).json({ error: result.error, code: result.code });
    }
    return res.status(200).json(result.data);
  });

  app.get('/api/events/:slug/website-data', async (req, res) => {
    const previewToken = typeof req.query.token === 'string' ? req.query.token : null;
    const authHeader = req.headers.authorization;
    let authUser: any = null;
    if (authHeader?.startsWith('Bearer ')) {
      const check = await verifySessionWithDb(req, {
        getSupabase: () => supabase,
        getJwtSecret: () => JWT_SECRET,
        getSuperAdminEmails: () => '',
      });
      if (check.ok) authUser = check.user;
    }

    const result = await getEventWebsiteData(supabase, {
      slug: req.params.slug,
      previewToken,
      authUser,
    });
    return res.status(result.statusCode).json(result.body);
  });

  return app;
}

async function runAllTests() {
  console.log('🧪 Running Website Preview Token & Validation Test Suite...');

  const db = createDbState();
  const supabase = createMockSupabase(db);
  const expApp = createExpressAppForTest(supabase);
  const server = http.createServer(expApp);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;
  const expressBaseUrl = `http://127.0.0.1:${addr.port}`;

  const supabaseHost = 'https://mock-supabase.eventframe.local';
  const restoreFetch = installPostgrestFetchShim(db, supabaseHost);
  const workerEnv = {
    JWT_SECRET,
    APP_URL: 'https://eventframe.io',
    SUPABASE_URL: supabaseHost,
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
  } as any;

  const signToken = (payload: Record<string, any>) =>
    jwt.sign({ ...payload, auth_ts: Date.now() }, JWT_SECRET, { expiresIn: '1h' });

  const ownerJwt = signToken({ id: OWNER_ID, email: 'owner@atelier.com', role: 'agency_owner' });
  // Simulate Google OAuth member whose JWT carries external supabase_user_id rather than internal users_auth.id
  const memberJwt = signToken({ id: 'supa-member-1', sub: 'supa-member-1', email: 'member@atelier.com', role: 'agency_member' });
  const outsiderJwt = signToken({ id: OUTSIDER_ID, email: 'outsider@other.com', role: 'agency_owner' });

  try {
    // -------------------------------------------------------------------------
    // 1. Authorized project owner generates token -> 200 (Express & Real Worker)
    // -------------------------------------------------------------------------
    const resOwnerWorker = await workerApp.request(
      `https://eventframe.io/api/projects/${PROJECT_1_ID}/website/preview-token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
      workerEnv
    );
    assert.equal(resOwnerWorker.status, 200, 'Worker: Authorized project owner generates preview token -> 200');
    const ownerBody = (await resOwnerWorker.json()) as any;
    assert.equal(ownerBody.success, true);
    assert.ok(typeof ownerBody.token === 'string' && ownerBody.token.length >= 32, 'Token must be cryptographically long');
    assert.ok(ownerBody.expires_at && Number.isFinite(new Date(ownerBody.expires_at).getTime()), 'Must return valid expires_at');
    assert.equal(
      ownerBody.previewUrl,
      `/julian-claire-draft/website?preview=true&token=${encodeURIComponent(ownerBody.token)}`
    );

    // Verify plaintext token is NEVER stored in DB; only SHA-256 hash is stored
    assert.equal(db.website_preview_tokens.length, 1);
    const storedRow = db.website_preview_tokens[0];
    assert.notEqual(storedRow.token_hash, ownerBody.token, 'Plaintext preview token MUST NOT be stored in database');
    assert.equal(storedRow.token_hash, await hashPreviewToken(ownerBody.token), 'DB must store SHA-256 hash of token');
    assert.equal(storedRow.project_id, PROJECT_1_ID);

    const resOwnerExp = await fetch(`${expressBaseUrl}/api/projects/${PROJECT_1_ID}/website/preview-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerJwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(resOwnerExp.status, 200, 'Express: Authorized project owner generates preview token -> 200');
    console.log('✓ Test 1 passed: Authorized project owner generates token (200, hashed storage)');

    // -------------------------------------------------------------------------
    // 2. Authorized agency member generates token -> 200 (Express & Real Worker)
    // -------------------------------------------------------------------------
    const resMemberWorker = await workerApp.request(
      `https://atelier.eventframe.io/api/projects/${PROJECT_1_ID}/website/preview-token`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${memberJwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      workerEnv
    );
    assert.equal(resMemberWorker.status, 200, 'Worker: Active agency member generates token -> 200');
    const memberBody = (await resMemberWorker.json()) as any;
    assert.ok(memberBody.token && memberBody.expires_at);

    const resMemberExp = await fetch(`${expressBaseUrl}/api/projects/${PROJECT_1_ID}/website/preview-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberJwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(resMemberExp.status, 200, 'Express: Active agency member generates token -> 200');
    console.log('✓ Test 2 passed: Authorized agency member generates token (200)');

    // -------------------------------------------------------------------------
    // 3. Unauthorized user generates token -> 403 (& Unauthenticated -> 401)
    // -------------------------------------------------------------------------
    const resUnauthWorker = await workerApp.request(
      `https://eventframe.io/api/projects/${PROJECT_1_ID}/website/preview-token`,
      { method: 'POST' },
      workerEnv
    );
    assert.equal(resUnauthWorker.status, 401, 'Worker: Unauthenticated user -> 401');

    const resOutsiderWorker = await workerApp.request(
      `https://eventframe.io/api/projects/${PROJECT_1_ID}/website/preview-token`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${outsiderJwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      workerEnv
    );
    assert.equal(resOutsiderWorker.status, 403, 'Worker: Unauthorized user generating token -> 403');

    const resOutsiderExp = await fetch(`${expressBaseUrl}/api/projects/${PROJECT_1_ID}/website/preview-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${outsiderJwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(resOutsiderExp.status, 403, 'Express: Unauthorized user generating token -> 403');
    console.log('✓ Test 3 passed: Unauthorized user rejected (403) & unauthenticated rejected (401)');

    // -------------------------------------------------------------------------
    // 4. Invalid project ID -> 404
    // -------------------------------------------------------------------------
    const resMissingUuidWorker = await workerApp.request(
      `https://eventframe.io/api/projects/99999999-9999-4999-8999-999999999999/website/preview-token`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerJwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      workerEnv
    );
    assert.equal(resMissingUuidWorker.status, 404, 'Worker: Non-existent project UUID -> 404');

    const resMalformedWorker = await workerApp.request(
      `https://eventframe.io/api/projects/not-a-valid-project/website/preview-token`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerJwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      workerEnv
    );
    assert.equal(resMalformedWorker.status, 404, 'Worker: Invalid/undefined-like project ID -> 404');

    const resMissingExp = await fetch(
      `${expressBaseUrl}/api/projects/99999999-9999-4999-8999-999999999999/website/preview-token`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerJwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    assert.equal(resMissingExp.status, 404, 'Express: Non-existent project UUID -> 404');
    console.log('✓ Test 4 passed: Invalid/missing project IDs return 404');

    // -------------------------------------------------------------------------
    // 5. Valid token accesses unpublished preview -> 200 (draft config visible)
    // -------------------------------------------------------------------------
    const resValidPreviewWorker = await workerApp.request(
      `https://eventframe.io/api/events/julian-claire-draft/website-data?token=${encodeURIComponent(ownerBody.token)}`,
      { method: 'GET' },
      workerEnv
    );
    assert.equal(resValidPreviewWorker.status, 200, 'Worker: Valid token accesses unpublished preview -> 200');
    assert.ok(
      (resValidPreviewWorker.headers.get('Cache-Control') || '').includes('no-store'),
      'Preview data response must include Cache-Control: no-store'
    );
    const validPreviewData = (await resValidPreviewWorker.json()) as any;
    assert.equal(validPreviewData.isPreview, true);
    assert.equal(
      validPreviewData.config?.sections?.[0]?.content?.headline,
      'Secret Unpublished Draft Headline',
      'Unpublished draft config must be visible with valid preview token'
    );
    assert.equal(validPreviewData.project?.website_preview_token, undefined, 'Never expose preview token in project payload');

    // Even when a project IS already published (Project 2), a valid preview token MUST show unpublished draft changes (v2), not v1
    const resP2Tok = await workerApp.request(
      `https://eventframe.io/api/projects/${PROJECT_2_ID}/website/preview-token`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${outsiderJwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      workerEnv
    );
    assert.equal(resP2Tok.status, 200);
    const p2Body = (await resP2Tok.json()) as any;
    const resP2Preview = await workerApp.request(
      `https://eventframe.io/api/events/marco-elena/website-data?token=${encodeURIComponent(p2Body.token)}`,
      { method: 'GET' },
      workerEnv
    );
    assert.equal(resP2Preview.status, 200);
    const p2PreviewData = (await resP2Preview.json()) as any;
    assert.equal(p2PreviewData.isPreview, true);
    assert.equal(
      p2PreviewData.config?.sections?.[0]?.content?.headline,
      'Unpublished Draft Update v2',
      'Preview token on a published project must show unpublished draft updates'
    );
    console.log('✓ Test 5 passed: Valid token accesses unpublished preview & shows unpublished draft changes (200)');

    // -------------------------------------------------------------------------
    // 6. Missing token accesses unpublished preview -> 403 (no config leak)
    // -------------------------------------------------------------------------
    const resMissingTokenWorker = await workerApp.request(
      `https://eventframe.io/api/events/julian-claire-draft/website-data`,
      { method: 'GET' },
      workerEnv
    );
    assert.equal(resMissingTokenWorker.status, 403, 'Worker: Missing token on unpublished preview -> 403');
    const missingTokenData = (await resMissingTokenWorker.json()) as any;
    assert.equal(missingTokenData.isPreview, false);
    assert.equal(missingTokenData.config, undefined, 'Unpublished config MUST NOT be returned without valid token');

    const resMissingTokenExp = await fetch(`${expressBaseUrl}/api/events/julian-claire-draft/website-data`);
    assert.equal(resMissingTokenExp.status, 403, 'Express: Missing token on unpublished preview -> 403');
    console.log('✓ Test 6 passed: Missing token cannot access unpublished preview (403)');

    // -------------------------------------------------------------------------
    // 7. Token used for another project -> 403
    // -------------------------------------------------------------------------
    const resWrongProjectWorker = await workerApp.request(
      `https://eventframe.io/api/events/julian-claire-draft/website-data?token=${encodeURIComponent(p2Body.token)}`,
      { method: 'GET' },
      workerEnv
    );
    assert.equal(resWrongProjectWorker.status, 403, 'Worker: Token belonging to Project 2 rejected for Project 1 -> 403');
    const wrongProjData = (await resWrongProjectWorker.json()) as any;
    assert.equal(wrongProjData.code, 'PREVIEW_TOKEN_PROJECT_MISMATCH');
    assert.equal(wrongProjData.config, undefined);

    const resWrongProjectExp = await fetch(
      `${expressBaseUrl}/api/events/julian-claire-draft/website-data?token=${encodeURIComponent(p2Body.token)}`
    );
    assert.equal(resWrongProjectExp.status, 403, 'Express: Cross-project preview token -> 403');
    console.log('✓ Test 7 passed: Cross-project preview token rejected (403)');

    // -------------------------------------------------------------------------
    // 8. Expired preview token -> 401
    // -------------------------------------------------------------------------
    const memberTokenHash = await hashPreviewToken(memberBody.token);
    const memberRow = db.website_preview_tokens.find((r) => r.token_hash === memberTokenHash)!;
    memberRow.expires_at = new Date(Date.now() - 60_000).toISOString();

    const resExpiredWorker = await workerApp.request(
      `https://eventframe.io/api/events/julian-claire-draft/website-data?token=${encodeURIComponent(memberBody.token)}`,
      { method: 'GET' },
      workerEnv
    );
    assert.equal(resExpiredWorker.status, 401, 'Worker: Expired preview token -> 401');
    const expiredData = (await resExpiredWorker.json()) as any;
    assert.equal(expiredData.code, 'PREVIEW_TOKEN_EXPIRED');
    assert.equal(expiredData.config, undefined, 'Expired token MUST NOT expose draft config');

    const resExpiredExp = await fetch(
      `${expressBaseUrl}/api/events/julian-claire-draft/website-data?token=${encodeURIComponent(memberBody.token)}`
    );
    assert.equal(resExpiredExp.status, 401, 'Express: Expired preview token -> 401');
    console.log('✓ Test 8 passed: Expired preview token rejected (401)');

    // -------------------------------------------------------------------------
    // 9. Revoked preview token -> 403
    // -------------------------------------------------------------------------
    const resRevokeWorker = await workerApp.request(
      `https://eventframe.io/api/projects/${PROJECT_1_ID}/website/preview-token/revoke`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerJwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ownerBody.token }),
      },
      workerEnv
    );
    assert.equal(resRevokeWorker.status, 200, 'Owner can revoke preview token');

    const resAfterRevokeWorker = await workerApp.request(
      `https://eventframe.io/api/events/julian-claire-draft/website-data?token=${encodeURIComponent(ownerBody.token)}`,
      { method: 'GET' },
      workerEnv
    );
    assert.equal(resAfterRevokeWorker.status, 403, 'Worker: Revoked preview token -> 403');
    const revokedData = (await resAfterRevokeWorker.json()) as any;
    assert.equal(revokedData.code, 'PREVIEW_TOKEN_REVOKED');
    assert.equal(revokedData.config, undefined);

    const resAfterRevokeExp = await fetch(
      `${expressBaseUrl}/api/events/julian-claire-draft/website-data?token=${encodeURIComponent(ownerBody.token)}`
    );
    assert.equal(resAfterRevokeExp.status, 403, 'Express: Revoked preview token -> 403');
    console.log('✓ Test 9 passed: Revoked preview token rejected (403)');

    // -------------------------------------------------------------------------
    // 10. Unmigrated DB fallback (if website_preview_tokens table missing yet)
    // -------------------------------------------------------------------------
    const dbNoTable: Record<string, any[]> = {
      users_auth: db.users_auth,
      agencies: db.agencies,
      agency_members: db.agency_members,
      projects: [JSON.parse(JSON.stringify(db.projects[0]))],
    };
    const supabaseNoTable = createMockSupabase(dbNoTable);
    const fallbackIssued = await createProjectPreviewToken(supabaseNoTable, {
      projectId: PROJECT_1_ID,
      authUser: { id: OWNER_ID, email: 'owner@atelier.com', role: 'agency_owner' },
    });
    assert.equal(fallbackIssued.ok, true);
    if (fallbackIssued.ok) {
      const storedFallbackCol = dbNoTable.projects[0].website_preview_token;
      assert.ok(String(storedFallbackCol).startsWith('v2.'), 'Fallback column must store v2.<exp>.<hash> envelope');
      assert.ok(!String(storedFallbackCol).includes(fallbackIssued.data.token), 'Fallback column must NOT store plaintext token');
      const fallbackAccess = await getEventWebsiteData(supabaseNoTable, {
        slug: 'julian-claire-draft',
        previewToken: fallbackIssued.data.token,
      });
      assert.equal(fallbackAccess.statusCode, 200);
      assert.equal(fallbackAccess.body.isPreview, true);
    }
    console.log('✓ Test 10 passed: Unmigrated table fallback remains hashed, expiring, and non-plaintext');

    // -------------------------------------------------------------------------
    // 11. Frontend store integration with Worker preview-token endpoint
    // -------------------------------------------------------------------------
    const storeFetchBefore = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/projects/')) {
        const headers = new Headers(init?.headers || {});
        headers.set('Authorization', `Bearer ${ownerJwt}`);
        return workerApp.request(
          url.startsWith('http') ? url : `https://eventframe.io${url}`,
          { method: init?.method || 'POST', headers, body: init?.body },
          workerEnv
        );
      }
      return storeFetchBefore(input as any, init);
    }) as any;

    try {
      useWebsiteStore.getState().init({
        id: PROJECT_1_ID,
        agency_id: AGENCY_1_ID,
        name: 'Julian & Claire Draft',
        slug: 'julian-claire-draft',
        groom_name: 'Julian',
        bride_name: 'Claire',
        wedding_date: '2027-06-12',
        location: 'Lake Como, Italy',
        theme_id: 'minimal_luxury',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const genRes = await useWebsiteStore.getState().generatePreviewToken({ forceRegenerate: true });
      assert.equal(genRes.success, true, 'Frontend store generatePreviewToken must succeed against Worker');
      assert.ok(genRes.token && genRes.expiresAt && genRes.previewUrl);
      assert.equal(useWebsiteStore.getState().previewToken, genRes.token);
      assert.equal(useWebsiteStore.getState().previewError, null);

      // Force expiration in store and verify regeneration issues a distinct new token
      useWebsiteStore.setState({
        previewTokenExpiresAt: new Date(Date.now() - 10_000).toISOString(),
      });
      const regenRes = await useWebsiteStore.getState().generatePreviewToken();
      assert.equal(regenRes.success, true);
      assert.notEqual(regenRes.token, genRes.token, 'Expired token must trigger regeneration of a fresh token');
      console.log('✓ Test 11 passed: Frontend websiteStore generates & regenerates expired preview tokens cleanly');
    } finally {
      globalThis.fetch = storeFetchBefore;
    }

    console.log('\n🎉 All Website Preview Token & Validation tests passed!');
  } finally {
    restoreFetch();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runAllTests().catch((err) => {
  console.error('❌ Website preview token test failed:', err);
  process.exit(1);
});
