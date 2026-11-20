import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { UserProvider, useUser } from '../../src/lib/UserContext';
import { WorkspaceProvider, useWorkspace } from '../../src/lib/WorkspaceContext';

function AuthSnapshotProbe({ onActionReady }: { onActionReady?: (actions: { logout: () => Promise<void>; establishSession: (u: any, t?: string | null, c?: string | null) => void; refreshUser: () => Promise<any | null> }) => void }) {
  const { user, isLoading, isSessionVerified, logout, establishSession, refreshUser } = useUser();
  const { authorizedAgencies, activeAgency, isLoadingAuthorizedAgencies } = useWorkspace();

  React.useEffect(() => {
    onActionReady?.({ logout, establishSession, refreshUser });
  }, [logout, establishSession, refreshUser, onActionReady]);

  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="verified">{String(isSessionVerified)}</div>
      <div data-testid="user-email">{user?.email || 'NONE'}</div>
      <div data-testid="user-id">{user?.id || 'NONE'}</div>
      <div data-testid="agencies-loading">{String(isLoadingAuthorizedAgencies)}</div>
      <div data-testid="active-agency">{activeAgency?.name || 'NONE'}</div>
      <div data-testid="agency-ids">{authorizedAgencies.map((a) => a.id).join(',') || 'NONE'}</div>
    </div>
  );
}

export async function flushUi(ticks = 6, delayMs = 20) {
  for (let i = 0; i < ticks; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

export async function mountAuthProbe(
  onReady?: (actions: { logout: () => Promise<void>; establishSession: (u: any, t?: string | null, c?: string | null) => void; refreshUser: () => Promise<any | null> }) => void,
  onRenderSnapshot?: (snapshot: { loading: string; userEmail: string; activeAgency: string }) => void
) {
  const container = document.getElementById('root')!;
  const root: Root = createRoot(container);

  const readSnapshot = () => ({
    loading: container.querySelector('[data-testid="loading"]')?.textContent || '',
    userEmail: container.querySelector('[data-testid="user-email"]')?.textContent || '',
    activeAgency: container.querySelector('[data-testid="active-agency"]')?.textContent || '',
  });

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/workspace']}>
        <UserProvider>
          <WorkspaceProvider>
            <AuthSnapshotProbe onActionReady={onReady} />
          </WorkspaceProvider>
        </UserProvider>
      </MemoryRouter>
    );
    await new Promise((r) => setTimeout(r, 5));
  });

  onRenderSnapshot?.(readSnapshot());

  return {
    container,
    readSnapshot,
    waitUntilSettled: async () => {
      for (let i = 0; i < 60; i++) {
        const loading = container.querySelector('[data-testid="loading"]')?.textContent;
        const verified = container.querySelector('[data-testid="verified"]')?.textContent;
        const agenciesLoading = container.querySelector('[data-testid="agencies-loading"]')?.textContent;
        const userEmail = container.querySelector('[data-testid="user-email"]')?.textContent;
        if (loading === 'false' && verified === 'true' && (userEmail === 'NONE' || agenciesLoading === 'false')) {
          break;
        }
        await act(async () => {
          await flushUi(1, 15);
        });
      }
      return readSnapshot();
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
        await flushUi(2, 10);
      });
    },
  };
}
