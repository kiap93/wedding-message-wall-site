import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from '../../src/App';

async function flushUi(ticks = 6) {
  for (let i = 0; i < ticks; i++) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function isLoadingFallbackVisible(container: HTMLElement): boolean {
  const text = container.textContent || '';
  return (
    text.includes('Loading EventFrame...') ||
    text.includes('Checking authentication...') ||
    text.includes('Syncing workspace...')
  );
}

export async function runAppRouteScenario(
  assertions: (container: HTMLElement) => Promise<void>,
  readyCheck?: (container: HTMLElement) => boolean
) {
  const container = document.getElementById('root')!;
  let root: Root | null = createRoot(container);
  try {
    await act(async () => {
      root!.render(<App />);
      await flushUi(4);
    });
    for (let attempt = 0; attempt < 60; attempt++) {
      const doneLoading = !isLoadingFallbackVisible(container);
      const ready = readyCheck ? readyCheck(container) : doneLoading;
      if (doneLoading && ready) break;
      await act(async () => {
        await flushUi(2);
      });
    }
    await assertions(container);
  } finally {
    if (root) {
      await act(async () => {
        root!.unmount();
        await flushUi(2);
      });
      root = null;
    }
  }
}
