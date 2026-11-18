import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserProvider } from '../../src/lib/UserContext';
import { WorkspaceProvider, useWorkspace } from '../../src/lib/WorkspaceContext';
import Workspace from '../../src/pages/Workspace';

async function flushUi(ticks = 10) {
  for (let i = 0; i < ticks; i++) {
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

function AgencyContextControls({ onReady }: { onReady: (api: ReturnType<typeof useWorkspace>) => void }) {
  const ctx = useWorkspace();
  onReady(ctx);
  return null;
}

export interface AgencyFrontendScenarioResult {
  requestedAgencyIds: string[];
  clearedStaleKey: boolean;
  renderedText: string;
}

export async function runAgencyFrontendDomScenarios(): Promise<void> {
  let root: Root | null = null;
  let latestCtx: ReturnType<typeof useWorkspace> | null = null;

  const container = document.getElementById('root')!;
  const mount = async (path: string) => {
    window.history.replaceState({}, '', path);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <BrowserRouter>
          <UserProvider>
            <WorkspaceProvider>
              <AgencyContextControls
                onReady={(ctx) => {
                  latestCtx = ctx;
                }}
              />
              <Routes>
                <Route path="/workspace" element={<Workspace />} />
              </Routes>
            </WorkspaceProvider>
          </UserProvider>
        </BrowserRouter>
      );
      await flushUi(14);
    });
  };

  const unmount = async () => {
    if (root) {
      await act(async () => {
        root!.unmount();
        await flushUi(3);
      });
      root = null;
    }
  };

  try {
    // 1. Subdomain mismatch + stale localStorage agency ID must NEVER fetch unauthorized ?agency_id=...
    window.localStorage.setItem('ef_active_agency_usr-1', 'd0e0f0d4-1c7f-4ac2-b92d-2ace37c6b2d1');
    await mount('/workspace?view=grid');

    assert.equal(
      window.localStorage.getItem('ef_active_agency_usr-1'),
      'aaaa1111-1111-4111-8111-111111111111',
      'Stale unauthorized agency_id in localStorage must be overwritten by verified authorized agency'
    );
    assert.ok(
      container.textContent?.includes('Atelier One'),
      'Authorized Agency 1 name should render in sidebar/workspace'
    );
    assert.ok(
      container.textContent?.includes('Alpha & One'),
      'Authorized Agency 1 project must render'
    );
    assert.equal(
      container.textContent?.includes('Secret Other Wedding') ?? false,
      false,
      'Unauthorized agency project must NEVER render'
    );

    // 2. Switching to unauthorized agency ID via selectAgency is blocked client-side
    let switchedUnauthorized = true;
    await act(async () => {
      switchedUnauthorized = latestCtx!.selectAgency('d0e0f0d4-1c7f-4ac2-b92d-2ace37c6b2d1');
      await flushUi(4);
    });
    assert.equal(switchedUnauthorized, false, 'selectAgency must reject unauthorized agency IDs');

    // 3. Switching to a second authorized agency via selectAgency / switcher reloads new agency projects
    const switcher = container.querySelector('#agency-workspace-switcher') as HTMLSelectElement | null;
    assert.ok(switcher, 'Agency switcher dropdown must render when user belongs to multiple agencies');
    assert.equal(switcher!.options.length, 2, 'Agency switcher should list both authorized agencies');

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
      nativeSetter?.call(switcher, 'bbbb2222-2222-4222-8222-222222222222');
      switcher!.dispatchEvent(new window.Event('change', { bubbles: true }));
      await flushUi(12);
    });

    assert.equal(
      latestCtx?.activeAgency?.id,
      'bbbb2222-2222-4222-8222-222222222222',
      'Active agency must switch cleanly to Agency 2'
    );
    assert.ok(
      container.textContent?.includes('Beta & Two'),
      'Workspace must reload and display Agency 2 projects after switching'
    );
    assert.equal(
      container.textContent?.includes('Alpha & One') ?? false,
      false,
      'Previous Agency 1 projects must be cleared after switching to Agency 2'
    );
  } finally {
    await unmount();
  }
}
