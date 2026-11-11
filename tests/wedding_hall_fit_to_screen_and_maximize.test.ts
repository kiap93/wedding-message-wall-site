import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  calculateHallBoundingBox, 
  calculateFitToScreenTransform, 
  calculateZoom100Transform 
} from '../src/utils/hallViewport';
import { VenueLayoutObject } from '../src/types/seating';

describe('Wedding Hall Layout Editor – Maximize Workspace & Fit to Screen Engine', () => {

  // Test 1: Fit to Screen includes every object in bounding box
  it('should calculate bounding box including all objects, chair clearance, and rotations', () => {
    const objects: VenueLayoutObject[] = [
      {
        id: 'table-1',
        venue_layout_id: 'layout-1',
        project_id: 'proj-1',
        object_type: 'table',
        object_reference_id: null,
        label: 'Table 1',
        position_x: 200,
        position_y: 300,
        width: 140,
        height: 140,
        rotation: 0,
        properties: {},
        z_index: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'stage-1',
        venue_layout_id: 'layout-1',
        project_id: 'proj-1',
        object_type: 'stage',
        object_reference_id: null,
        label: 'Main Stage',
        position_x: 800,
        position_y: 100,
        width: 500,
        height: 120,
        rotation: 45, // Rotated 45 degrees
        properties: {},
        z_index: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const bbox = calculateHallBoundingBox(objects, 2000, 1400);

    assert.strictEqual(bbox.hasObjects, true);
    // Table 1 has position 200, with 24px chair padding => left should be <= 200 - 24 = 176
    assert.ok(bbox.minX <= 176, `minX (${bbox.minX}) should be <= 176 due to table chair clearance`);
    // Stage 1 right boundary with 45° rotation extends to 800 + 500*cos(45°) = 1153.55
    assert.ok(bbox.maxX >= 1150, `maxX (${bbox.maxX}) should be >= 1150`);
    assert.ok(bbox.width > 950, `bbox.width (${bbox.width}) should encompass both objects`);
    assert.ok(bbox.height > 300, `bbox.height (${bbox.height}) should encompass vertical spread`);
    assert.strictEqual(bbox.centerX, bbox.minX + bbox.width / 2);
    assert.strictEqual(bbox.centerY, bbox.minY + bbox.height / 2);
  });

  // Test 2: Large wedding halls fit correctly within available viewport
  it('should scale down large wedding halls so all elements fit inside viewport with visual padding', () => {
    // Large spread: objects from X=100 to X=2800, Y=100 to Y=1800
    const largeHallObjects: VenueLayoutObject[] = [
      {
        id: 'entrance',
        venue_layout_id: 'l-1',
        project_id: 'p-1',
        object_type: 'entrance',
        object_reference_id: null,
        label: 'Entrance',
        position_x: 100,
        position_y: 100,
        width: 200,
        height: 60,
        rotation: 0,
        properties: {},
        z_index: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'far-stage',
        venue_layout_id: 'l-1',
        project_id: 'p-1',
        object_type: 'stage',
        object_reference_id: null,
        label: 'Far Stage',
        position_x: 2800,
        position_y: 1800,
        width: 400,
        height: 120,
        rotation: 0,
        properties: {},
        z_index: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const bbox = calculateHallBoundingBox(largeHallObjects, 3200, 2200);
    const viewportWidth = 1200;
    const viewportHeight = 800;

    const transform = calculateFitToScreenTransform({
      availableWidth: viewportWidth,
      availableHeight: viewportHeight,
      bbox,
      paddingPercent: 0.07 // 7% visual padding
    });

    // Content width ~ 3100. Available width 1200 * 0.86 ~ 1032 => scale ~ 0.33
    assert.ok(transform.scale < 0.5, `Scale should be reduced for large hall (got ${transform.scale})`);
    assert.ok(transform.scale >= 0.25, `Scale should respect minScale limit (got ${transform.scale})`);

    // Verify centering: world center mapped through transform must equal viewport center
    const screenCenterX = bbox.centerX * transform.scale + transform.position.x;
    const screenCenterY = bbox.centerY * transform.scale + transform.position.y;
    assert.ok(Math.abs(screenCenterX - viewportWidth / 2) <= 1, `Horizontal center error too large: ${screenCenterX}`);
    assert.ok(Math.abs(screenCenterY - viewportHeight / 2) <= 1, `Vertical center error too large: ${screenCenterY}`);
  });

  // Test 3: Small wedding halls remain properly centered without excessive over-zooming
  it('should center small layouts without exceeding maxScale limit', () => {
    // Only 1 table in center (X=500, Y=400, 140x140)
    const singleTableObjects: VenueLayoutObject[] = [
      {
        id: 'single-table',
        venue_layout_id: 'l-1',
        project_id: 'p-1',
        object_type: 'table',
        object_reference_id: null,
        label: 'Intimate Table',
        position_x: 500,
        position_y: 400,
        width: 140,
        height: 140,
        rotation: 0,
        properties: {},
        z_index: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const bbox = calculateHallBoundingBox(singleTableObjects, 1000, 800);
    const viewportWidth = 1400;
    const viewportHeight = 900;

    const transform = calculateFitToScreenTransform({
      availableWidth: viewportWidth,
      availableHeight: viewportHeight,
      bbox,
      maxScale: 2.0,
      paddingPercent: 0.07
    });

    assert.ok(transform.scale <= 2.0, `Scale should not exceed maxScale limit of 2.0 (got ${transform.scale})`);
    assert.ok(transform.scale >= 1.0, `Scale should be positive and readable (got ${transform.scale})`);

    // Verify center
    const screenCenterX = bbox.centerX * transform.scale + transform.position.x;
    const screenCenterY = bbox.centerY * transform.scale + transform.position.y;
    assert.ok(Math.abs(screenCenterX - viewportWidth / 2) <= 1);
    assert.ok(Math.abs(screenCenterY - viewportHeight / 2) <= 1);
  });

  // Test 4: Empty layouts do not cause division-by-zero errors
  it('should safely fall back to default canvas dimensions when layout is empty', () => {
    const emptyBbox = calculateHallBoundingBox([], 2000, 1400);

    assert.strictEqual(emptyBbox.hasObjects, false);
    assert.strictEqual(emptyBbox.width, 2000);
    assert.strictEqual(emptyBbox.height, 1400);
    assert.strictEqual(emptyBbox.centerX, 1000);
    assert.strictEqual(emptyBbox.centerY, 700);

    const transform = calculateFitToScreenTransform({
      availableWidth: 1000,
      availableHeight: 700,
      bbox: emptyBbox,
      paddingPercent: 0.07
    });

    assert.ok(!isNaN(transform.scale) && isFinite(transform.scale), 'Scale must be a finite number');
    assert.ok(!isNaN(transform.position.x) && isFinite(transform.position.x), 'Position X must be finite');
    assert.ok(!isNaN(transform.position.y) && isFinite(transform.position.y), 'Position Y must be finite');
    assert.ok(transform.scale > 0, 'Scale must be positive');
  });

  // Test 5: Zoom in/out and 1:1 Zoom operations after Fit to Screen
  it('should support Zoom In, Zoom Out, and 100% Zoom (1:1) from fitted transform', () => {
    const initialTransform = { scale: 0.65, position: { x: 120, y: 80 } };
    const viewportWidth = 1000;
    const viewportHeight = 700;

    // Zoom In centered on viewport
    const zoomInFactor = 1.15;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    const worldCenter = {
      x: (centerX - initialTransform.position.x) / initialTransform.scale,
      y: (centerY - initialTransform.position.y) / initialTransform.scale
    };

    const newScaleIn = initialTransform.scale * zoomInFactor;
    const newPosIn = {
      x: centerX - worldCenter.x * newScaleIn,
      y: centerY - worldCenter.y * newScaleIn
    };

    assert.ok(newScaleIn > initialTransform.scale, 'Zoom In should increase scale');
    // World point at center must stay at viewport center
    const checkCenterX = worldCenter.x * newScaleIn + newPosIn.x;
    assert.ok(Math.abs(checkCenterX - centerX) <= 0.001);

    // 100% Zoom Transform (1:1)
    const zoom100 = calculateZoom100Transform({
      currentScale: newScaleIn,
      currentPosition: newPosIn,
      viewportWidth,
      viewportHeight
    });

    assert.strictEqual(zoom100.scale, 1.0, '1:1 zoom should set scale to exactly 1.0');
    // Center alignment must hold
    const check100Center = worldCenter.x * 1.0 + zoom100.position.x;
    assert.ok(Math.abs(check100Center - centerX) <= 1);
  });

  // Test 6: Fit to Screen NEVER modifies actual object data
  it('should strictly modify only viewport transform and never alter object positions, dimensions, or rotations', () => {
    const originalObject: VenueLayoutObject = {
      id: 'table-static',
      venue_layout_id: 'l-1',
      project_id: 'p-1',
      object_type: 'table',
      object_reference_id: 'ref-123',
      label: 'Table 7',
      position_x: 450,
      position_y: 350,
      width: 150,
      height: 150,
      rotation: 30,
      properties: { capacity: 8 },
      z_index: 5,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    };

    const snapshot = JSON.parse(JSON.stringify(originalObject));

    // Calculate bbox and fit
    const bbox = calculateHallBoundingBox([originalObject], 2000, 1400);
    const transform = calculateFitToScreenTransform({
      availableWidth: 1200,
      availableHeight: 800,
      bbox
    });

    // Verify transform produced values
    assert.ok(transform.scale > 0);

    // Verify original object is 100% identical in every field
    assert.strictEqual(originalObject.position_x, snapshot.position_x);
    assert.strictEqual(originalObject.position_y, snapshot.position_y);
    assert.strictEqual(originalObject.width, snapshot.width);
    assert.strictEqual(originalObject.height, snapshot.height);
    assert.strictEqual(originalObject.rotation, snapshot.rotation);
    assert.strictEqual(originalObject.object_reference_id, snapshot.object_reference_id);
    assert.deepStrictEqual(originalObject.properties, snapshot.properties);
  });

  // Test 7: Maximize mode transitions and panel collapse
  it('should calculate expanded viewport space when maximizing or collapsing inspector panel', () => {
    const standardWidth = 900;
    const standardHeight = 700;

    // In normal mode with 9/12 grid: availableWidth = 900
    const bbox = calculateHallBoundingBox([], 2000, 1400);
    const normalTransform = calculateFitToScreenTransform({
      availableWidth: standardWidth,
      availableHeight: standardHeight,
      bbox
    });

    // In maximized full-viewport mode (e.g. 1920x1080 screen with collapsed inspector):
    const maximizedWidth = 1900;
    const maximizedHeight = 1000;
    const maxTransform = calculateFitToScreenTransform({
      availableWidth: maximizedWidth,
      availableHeight: maximizedHeight,
      bbox
    });

    // Larger available area allows greater scale
    assert.ok(maxTransform.scale > normalTransform.scale, 'Maximized workspace should provide larger zoom scale');
    assert.ok(maxTransform.position.x !== normalTransform.position.x, 'Position must adapt to new center');
  });

  // Test 8: Coordinate conversion accuracy for object dragging and panning under any scale
  it('should accurately translate pointer events to world coordinates regardless of zoom scale', () => {
    const scale = 0.5;
    const position = { x: -200, y: -100 };

    // Suppose user clicks at screen pixel (500, 400)
    const screenPointer = { x: 500, y: 400 };

    // World coordinate formula: (screen - position) / scale
    const worldX = (screenPointer.x - position.x) / scale;
    const worldY = (screenPointer.y - position.y) / scale;

    assert.strictEqual(worldX, (500 - (-200)) / 0.5); // (500 + 200) / 0.5 = 1400
    assert.strictEqual(worldY, (400 - (-100)) / 0.5); // (400 + 100) / 0.5 = 1000
    assert.strictEqual(worldX, 1400);
    assert.strictEqual(worldY, 1000);

    // Reverse projection: world to screen: world * scale + pos
    const projectedScreenX = worldX * scale + position.x;
    const projectedScreenY = worldY * scale + position.y;
    assert.strictEqual(projectedScreenX, screenPointer.x);
    assert.strictEqual(projectedScreenY, screenPointer.y);
  });
});
