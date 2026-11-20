import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { JSDOM } from 'jsdom';
import { createServer, ViteDevServer } from 'vite';
import {
  LOGOUT_MARKER_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  isNoStoreApiPath,
  selectPreferredSessionToken,
} from '../server/sessionToken';
import { extractBearerOrCookieToken } from '../server/createDeveloperRouter';
import { extractWorkerToken } from '../server/registerWorkerDeveloperRoutes';
import workerApp from '../worker/index';

const TEST_SECRET = 'wedding-v1-sync-key-2024-secret-auth-v2';

function signSession(user: { id: string; email: string; name: string; auth_ts?: number }, iatOverrideSec?: number) {
  const payload: any = {
    id: user.id,
    sub: user.id,
    email: user.email,
    name: user.name,
    ...(typeof user.auth_ts === 'number' ? { auth_ts: user.auth_ts } : {}),
  };
  if (typeof iatOverrideSec === 'number') {
    payload.iat = iatOverrideSec;
    payload.exp = iatOverrideSec + 7 * 24 * 3600;
    return jwt.sign(payload, TEST_SECRET, { algorithm: 'HS256', noTimestamp: true });
  }
  return jwt.sign(payload, TEST_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}

function runTokenPrecedenceAndLogoutMarkerTests() {
  console.log('1. Running sessionToken precedence & cross-subdomain logout marker tests...');

  const tokenA = signSession({
    id: 'user-a',
    email: 'munjian1993@hotmail.com',
    name: 'Munjian',
    auth_ts: 1_700_000_001_000,
  });
  const tokenB = signSession({
    id: 'user-b',
    email: 'kiap93.kmj@gmail.com',
    name: 'Kiap Google',
    auth_ts: 1_700_000_005_000,
  });

  // Case 1: Stale Bearer token A (in root eventframe.io localStorage) + fresh Cookie token B (Google login)
  assert.equal(
    selectPreferredSessionToken({
      bearerToken: tokenA,
      cookieToken: tokenB,
      loggedOutAtCookie: null,
    }),
    tokenB,
    'Newer HttpOnly cookie MUST override stale localStorage Bearer token'
  );

  // Case 2: Same-second timestamp tie between Bearer A and Cookie B -> shared HttpOnly cookie wins
  const tieSec = 1_700_000_010;
  const tieTokenA = signSession({ id: 'user-a', email: 'munjian1993@hotmail.com', name: 'Munjian' }, tieSec);
  const tieTokenB = signSession({ id: 'user-b', email: 'kiap93.kmj@gmail.com', name: 'Kiap Google' }, tieSec);
  assert.equal(
    selectPreferredSessionToken({
      bearerToken: tieTokenA,
      cookieToken: tieTokenB,
      loggedOutAtCookie: null,
    }),
    tieTokenB,
    'On timestamp ties, shared HttpOnly cookie MUST override origin-scoped localStorage Bearer'
  );

  // Case 3: User logged out on subdomain at ts=1_700_000_003_000 -> stale localStorage Bearer tokenA rejected
  assert.equal(
    selectPreferredSessionToken({
      bearerToken: tokenA,
      cookieToken: null,
      loggedOutAtCookie: '1700000003000',
    }),
    null,
    'Stale Bearer token minted before logout marker MUST be rejected when cookie is cleared'
  );

  // Case 4: Newer Bearer token minted AFTER logout (e.g. iframe preview without cookie) is accepted
  assert.equal(
    selectPreferredSessionToken({
      bearerToken: tokenB,
      cookieToken: tokenA,
      loggedOutAtCookie: null,
    }),
    tokenB,
    'Explicitly newer Bearer token (e.g. preview iframe login) wins over older cookie'
  );

  // Case 5: Standalone Bearer API request with no cookies works cleanly
  assert.equal(
    selectPreferredSessionToken({
      bearerToken: tokenA,
      cookieToken: null,
      loggedOutAtCookie: null,
    }),
    tokenA,
    'Standalone Bearer token without cookies continues to work'
  );

  // Case 6: Express & Worker extractors honor identical precedence & logout markers
  const mockExpressReq = {
    headers: { authorization: `Bearer ${tokenA}` },
    cookies: {
      [SESSION_COOKIE_NAME]: tokenB,
    },
  } as any;
  assert.equal(
    extractBearerOrCookieToken(mockExpressReq),
    tokenB,
    'Express extractBearerOrCookieToken must prefer newer HttpOnly cookie over stale Bearer'
  );

  const mockExpressLoggedOutReq = {
    headers: { authorization: `Bearer ${tokenA}` },
    cookies: {
      [LOGOUT_MARKER_COOKIE_NAME]: '1700000003000',
    },
  } as any;
  assert.equal(
    extractBearerOrCookieToken(mockExpressLoggedOutReq),
    null,
    'Express extractBearerOrCookieToken must reject stale Bearer after logout marker'
  );

  const mockHonoCtx = {
    req: {
      raw: {
        headers: new Headers({
          authorization: `Bearer ${tokenA}`,
          cookie: `${SESSION_COOKIE_NAME}=${tokenB}`,
        }),
      },
      header: (name: string) => {
        if (name.toLowerCase() === 'authorization') return `Bearer ${tokenA}`;
        if (name.toLowerCase() === 'cookie') return `${SESSION_COOKIE_NAME}=${tokenB}`;
        return undefined;
      },
    },
  } as any;
  assert.equal(
    extractWorkerToken(mockHonoCtx),
    tokenB,
    'Worker extractWorkerToken must prefer newer HttpOnly cookie over stale Bearer'
  );

  // Case 7: No-store cache path coverage
  for (const route of ['/api/auth/me', '/api/auth/refresh', '/api/agencies/me', '/api/projects', '/api/developer/me', '/api/billing/history']) {
    assert.equal(isNoStoreApiPath(route), true, `${route} must require no-store Cache-Control`);
  }

  console.log('✓ sessionToken precedence & cross-subdomain logout marker tests passed');
}

async function runWorkerHttpCookieTests() {
  console.log('2. Running Cloudflare Worker logout & cache-control HTTP tests...');

  const mockEnv = {
    JWT_SECRET: TEST_SECRET,
    APP_URL: 'https://eventframe.io',
  } as any;

  const logoutRes = await workerApp.request(
    'https://agency-a.eventframe.io/api/auth/logout',
    {
      method: 'POST',
      headers: {
        Origin: 'https://agency-a.eventframe.io',
        'X-Requested-With': 'EventFrame',
      },
    },
    mockEnv
  );

  assert.equal(logoutRes.status, 200);
  const cacheControl = logoutRes.headers.get('Cache-Control') || '';
  assert.ok(cacheControl.includes('no-store'), `Expected no-store Cache-Control on /api/auth/logout, got: ${cacheControl}`);
  assert.ok((logoutRes.headers.get('Vary') || '').includes('Cookie'), 'Expected Vary: Cookie, Authorization');

  const setCookies =
    typeof (logoutRes.headers as any).getSetCookie === 'function'
      ? ((logoutRes.headers as any).getSetCookie() as string[])
      : [logoutRes.headers.get('Set-Cookie') || ''];
  const joinedCookies = setCookies.join('\n');

  assert.ok(joinedCookies.includes(`${SESSION_COOKIE_NAME}=`), 'Logout must clear wedding_session');
  assert.ok(joinedCookies.includes('Domain=.eventframe.io'), 'Logout must clear parent .eventframe.io cookies');
  assert.ok(joinedCookies.includes(`${LOGOUT_MARKER_COOKIE_NAME}=`), 'Logout must set wedding_logged_out_at marker');

  // Calling /api/auth/me with stale TOKEN_A Bearer AND the logout marker cookie must return 401
  const staleToken = signSession({
    id: 'user-a',
    email: 'munjian1993@hotmail.com',
    name: 'Munjian',
    auth_ts: Date.now() - 60_000,
  });
  const markerMatch = joinedCookies.match(new RegExp(`${LOGOUT_MARKER_COOKIE_NAME}=([^;]+)`));
  assert.ok(markerMatch && markerMatch[1], 'Logout marker value must be readable from Set-Cookie');

  const meAfterLogoutRes = await workerApp.request(
    'https://eventframe.io/api/auth/me',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${staleToken}`,
        Cookie: `${LOGOUT_MARKER_COOKIE_NAME}=${markerMatch![1]}`,
      },
    },
    mockEnv
  );
  assert.equal(meAfterLogoutRes.status, 401, 'Stale localStorage Bearer after logout must receive 401');
  assert.ok(
    (meAfterLogoutRes.headers.get('Cache-Control') || '').includes('no-store'),
    'GET /api/auth/me 401 must include Cache-Control: no-store'
  );

  console.log('✓ Cloudflare Worker logout & cache-control HTTP tests passed');
}

async function runFrontendAccountSwitchingDomTests() {
  console.log('3. Running full browser lifecycle DOM tests (email A -> logout -> Google B -> reopen & races)...');

  const userA = { id: 'user-a', email: 'munjian1993@hotmail.com', name: 'Munjian', role: 'agency_owner' };
  const userB = { id: 'user-b', email: 'kiap93.kmj@gmail.com', name: 'Kiap Google', role: 'agency_owner' };
  const agencyA = { id: 'ag-a', name: 'Munjian Events', slug: 'munjian', user_role: 'agency', subscription_status: 'active' };
  const agencyB = { id: 'ag-b', name: 'Kiap Luxury Weddings', slug: 'kiap', user_role: 'agency', subscription_status: 'active' };

  // Simulate browser cookie jar (.eventframe.io) + per-origin partitioned localStorage
  let sharedCookieToken: string | null = null;
  let sharedLogoutMarkerMs: number = 0;
  const originStorage = new Map<string, Record<string, string>>([
    ['https://eventframe.io', {}],
    ['https://agency-a.eventframe.io', {}],
    ['https://agency-b.eventframe.io', {}],
  ]);

  let currentOrigin = 'https://eventframe.io';
  let slowMeDelayMs = 0;
  let forceMeResponseForTest: { token: string; user: any; delayMs: number } | null = null;

  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://eventframe.io/workspace',
  });
  const win = dom.window;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).window = win;
  (globalThis as any).document = win.document;
  (globalThis as any).HTMLElement = win.HTMLElement;
  (globalThis as any).Element = win.Element;
  (globalThis as any).Node = win.Node;
  (globalThis as any).Event = win.Event;
  (globalThis as any).PopStateEvent = win.PopStateEvent;
  (globalThis as any).CustomEvent = win.CustomEvent;
  (globalThis as any).MutationObserver = win.MutationObserver;
  Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true });

  // Bind global localStorage to the active origin's storage bucket (simulates real subdomain isolation!)
  const makeStorageProxy = (getOrigin: () => string) => ({
    get length() {
      return Object.keys(originStorage.get(getOrigin()) || {}).length;
    },
    key(idx: number) {
      return Object.keys(originStorage.get(getOrigin()) || {})[idx] ?? null;
    },
    getItem(k: string) {
      const store = originStorage.get(getOrigin()) || {};
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    },
    setItem(k: string, v: string) {
      const store = originStorage.get(getOrigin()) || {};
      store[k] = String(v);
      originStorage.set(getOrigin(), store);
    },
    removeItem(k: string) {
      const store = originStorage.get(getOrigin()) || {};
      delete store[k];
      originStorage.set(getOrigin(), store);
    },
    clear() {
      originStorage.set(getOrigin(), {});
    },
  });

  const storageProxy = makeStorageProxy(() => currentOrigin);
  Object.defineProperty(win, 'localStorage', { value: storageProxy, configurable: true });
  (globalThis as any).localStorage = storageProxy;
  (globalThis as any).sessionStorage = win.sessionStorage;

  const verifyUserFromToken = (token: string | null) => {
    if (!token) return null;
    try {
      const decoded = jwt.verify(token, TEST_SECRET, { algorithms: ['HS256'] }) as any;
      if (decoded.email === userA.email) return userA;
      if (decoded.email === userB.email) return userB;
    } catch {
      return null;
    }
    return null;
  };

  (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const headers = new Headers(init?.headers || {});
    const authHeader = headers.get('Authorization');
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (url.includes('/api/auth/logout')) {
      sharedCookieToken = null;
      sharedLogoutMarkerMs = Date.now();
      return new Response(JSON.stringify({ success: true, data: { loggedOut: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    if (url.includes('/api/auth/me')) {
      if (forceMeResponseForTest) {
        const forced = forceMeResponseForTest;
        forceMeResponseForTest = null;
        await new Promise((r) => setTimeout(r, forced.delayMs));
        return new Response(
          JSON.stringify({ user: forced.user, token: forced.token, csrfToken: 'csrf-forced' }),
          { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
        );
      }

      if (slowMeDelayMs > 0) {
        await new Promise((r) => setTimeout(r, slowMeDelayMs));
      }

      const resolvedToken = selectPreferredSessionToken({
        bearerToken: bearer,
        cookieToken: sharedCookieToken,
        loggedOutAtCookie: sharedLogoutMarkerMs > 0 ? String(sharedLogoutMarkerMs) : null,
      });
      const resolvedUser = verifyUserFromToken(resolvedToken);
      if (!resolvedUser) {
        return new Response(JSON.stringify({ error: 'Not authenticated', code: 'UNAUTHENTICATED' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }

      const freshToken = signSession({
        id: resolvedUser.id,
        email: resolvedUser.email,
        name: resolvedUser.name,
        auth_ts: Date.now(),
      });
      sharedCookieToken = freshToken;
      sharedLogoutMarkerMs = 0;

      return new Response(
        JSON.stringify({ user: resolvedUser, token: freshToken, csrfToken: `csrf-${resolvedUser.id}` }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
      );
    }

    if (url.includes('/api/agencies/me')) {
      const resolvedToken = selectPreferredSessionToken({
        bearerToken: bearer,
        cookieToken: sharedCookieToken,
        loggedOutAtCookie: sharedLogoutMarkerMs > 0 ? String(sharedLogoutMarkerMs) : null,
      });
      const resolvedUser = verifyUserFromToken(resolvedToken);
      if (!resolvedUser) {
        return new Response(JSON.stringify({ error: 'Unauthenticated' }), { status: 401 });
      }
      const agencies = resolvedUser.id === userA.id ? [agencyA] : [agencyB];
      return new Response(JSON.stringify({ agencies }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
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

    const { mountAuthProbe } = await vite.ssrLoadModule('/tests/helpers/authLifecycleHarness.tsx');

    // Step 1: Login Account A (munjian1993@hotmail.com) on root eventframe.io & preserve unrelated preferences
    const tA1 = Date.now() - 10_000;
    const tokenA = signSession({ ...userA, auth_ts: tA1 });
    currentOrigin = 'https://eventframe.io';
    storageProxy.setItem('wedding_session_token', tokenA);
    storageProxy.setItem('ef_marketing_lang', 'zh-cn');
    storageProxy.setItem('ef_lang_evt1', 'ms');
    sharedCookieToken = tokenA;

    // Step 2: Account A redirected to subdomain agency-a.eventframe.io and clicks Logout
    currentOrigin = 'https://agency-a.eventframe.io';
    storageProxy.setItem('wedding_session_token', tokenA);
    storageProxy.setItem(`ef_active_agency_${userA.id}`, agencyA.id);

    let actions: any = null;
    const probeA = await mountAuthProbe((a) => {
      actions = a;
    });
    const snapA = await probeA.waitUntilSettled();
    assert.equal(snapA.userEmail, userA.email, 'Initial session should belong to Account A');
    assert.equal(snapA.activeAgency, agencyA.name, 'Initial agency should belong to Account A');

    await actions.logout();
    await probeA.unmount();

    assert.equal(
      originStorage.get('https://agency-a.eventframe.io')?.wedding_session_token,
      undefined,
      'Logout must clear wedding_session_token on agency-a origin'
    );
    assert.equal(
      originStorage.get('https://agency-a.eventframe.io')?.[`ef_active_agency_${userA.id}`],
      undefined,
      'Logout must clear user-scoped active agency cache'
    );
    // Crucial: eventframe.io STILL has stale Account A token in localStorage (cross-subdomain partition)!
    assert.equal(
      originStorage.get('https://eventframe.io')?.wedding_session_token,
      tokenA,
      'Simulating stale Account A token lingering on root eventframe.io origin'
    );

    // Step 3: User stays logged out if reopening eventframe.io before any new login (even with stale tokenA!)
    currentOrigin = 'https://eventframe.io';
    const probeLoggedOut = await mountAuthProbe();
    const snapLoggedOut = await probeLoggedOut.waitUntilSettled();
    await probeLoggedOut.unmount();
    assert.equal(snapLoggedOut.userEmail, 'NONE', 'Reopening eventframe.io after logout must NOT restore Account A');
    assert.equal(
      originStorage.get('https://eventframe.io')?.wedding_session_token,
      undefined,
      'Stale Account A token on eventframe.io must be purged after 401'
    );
    assert.equal(
      originStorage.get('https://eventframe.io')?.ef_marketing_lang,
      'zh-cn',
      'Unrelated language preference must be preserved across logout'
    );

    // Step 4 (Exact bug reproduction): Re-seed stale tokenA on eventframe.io, then login Google Account B (kiap93.kmj@gmail.com)
    storageProxy.setItem('wedding_session_token', tokenA);
    const tokenB = signSession({ ...userB, auth_ts: Date.now() });
    sharedCookieToken = tokenB;
    sharedLogoutMarkerMs = 0;

    // Next day, browser opens https://eventframe.io (which STILL has stale tokenA in localStorage!)
    slowMeDelayMs = 40;
    let firstFrameSnapshot: any = null;
    const probeReopen = await mountAuthProbe(undefined, (snap) => {
      firstFrameSnapshot = snap;
    });
    assert.equal(firstFrameSnapshot.loading, 'true', 'Startup must stay in loading state until server verification');
    assert.equal(
      firstFrameSnapshot.userEmail,
      'NONE',
      'Startup MUST NEVER optimistically display previous Account A from localStorage'
    );

    const snapReopen = await probeReopen.waitUntilSettled();
    assert.equal(snapReopen.userEmail, userB.email, 'Reopened browser MUST resolve to Google Account B');
    assert.equal(snapReopen.activeAgency, agencyB.name, 'Reopened browser MUST load Agency B');
    assert.notEqual(
      originStorage.get('https://eventframe.io')?.wedding_session_token,
      tokenA,
      'Stale Account A localStorage token on eventframe.io must be overwritten by verified Account B token'
    );

    // Step 5: Session persists across reload without logout
    await probeReopen.unmount();
    slowMeDelayMs = 0;
    const probePersist = await mountAuthProbe();
    const snapPersist = await probePersist.waitUntilSettled();
    assert.equal(snapPersist.userEmail, userB.email, 'Authenticated Account B must persist across browser restart');

    // Step 6: Race condition test — slow /api/auth/me returning Account A cannot overwrite establishSession(Account B)
    let raceActions: any = null;
    await probePersist.unmount();
    forceMeResponseForTest = { token: tokenA, user: userA, delayMs: 80 };
    const probeRace = await mountAuthProbe((a) => {
      raceActions = a;
    });
    // While initial /api/auth/me is still in-flight (returning Account A after 80ms), establish Account B session
    await new Promise((r) => setTimeout(r, 15));
    raceActions.establishSession(userB, tokenB, 'csrf-b');
    await new Promise((r) => setTimeout(r, 110));
    const snapAfterRace = probeRace.readSnapshot();
    assert.equal(
      snapAfterRace.userEmail,
      userB.email,
      'Delayed /api/auth/me response for Account A MUST NOT overwrite newer Account B session'
    );
    await probeRace.unmount();

    // Step 7: Reverse switch (Google B -> Logout -> Email A)
    currentOrigin = 'https://agency-b.eventframe.io';
    storageProxy.setItem('wedding_session_token', tokenB);
    sharedLogoutMarkerMs = Date.now();
    sharedCookieToken = signSession({ ...userA, auth_ts: Date.now() + 100 });
    sharedLogoutMarkerMs = 0;
    const probeReverse = await mountAuthProbe();
    const snapReverse = await probeReverse.waitUntilSettled();
    assert.equal(snapReverse.userEmail, userA.email, 'Reverse switch (Google B -> Email A) must resolve Account A');
    assert.equal(snapReverse.activeAgency, agencyA.name, 'Reverse switch must load Agency A');
    await probeReverse.unmount();
  } finally {
    if (vite) await vite.close();
    dom.window.close();
  }

  console.log('✓ Full browser lifecycle DOM tests passed');
}

async function main() {
  runTokenPrecedenceAndLogoutMarkerTests();
  await runWorkerHttpCookieTests();
  await runFrontendAccountSwitchingDomTests();
  console.log('All Authentication Session Lifecycle tests passed!');
}

main().catch((err) => {
  console.error('Auth session lifecycle test failed:', err);
  process.exit(1);
});
