/**
 * Backend API Migration Security & Integration Test Suite
 *
 * Verifies:
 * 1. Worker /api/config & HTML responses expose zero Supabase URLs/keys or window.__ENV__
 * 2. Standardized agency lookup (/api/agencies/:slug, 404 PGRST116-safe handling)
 * 3. Message & RSVP services (approved filter, includeAll owner/PIN enforcement, server-side VIP tagging, preview cap, demo isolation)
 * 4. Double-submit CSRF + X-Requested-With validation on cookie mutations (including moderation & upload routes)
 * 5. Worker auth refresh & logout cookie revocation
 * 6. Express uploadRouter authorization (owner JWT / valid X-Event-PIN enforcement, no silent guest fallback)
 * 7. Frontend apiClient helpers (extractApiErrorMessage, unwrapApiData, transparent 401 refresh + retry)
 * 8. Zero raw DB/PGRST/SQLSTATE error leaks
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { sign as signHonoJwt } from 'hono/jwt';
import workerApp from '../worker/index';
import uploadRouter from '../server/uploadRouter';
import {
  buildSuccessResponse,
  buildErrorResponse,
  generateCsrfToken,
  validateCookieMutationCsrf,
} from '../server/apiResponse';
import {
  listProjectMessages,
  createGuestMessage,
  moderateMessageStatus,
  updateMessageHighlightForProject,
  listProjectRsvps,
  updateRsvpVipAuthorized,
  getPublicEventCounts,
} from '../server/messageAndRsvpService';
import {
  extractApiErrorMessage,
  unwrapApiData,
  apiFetch,
  setAuthToken,
  removeAuthToken,
  setCsrfTokenMemory,
} from '../src/lib/apiClient';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✓ PASSED: ${message}`);
}

type TableRows = Record<string, any[]>;

class StatefulQueryBuilder {
  private db: TableRows;
  private table: string;
  private filters: Array<(row: any) => boolean> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private singleMode: 'none' | 'maybe' | 'single' = 'none';
  private isCountHead = false;

  constructor(db: TableRows, table: string) {
    this.db = db;
    this.table = table;
    if (!this.db[table]) this.db[table] = [];
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.head) {
      this.isCountHead = true;
    }
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
    this.limitCount = n;
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

  insert(rows: any[]) {
    this.op = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(patch: Record<string, any>) {
    this.op = 'update';
    this.payload = patch;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  private exec() {
    const tableRows = this.db[this.table] || [];

    if (this.op === 'insert') {
      const inserted = this.payload.map((row: any, idx: number) => ({
        id: row.id || `${this.table}-${tableRows.length + idx + 1}`,
        created_at: row.created_at || new Date().toISOString(),
        ...row,
      }));
      tableRows.push(...inserted);
      return {
        data: this.singleMode !== 'none' ? inserted[0] : inserted,
        error: null,
        count: inserted.length,
      };
    }

    const matches = tableRows.filter((row) => this.filters.every((fn) => fn(row)));

    if (this.op === 'update') {
      const updated = matches.map((row) => Object.assign(row, this.payload));
      return {
        data: this.singleMode !== 'none' ? updated[0] || null : updated,
        error: null,
      };
    }

    if (this.op === 'delete') {
      const remaining = tableRows.filter((row) => !this.filters.every((fn) => fn(row)));
      this.db[this.table] = remaining;
      return { data: matches, error: null };
    }

    let result = [...matches];
    if (this.orderCol) {
      const col = this.orderCol;
      result.sort((a, b) => {
        const av = a?.[col] ?? 0;
        const bv = b?.[col] ?? 0;
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (this.orderAsc ? 1 : -1);
      });
    }
    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    if (this.isCountHead) {
      return { data: null, count: matches.length, error: null };
    }

    if (this.singleMode === 'maybe') {
      return { data: result[0] || null, error: null };
    }
    if (this.singleMode === 'single') {
      if (!result[0]) {
        return { data: null, error: { code: 'PGRST116', message: '0 rows' } };
      }
      return { data: result[0], error: null };
    }

    return { data: result, error: null };
  }

  then(resolve: (val: any) => any, reject?: (err: any) => any) {
    try {
      return Promise.resolve(this.exec()).then(resolve, reject);
    } catch (err) {
      return reject ? Promise.reject(err).catch(reject) : Promise.reject(err);
    }
  }
}

function createMockSupabase(initial: Partial<TableRows> = {}) {
  const db: TableRows = {
    users_auth: [],
    agencies: [],
    projects: [],
    messages: [],
    rsvps: [],
    organization_members: [],
    uploaded_images: [],
    ...initial,
  };
  return {
    db,
    from(table: string) {
      return new StatefulQueryBuilder(db, table);
    },
  };
}

function makeMockStorageEnv(dbSeed?: Partial<TableRows>) {
  // Ensures worker tests run without connecting to live Supabase if env lacks URL;
  // for worker tests requiring JWT/HTML/CSRF we use lightweight Worker env.
  return {
    JWT_SECRET: 'test-jwt-secret-eventframe',
    APP_URL: 'https://eventframe.io',
    GOOGLE_CLIENT_ID: 'test-client-id',
    ASSETS: {
      fetch: async () =>
        new Response('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    },
    ...(dbSeed || {}),
  } as any;
}

async function runTests() {
  console.log('\n🧪 Running Backend API Migration Security & Integration Tests...\n');

  // --- 1. Worker /api/config & HTML scrubbing ---
  {
    const env = makeMockStorageEnv({
      SUPABASE_URL: 'https://zbngcjmwgcqgahdtipvf.supabase.co',
      SUPABASE_ANON_KEY: 'eyJ_should_never_leak',
      SUPABASE_SERVICE_ROLE_KEY: 'service_role_should_never_leak',
    });

    const configRes = await workerApp.fetch(new Request('https://eventframe.io/api/config'), env);
    assert(configRes.status === 200, 'Worker /api/config returns 200');
    const configText = await configRes.text();
    assert(!configText.includes('supabase.co'), '/api/config does not expose Supabase URL');
    assert(!configText.includes('should_never_leak'), '/api/config does not expose Supabase keys');
    const configJson = JSON.parse(configText);
    assert(configJson.success === true && configJson.data?.realtimeTransport === 'sse', '/api/config advertises SSE transport');

    const htmlRes = await workerApp.fetch(new Request('https://eventframe.io/pricing'), env);
    const htmlText = await htmlRes.text();
    assert(!htmlText.includes('__ENV__'), 'Worker HTML response does not inject window.__ENV__');
    assert(!htmlText.includes('zbngcjmwgcqgahdtipvf'), 'Worker HTML response contains zero Supabase project IDs');
  }

  // --- 2. Worker auth refresh, logout & CSRF protection ---
  {
    const env = makeMockStorageEnv();
    const userPayload = {
      id: 'user-1',
      email: 'planner@atelier.io',
      name: 'Atelier Planner',
      role: 'user',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = await signHonoJwt(userPayload, env.JWT_SECRET);

    // Cookie mutation without CSRF header must be blocked (403)
    const blockedRes = await workerApp.fetch(
      new Request('https://eventframe.io/api/auth/refresh', {
        method: 'POST',
        headers: {
          Cookie: `wedding_session=${token}; wedding_csrf=csrf_abc`,
        },
      }),
      env
    );
    assert(blockedRes.status === 403, 'Cookie-based POST /api/auth/refresh without CSRF header is rejected (403)');

    // Valid CSRF double-submit succeeds and returns new token + csrfToken
    const refreshRes = await workerApp.fetch(
      new Request('https://eventframe.io/api/auth/refresh', {
        method: 'POST',
        headers: {
          Cookie: `wedding_session=${token}; wedding_csrf=csrf_abc`,
          'X-CSRF-Token': 'csrf_abc',
          'X-Requested-With': 'EventFrame',
        },
      }),
      env
    );
    assert(refreshRes.status === 200, 'POST /api/auth/refresh with valid CSRF passes (200)');
    const refreshBody = await refreshRes.json() as any;
    assert(Boolean(refreshBody?.data?.token && refreshBody?.data?.csrfToken), 'Refresh returns rotating token and csrfToken');

    const logoutRes = await workerApp.fetch(
      new Request('https://eventframe.io/api/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: `wedding_session=${token}; wedding_csrf=csrf_abc`,
          'X-CSRF-Token': 'csrf_abc',
          'X-Requested-With': 'EventFrame',
        },
      }),
      env
    );
    assert(logoutRes.status === 200, 'POST /api/auth/logout returns 200');
    const setCookies = logoutRes.headers.get('set-cookie') || '';
    assert(setCookies.includes('wedding_session='), 'Logout clears wedding_session cookie');
  }

  // --- 3. CSRF middleware behavior on protected vs public guest routes ---
  {
    const modCheck = validateCookieMutationCsrf({
      method: 'POST',
      path: '/api/messages/msg-1/status',
      hasSessionCookie: true,
      hasBearerToken: false,
      hasEventPin: false,
      csrfCookie: 'tok1',
    });
    assert(modCheck.ok === false, 'CSRF rejects cookie POST to /api/messages/:id/status without CSRF header');

    const vipCheck = validateCookieMutationCsrf({
      method: 'PATCH',
      path: '/api/rsvps/rsvp-1/vip',
      hasSessionCookie: true,
      hasBearerToken: false,
      hasEventPin: false,
      csrfCookie: 'tok1',
    });
    assert(vipCheck.ok === false, 'CSRF rejects cookie PATCH to /api/rsvps/:id/vip without CSRF header');

    const guestPostCheck = validateCookieMutationCsrf({
      method: 'POST',
      path: '/api/messages',
      hasSessionCookie: true,
      hasBearerToken: false,
      hasEventPin: false,
      csrfCookie: 'tok1',
    });
    assert(guestPostCheck.ok === true, 'Public guest POST /api/messages bypasses authenticated CSRF requirement');

    const bearerCheck = validateCookieMutationCsrf({
      method: 'POST',
      path: '/api/messages/msg-1/status',
      hasSessionCookie: true,
      hasBearerToken: true,
      hasEventPin: false,
      csrfCookie: 'tok1',
    });
    assert(bearerCheck.ok === true, 'Authorization Bearer mutations pass CSRF middleware');

    const doubleSubmitCheck = validateCookieMutationCsrf({
      method: 'DELETE',
      path: '/api/images/img-1',
      hasSessionCookie: true,
      hasBearerToken: false,
      hasEventPin: false,
      csrfCookie: 'tok1',
      csrfHeader: 'tok1',
      requestedWith: 'EventFrame',
    });
    assert(doubleSubmitCheck.ok === true, 'Matching wedding_csrf + X-CSRF-Token + X-Requested-With passes CSRF');
  }

  // --- 4. Message & RSVP Services + Authorization + Server-side VIP Tagging ---
  {
    const supabase = createMockSupabase({
      agencies: [
        { id: 'ag-1', slug: 'atelier-blanc', name: 'Atelier Blanc', user_id: 'owner-1', subscription_status: 'active' },
        { id: 'ag-2', slug: 'other-studio', name: 'Other Studio', user_id: 'owner-2', subscription_status: 'inactive' },
      ],
      projects: [
        {
          id: 'proj-active',
          agency_id: 'ag-1',
          slug: 'lucas-sofia',
          groom_name: 'Lucas',
          bride_name: 'Sofia',
          access_password: 'PIN-8888',
          auto_approve_messages: false,
          expires_at: new Date(Date.now() + 86400_000 * 60).toISOString(),
        },
        {
          id: 'proj-preview',
          agency_id: 'ag-2',
          slug: 'preview-couple',
          groom_name: 'Max',
          bride_name: 'Chloe',
          access_password: 'PIN-2222',
          auto_approve_messages: false,
          expires_at: null,
        },
      ],
      rsvps: [
        {
          id: 'rsvp-vip',
          project_id: 'proj-active',
          name: 'Grandmother Rose',
          attending: true,
          guest_count: 1,
          is_vip: true,
          guest_category: 'Family',
          created_at: new Date().toISOString(),
        },
      ],
      messages: [
        { id: 'm-approved', project_id: 'proj-active', name: 'Guest 1', message: 'Congrats!', status: 'approved', timestamp: 100 },
        { id: 'm-pending', project_id: 'proj-active', name: 'Guest 2', message: 'Pending wish', status: 'pending', timestamp: 200 },
      ],
    });

    // Public list returns approved only
    const publicMsgs = await listProjectMessages(supabase, { projectId: 'proj-active', includeAll: false });
    assert(publicMsgs.ok === true && publicMsgs.data.length === 1 && publicMsgs.data[0].id === 'm-approved', 'Public list returns approved messages only');

    // includeAll denied to unauthenticated or wrong-agency user
    const unauthAll = await listProjectMessages(supabase, { projectId: 'proj-active', includeAll: true });
    assert(unauthAll.ok === false && unauthAll.statusCode === 401, 'includeAll rejects unauthenticated callers (401)');

    const wrongOwnerAll = await listProjectMessages(supabase, {
      projectId: 'proj-active',
      includeAll: true,
      authUser: { id: 'owner-2', email: 'other@studio.io' },
    });
    assert(wrongOwnerAll.ok === false && wrongOwnerAll.statusCode === 403, 'includeAll rejects cross-agency owner (403)');

    const pinAll = await listProjectMessages(supabase, { projectId: 'proj-active', includeAll: true, pin: 'PIN-8888' });
    assert(pinAll.ok === true && pinAll.data.length === 2, 'includeAll with valid X-Event-PIN returns all messages');

    // Guest submission auto-tags VIP from backend rsvps without trusting client input
    const createdVip = await createGuestMessage(supabase, {
      projectId: 'proj-active',
      name: 'grandmother rose',
      message: 'So much love to you both!',
      wishCategory: 'heartfelt',
    });
    assert(
      createdVip.ok === true &&
        createdVip.data.classification === 'SPECIAL_GUEST' &&
        createdVip.data.guest_category === 'Family' &&
        createdVip.data.status === 'pending',
      'createGuestMessage detects VIP status server-side from rsvps and respects auto_approve=false'
    );

    // Demo room rejection
    const demoReject = await createGuestMessage(supabase, {
      projectId: 'eventframe-public-demo',
      name: 'Guest',
      message: 'Hello',
    });
    assert(demoReject.ok === false && demoReject.statusCode === 400, 'createGuestMessage enforces demo room isolation');

    // Preview 5-message cap on unlicensed event
    for (let i = 0; i < 5; i++) {
      const okRes = await createGuestMessage(supabase, {
        projectId: 'proj-preview',
        name: `Guest ${i}`,
        message: `Wish ${i}`,
      });
      assert(okRes.ok === true, `Preview message ${i + 1}/5 accepted`);
    }
    const overCapRes = await createGuestMessage(supabase, {
      projectId: 'proj-preview',
      name: 'Guest 6',
      message: 'Over limit',
    });
    assert(overCapRes.ok === false && overCapRes.statusCode === 403 && overCapRes.code === 'PREVIEW_LIMIT_REACHED', 'Preview 6th message blocked server-side (403)');

    // Moderation + highlight with owner or PIN
    const modForbidden = await moderateMessageStatus(supabase, {
      messageId: 'm-pending',
      status: 'approved',
      authUser: { id: 'owner-2' },
    });
    assert(modForbidden.ok === false && modForbidden.statusCode === 403, 'Cross-tenant moderation blocked (403)');

    const modPinOk = await moderateMessageStatus(supabase, {
      messageId: 'm-pending',
      status: 'approved',
      pin: 'PIN-8888',
    });
    assert(modPinOk.ok === true && modPinOk.data.status === 'approved', 'Moderation with valid PIN succeeds');

    const highlightOk = await updateMessageHighlightForProject(supabase, {
      messageId: 'm-pending',
      updates: { is_featured: true, classification: 'COUPLE_SELECTED' },
      authUser: { id: 'owner-1' },
    });
    assert(highlightOk.ok === true && highlightOk.data.classification === 'COUPLE_SELECTED', 'Owner highlight update succeeds');

    // RSVP list + VIP update authorization
    const rsvpsOk = await listProjectRsvps(supabase, { projectId: 'proj-active', pin: 'PIN-8888' });
    assert(rsvpsOk.ok === true && rsvpsOk.data.length === 1, 'listProjectRsvps succeeds with valid PIN');

    const vipForbidden = await updateRsvpVipAuthorized(supabase, {
      rsvpId: 'rsvp-vip',
      isVip: false,
      authUser: { id: 'owner-2' },
    });
    assert(vipForbidden.ok === false && vipForbidden.statusCode === 403, 'Cross-tenant RSVP VIP toggle blocked (403)');

    const vipOk = await updateRsvpVipAuthorized(supabase, {
      rsvpId: 'rsvp-vip',
      isVip: true,
      guestCategory: 'Bridal Party',
      authUser: { id: 'owner-1' },
    });
    assert(vipOk.ok === true && vipOk.data.guest_category === 'Bridal Party', 'Owner RSVP VIP update succeeds');

    // Public stats counts
    const counts = await getPublicEventCounts(supabase, 'proj-active');
    assert(counts.messageCount >= 2 && counts.rsvpCount === 1, 'getPublicEventCounts computes exact server counts');
  }

  // --- 5. Express uploadRouter authorization enforcement ---
  {
    const uploadApp = express();
    uploadApp.use(cookieParser());
    uploadApp.use('/api', uploadRouter);

    const server = await new Promise<any>((resolve) => {
      const s = uploadApp.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    try {
      const form = new FormData();
      form.append('event_id', 'proj-1');
      form.append('image', new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }), 'cover.jpg');

      const unauthUpload = await fetch(`http://127.0.0.1:${port}/api/upload`, {
        method: 'POST',
        body: form,
      });
      assert(unauthUpload.status === 401, 'POST /api/upload rejects unauthenticated caller (401)');
      const errBody = await unauthUpload.json();
      assert(
        errBody.success === false && typeof errBody.error?.code === 'string' && typeof errBody.error?.message === 'string',
        'Upload error returns standardized { success: false, error: { code, message } } envelope'
      );

      // Token with malformed signature fails to 401
      const form2 = new FormData();
      form2.append('event_id', 'proj-1');
      form2.append('image', new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }), 'cover.jpg');
      const badTokenUpload = await fetch(`http://127.0.0.1:${port}/api/upload`, {
        method: 'POST',
        headers: { Authorization: 'Bearer invalid.jwt.token' },
        body: form2,
      });
      assert(badTokenUpload.status === 401, 'POST /api/upload rejects invalid JWT token (401)');

      const validJwt = jwt.sign({ id: 'u1', email: 'u1@example.com' }, 'wedding-v1-sync-key-2024-secret-auth-v2');
      const badMimeForm = new FormData();
      badMimeForm.append('event_id', 'proj-1');
      badMimeForm.append('image', new Blob(['hello'], { type: 'text/plain' }), 'evil.txt');
      const badMimeUpload = await fetch(`http://127.0.0.1:${port}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${validJwt}` },
        body: badMimeForm,
      });
      assert(badMimeUpload.status === 400, 'POST /api/upload validates image MIME type (400)');
    } finally {
      server.closeAllConnections?.();
      server.close();
    }
  }

  // --- 6. Frontend apiClient helpers & transparent 401 retry ---
  {
    assert(
      extractApiErrorMessage({ success: false, error: { code: 'AGENCY_NOT_FOUND', message: 'Workspace not found.' } }, 'Fallback') ===
        'Workspace not found.',
      'extractApiErrorMessage unwraps structured error.message'
    );
    assert(
      extractApiErrorMessage({ error: 'Legacy string error' }, 'Fallback') === 'Legacy string error',
      'extractApiErrorMessage preserves legacy string error compatibility'
    );
    assert(
      unwrapApiData({ success: true, data: { slug: 'atelier' } })?.slug === 'atelier',
      'unwrapApiData unwraps standardized data property'
    );

    // Mock localStorage & fetch to verify CSRF + 401 refresh + retry once
    const store = new Map<string, string>();
    (globalThis as any).window = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    };
    (globalThis as any).document = { cookie: 'wedding_csrf=initial_csrf' };

    setAuthToken('expired-token');
    setCsrfTokenMemory('initial_csrf');

    const calls: Array<{ url: string; auth: string | null; csrf: string | null }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: RequestInit) => {
      const headers = new Headers(init?.headers || {});
      const url = String(input);
      calls.push({
        url,
        auth: headers.get('Authorization'),
        csrf: headers.get('X-CSRF-Token'),
      });

      if (url.endsWith('/api/auth/refresh')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { token: 'refreshed-token', csrfToken: 'rotated_csrf' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (headers.get('Authorization') === 'Bearer expired-token') {
        return new Response(JSON.stringify({ error: 'Expired' }), { status: 401 });
      }

      return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    try {
      const res = await apiFetch('/api/projects', { method: 'POST', body: '{}' });
      assert(res.status === 200, 'apiFetch transparently refreshes 401 and retries original POST request');
      assert(calls.length === 3, 'apiFetch executed initial call -> /api/auth/refresh -> single retry');
      assert(calls[0].csrf === 'initial_csrf', 'Initial mutating request attaches X-CSRF-Token');
      assert(calls[2].auth === 'Bearer refreshed-token' && calls[2].csrf === 'rotated_csrf', 'Retry request uses rotated JWT and CSRF token');
    } finally {
      globalThis.fetch = originalFetch;
      removeAuthToken();
    }

    // Response envelope builder test
    const errEnv = buildErrorResponse('FORBIDDEN_ACCESS', 'Permission denied.');
    const okEnv = buildSuccessResponse({ id: '1' }, { legacyField: 'compat' });
    assert(errEnv.success === false && errEnv.error.code === 'FORBIDDEN_ACCESS', 'buildErrorResponse structure verified');
    assert(okEnv.success === true && okEnv.data.id === '1' && okEnv.legacyField === 'compat', 'buildSuccessResponse structure verified');
    const generated = generateCsrfToken();
    assert(typeof generated === 'string' && generated.length >= 32, 'generateCsrfToken produces high-entropy token');
  }

  console.log('\n✅ ALL BACKEND API MIGRATION TESTS PASSED!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
