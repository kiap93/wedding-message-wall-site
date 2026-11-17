import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import FloorPlanPreviewWidget from '../../src/components/overview/FloorPlanPreviewWidget';
import { SeatingTable, VenueLayout } from '../../src/types';

export interface MountedFloorPlanPreview {
  container: HTMLElement;
  rerender: (props: {
    layout: VenueLayout | null;
    tables: SeatingTable[];
    initialContainerWidth?: number;
    isLoading?: boolean;
    error?: string | null;
  }) => Promise<void>;
  unmount: () => Promise<void>;
}

export async function mountFloorPlanPreview(props: {
  container: HTMLElement;
  layout: VenueLayout | null;
  tables: SeatingTable[];
  initialContainerWidth?: number;
  isLoading?: boolean;
  error?: string | null;
}): Promise<MountedFloorPlanPreview> {
  const root: Root = createRoot(props.container);

  const renderWith = async (next: {
    layout: VenueLayout | null;
    tables: SeatingTable[];
    initialContainerWidth?: number;
    isLoading?: boolean;
    error?: string | null;
  }) => {
    await act(async () => {
      root.render(
        <FloorPlanPreviewWidget
          layout={next.layout}
          tables={next.tables}
          isLoading={Boolean(next.isLoading)}
          error={next.error}
          initialContainerWidth={next.initialContainerWidth}
          onEditFloorPlan={() => {}}
        />
      );
    });
  };

  await renderWith(props);

  return {
    container: props.container,
    rerender: renderWith,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
    },
  };
}
