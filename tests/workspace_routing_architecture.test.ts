import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { createServer, ViteDevServer } from 'vite';
import {
  APP_SHELL_ROUTE_PATH,
  isPrerenderedMarketingPath,
  isStaticAssetPath,
  shouldServeCleanAppShell,
} from '../src/seo/appShell';
import workerApp from '../worker/index';

function runAppShellClassifierTests() {
  console.log('Running appShell classifier tests...');

  assert.equal(isStaticAssetPath('/assets/index-123.js'), true);
  assert.equal(isStaticAssetPath('/images/hero.webp'), true);
  assert.equal(isStaticAssetPath('/favicon.png'), true);
  assert.equal(isStaticAssetPath('/workspace'), false);

  assert.equal(isPrerenderedMarketingPath('/'), true);
  assert.equal(isPrerenderedMarketingPath('/pricing'), true);
  assert.equal(isPrerenderedMarketingPath('/zh-cn/pricing'), true);
  assert.equal(isPrerenderedMarketingPath('/workspace'), false);
  assert.equal(isPrerenderedMarketingPath('/login'), false);

  // Clean SPA shell must be served for /workspace and all private/dynamic routes
  assert.equal(shouldServeCleanAppShell('/workspace', 'eventframe.io'), true);
  assert.equal(shouldServeCleanAppShell('/workspace/', 'eventframe.io'), true);
  assert.equal(shouldServeCleanAppShell('/workspace/calendar', 'eventframe.io'), true);
  assert.equal(shouldServeCleanAppShell('/login', 'eventframe.io'), true);
  assert.equal(shouldServeCleanAppShell('/developer', 'eventframe.io'), true);
  assert.equal(shouldServeCleanAppShell('/lucas-sofia/website', 'eventframe.io'), true);

  // Agency subdomains always get clean SPA shell even at /
  assert.equal(shouldServeCleanAppShell('/', 'gewg.eventframe.io'), true);
  assert.equal(shouldServeCleanAppShell('/workspace', 'gewg.eventframe.io'), true);

  // Root marketing pages & static assets keep normal resolution
  assert.equal(shouldServeCleanAppShell('/', 'eventframe.io'), false);
  assert.equal(shouldServeCleanAppShell('/pricing', 'eventframe.io'), false);
  assert.equal(shouldServeCleanAppShell('/assets/Workspace-abc.js', 'eventframe.io'), false);
  assert.equal(shouldServeCleanAppShell('/api/projects', 'eventframe.io'), false);

  console.log('✓ appShell classifier tests passed');
}

