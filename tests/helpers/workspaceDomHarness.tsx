import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserProvider } from '../../src/lib/UserContext';
import { WorkspaceProvider } from '../../src/lib/WorkspaceContext';
import Workspace from '../../src/pages/Workspace';
import { resolveWorkspaceView } from '../../src/lib/workspaceNavigation';

async function flushUi(ticks = 8) {
  for (let i = 0; i < ticks; i++) {
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

function findButtonByText(container: ParentNode, text: string): HTMLButtonElement | undefined {
  const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.find((btn) => btn.textContent?.replace(/\s+/g, ' ').trim().includes(text));
}

function isCalendarVisible(container: ParentNode): boolean {
  return container.textContent?.includes('Event Schedule Calendar') ?? false;
}

function isGridVisible(container: ParentNode): boolean {
  return (
    (container.textContent?.includes('Weddings & Celebrations') ?? false) &&
    (container.textContent?.includes('Total Events') ?? false)
  );
}

function isAgencySettingsVisible(container: ParentNode): boolean {
  return container.textContent?.includes('Agency Branding & Subdomain') ?? false;
}

function isEditorVisible(container: ParentNode, expectedCouple?: string): boolean {
  const hasEditorChrome =
    (container.textContent?.includes('Event Overview') ?? false) &&
    (container.textContent?.includes('Event Details & Style') ?? false);
  if (!hasEditorChrome) return false;
  if (expectedCouple) {
    return container.textContent?.includes(expectedCouple) ?? false;
  }
  return true;
}

function isEditorErrorVisible(container: ParentNode): boolean {
  return (
    (container.textContent?.includes('Wedding Project Not Found') ?? false) ||
    (container.textContent?.includes('Invalid Project ID') ?? false) ||
    (container.textContent?.includes('Unable to Load Wedding Project') ?? false) ||
    (container.textContent?.includes('No Wedding Project Selected') ?? false) ||
    (container.textContent?.includes('Access Denied') ?? false)
  );
}

function isSpinnerVisible(container: ParentNode): boolean {
  return container.textContent?.includes('Loading wedding configuration...') ?? false;
}

function assertUrlViewInvariant(
  container: ParentNode,
  options?: { expectEditorError?: boolean; expectedCouple?: string }
) {
  const params = new URLSearchParams(window.location.search);
  const resolved = resolveWorkspaceView(params);

  if (resolved === 'calendar') {
    assert.equal(params.has('project'), false, `Calendar URL must not keep project param: ${window.location.href}`);
    assert.equal(isCalendarVisible(container), true, `Expected Calendar visible at ${window.location.href}`);
    assert.equal(isGridVisible(container), false, `Expected Grid hidden at ${window.location.href}`);
    assert.equal(isEditorVisible(container), false, `Expected Editor hidden & cleared at ${window.location.href}`);
    assert.equal(
      findButtonByText(container, 'Event Calendar')?.getAttribute('aria-current'),
      'page',
      'Sidebar Event Calendar must be active'
    );
  } else if (resolved === 'grid') {
    if (params.get('view') === 'grid') {
      assert.equal(params.has('project'), false, `Grid URL must not keep project param: ${window.location.href}`);
    }
    assert.equal(isGridVisible(container), true, `Expected Grid visible at ${window.location.href}`);
    assert.equal(isCalendarVisible(container), false, `Expected Calendar hidden at ${window.location.href}`);
    assert.equal(isEditorVisible(container), false, `Expected Editor hidden & cleared at ${window.location.href}`);
    assert.equal(
      findButtonByText(container, 'Weddings & Events')?.getAttribute('aria-current'),
      'page',
      'Sidebar Weddings & Events must be active'
    );
  } else if (resolved === 'agency_settings') {
    assert.equal(params.has('project'), false, `Settings URL must not keep project param: ${window.location.href}`);
    assert.equal(isAgencySettingsVisible(container), true, `Expected Agency Settings visible at ${window.location.href}`);
    assert.equal(isEditorVisible(container), false, `Expected Editor hidden & cleared at ${window.location.href}`);
    assert.equal(
      findButtonByText(container, 'Agency Branding')?.getAttribute('aria-current'),
      'page',
      'Sidebar Agency Branding must be active'
    );
  } else if (resolved === 'editor') {
    if (options?.expectEditorError) {
      assert.equal(isEditorErrorVisible(container), true, `Expected Editor error UI at ${window.location.href}`);
      assert.equal(isSpinnerVisible(container), false, 'Error state must never stay stuck on spinner');
    } else {
      assert.equal(
        isEditorVisible(container, options?.expectedCouple),
        true,
        `Expected Editor visible${options?.expectedCouple ? ` for ${options.expectedCouple}` : ''} at ${window.location.href}`
      );
    }
    assert.equal(isGridVisible(container), false, `Expected Grid hidden inside Editor at ${window.location.href}`);
    assert.equal(isCalendarVisible(container), false, `Expected Calendar hidden inside Editor at ${window.location.href}`);
  }
}

export interface WorkspaceDomController {
  setMode: (mode: 'normal' | 'fail_project_fetch' | 'fail_all_projects') => void;
  getProjectsListFetchCount: () => number;
  getSingleProjectFetchCount: () => number;
}

export async function runWorkspaceDomSuite(controller: WorkspaceDomController) {
  let root: Root | null = null;

  const mountApp = async (initialPath?: string) => {
    if (initialPath) {
      window.history.replaceState({}, '', initialPath);
    }
    const container = document.getElementById('root')!;
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <BrowserRouter>
          <UserProvider>
            <WorkspaceProvider>
              <Routes>
                <Route path="/workspace" element={<Workspace />} />
              </Routes>
            </WorkspaceProvider>
          </UserProvider>
        </BrowserRouter>
      );
      await flushUi(14);
    });
    return container;
  };

  const unmountApp = async () => {
    if (root) {
      await act(async () => {
        root!.unmount();
        await flushUi(3);
      });
      root = null;
    }
  };

  const VALID_PROJECT_UUID = '1ff1a5bf-a9a3-45f7-a782-ed1bf83acf73';
  const DIRECT_ONLY_PROJECT_UUID = '2aa2b6cf-b0b4-46a8-b893-fe2ca94bdf84';
  const MISSING_PROJECT_UUID = '99999999-9999-4999-8999-999999999999';

  try {
    // =========================================================================
    // Sequence 1: Grid -> Calendar -> Grid
    // =========================================================================
    let container = await mountApp('/workspace?view=grid');
    assert.equal(window.location.pathname + window.location.search, '/workspace?view=grid');
    assertUrlViewInvariant(container);
    const baseFetchCount = controller.getProjectsListFetchCount();
    assert.equal(baseFetchCount, 1, 'Initial project list fetch happens once');

    const calToggleBtn = findButtonByText(container, 'Calendar');
    assert.ok(calToggleBtn, 'Calendar toggle button must exist in Grid view');
    await act(async () => {
      calToggleBtn!.click();
      await flushUi();
    });
    assert.equal(window.location.pathname + window.location.search, '/workspace?view=calendar');
    assertUrlViewInvariant(container);

    const backToGridFromCal = findButtonByText(container, 'Back to Grid View');
    assert.ok(backToGridFromCal, 'Back to Grid View button must exist in Calendar view');
    await act(async () => {
      backToGridFromCal!.click();
      await flushUi();
    });
    assert.equal(window.location.pathname + window.location.search, '/workspace?view=grid');
    assertUrlViewInvariant(container);
    assert.equal(controller.getProjectsListFetchCount(), baseFetchCount, 'Grid <-> Calendar must not refetch projects');
    console.log('✓ Sequence 1 passed: Grid -> Calendar -> Grid');

    // =========================================================================
    // Sequence 2: Grid -> Editor -> Grid (clears project param & stale state)
    // =========================================================================
    const openOverviewBtn = findButtonByText(container, 'Open Event Overview');
    assert.ok(openOverviewBtn, 'Open Event Overview button must exist on Grid card');
    await act(async () => {
      openOverviewBtn!.click();
      await flushUi();
    });
    assert.equal(window.location.pathname + window.location.search, `/workspace?view=editor&project=${VALID_PROJECT_UUID}`);
    assertUrlViewInvariant(container, { expectedCouple: 'Lucas & Sofia' });

    // Switch internal editor tab (must preserve project URL param!)
    const aestheticTab = findButtonByText(container, 'Event Details & Style');
    assert.ok(aestheticTab, 'Editor internal tab Event Details & Style must exist');
    await act(async () => {
      aestheticTab!.click();
      await flushUi();
    });
    assert.equal(window.location.search, `?view=editor&project=${VALID_PROJECT_UUID}`, 'Editor tab switch must preserve project param');

    const overviewTab = findButtonByText(container, 'Event Overview');
    assert.ok(overviewTab);
    await act(async () => {
      overviewTab!.click();
      await flushUi();
    });
    assert.equal(window.location.search, `?view=editor&project=${VALID_PROJECT_UUID}`);

    // Exit from Editor Overview using "Back to Grid View"
    const exitFromOverviewBtn = findButtonByText(container, 'Back to Grid View');
    assert.ok(exitFromOverviewBtn, 'Overview editor tab must display Back to Grid View button');
    await act(async () => {
      exitFromOverviewBtn!.click();
      await flushUi();
    });
    assert.equal(window.location.pathname + window.location.search, '/workspace?view=grid');
    assertUrlViewInvariant(container);
    console.log('✓ Sequence 2 passed: Grid -> Editor -> Grid');

    // =========================================================================
    // Sequence 3: Grid -> Editor -> Calendar
    // =========================================================================
    await act(async () => {
      findButtonByText(container, 'Open Event Overview')!.click();
      await flushUi();
    });
    assert.equal(window.location.search, `?view=editor&project=${VALID_PROJECT_UUID}`);
    assertUrlViewInvariant(container, { expectedCouple: 'Lucas & Sofia' });

    const calSidebarBtn = findButtonByText(container, 'Event Calendar');
    assert.ok(calSidebarBtn);
    await act(async () => {
      calSidebarBtn!.click();
      await flushUi();
    });
    assert.equal(window.location.pathname + window.location.search, '/workspace?view=calendar');
    assertUrlViewInvariant(container);
    console.log('✓ Sequence 3 passed: Grid -> Editor -> Calendar');

    // =========================================================================
    // Sequence 4: Calendar -> Editor -> Calendar
    // =========================================================================
    const calendarEventCard = findButtonByText(container, 'Lucas & Sofia');
    assert.ok(calendarEventCard, 'Calendar must render clickable event card for Lucas & Sofia');
    await act(async () => {
      calendarEventCard!.click();
      await flushUi();
    });
    assert.equal(window.location.pathname + window.location.search, `/workspace?view=editor&project=${VALID_PROJECT_UUID}`);
    assertUrlViewInvariant(container, { expectedCouple: 'Lucas & Sofia' });

    const returnToCalBtn = findButtonByText(container, 'Event Calendar');
    assert.ok(returnToCalBtn);
    await act(async () => {
      returnToCalBtn!.click();
      await flushUi();
    });
    assert.equal(window.location.pathname + window.location.search, '/workspace?view=calendar');
    assertUrlViewInvariant(container);
    console.log('✓ Sequence 4 passed: Calendar -> Editor -> Calendar');

    // =========================================================================
    // Sequence 5: Editor -> Browser Back -> Grid
    // =========================================================================
    await act(async () => {
      findButtonByText(container, 'Weddings & Events')!.click();
      await flushUi();
    });
    assert.equal(window.location.search, '?view=grid');
    assertUrlViewInvariant(container);

    await act(async () => {
      findButtonByText(container, 'Open Event Overview')!.click();
      await flushUi();
    });
    assert.equal(window.location.search, `?view=editor&project=${VALID_PROJECT_UUID}`);
    assertUrlViewInvariant(container, { expectedCouple: 'Lucas & Sofia' });

    await act(async () => {
      window.history.back();
      await flushUi(10);
    });
    assert.equal(window.location.search, '?view=grid', 'Browser Back from Editor must return to ?view=grid');
    assertUrlViewInvariant(container);
    console.log('✓ Sequence 5 passed: Editor -> Browser Back -> Grid');

    // =========================================================================
    // Sequence 6: Editor -> Refresh -> Editor
    // =========================================================================
    await act(async () => {
      findButtonByText(container, 'Open Event Overview')!.click();
      await flushUi();
    });
    assert.equal(window.location.search, `?view=editor&project=${VALID_PROJECT_UUID}`);
    await unmountApp();
    container = await mountApp(); // keeps current URL `/workspace?view=editor&project=...`
    assert.equal(window.location.pathname + window.location.search, `/workspace?view=editor&project=${VALID_PROJECT_UUID}`);
    assertUrlViewInvariant(container, { expectedCouple: 'Lucas & Sofia' });
    console.log('✓ Sequence 6 passed: Editor -> Refresh -> Editor');

    // =========================================================================
    // Sequence 7: Editor -> Grid -> Calendar -> Editor
    // =========================================================================
    await act(async () => {
      findButtonByText(container, 'Back to Grid View')!.click();
      await flushUi();
    });
    assert.equal(window.location.search, '?view=grid');
    assertUrlViewInvariant(container);

    await act(async () => {
      findButtonByText(container, 'Event Calendar')!.click();
      await flushUi();
    });
    assert.equal(window.location.search, '?view=calendar');
    assertUrlViewInvariant(container);

    await act(async () => {
      findButtonByText(container, 'Lucas & Sofia')!.click();
      await flushUi();
    });
    assert.equal(window.location.search, `?view=editor&project=${VALID_PROJECT_UUID}`);
    assertUrlViewInvariant(container, { expectedCouple: 'Lucas & Sofia' });
    console.log('✓ Sequence 7 passed: Editor -> Grid -> Calendar -> Editor');

    // =========================================================================
    // Sequence 8: Open editor directly using a valid project ID (direct API lookup)
    // =========================================================================
    await unmountApp();
    container = await mountApp(`/workspace?view=editor&project=${DIRECT_ONLY_PROJECT_UUID}`);
    assert.equal(window.location.pathname + window.location.search, `/workspace?view=editor&project=${DIRECT_ONLY_PROJECT_UUID}`);
    assertUrlViewInvariant(container, { expectedCouple: 'Mateo & Elena' });
    assert.ok(controller.getSingleProjectFetchCount() >= 1, 'Direct project ID not in grid list fetches /api/projects/:id');
    console.log('✓ Sequence 8 passed: Direct open with valid project ID loads Editor');

    // Also verify invalid view parameter with project param falls back safely to Grid
    await unmountApp();
    container = await mountApp(`/workspace?view=bogus_view&project=${VALID_PROJECT_UUID}`);
    assert.ok(isGridVisible(container), 'Invalid ?view= parameter must fall back to Grid View');
    assert.equal(isEditorVisible(container), false, 'Invalid ?view= must NOT render Editor');
    console.log('✓ Sequence 8b passed: Invalid ?view= falls back cleanly to Grid');

    // =========================================================================
    // Sequence 9: Open editor using an invalid or non-existent project ID
    // =========================================================================
    await unmountApp();
    container = await mountApp('/workspace?view=editor&project=bad%20project%20id!');
    assertUrlViewInvariant(container, { expectEditorError: true });
    assert.ok(container.textContent?.includes('Invalid Project ID'), 'Malformed ID renders Invalid Project ID error');
    await act(async () => {
      findButtonByText(container, 'Back to Grid View')!.click();
      await flushUi();
    });
    assert.equal(window.location.search, '?view=grid');
    assertUrlViewInvariant(container);

    // Non-existent UUID returning 404 from API
    await unmountApp();
    container = await mountApp(`/workspace?view=editor&project=${MISSING_PROJECT_UUID}`);
    assertUrlViewInvariant(container, { expectEditorError: true });
    assert.ok(container.textContent?.includes('Wedding Project Not Found'), '404 ID renders Wedding Project Not Found error');
    await act(async () => {
      findButtonByText(container, 'Back to Grid View')!.click();
      await flushUi();
    });
    assert.equal(window.location.search, '?view=grid');
    assertUrlViewInvariant(container);
    console.log('✓ Sequence 9 passed: Invalid/missing project ID renders clear error & exits to Grid cleanly');

    // =========================================================================
    // Sequence 10: Project loading failure and Retry recovery
    // =========================================================================
    await unmountApp();
    controller.setMode('fail_all_projects');
    container = await mountApp(`/workspace?view=editor&project=${VALID_PROJECT_UUID}`);
    assertUrlViewInvariant(container, { expectEditorError: true });
    const retryBtn = findButtonByText(container, 'Retry');
    assert.ok(retryBtn, 'Failed project load must show Retry button');
    assert.ok(findButtonByText(container, 'Back to Grid View'), 'Failed project load must show Back to Grid View button');

    // Recover API and click Retry
    controller.setMode('normal');
    await act(async () => {
      retryBtn!.click();
      await flushUi(14);
    });
    assert.equal(window.location.pathname + window.location.search, `/workspace?view=editor&project=${VALID_PROJECT_UUID}`);
    assertUrlViewInvariant(container, { expectedCouple: 'Lucas & Sofia' });
    console.log('✓ Sequence 10 passed: Project loading failure shows error + Retry recovers cleanly into Editor');
  } finally {
    await unmountApp();
  }
}
