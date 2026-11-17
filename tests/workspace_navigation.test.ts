import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer, ViteDevServer } from 'vite';
import {
  buildWorkspaceUrl,
  getDashboardNavItem,
  isSameWorkspaceTarget,
  resolveWorkspaceView,
} from '../src/lib/workspaceNavigation';

function runUnitTests() {
  console.log('Running workspaceNavigation unit tests...');

  assert.equal(resolveWorkspaceView(''), 'grid');
  assert.equal(resolveWorkspaceView('?view=grid'), 'grid');
  assert.equal(resolveWorkspaceView('?view=list'), 'grid');
  assert.equal(resolveWorkspaceView('?view=calendar'), 'calendar');
  assert.equal(resolveWorkspaceView('?view=agency_settings'), 'agency_settings');
  assert.equal(resolveWorkspaceView('?view=editor'), 'editor');
  assert.equal(resolveWorkspaceView('?project=evt-123'), 'editor');
  assert.equal(resolveWorkspaceView('?view=unknown'), 'grid');

  assert.equal(buildWorkspaceUrl('grid'), '/workspace?view=grid');
  assert.equal(buildWorkspaceUrl('calendar'), '/workspace?view=calendar');
  assert.equal(buildWorkspaceUrl('agency_settings'), '/workspace?view=agency_settings');
  assert.equal(buildWorkspaceUrl('editor'), '/workspace?view=editor');
  assert.equal(
    buildWorkspaceUrl('editor', { projectId: 'evt-123' }),
    '/workspace?view=editor&project=evt-123'
  );

  assert.equal(getDashboardNavItem('grid'), 'events');
  assert.equal(getDashboardNavItem('editor'), 'events');
  assert.equal(getDashboardNavItem('calendar'), 'calendar');
  assert.equal(getDashboardNavItem('agency_settings'), 'settings');

  assert.equal(
    isSameWorkspaceTarget(new URLSearchParams('view=calendar'), 'calendar'),
    true
  );
  assert.equal(
    isSameWorkspaceTarget(new URLSearchParams(''), 'grid'),
    false
  );
  assert.equal(
    isSameWorkspaceTarget(new URLSearchParams('view=grid'), 'grid'),
    true
  );
  assert.equal(
    isSameWorkspaceTarget(new URLSearchParams('view=editor&project=evt-1'), 'editor', 'evt-1'),
    true
  );
  assert.equal(
    isSameWorkspaceTarget(new URLSearchParams('view=editor&project=evt-1'), 'editor', 'evt-2'),
    false
  );

  console.log('✓ workspaceNavigation unit tests passed');
}

function setupDomEnvironment(initialUrl: string) {
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

  return dom;
}

async function runDomIntegrationTests() {
  console.log('Running Workspace DOM & React Router integration tests...');

  const dom = setupDomEnvironment('https://eventframe.io/workspace?view=calendar');

  const todayStr = new Date().toISOString().split('T')[0];
  let projectsFetchCount = 0;

  (globalThis as any).fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/api/auth/me')) {
      return new Response(
        JSON.stringify({
          user: {
            id: 'user-1',
            email: 'planner@eventframe.io',
            role: 'agency',
            is_developer: false,
          },
          csrfToken: 'test-csrf',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('/api/agencies/me')) {
      return new Response(
        JSON.stringify({
          agencies: [
            {
              id: 'agency-1',
              name: 'Atelier Blanc',
              slug: 'atelier',
              user_role: 'agency',
              subscription_status: 'active',
              theme_config: { primaryColor: '#252525', accentColor: '#8B806F' },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('/api/projects')) {
      projectsFetchCount += 1;
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'evt-1',
              agency_id: 'agency-1',
              name: 'Lucas & Sofia',
              groom_name: 'Lucas',
              bride_name: 'Sofia',
              slug: 'lucas-sofia',
              wedding_date: todayStr,
              location: 'Villa Erba, Lake Como',
              theme_id: 'minimal_luxury',
              access_password: 'PIN123',
              status: 'active',
              payment_status: 'paid',
              rsvp_fields: [],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  let vite: ViteDevServer | null = null;
  try {
    vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });

    const { runWorkspaceDomSuite } = await vite.ssrLoadModule('/tests/helpers/workspaceDomHarness.tsx');
    await runWorkspaceDomSuite(() => projectsFetchCount);
  } finally {
    if (vite) {
      await vite.close();
    }
    dom.window.close();
  }
}

async function main() {
  runUnitTests();
  await runDomIntegrationTests();
  console.log('All Workspace Navigation tests passed!');
}

main().catch((err) => {
  console.error('Workspace navigation test failed:', err);
  process.exit(1);
});
