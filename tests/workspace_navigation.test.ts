import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer, ViteDevServer } from 'vite';
import {
  buildWorkspaceUrl,
  getDashboardNavItem,
  isSameWorkspaceTarget,
  isValidProjectIdFormat,
  normalizeProjectIdParam,
  resolveWorkspaceView,
} from '../src/lib/workspaceNavigation';

function runUnitTests() {
  console.log('Running workspaceNavigation unit tests...');

  // Default & explicit view rules
  assert.equal(resolveWorkspaceView(''), 'grid');
  assert.equal(resolveWorkspaceView('?view=grid'), 'grid');
  assert.equal(resolveWorkspaceView('?view=calendar'), 'calendar');
  assert.equal(resolveWorkspaceView('?view=agency_settings'), 'agency_settings');
  assert.equal(resolveWorkspaceView('?view=editor'), 'editor');
  assert.equal(resolveWorkspaceView('?view=editor&project=1ff1a5bf-a9a3-45f7-a782-ed1bf83acf73'), 'editor');

  // Strict rules: No view param -> grid; invalid view param -> grid (even when ?project= exists)
  assert.equal(resolveWorkspaceView('?project=1ff1a5bf-a9a3-45f7-a782-ed1bf83acf73'), 'grid');
  assert.equal(resolveWorkspaceView('?view=unknown'), 'grid');
  assert.equal(resolveWorkspaceView('?view=invalid&project=1ff1a5bf-a9a3-45f7-a782-ed1bf83acf73'), 'grid');

  // Project param normalization & validation
  assert.equal(normalizeProjectIdParam('?view=editor&project=  evt-1  '), 'evt-1');
  assert.equal(normalizeProjectIdParam('?view=editor&project='), null);
  assert.equal(isValidProjectIdFormat('1ff1a5bf-a9a3-45f7-a782-ed1bf83acf73'), true);
  assert.equal(isValidProjectIdFormat('evt-1'), true);
  assert.equal(isValidProjectIdFormat('demo-project'), true);
  assert.equal(isValidProjectIdFormat('undefined'), false);
  assert.equal(isValidProjectIdFormat('null'), false);
  assert.equal(isValidProjectIdFormat('bad id!'), false);
  assert.equal(isValidProjectIdFormat(''), false);

  // URL building strips project for non-editor views
  assert.equal(buildWorkspaceUrl('grid'), '/workspace?view=grid');
  assert.equal(buildWorkspaceUrl('grid', { projectId: 'evt-1' }), '/workspace?view=grid');
  assert.equal(buildWorkspaceUrl('calendar'), '/workspace?view=calendar');
  assert.equal(buildWorkspaceUrl('calendar', { projectId: 'evt-1' }), '/workspace?view=calendar');
  assert.equal(buildWorkspaceUrl('agency_settings'), '/workspace?view=agency_settings');
  assert.equal(buildWorkspaceUrl('editor'), '/workspace?view=editor');
  assert.equal(
    buildWorkspaceUrl('editor', { projectId: '1ff1a5bf-a9a3-45f7-a782-ed1bf83acf73' }),
    '/workspace?view=editor&project=1ff1a5bf-a9a3-45f7-a782-ed1bf83acf73'
  );

  assert.equal(getDashboardNavItem('grid'), 'events');
  assert.equal(getDashboardNavItem('editor'), 'events');
  assert.equal(getDashboardNavItem('calendar'), 'calendar');
  assert.equal(getDashboardNavItem('agency_settings'), 'settings');

  assert.equal(isSameWorkspaceTarget(new URLSearchParams('view=calendar'), 'calendar'), true);
  assert.equal(isSameWorkspaceTarget(new URLSearchParams(''), 'grid'), false);
  assert.equal(isSameWorkspaceTarget(new URLSearchParams('view=grid'), 'grid'), true);
  assert.equal(isSameWorkspaceTarget(new URLSearchParams('view=editor&project=evt-1'), 'editor', 'evt-1'), true);
  assert.equal(isSameWorkspaceTarget(new URLSearchParams('view=editor&project=evt-1'), 'editor', 'evt-2'), false);

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
  console.log('Running Workspace DOM & React Router integration tests (10 scenarios)...');

  const dom = setupDomEnvironment('https://eventframe.io/workspace?view=grid');
  const todayStr = new Date().toISOString().split('T')[0];

  const VALID_PROJECT_UUID = '1ff1a5bf-a9a3-45f7-a782-ed1bf83acf73';
  const DIRECT_ONLY_PROJECT_UUID = '2aa2b6cf-b0b4-46a8-b893-fe2ca94bdf84';

  const listProject = {
    id: VALID_PROJECT_UUID,
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
  };

  const directOnlyProject = {
    id: DIRECT_ONLY_PROJECT_UUID,
    agency_id: 'agency-2',
    name: 'Mateo & Elena',
    groom_name: 'Mateo',
    bride_name: 'Elena',
    slug: 'mateo-elena',
    wedding_date: todayStr,
    location: 'Ravello, Amalfi Coast',
    theme_id: 'minimal_luxury',
    access_password: 'PIN456',
    status: 'active',
    payment_status: 'paid',
    rsvp_fields: [],
  };

  let mode: 'normal' | 'fail_project_fetch' | 'fail_all_projects' = 'normal';
  let projectsListFetchCount = 0;
  let singleProjectFetchCount = 0;

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

    // Sub-resources inside EventOverviewDashboard / GuestManagementSuite
    if (url.includes('/guests')) {
      return new Response(JSON.stringify({ guests: [] }), { status: 200 });
    }
    if (url.includes('/tables')) {
      return new Response(JSON.stringify({ tables: [] }), { status: 200 });
    }
    if (url.includes('/layout')) {
      return new Response(JSON.stringify({ layout: null }), { status: 200 });
    }
    if (url.includes('/api/messages')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }

    // Single-project endpoint GET /api/projects/:id
    const singleMatch = url.match(/\/api\/projects\/([^/?#]+)$/);
    if (singleMatch) {
      singleProjectFetchCount += 1;
      const requestedId = decodeURIComponent(singleMatch[1]);
      if (mode === 'fail_project_fetch' || mode === 'fail_all_projects') {
        return new Response(
          JSON.stringify({ error: 'Database temporarily unavailable', code: 'DATABASE_ERROR' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (requestedId === VALID_PROJECT_UUID) {
        return new Response(JSON.stringify({ success: true, data: listProject }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (requestedId === DIRECT_ONLY_PROJECT_UUID) {
        return new Response(JSON.stringify({ success: true, data: directOnlyProject }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ error: 'Wedding event not found.', code: 'PROJECT_NOT_FOUND' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Project list endpoint GET /api/projects?agency_id=...
    if (url.includes('/api/projects')) {
      projectsListFetchCount += 1;
      if (mode === 'fail_all_projects') {
        return new Response(
          JSON.stringify({ error: 'Failed to load events', code: 'DATABASE_ERROR' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ data: [listProject] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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
    await runWorkspaceDomSuite({
      setMode: (nextMode: 'normal' | 'fail_project_fetch' | 'fail_all_projects') => {
        mode = nextMode;
      },
      getProjectsListFetchCount: () => projectsListFetchCount,
      getSingleProjectFetchCount: () => singleProjectFetchCount,
    });
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
  console.log('All Workspace Navigation & Editor Lifecycle tests passed!');
}

main().catch((err) => {
  console.error('Workspace navigation test failed:', err);
  process.exit(1);
});
