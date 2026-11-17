import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer, ViteDevServer } from 'vite';
import { act } from 'react';
import {
  computeResponsiveFloorPlanStageSize,
  computeUniformFloorPlanTransform,
  projectFloorPlanPreview,
  projectObjectWithUniformScale,
} from '../src/lib/eventOverview';
import { SeatingTable, VenueLayout, VenueLayoutObject } from '../src/types';

function makeObject(partial: Partial<VenueLayoutObject> & Pick<VenueLayoutObject, 'id' | 'object_type'>): VenueLayoutObject {
  return {
    venue_layout_id: 'lay-test',
    project_id: 'evt-test',
    position_x: 0,
    position_y: 0,
    width: 2,
    height: 2,
    rotation: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...partial,
  };
}

function makeLayout(params: {
  width: number;
  height: number;
  unit?: 'm' | 'ft';
  venueName?: string;
  objects: VenueLayoutObject[];
}): VenueLayout {
  return {
    id: 'lay-test',
    project_id: 'evt-test',
    layout_name: params.venueName || 'Main Ballroom & Reception Hall',
    venue_name: params.venueName || 'Main Ballroom & Reception Hall',
    venue_width: params.width,
    venue_height: params.height,
    venue_unit: params.unit || 'm',
    coordinate_system: 'world',
    canvas_width: Math.round(params.width * 60),
    canvas_height: Math.round(params.height * 60),
    grid_size: 30,
    snap_to_grid: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    objects: params.objects,
  };
}

