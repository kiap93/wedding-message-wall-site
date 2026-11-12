import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  getVenueLayout, 
  saveVenueLayout, 
  createTable, 
  getEventTables, 
  createGuest, 
  assignGuestToTable 
} from '../server/guestSeatingService';
import { 
  VenueUnit,
  getPixelsPerUnit,
  worldToScreen,
  screenToWorld,
  roundToDecimals,
  formatVenueArea,
  convertUnitValue,
  isLegacyLayout,
  migrateVenueLayout,
  getOutOfBoundsObjects,
  repositionObjectsInsideVenue,
  VENUE_PRESETS,
  PIXELS_PER_METER,
  PIXELS_PER_FOOT
} from '../src/utils/venueCoordinates';
import { 
  calculateHallBoundingBox, 
  calculateFitToScreenTransform 
} from '../src/utils/hallViewport';
import { VenueLayout, VenueLayoutObject } from '../src/types/seating';

describe('EventFrame Wedding Hall Layout Editor – Custom Venue Dimensions & Dynamic Canvas Engine', () => {

  // Test 1: Preset & Dimensions - 30m x 20m Landscape Venue
  it('Scenario 1: should create a 30m × 20m landscape venue with correct area and screen scale', () => {
    const venue = {
      width: 30,
      height: 20,
      unit: 'm' as VenueUnit,
      orientation: 'landscape'
    };
    const areaStr = formatVenueArea(venue.width, venue.height, venue.unit);
    assert.strictEqual(areaStr, '600 m²', 'Area should be exactly 600 m²');

    const px = getPixelsPerUnit(venue.unit);
    assert.strictEqual(px, 60, '60 screen pixels per meter');
    const screenW = worldToScreen(venue.width, venue.unit);
    const screenH = worldToScreen(venue.height, venue.unit);
    assert.strictEqual(screenW, 1800, '30m renders at 1800 screen pixels');
    assert.strictEqual(screenH, 1200, '20m renders at 1200 screen pixels');
  });

  // Test 2: 20m x 30m Portrait Venue
  it('Scenario 2: should create a 20m × 30m portrait venue preserving vertical orientation', () => {
    const venue = {
      width: 20,
      height: 30,
      unit: 'm' as VenueUnit,
      orientation: 'portrait'
    };
    const screenW = worldToScreen(venue.width, venue.unit);
    const screenH = worldToScreen(venue.height, venue.unit);
    assert.strictEqual(screenW, 1200);
    assert.strictEqual(screenH, 1800);
    assert.ok(screenH > screenW, 'Portrait venue height must exceed width');
  });

  // Test 3: 35m x 12m Long Reception Hall
  it('Scenario 3: should create a 35m × 12m long elongated reception hall', () => {
    const preset = VENUE_PRESETS.find(p => p.id === 'long');
    assert.ok(preset, 'Long Reception Hall preset exists');
    assert.strictEqual(preset.widthM, 35);
    assert.strictEqual(preset.heightM, 12);

    const screenW = worldToScreen(preset.widthM, 'm');
    const screenH = worldToScreen(preset.heightM, 'm');
    assert.strictEqual(screenW, 2100);
    assert.strictEqual(screenH, 720);
    assert.strictEqual(formatVenueArea(preset.widthM, preset.heightM, 'm'), '420 m²');
  });

  // Test 4: Custom Size Venue
  it('Scenario 4: should support arbitrary custom-sized venues with decimal dimensions', () => {
    const customW = 24.5;
    const customH = 16.8;
    const unit: VenueUnit = 'm';

    const screenW = worldToScreen(customW, unit);
    const screenH = worldToScreen(customH, unit);
    assert.strictEqual(screenW, 1470);
    assert.strictEqual(screenH, 1008);

    const backToWorldW = screenToWorld(screenW, unit);
    const backToWorldH = screenToWorld(screenH, unit);
    assert.strictEqual(backToWorldW, customW);
    assert.strictEqual(backToWorldH, customH);
  });

  // Test 5, 6, 7: Changing venue dimensions after placing tables preserves dimensions, rotations & assignments
  it('Scenario 5, 6, 7: should preserve object dimensions, rotations and guest assignments when venue dimensions change', async () => {
    const projectId = `test_venue_dim_${Date.now()}`;
    const table = await createTable(projectId, {
      table_name: 'VIP Presidential',
      table_number: '1',
      table_type: 'round',
      capacity: 10
    });
    const guest = await createGuest(projectId, {
      full_name: 'Lady Ambassador',
      rsvp_status: 'attending'
    });
    await assignGuestToTable(projectId, table.id, guest.id);

    // Initial Layout in 30m x 20m
    const initialObjects: VenueLayoutObject[] = [
      {
        id: 'obj_table_1',
        venue_layout_id: 'lay_1',
        project_id: projectId,
        object_type: 'table',
        object_reference_id: table.id,
        label: 'VIP Presidential Table',
        position_x: 10.0,
        position_y: 8.0,
        width: 1.8,
        height: 1.8,
        rotation: 45,
        properties: { capacity: 10 },
        z_index: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const saved = await saveVenueLayout(projectId, {
      venue_width: 30,
      venue_height: 20,
      venue_unit: 'm',
      venue_orientation: 'landscape',
      coordinate_system: 'world',
      objects: initialObjects
    });

    assert.strictEqual(saved.venue_width, 30);
    assert.strictEqual(saved.objects[0].position_x, 10.0);
    assert.strictEqual(saved.objects[0].width, 1.8);
    assert.strictEqual(saved.objects[0].rotation, 45);

    // Now change venue dimensions to 25m x 15m
    const updated = await saveVenueLayout(projectId, {
      venue_width: 25,
      venue_height: 15,
      objects: saved.objects
    });

    assert.strictEqual(updated.venue_width, 25);
    assert.strictEqual(updated.venue_height, 15);
    // Object geometry completely preserved
    assert.strictEqual(updated.objects[0].width, 1.8);
    assert.strictEqual(updated.objects[0].height, 1.8);
    assert.strictEqual(updated.objects[0].rotation, 45);
    assert.strictEqual(updated.objects[0].object_reference_id, table.id);

    // Verify seating assignments & table integrity untouched
    const tables = await getEventTables(projectId);
    const tableReloaded = tables.find(t => t.id === table.id);
    assert.strictEqual(tableReloaded?.assigned_count, 1);
    assert.strictEqual(tableReloaded?.assigned_guests?.[0]?.full_name, 'Lady Ambassador');
  });

  // Test 8: Out of bounds detection and repositioning
  it('Scenario 8: should accurately detect objects outside boundary and safely reposition inward', () => {
    const venueW = 20; // smaller venue
    const venueH = 15;

    const objects: VenueLayoutObject[] = [
      {
        id: 'inside_obj',
        venue_layout_id: 'lay_1',
        project_id: 'p1',
        object_type: 'table',
        position_x: 5,
        position_y: 5,
        width: 1.8,
        height: 1.8,
        rotation: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'outside_obj_x',
        venue_layout_id: 'lay_1',
        project_id: 'p1',
        object_type: 'stage',
        position_x: 22, // exceeds venueW of 20
        position_y: 5,
        width: 8,
        height: 3,
        rotation: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'outside_obj_y',
        venue_layout_id: 'lay_1',
        project_id: 'p1',
        object_type: 'table',
        position_x: 8,
        position_y: 16, // exceeds venueH of 15
        width: 1.8,
        height: 1.8,
        rotation: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const { outOfBoundsIds, outOfBoundsObjects } = getOutOfBoundsObjects(objects, venueW, venueH);
    assert.strictEqual(outOfBoundsIds.length, 2, 'Should identify 2 out of bounds objects');
    assert.ok(outOfBoundsIds.includes('outside_obj_x'));
    assert.ok(outOfBoundsIds.includes('outside_obj_y'));

    // Reposition objects inside venue
    const repositioned = repositionObjectsInsideVenue(objects, venueW, venueH, 0.5);
    assert.strictEqual(repositioned.length, 3, 'No objects should be deleted');
    const stageRepositioned = repositioned.find(o => o.id === 'outside_obj_x')!;
    assert.ok(stageRepositioned.position_x + stageRepositioned.width <= venueW, 'Stage now fits inside venue width');
    assert.strictEqual(stageRepositioned.width, 8, 'Object width preserved');
    assert.strictEqual(stageRepositioned.height, 3, 'Object height preserved');

    const tableRepositioned = repositioned.find(o => o.id === 'outside_obj_y')!;
    assert.ok(tableRepositioned.position_y + tableRepositioned.height <= venueH, 'Table now fits inside venue height');
  });

  // Test 9: Fit to Screen with different aspect ratios fits the whole venue boundary
  it('Scenario 9: should fit entire venue boundary into available viewport across different aspect ratios', () => {
    // 35m x 12m Long Venue (2100 x 720 px) in a 1200 x 800 px screen
    const venueWidthPx = 35 * 60; // 2100 px
    const venueHeightPx = 12 * 60; // 720 px

    const bbox = calculateHallBoundingBox([], venueWidthPx, venueHeightPx, true);
    assert.strictEqual(bbox.minX, 0);
    assert.strictEqual(bbox.minY, 0);
    assert.strictEqual(bbox.width, 2100);
    assert.strictEqual(bbox.height, 720);

    const transform = calculateFitToScreenTransform({
      availableWidth: 1200,
      availableHeight: 800,
      bbox,
      paddingPercent: 0.07
    });

    assert.ok(transform.scale < 1.0, 'Scale must zoom out for 2100px venue on 1200px viewport');
    // Bounding box scaled width should be <= available viewport width with padding
    const renderedWidth = bbox.width * transform.scale;
    assert.ok(renderedWidth <= 1200, 'Fitted venue width must fit inside viewport width');
    const renderedHeight = bbox.height * transform.scale;
    assert.ok(renderedHeight <= 800, 'Fitted venue height must fit inside viewport height');
  });

  // Test 10, 11: Zoom, Pan & Drag coordinate mapping
  it('Scenario 10, 11: should correctly translate between screen deltas and world coordinates at arbitrary zoom levels', () => {
    const currentScale = 1.5;
    const unit: VenueUnit = 'm';
    const px = getPixelsPerUnit(unit); // 60

    // User drags an object 90 screen pixels to the right
    const screenDeltaX = 90;
    // In Konva world-layer space, delta is screenDeltaX / currentScale = 60 canvas pixels
    const canvasDeltaX = screenDeltaX / currentScale;
    // In world meters: canvasDeltaX / px = 60 / 60 = 1.0 meter
    const worldDeltaX = screenToWorld(canvasDeltaX, unit);
    assert.strictEqual(worldDeltaX, 1.0, '90 screen pixels at 1.5x zoom equals 1.0 meter in world coordinates');
  });

  // Test 12: Save and Reload layouts with venue dimensions
  it('Scenario 12: should persist and reload custom venue dimensions, unit, orientation and name', async () => {
    const projectId = `test_venue_reload_${Date.now()}`;
    const saved = await saveVenueLayout(projectId, {
      venue_width: 28.5,
      venue_height: 18.0,
      venue_unit: 'm',
      venue_orientation: 'landscape',
      venue_name: 'Imperial Glass Ballroom',
      venue_description: 'Panoramic glass pavilion with crystal chandeliers',
      grid_unit_step: 1.0,
      show_grid: true,
      show_rulers: true,
      coordinate_system: 'world'
    });

    const reloaded = await getVenueLayout(projectId);
    assert.strictEqual(reloaded.venue_width, 28.5);
    assert.strictEqual(reloaded.venue_height, 18.0);
    assert.strictEqual(reloaded.venue_unit, 'm');
    assert.strictEqual(reloaded.venue_name, 'Imperial Glass Ballroom');
    assert.strictEqual(reloaded.venue_description, 'Panoramic glass pavilion with crystal chandeliers');
    assert.strictEqual(reloaded.grid_unit_step, 1.0);
  });

  // Test 13: Existing legacy layout migration
  it('Scenario 13: should migrate legacy 2000 × 1400 px layouts to world-coordinate system preserving all items', () => {
    const legacyLayout: VenueLayout = {
      id: 'legacy_lay_1',
      project_id: 'legacy_proj_1',
      layout_name: 'Old Pixel Layout',
      canvas_width: 2000,
      canvas_height: 1400,
      grid_size: 40,
      snap_to_grid: true,
      objects: [
        {
          id: 'leg_table',
          venue_layout_id: 'legacy_lay_1',
          project_id: 'legacy_proj_1',
          object_type: 'table',
          object_reference_id: 'tbl_1',
          label: 'Table 1',
          position_x: 600,
          position_y: 400,
          width: 130, // 130px legacy round table
          height: 130,
          rotation: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'leg_stage',
          venue_layout_id: 'legacy_lay_1',
          project_id: 'legacy_proj_1',
          object_type: 'stage',
          object_reference_id: null,
          label: 'Stage',
          position_x: 650,
          position_y: 60,
          width: 700, // 700px legacy stage
          height: 140,
          rotation: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    assert.strictEqual(isLegacyLayout(legacyLayout), true, 'Must detect as legacy layout');

    const migrated = migrateVenueLayout(legacyLayout);
    assert.strictEqual(migrated.coordinate_system, 'world');
    assert.strictEqual(migrated.venue_width, 30.0);
    assert.strictEqual(migrated.venue_height, 21.0);
    assert.strictEqual(migrated.venue_unit, 'm');

    // Check migrated objects
    const migTable = migrated.objects.find(o => o.id === 'leg_table')!;
    // 130px / (2000 / 30) = 1.95m
    assert.strictEqual(migTable.width, 1.95, 'Legacy 130px table converts to 1.95m diameter');
    assert.strictEqual(migTable.position_x, 9.0, 'Legacy position 600 converts to 9.0m');
    assert.strictEqual(migTable.object_reference_id, 'tbl_1', 'Table reference preserved');

    const migStage = migrated.objects.find(o => o.id === 'leg_stage')!;
    // 700px / (2000 / 30) = 10.5m
    assert.strictEqual(migStage.width, 10.5, 'Legacy 700px stage converts to 10.5m');
  });

  // Test 14: Idempotency - Coordinate migration never runs repeatedly
  it('Scenario 14: should never apply repeated scaling once a layout is migrated', () => {
    const layoutAlreadyMigrated: VenueLayout = {
      id: 'migrated_lay_1',
      project_id: 'p1',
      layout_name: 'Migrated Layout',
      venue_width: 30.0,
      venue_height: 20.0,
      venue_unit: 'm',
      coordinate_system: 'world',
      canvas_width: 1800,
      canvas_height: 1200,
      grid_size: 30,
      snap_to_grid: true,
      objects: [
        {
          id: 'table_1',
          venue_layout_id: 'migrated_lay_1',
          project_id: 'p1',
          object_type: 'table',
          position_x: 5.0,
          position_y: 8.0,
          width: 1.8,
          height: 1.8,
          rotation: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    assert.strictEqual(isLegacyLayout(layoutAlreadyMigrated), false, 'Already migrated layout must not be legacy');

    const result = migrateVenueLayout(layoutAlreadyMigrated);
    // Values must be identical without scaling
    assert.strictEqual(result.objects[0].position_x, 5.0);
    assert.strictEqual(result.objects[0].width, 1.8);
  });

  // Test 15: Unit Conversion between meters and feet
  it('Scenario 15: should seamlessly convert between meters and feet without losing proportions', () => {
    // 30 meters to feet
    const feetVal = convertUnitValue(30, 'm', 'ft');
    assert.strictEqual(feetVal, 98.4, '30m converts to ~98.4ft');

    // Back to meters
    const backToM = convertUnitValue(feetVal, 'ft', 'm');
    assert.strictEqual(Math.round(backToM), 30, 'Converts back to 30m');

    // 100 sq ft format vs m²
    const areaM = formatVenueArea(30, 20, 'm');
    const areaFt = formatVenueArea(98.4, 65.6, 'ft');
    assert.ok(areaM.includes('m²'));
    assert.ok(areaFt.includes('sq ft'));
  });

});