async function runWorkerRoutingTests() {
  console.log('Running Cloudflare Worker routing tests...');

  const fetchedPaths: string[] = [];
  const mockEnv = {
    GOOGLE_CLIENT_ID: 'test-client-id',
    APP_URL: 'https://eventframe.io',
    ASSETS: {
      fetch: async (input: RequestInfo | URL) => {
        const reqUrl = typeof input === 'string' ? new URL(input) : new URL(input.url);
        fetchedPaths.push(reqUrl.pathname);

        if (reqUrl.pathname === APP_SHELL_ROUTE_PATH) {
          return new Response(
            '<!doctype html><html lang="en"><head><title>Studio Portal | EventFrame</title></head><body><div id="root"></div></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }

        if (reqUrl.pathname === '/' || reqUrl.pathname === '/pricing') {
          return new Response(
            '<!doctype html><html lang="en"><head><title>EventFrame</title></head><body><div id="root" data-prerendered="true" data-prerender-path="/">Home</div></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }

        return new Response('/* asset */', {
          status: 200,
          headers: { 'Content-Type': 'application/javascript' },
        });
      },
    },
  } as any;

  // 1. /workspace, /workspace?view=calendar, /workspace?view=grid must receive clean SPA shell, not homepage
  for (const targetUrl of [
    'https://eventframe.io/workspace',
    'https://eventframe.io/workspace?view=calendar',
    'https://eventframe.io/workspace?view=grid',
    'https://gewg.eventframe.io/workspace?view=calendar',
  ]) {
    fetchedPaths.length = 0;
    const res = await workerApp.request(targetUrl, { method: 'GET' }, mockEnv);
    assert.equal(res.status, 200);
    assert.equal(fetchedPaths[0], APP_SHELL_ROUTE_PATH, `Expected clean app shell for ${targetUrl}`);
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    const html = await res.text();
    assert.equal(html.includes('data-prerendered'), false, `Marketing prerender leaked into ${targetUrl}`);
    assert.ok(html.includes('<div id="root"></div>'), `Clean root missing for ${targetUrl}`);
  }

  // 2. Root marketing route still serves prerendered HTML
  fetchedPaths.length = 0;
  const homeRes = await workerApp.request('https://eventframe.io/', { method: 'GET' }, mockEnv);
  assert.equal(homeRes.status, 200);
  assert.equal(fetchedPaths[0], '/');
  assert.ok((await homeRes.text()).includes('data-prerendered="true"'));

  // 3. Direct external request to /app-shell/ redirects cleanly to /
  const shellDirectRes = await workerApp.request('https://eventframe.io/app-shell/', { method: 'GET' }, mockEnv);
  assert.equal(shellDirectRes.status, 302);
  assert.equal(shellDirectRes.headers.get('Location'), 'https://eventframe.io/');

  // 4. Google OAuth preserves ?redirect=/workspace?view=calendar in state
  const googleRes = await workerApp.request(
    'https://eventframe.io/api/auth/google?origin=https%3A%2F%2Feventframe.io&redirect=%2Fworkspace%3Fview%3Dcalendar',
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
    mockEnv
  );
  assert.equal(googleRes.status, 200);
  const googleBody = (await googleRes.json()) as { url: string };
  const authUrl = new URL(googleBody.url);
  const encodedState = authUrl.searchParams.get('state');
  assert.ok(encodedState, 'Google OAuth state must be present');
  const decodedState = JSON.parse(Buffer.from(encodedState!, 'base64').toString('utf8'));
  assert.equal(decodedState.redirect, '/workspace?view=calendar');

  console.log('✓ Cloudflare Worker routing tests passed');
}

function runBuiltDistVerification() {
  console.log('Verifying built dist/ artifacts...');
  const distDir = path.resolve(process.cwd(), 'dist');
  const appShellHtmlPath = path.join(distDir, 'app-shell', 'index.html');
  const rootHtmlPath = path.join(distDir, 'index.html');

  assert.equal(fs.existsSync(appShellHtmlPath), true, 'dist/app-shell/index.html must exist after npm run build');
  assert.equal(fs.existsSync(rootHtmlPath), true, 'dist/index.html must exist after npm run build');

  const appShellHtml = fs.readFileSync(appShellHtmlPath, 'utf8');
  assert.equal(appShellHtml.includes('data-prerendered'), false, 'dist/app-shell/index.html must not contain prerendered marketing DOM');
  assert.equal(appShellHtml.includes('rel="canonical"'), false, 'dist/app-shell/index.html must not hardcode homepage canonical');
  assert.ok(appShellHtml.includes('<div id="root"></div>'), 'dist/app-shell/index.html must contain clean #root mount');

  const rootHtml = fs.readFileSync(rootHtmlPath, 'utf8');
  assert.ok(rootHtml.includes('data-prerendered="true"'), 'dist/index.html must remain prerendered for SEO');
  assert.ok(rootHtml.includes('data-prerender-path="/"'), 'dist/index.html must declare data-prerender-path="/"');

  console.log('✓ Built dist/ artifact verification passed');
}

async function runAppRouteAuthTests() {
  console.log('Running AppRoutes / AuthGuard / UserContext integration tests...');

  const runScenario = async (
    initialUrl: string,
    loggedIn: boolean,
    assertions: (container: HTMLElement) => Promise<void>,
    readyCheck?: (container: HTMLElement) => boolean
  ) => {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: initialUrl,
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
    (globalThis as any).localStorage = win.localStorage;
    (globalThis as any).sessionStorage = win.sessionStorage;
    Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true });
    if (!win.matchMedia) {
      win.matchMedia = () =>
        ({ matches: false, media: '', onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }) as any;
    }

    (globalThis as any).fetch = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/auth/me')) {
        if (!loggedIn) {
          return new Response(JSON.stringify({ error: 'Unauthenticated' }), { status: 401 });
        }
        return new Response(
          JSON.stringify({
            user: { id: 'u1', email: 'planner@eventframe.io', role: 'agency', is_developer: false },
            csrfToken: 'csrf-123',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/agencies/me')) {
        return new Response(
          JSON.stringify({
            agencies: [
              { id: 'a1', name: 'Atelier Blanc', slug: 'atelier', user_role: 'agency', subscription_status: 'active' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/projects')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'e1',
                agency_id: 'a1',
                name: 'Lucas & Sofia',
                groom_name: 'Lucas',
                bride_name: 'Sofia',
                slug: 'lucas-sofia',
                wedding_date: new Date().toISOString().split('T')[0],
                location: 'Lake Como',
                theme_id: 'minimal_luxury',
                rsvp_fields: [],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
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
      const { runAppRouteScenario } = await vite.ssrLoadModule('/tests/helpers/appRouteHarness.tsx');
      await runAppRouteScenario(assertions, readyCheck);
    } finally {
      if (vite) await vite.close();
      dom.window.close();
    }
  };

  // Scenario A: Unauthenticated /workspace?view=calendar preserves destination in /login?redirect=...
  await runScenario(
    'https://localhost/workspace?view=calendar',
    false,
    async (container) => {
      assert.equal(window.location.pathname, '/login');
      assert.equal(
        new URLSearchParams(window.location.search).get('redirect'),
        '/workspace?view=calendar',
        'Unauthenticated redirect must preserve /workspace?view=calendar'
      );
      assert.ok(
        container.textContent?.includes('Agency & Studio Sign In'),
        `Expected login heading, got: ${container.textContent}`
      );
    },
    (container) => container.textContent?.includes('Agency & Studio Sign In') ?? false
  );

  // Scenario B: Authenticated /workspace?view=calendar&token=abc strips token ONLY and renders Calendar
  await runScenario(
    'https://localhost/workspace?view=calendar&token=fake.jwt.token',
    true,
    async (container) => {
      assert.equal(window.location.pathname, '/workspace');
      assert.equal(window.location.search, '?view=calendar', 'Token stripped while preserving ?view=calendar');
      assert.ok(container.textContent?.includes('Event Schedule Calendar'), 'Calendar must render');
    },
    (container) => container.textContent?.includes('Event Schedule Calendar') ?? false
  );

  // Scenario C: Authenticated /workspace defaults cleanly to Grid View (never redirects to /)
  await runScenario(
    'https://localhost/workspace',
    true,
    async (container) => {
      assert.equal(window.location.pathname, '/workspace');
      assert.ok(container.textContent?.includes('Weddings & Celebrations'), 'Default /workspace must render Grid View');
    },
    (container) => container.textContent?.includes('Weddings & Celebrations') ?? false
  );

  // Scenario D: Authenticated /workspace/calendar normalizes cleanly to /workspace?view=calendar
  await runScenario(
    'https://localhost/workspace/calendar',
    true,
    async (container) => {
      assert.equal(window.location.pathname + window.location.search, '/workspace?view=calendar');
      assert.ok(container.textContent?.includes('Event Schedule Calendar'), '/workspace/calendar must render Calendar');
    },
    (container) => container.textContent?.includes('Event Schedule Calendar') ?? false
  );

  console.log('✓ AppRoutes / AuthGuard / UserContext tests passed');
}

async function main() {
  runAppShellClassifierTests();
  await runWorkerRoutingTests();
  runBuiltDistVerification();
  await runAppRouteAuthTests();
  console.log('All Workspace Route Architecture tests passed!');
}

main().catch((err) => {
  console.error('Workspace route architecture test failed:', err);
  process.exit(1);
});