function makeTables(): SeatingTable[] {
  return [
    {
      id: 't-round-1',
      project_id: 'evt-test',
      table_name: 'Peony',
      table_number: '1',
      table_type: 'round',
      capacity: 10,
      assigned_count: 6,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 't-rect-2',
      project_id: 'evt-test',
      table_name: 'Banquet',
      table_number: '2',
      table_type: 'rectangular',
      capacity: 8,
      assigned_count: 8,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 't-sq-3',
      project_id: 'evt-test',
      table_name: 'Intimate',
      table_number: '3',
      table_type: 'square',
      capacity: 4,
      assigned_count: 2,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ];
}

function assertClose(actual: number, expected: number, epsilon = 0.05, msg?: string) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${msg || 'Expected values to be close'}: actual=${actual}, expected=${expected}`
  );
}

function runMathTests() {
  console.log('Running uniform scaling mathematical invariants...');

  const hallDimensions = [
    { name: '23x12m', w: 23, h: 12 },
    { name: '12x20m portrait', w: 12, h: 20 },
    { name: '30x15m large', w: 30, h: 15 },
    { name: '10x40m narrow', w: 10, h: 40 },
  ];

  for (const dim of hallDimensions) {
    for (const containerW of [320, 580, 920]) {
      const stage = computeResponsiveFloorPlanStageSize(containerW, dim.w, dim.h);
      const transform = computeUniformFloorPlanTransform({
        containerWidth: stage.width,
        containerHeight: stage.height,
        hallWidth: dim.w,
        hallHeight: dim.h,
      });

      assert.equal(transform.scaleX, transform.scaleY, `${dim.name} @ ${containerW}: scaleX must equal scaleY`);
      assertClose(
        transform.renderedWidth / transform.renderedHeight,
        dim.w / dim.h,
        0.0001,
        `${dim.name} @ ${containerW}: rendered hall aspect ratio must match world ratio`
      );

      // Verify centered inside padded area
      const innerW = transform.containerWidth - transform.padding.left - transform.padding.right;
      const innerH = transform.containerHeight - transform.padding.top - transform.padding.bottom;
      assertClose(
        transform.offsetX,
        transform.padding.left + (innerW - transform.renderedWidth) / 2,
        0.001
      );
      assertClose(
        transform.offsetY,
        transform.padding.top + (innerH - transform.renderedHeight) / 2,
        0.001
      );
    }
  }

  console.log('✓ Uniform scaling math verified across all aspect ratios & widths');
}

type ResizeObserverCallbackEntry = {
  target: Element;
  callback: ResizeObserverCallback;
};

function setupDomEnvironment() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://eventframe.io/workspace',
  });

  const win = dom.window;
  const observerEntries: ResizeObserverCallbackEntry[] = [];

  class MockResizeObserver {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      observerEntries.push({ target, callback: this.cb });
    }
    unobserve() {}
    disconnect() {}
  }

  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).window = win;
  (globalThis as any).document = win.document;
  (globalThis as any).HTMLElement = win.HTMLElement;
  (globalThis as any).SVGElement = win.SVGElement;
  (globalThis as any).Element = win.Element;
  (globalThis as any).Node = win.Node;
  (globalThis as any).Event = win.Event;
  (globalThis as any).ResizeObserver = MockResizeObserver;

  return {
    dom,
    triggerResize: async (width: number) => {
      await act(async () => {
        for (const entry of observerEntries) {
          entry.callback(
            [
              {
                target: entry.target,
                contentRect: { width, height: 300 } as DOMRectReadOnly,
              } as ResizeObserverEntry,
            ],
            {} as ResizeObserver
          );
        }
      });
    },
  };
}

function getSvgMetrics(container: HTMLElement) {
  const svg = container.querySelector('[data-testid="floor-plan-preview-svg"]') as SVGSVGElement | null;
  assert.ok(svg, 'Expected floor-plan-preview-svg to render');
  assert.equal(svg.getAttribute('preserveAspectRatio'), 'xMidYMid meet', 'preserveAspectRatio must be xMidYMid meet');
  assert.notEqual(svg.getAttribute('preserveAspectRatio'), 'none', 'preserveAspectRatio must never be none');

  const boundary = svg.querySelector('[data-testid="floor-plan-hall-boundary"]') as SVGRectElement | null;
  assert.ok(boundary, 'Expected floor-plan-hall-boundary rect');

  return {
    svg,
    svgWidth: Number(svg.getAttribute('width')),
    svgHeight: Number(svg.getAttribute('height')),
    scale: Number(svg.getAttribute('data-scale')),
    boundaryX: Number(boundary.getAttribute('x')),
    boundaryY: Number(boundary.getAttribute('y')),
    boundaryW: Number(boundary.getAttribute('width')),
    boundaryH: Number(boundary.getAttribute('height')),
  };
}

function assertRoundTableIsExactCircle(container: HTMLElement, objectId: string, expectedScale: number, expectedWorldDiam: number) {
  const group = container.querySelector(`[data-object-id="${objectId}"]`);
  assert.ok(group, `Expected group for round table ${objectId}`);
  const circles = Array.from(group.querySelectorAll('circle'));
  assert.ok(circles.length >= 1, `Expected <circle> elements inside round table ${objectId}`);
  const ellipses = group.querySelectorAll('ellipse');
  assert.equal(ellipses.length, 0, `Round table ${objectId} must never render as <ellipse>`);

  // The main table circle is the largest circle (chairs are smaller)
  const tableCircle = circles.reduce((best, cur) =>
    Number(cur.getAttribute('r')) > Number(best.getAttribute('r')) ? cur : best
  );
  const r = Number(tableCircle.getAttribute('r'));
  const expectedR = (expectedWorldDiam * expectedScale) / 2;
  assertClose(r, expectedR, 0.15, `Round table ${objectId} radius must match world diameter * uniform scale / 2`);

  // Verify bounding symmetry via circle element: cx/cy + equal radius guarantees 1:1 width === height
  assert.ok(Number.isFinite(Number(tableCircle.getAttribute('cx'))));
  assert.ok(Number.isFinite(Number(tableCircle.getAttribute('cy'))));
}

async function runDomTests() {
  console.log('Running FloorPlanPreviewWidget DOM & integration tests across 8 scenarios...');
  const { dom, triggerResize } = setupDomEnvironment();
  const vite: ViteDevServer = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });

  try {
    const harness = (await vite.ssrLoadModule('/tests/helpers/floorPlanPreviewHarness.tsx')) as {
      mountFloorPlanPreview: (props: any) => Promise<any>;
    };
    const rootEl = dom.window.document.getElementById('root')!;
    const tables = makeTables();

    // Scenario 1: 23 x 12 m hall with circular tables (screenshot case)
    const layout23x12 = makeLayout({
      width: 23,
      height: 12,
      objects: [
        makeObject({ id: 'stage-1', object_type: 'stage', label: 'Main Stage', position_x: 7.5, position_y: 0.6, width: 8, height: 2.2 }),
        makeObject({ id: 'obj-t1', object_type: 'table', object_reference_id: 't-round-1', position_x: 4, position_y: 5, width: 1.8, height: 1.8 }),
        makeObject({ id: 'obj-t1b', object_type: 'table', position_x: 10, position_y: 5, width: 2.0, height: 2.0, properties: { tableShape: 'round', tableNumber: '4', capacity: 10 } }),
      ],
    });
    const originalSnapshot = JSON.stringify(layout23x12);

    const mounted = await harness.mountFloorPlanPreview({
      container: rootEl,
      layout: layout23x12,
      tables,
      initialContainerWidth: 580,
    });

    let metrics = getSvgMetrics(rootEl);
    assertClose(metrics.boundaryW / metrics.boundaryH, 23 / 12, 0.005, 'Scenario 1 (23x12): aspect ratio mismatch');
    assertRoundTableIsExactCircle(rootEl, 'obj-t1', metrics.scale, 1.8);
    assertRoundTableIsExactCircle(rootEl, 'obj-t1b', metrics.scale, 2.0);
    assert.equal(JSON.stringify(layout23x12), originalSnapshot, 'Must not mutate original saved layout data');
    console.log('✓ Scenario 1: 23 × 12 m hall circular tables verified');

    // Scenario 2: 12 x 20 m portrait hall
    const layout12x20 = makeLayout({
      width: 12,
      height: 20,
      objects: [
        makeObject({ id: 'stage-p', object_type: 'stage', label: 'Stage', position_x: 2, position_y: 1, width: 8, height: 2.5 }),
        makeObject({ id: 'obj-t1', object_type: 'table', object_reference_id: 't-round-1', position_x: 5, position_y: 8, width: 1.8, height: 1.8 }),
      ],
    });
    await mounted.rerender({ layout: layout12x20, tables, initialContainerWidth: 580 });
    metrics = getSvgMetrics(rootEl);
    assertClose(metrics.boundaryW / metrics.boundaryH, 12 / 20, 0.005, 'Scenario 2 (12x20 portrait): aspect ratio mismatch');
    assert.ok(metrics.boundaryH > metrics.boundaryW, 'Portrait hall must render taller than wide');
    assertRoundTableIsExactCircle(rootEl, 'obj-t1', metrics.scale, 1.8);
    console.log('✓ Scenario 2: 12 × 20 m portrait hall verified');

    // Scenario 3: 30 x 15 m large hall
    const layout30x15 = makeLayout({
      width: 30,
      height: 15,
      objects: [
        makeObject({ id: 'obj-t1', object_type: 'table', object_reference_id: 't-round-1', position_x: 12, position_y: 6, width: 2.2, height: 2.2 }),
      ],
    });
    await mounted.rerender({ layout: layout30x15, tables, initialContainerWidth: 580 });
    metrics = getSvgMetrics(rootEl);
    assertClose(metrics.boundaryW / metrics.boundaryH, 30 / 15, 0.005, 'Scenario 3 (30x15): aspect ratio mismatch');
    assertRoundTableIsExactCircle(rootEl, 'obj-t1', metrics.scale, 2.2);
    console.log('✓ Scenario 3: 30 × 15 m large hall verified');

    // Scenario 4: 10 x 40 m narrow hall (centered without clipping or distortion)
    const layout10x40 = makeLayout({
      width: 10,
      height: 40,
      objects: [
        makeObject({ id: 'obj-t1', object_type: 'table', object_reference_id: 't-round-1', position_x: 4, position_y: 18, width: 1.8, height: 1.8 }),
      ],
    });
    await mounted.rerender({ layout: layout10x40, tables, initialContainerWidth: 580 });
    metrics = getSvgMetrics(rootEl);
    assertClose(metrics.boundaryW / metrics.boundaryH, 10 / 40, 0.005, 'Scenario 4 (10x40 narrow): aspect ratio mismatch');
    assert.ok(metrics.boundaryX > 150, 'Narrow 10x40 hall should be centered horizontally inside container');
    assertRoundTableIsExactCircle(rootEl, 'obj-t1', metrics.scale, 1.8);
    console.log('✓ Scenario 4: 10 × 40 m narrow hall verified');

    // Scenario 5: Hall with rotated rectangular tables (top-left pivot matching WeddingHallPlanner)
    const layoutRotated = makeLayout({
      width: 24,
      height: 14,
      objects: [
        makeObject({
          id: 'obj-rect-rot',
          object_type: 'table',
          object_reference_id: 't-rect-2',
          position_x: 8,
          position_y: 5,
          width: 3.0,
          height: 1.2,
          rotation: 45,
        }),
      ],
    });
    await mounted.rerender({ layout: layoutRotated, tables, initialContainerWidth: 580 });
    metrics = getSvgMetrics(rootEl);
    const rotGroup = rootEl.querySelector('[data-object-id="obj-rect-rot"]') as SVGGElement | null;
    assert.ok(rotGroup, 'Expected rotated rectangular table group');
    const rotRect = rotGroup.querySelector('rect')!;
    const rectW = Number(rotRect.getAttribute('width'));
    const rectH = Number(rotRect.getAttribute('height'));
    assertClose(rectW / rectH, 3.0 / 1.2, 0.01, 'Rotated rectangular table must preserve exact 3.0:1.2 width/height ratio');
    const expectedPivotX = metrics.boundaryX + 8 * metrics.scale;
    const expectedPivotY = metrics.boundaryY + 5 * metrics.scale;
    const transformAttr = rotGroup.getAttribute('transform') || '';
    assert.ok(
      transformAttr.startsWith('rotate(45 '),
      `Expected rotate(45 ...) transform, got ${transformAttr}`
    );
    const [, pxStr, pyStr] = transformAttr.replace('rotate(', '').replace(')', '').split(' ');
    assertClose(Number(pxStr), expectedPivotX, 0.05, 'Rotation pivot X must match WeddingHallPlanner top-left pivot');
    assertClose(Number(pyStr), expectedPivotY, 0.05, 'Rotation pivot Y must match WeddingHallPlanner top-left pivot');
    console.log('✓ Scenario 5: Rotated rectangular table proportions & Konva-aligned pivot verified');

    // Scenario 6: Hall with all distinct object types + live object addition/removal
    const allTypeObjects: VenueLayoutObject[] = [
      makeObject({ id: 'el-stage', object_type: 'stage', position_x: 9, position_y: 0.8, width: 8, height: 2.8 }),
      makeObject({ id: 'el-dance', object_type: 'dance_floor', position_x: 10, position_y: 5, width: 6, height: 5 }),
      makeObject({ id: 'el-couple', object_type: 'couple_table', position_x: 11, position_y: 3.8, width: 3.8, height: 1.4 }),
      makeObject({ id: 'el-buffet', object_type: 'buffet', position_x: 1, position_y: 4, width: 5, height: 1.5 }),
      makeObject({ id: 'el-bar', object_type: 'bar', position_x: 1, position_y: 8, width: 3.2, height: 1.2 }),
      makeObject({ id: 'el-entrance', object_type: 'entrance', position_x: 11, position_y: 16.5, width: 4.5, height: 1.2 }),
      makeObject({ id: 'el-photo', object_type: 'photo_booth', position_x: 22, position_y: 3, width: 2.5, height: 2.5 }),
      makeObject({ id: 'el-reg', object_type: 'registration', position_x: 20, position_y: 16, width: 3.0, height: 1.2 }),
      makeObject({ id: 'el-pillar', object_type: 'pillar', position_x: 6, position_y: 10, width: 0.8, height: 0.8 }),
      makeObject({ id: 'el-wall', object_type: 'wall', position_x: 18, position_y: 10, width: 5, height: 0.3 }),
      makeObject({ id: 'el-decor', object_type: 'decor', position_x: 22, position_y: 8, width: 2, height: 2 }),
      makeObject({ id: 'el-label', object_type: 'label', label: 'VIP Wing', position_x: 2, position_y: 13, width: 3.5, height: 1 }),
      makeObject({ id: 'el-t-round', object_type: 'table', object_reference_id: 't-round-1', position_x: 4, position_y: 7, width: 1.8, height: 1.8 }),
      makeObject({ id: 'el-t-sq', object_type: 'table', object_reference_id: 't-sq-3', position_x: 8, position_y: 12, width: 1.8, height: 1.8 }),
    ];
    const layoutAllTypes = makeLayout({ width: 26, height: 18, objects: allTypeObjects });
    await mounted.rerender({ layout: layoutAllTypes, tables, initialContainerWidth: 640 });
    metrics = getSvgMetrics(rootEl);

    for (const o of allTypeObjects) {
      const node = rootEl.querySelector(`[data-object-id="${o.id}"]`);
      assert.ok(node, `Expected rendered element for ${o.object_type} (${o.id})`);
    }
    assertRoundTableIsExactCircle(rootEl, 'el-t-round', metrics.scale, 1.8);
    // Square table preserves 1:1 width === height
    const sqRect = rootEl.querySelector('[data-object-id="el-t-sq"] rect')!;
    assertClose(Number(sqRect.getAttribute('width')), Number(sqRect.getAttribute('height')), 0.05, 'Square table must stay 1:1');

    // Live reflection: delete an object & update hall dimension to 28x14
    const updatedLayout = makeLayout({
      width: 28,
      height: 14,
      objects: allTypeObjects.filter((o) => o.id !== 'el-decor'),
    });
    await mounted.rerender({ layout: updatedLayout, tables, initialContainerWidth: 640 });
    metrics = getSvgMetrics(rootEl);
    assert.equal(rootEl.querySelector('[data-object-id="el-decor"]'), null, 'Deleted object must disappear immediately');
    assertClose(metrics.boundaryW / metrics.boundaryH, 28 / 14, 0.005, 'Updated hall dimensions must reflect immediately');
    console.log('✓ Scenario 6: All 13 venue object types & live add/delete/dimension sync verified');

    // Scenario 7: Browser window / container resize updates scale uniformly
    await mounted.rerender({ layout: layout23x12, tables, initialContainerWidth: 640 });
    const beforeResize = getSvgMetrics(rootEl);
    await triggerResize(900);
    const afterResize = getSvgMetrics(rootEl);
    assert.ok(afterResize.scale > beforeResize.scale, 'Expanding container width via ResizeObserver must increase scale');
    assertClose(afterResize.boundaryW / afterResize.boundaryH, 23 / 12, 0.005, 'Resized landscape hall must maintain aspect ratio');
    assertRoundTableIsExactCircle(rootEl, 'obj-t1', afterResize.scale, 1.8);
    console.log('✓ Scenario 7: ResizeObserver dynamic resize keeps uniform scale & 1:1 circles');

    // Scenario 8: Mobile responsive layout (~320px width)
    await mounted.rerender({ layout: layout23x12, tables, initialContainerWidth: 320 });
    const mobileMetrics = getSvgMetrics(rootEl);
    assert.ok(mobileMetrics.svgWidth <= 320, 'Mobile SVG width must fit mobile viewport');
    assertClose(mobileMetrics.boundaryW / mobileMetrics.boundaryH, 23 / 12, 0.01, 'Mobile layout must preserve hall aspect ratio');
    assertRoundTableIsExactCircle(rootEl, 'obj-t1', mobileMetrics.scale, 1.8);

    // Also verify portrait hall at 320px mobile width
    await mounted.rerender({ layout: layout12x20, tables, initialContainerWidth: 320 });
    const mobilePortrait = getSvgMetrics(rootEl);
    assertClose(mobilePortrait.boundaryW / mobilePortrait.boundaryH, 12 / 20, 0.01, 'Mobile portrait hall must preserve aspect ratio');
    assertRoundTableIsExactCircle(rootEl, 'obj-t1', mobilePortrait.scale, 1.8);
    console.log('✓ Scenario 8: Mobile responsive landscape & portrait layouts verified');

    // Bonus: Check `projectObjectWithUniformScale` directly matches Planner Konva scale proportions
    const previewModel = projectFloorPlanPreview(layout23x12, tables);
    const tObj = previewModel.objects.find((o) => o.id === 'obj-t1')!;
    const uTransform = computeUniformFloorPlanTransform({
      containerWidth: 580,
      containerHeight: 330,
      hallWidth: 23,
      hallHeight: 12,
    });
    const screenObj = projectObjectWithUniformScale(tObj, uTransform, 'm');
    assertClose(screenObj.width, screenObj.height, 0.0001);
    assertClose(screenObj.circleDiameter, 1.8 * uTransform.scale, 0.0001);

    await mounted.unmount();
    console.log('All Floor Plan Overview tests passed!');
  } finally {
    await vite.close();
  }
}

async function main() {
  runMathTests();
  await runDomTests();
}

main().catch((err) => {
  console.error('Floor plan overview test failure:', err);
  process.exit(1);
});
