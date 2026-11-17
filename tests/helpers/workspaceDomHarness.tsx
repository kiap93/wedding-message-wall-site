import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserProvider } from '../../src/lib/UserContext';
import { WorkspaceProvider } from '../../src/lib/WorkspaceContext';
import Workspace from '../../src/pages/Workspace';
import { resolveWorkspaceView } from '../../src/lib/workspaceNavigation';

async function flushUi(ticks = 6) {
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

function assertUrlViewInvariant(container: ParentNode) {
  const params = new URLSearchParams(window.location.search);
  const resolved = resolveWorkspaceView(params);
  if (resolved === 'calendar') {
    assert.equal(isCalendarVisible(container), true, `Expected Calendar visible at ${window.location.href}`);
    assert.equal(isGridVisible(container), false, `Expected Grid hidden at ${window.location.href}`);
    assert.equal(
      findButtonByText(container, 'Event Calendar')?.getAttribute('aria-current'),
      'page',
      'Sidebar Event Calendar must be active'
    );
  } else if (resolved === 'grid') {
    assert.equal(isGridVisible(container), true, `Expected Grid visible at ${window.location.href}`);
    assert.equal(isCalendarVisible(container), false, `Expected Calendar hidden at ${window.location.href}`);
    assert.equal(
      findButtonByText(container, 'Weddings & Events')?.getAttribute('aria-current'),
      'page',
      'Sidebar Weddings & Events must be active'
    );
  } else if (resolved === 'agency_settings') {
    assert.equal(isAgencySettingsVisible(container), true, `Expected Agency Settings visible at ${window.location.href}`);
    assert.equal(
      findButtonByText(container, 'Agency Branding')?.getAttribute('aria-current'),
      'page',
      'Sidebar Agency Branding must be active'
    );
  }
}

export async function runWorkspaceDomSuite(getFetchCount: () => number) {
  let root: Root | null = null;

  const mountApp = async () => {
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
      await flushUi(12);
    });
    return container;
  };

  const unmountApp = async () => {
    if (root) {
      await act(async () => {
        root!.unmount();
        await flushUi(2);
      });
      root = null;
    }
  };

  try {
    // Case 1: Open Calendar directly via /workspace?view=calendar
    let container = await mountApp();
    assert.equal(window.location.pathname + window.location.search, '/workspace?view=calendar');
    assert.equal(isCalendarVisible(container), true, 'Case 1: Calendar should render on ?view=calendar');
    assert.ok(container.textContent?.includes('Lucas & Sofia'), 'Case 1: Calendar shows event');
    assertUrlViewInvariant(container);
    const initialFetchCount = getFetchCount();
    assert.equal(initialFetchCount, 1, 'Initial project fetch happens once');
    console.log('✓ Case 1 passed: Direct /workspace?view=calendar renders Calendar');

    // Case 2: Click "Back to Grid View" -> URL becomes /workspace?view=grid & Grid visible
    const backToGridBtn = findButtonByText(container, 'Back to Grid View');
    assert.ok(backToGridBtn, 'Back to Grid View button must exist');
    await act(async () => {
      backToGridBtn!.click();
      await flushUi();
    });
    assert.equal(window.location.pathname + window.location.search, '/workspace?view=grid');
    assertUrlViewInvariant(container);
    assert.equal(getFetchCount(), initialFetchCount, 'Switching Calendar -> Grid must not refetch /api/projects');
    console.log('✓ Case 2 passed: Back to Grid View updates URL to /workspace?view=grid and shows Grid');

    // Case 3: Click sidebar "Event Calendar" -> URL becomes /workspace?view=calendar & Calendar reopens
    const sidebarCalendarBtn = findButtonByText(container, 'Event Calendar');
    assert.ok(sidebarCalendarBtn, 'Sidebar Event Calendar button must exist');
    await act(async () => {
      sidebarCalendarBtn!.click();
      await flushUi();
    });
    assert.equal(window.location.pathname + window.location.search, '/workspace?view=calendar');
    assertUrlViewInvariant(container);
    assert.equal(getFetchCount(), initialFetchCount, 'Switching Grid -> Calendar must not refetch /api/projects');
    console.log('✓ Case 3 passed: Sidebar Event Calendar reopens Calendar & updates URL');

    // Case 4: Repeat Calendar -> Grid -> Calendar -> Grid -> Calendar repeatedly
    for (let i = 0; i < 3; i++) {
      const backBtn = findButtonByText(container, 'Back to Grid View');
      assert.ok(backBtn, `Iteration ${i}: Back to Grid View must exist`);
      await act(async () => {
        backBtn!.click();
        await flushUi();
      });
      assert.equal(window.location.search, '?view=grid');
      assertUrlViewInvariant(container);

      const calBtn =
        i % 2 === 0
          ? findButtonByText(container, 'Calendar')
          : findButtonByText(container, 'Event Calendar');
      assert.ok(calBtn, `Iteration ${i}: Calendar button must exist`);
      await act(async () => {
        calBtn!.click();
        await flushUi();
      });
      assert.equal(window.location.search, '?view=calendar');
      assertUrlViewInvariant(container);
    }
    assert.equal(getFetchCount(), initialFetchCount, 'Repeated toggles must not refetch /api/projects');
    console.log('✓ Case 4 passed: Repeated Calendar <-> Grid switching is consistent');

    // Case 5: Simulate page refresh while on /workspace?view=calendar
    await unmountApp();
    assert.equal(window.location.search, '?view=calendar');
    container = await mountApp();
    assert.equal(window.location.pathname + window.location.search, '/workspace?view=calendar');
    assertUrlViewInvariant(container);
    console.log('✓ Case 5 passed: Simulated refresh on ?view=calendar restores Calendar');

    // Case 6: Switch to Grid, then simulate page refresh while on /workspace?view=grid
    const backBtnBeforeRefresh = findButtonByText(container, 'Back to Grid View');
    assert.ok(backBtnBeforeRefresh);
    await act(async () => {
      backBtnBeforeRefresh!.click();
      await flushUi();
    });
    assert.equal(window.location.search, '?view=grid');
    await unmountApp();
    container = await mountApp();
    assert.equal(window.location.pathname + window.location.search, '/workspace?view=grid');
    assertUrlViewInvariant(container);
    console.log('✓ Case 6 passed: Simulated refresh on ?view=grid restores Grid');

    // Case 7: Browser Back and Forward restore matching view & URL
    const gridToCalBtn = findButtonByText(container, 'Event Calendar');
    assert.ok(gridToCalBtn);
    await act(async () => {
      gridToCalBtn!.click();
      await flushUi();
    });
    assert.equal(window.location.search, '?view=calendar');
    assertUrlViewInvariant(container);

    await act(async () => {
      window.history.back();
      await flushUi(8);
    });
    assert.equal(window.location.search, '?view=grid', 'Browser Back must return to ?view=grid');
    assertUrlViewInvariant(container);

    await act(async () => {
      window.history.forward();
      await flushUi(8);
    });
    assert.equal(window.location.search, '?view=calendar', 'Browser Forward must advance to ?view=calendar');
    assertUrlViewInvariant(container);
    console.log('✓ Case 7 passed: Browser Back and Forward synchronize URL and UI');

    // Case 8: Navigate across sidebar tabs (Agency Branding -> Weddings & Events -> Open Event Overview -> Event Calendar)
    const brandingBtn = findButtonByText(container, 'Agency Branding');
    assert.ok(brandingBtn);
    await act(async () => {
      brandingBtn!.click();
      await flushUi();
    });
    assert.equal(window.location.search, '?view=agency_settings');
    assertUrlViewInvariant(container);

    const weddingsSidebarBtn = findButtonByText(container, 'Weddings & Events');
    assert.ok(weddingsSidebarBtn);
    await act(async () => {
      weddingsSidebarBtn!.click();
      await flushUi();
    });
    assert.equal(window.location.search, '?view=grid');
    assertUrlViewInvariant(container);

    const openOverviewBtn = findButtonByText(container, 'Open Event Overview');
    assert.ok(openOverviewBtn);
    await act(async () => {
      openOverviewBtn!.click();
      await flushUi();
    });
    assert.equal(window.location.search, '?view=editor&project=evt-1');

    const calendarFromEditorBtn = findButtonByText(container, 'Event Calendar');
    assert.ok(calendarFromEditorBtn);
    await act(async () => {
      calendarFromEditorBtn!.click();
      await flushUi();
    });
    assert.equal(window.location.search, '?view=calendar');
    assertUrlViewInvariant(container);
    console.log('✓ Case 8 passed: Cross-tab and editor navigation transitions cleanly without reload');

    // Case 9: Month navigation inside Calendar preserves URL & invariant
    const prevMonthBtn = container.querySelector('button svg.lucide-chevron-left')?.closest('button');
    assert.ok(prevMonthBtn, 'Calendar prev month button exists');
    await act(async () => {
      (prevMonthBtn as HTMLButtonElement).click();
      await flushUi();
    });
    assert.equal(window.location.search, '?view=calendar');
    assertUrlViewInvariant(container);
    console.log('✓ Case 9 passed: URL/content invariant holds across all states');
  } finally {
    await unmountApp();
  }
}
