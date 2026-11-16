import test from 'node:test';
import assert from 'node:assert/strict';
import { VenueLayout, VenueLayoutObject, VenueObjectType } from '../src/types';
import {
  CURRENT_LAYOUT_MIGRATION_VERSION,
  PIXELS_PER_METER,
  PIXELS_PER_FOOT,
  convertLayoutUnit,
  getCanonicalObjectDefaults,
  getMinWorldDimension,
  getObjectScreenRect,
  isLegacyLayout,
  migrateVenueLayout,
  normalizeVenueLayout,
  screenObjectToWorld,
  worldObjectToScreen
} from '../src/utils/venueCoordinates';
import {
  calculateFitToScreenTransform,
  calculateWorldHallBoundingBox
} from '../src/utils/hallViewport';
import { projectFloorPlanPreview } from '../src/lib/eventOverview';
import {
  createTable,
  deleteTable,
  ensureValidUuid,
  getEventTables,
  getVenueLayout,
  isValidUuid,
  saveVenueLayout,
  updateTable
} from '../server/guestSeatingService';
import { auditLayoutsForRepair } from '../scripts/repair_venue_layouts';

function makeObject(overrides: Partial<VenueLayoutObject> = {}): VenueLayoutObject {
  return {
    id: overrides.id || '11111111-1111-4111-8111-111111111111',
    venue_layout_id: overrides.venue_layout_id || '22222222-2222-4222-8222-222222222222',
    project_id: overrides.project_id || 'proj-stab-1',
    object_type: overrides.object_type || 'table',
    object_reference_id: overrides.object_reference_id ?? null,
    label: overrides.label || 'Table 1',
    position_x: overrides.position_x ?? 5,
    position_y: overrides.position_y ?? 5,
    width: overrides.width ?? 1.8,
    height: overrides.height ?? 1.8,
    rotation: overrides.rotation ?? 0,
    properties: overrides.properties || { tableShape: 'round', capacity: 10 },
    z_index: overrides.z_index ?? 5,
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || new Date().toISOString()
  };
}

test('Wedding Hall Stabilization Suite', async (t) => {
  await t.test('1. Heuristic removal: large feet objects (>25ft) and thin 0.3m walls convert cleanly without misinterpretation', () => {
    const feetLayout: VenueLayout = {
      id: '33333333-3333-4333-8333-333333333333',
      project_id: 'proj-feet',
      layout_name: 'Feet Hall',
      venue_width: 100,
      venue_height: 65,
      venue_unit: 'ft',
      coordinate_system: 'world',
      is_migrated: true,
      migration_version: CURRENT_LAYOUT_MIGRATION_VERSION,
      canvas_width: Math.round(100 * PIXELS_PER_FOOT),
      canvas_height: Math.round(65 * PIXELS_PER_FOOT),
      grid_size: 37,
      snap_to_grid: true,
      objects: []
    };

    const bigStageInFeet = makeObject({
      object_type: 'stage',
      label: 'Grand Stage',
      position_x: 36,
      position_y: 4,
      width: 28, // > 25! Previously broke obj.width <= 25 heuristic
      height: 10
    });

    const stageRect = getObjectScreenRect(bigStageInFeet, feetLayout);
    assert.equal(stageRect.x, Math.round(36 * PIXELS_PER_FOOT));
    assert.equal(stageRect.width, Math.round(28 * PIXELS_PER_FOOT));
    assert.equal(stageRect.height, Math.round(10 * PIXELS_PER_FOOT));

    const roundTrip = screenObjectToWorld(stageRect, 'ft', 1);
    assert.ok(Math.abs(roundTrip.position_x - 36) <= 0.2);
    assert.ok(Math.abs(roundTrip.width - 28) <= 0.2);

    const thinWall = makeObject({
      object_type: 'wall',
      position_x: 2,
      position_y: 3,
      width: 5,
      height: 0.3
    });
    const wallRect = worldObjectToScreen(thinWall, 'm');
    assert.equal(wallRect.width, Math.round(5 * PIXELS_PER_METER));
    assert.equal(wallRect.height, Math.round(0.3 * PIXELS_PER_METER)); // 18px, not bloated to 20+ or corrupted
  });

  await t.test('2. Canonical defaults exist for all 13 venue object types in both meters and feet', () => {
    const allTypes: VenueObjectType[] = [
      'table',
      'couple_table',
      'stage',
      'dance_floor',
      'entrance',
      'buffet',
      'bar',
      'photo_booth',
      'registration',
      'pillar',
      'wall',
      'decor',
      'label'
    ];

    for (const type of allTypes) {
      const mDef = getCanonicalObjectDefaults(type, 'm');
      const ftDef = getCanonicalObjectDefaults(type, 'ft');
      assert.ok(mDef.width >= getMinWorldDimension('m'), `${type} meter width valid`);
      assert.ok(mDef.height >= getMinWorldDimension('m'), `${type} meter height valid`);
      assert.ok(ftDef.width >= getMinWorldDimension('ft'), `${type} feet width valid`);
      assert.ok(ftDef.height >= getMinWorldDimension('ft'), `${type} feet height valid`);
      assert.ok(mDef.label.length > 0, `${type} has label`);
    }
  });

  await t.test('3. Detects and repairs mis-tagged DB rows (coordinate_system=world + is_migrated=true + pixel objects) idempotently', () => {
    const brokenLayout: VenueLayout = {
      id: '44444444-4444-4444-8444-444444444444',
      project_id: 'proj-mistagged',
      layout_name: 'Corrupted Ballroom',
      venue_width: 30,
      venue_height: 20,
      venue_unit: 'm',
      coordinate_system: 'world', // Mis-tagged by SQL column default!
      is_migrated: true,          // Mis-tagged by SQL column default!
      canvas_width: 2000,
      canvas_height: 1400,
      grid_size: 40,
      snap_to_grid: true,
      objects: [
        makeObject({
          id: 'obj_stage_legacy',
          object_type: 'stage',
          label: 'Stage',
          position_x: 650,
          position_y: 80,
          width: 700,
          height: 120,
          rotation: 15,
          properties: { color: '#252525' }
        }),
        makeObject({
          id: 'obj_table_legacy',
          object_type: 'table',
          object_reference_id: '55555555-5555-4555-8555-555555555555',
          label: 'Table 1',
          position_x: 400,
          position_y: 500,
          width: 130,
          height: 130,
          rotation: 45,
          properties: { tableShape: 'square', capacity: 8, tableNumber: '1' }
        })
      ]
    };

    assert.equal(isLegacyLayout(brokenLayout), true, 'Detects pixel-scale objects even when tagged world/is_migrated');

    const repaired = migrateVenueLayout(brokenLayout);
    assert.equal(repaired.migration_version, CURRENT_LAYOUT_MIGRATION_VERSION);
    assert.equal(repaired.coordinate_system, 'world');
    assert.equal(repaired.is_migrated, true);
    assert.equal(repaired.objects.length, 2, 'Never drops any object during repair');

    const repairedStage = repaired.objects.find(o => o.id === 'obj_stage_legacy')!;
    const repairedTable = repaired.objects.find(o => o.id === 'obj_table_legacy')!;
    assert.ok(repairedStage.width > 5 && repairedStage.width < 15, `Stage width scaled to world meters (${repairedStage.width}m)`);
    assert.equal(repairedStage.rotation, 15, 'Rotation preserved');
    assert.equal(repairedStage.properties?.legacy_width, 700, 'Original pixel backup preserved in properties');
    assert.equal(repairedTable.object_reference_id, '55555555-5555-4555-8555-555555555555', 'Table reference preserved');
    assert.equal(repairedTable.properties?.capacity, 8, 'Table capacity preserved');
    assert.equal(repairedTable.rotation, 45, 'Table rotation preserved');

    // Idempotency: second pass MUST NOT modify coordinates
    assert.equal(isLegacyLayout(repaired), false);
    const secondPass = migrateVenueLayout(repaired);
    assert.deepEqual(secondPass.objects, repaired.objects);
  });

  await t.test('4. Audit dry-run utility identifies both untagged and mis-tagged layouts accurately', () => {
    const cleanV2: VenueLayout = normalizeVenueLayout({
      id: '66666666-6666-4666-8666-666666666666',
      project_id: 'p-clean',
      layout_name: 'Clean',
      venue_width: 30,
      venue_height: 20,
      venue_unit: 'm',
      coordinate_system: 'world',
      is_migrated: true,
      migration_version: CURRENT_LAYOUT_MIGRATION_VERSION,
      canvas_width: 1800,
      canvas_height: 1200,
      grid_size: 30,
      snap_to_grid: true,
      objects: [makeObject({ position_x: 6, position_y: 6, width: 1.8, height: 1.8 })]
    });

    const misTagged: VenueLayout = {
      ...cleanV2,
      id: '77777777-7777-4777-8777-777777777777',
      project_id: 'p-mistagged',
      migration_version: undefined,
      objects: [makeObject({ position_x: 700, position_y: 450, width: 140, height: 140, properties: {} })]
    };

    const untagged: VenueLayout = {
      ...cleanV2,
      id: '88888888-8888-4888-8888-888888888888',
      project_id: 'p-untagged',
      venue_width: undefined,
      venue_height: undefined,
      coordinate_system: undefined,
      is_migrated: undefined,
      migration_version: undefined,
      canvas_width: 2000,
      canvas_height: 1400,
      objects: [makeObject({ position_x: 500, position_y: 400, width: 120, height: 120, properties: {} })]
    };

    const report = auditLayoutsForRepair([cleanV2, misTagged, untagged]);
    assert.equal(report.totalLayouts, 3);
    assert.equal(report.affectedLayouts, 2);
    assert.equal(report.items[0].reason, 'mis_tagged_world_with_pixel_objects');
    assert.equal(report.items[1].reason, 'untagged_legacy');
  });

  await t.test('5. Unit conversion (m <-> ft) & Fit-to-Screen viewport transform stay centered and bounded', () => {
    const meterLayout = normalizeVenueLayout({
      id: '99999999-9999-4999-8999-999999999999',
      project_id: 'p-unit',
      layout_name: 'Unit Hall',
      venue_width: 30,
      venue_height: 20,
      venue_unit: 'm',
      canvas_width: 1800,
      canvas_height: 1200,
      grid_size: 30,
      snap_to_grid: true,
      objects: [
        makeObject({ object_type: 'stage', position_x: 11, position_y: 1.5, width: 8, height: 2.8 })
      ]
    });

    const feetLayout = convertLayoutUnit(meterLayout, 'ft');
    assert.equal(feetLayout.venue_unit, 'ft');
    assert.ok(feetLayout.venue_width! > 95 && feetLayout.venue_width! < 102);
    assert.ok(feetLayout.objects[0].width > 25, '8m stage converts to ~26.2ft');

    const bboxM = calculateWorldHallBoundingBox(meterLayout, true);
    const bboxFt = calculateWorldHallBoundingBox(feetLayout, true);
    const fitM = calculateFitToScreenTransform({ availableWidth: 1000, availableHeight: 700, bbox: bboxM });
    const fitFt = calculateFitToScreenTransform({ availableWidth: 1000, availableHeight: 700, bbox: bboxFt });

    assert.ok(fitM.scale >= 0.25 && fitM.scale <= 2.0);
    assert.ok(Math.abs(fitM.scale - fitFt.scale) < 0.05, 'Scale invariance between meters and feet');

    // Overview miniature preview also handles mis-tagged pixel layout safely
    const misTaggedForPreview: VenueLayout = {
      ...meterLayout,
      migration_version: undefined,
      objects: [
        makeObject({ position_x: 650, position_y: 90, width: 700, height: 120, properties: {} })
      ]
    };
    const preview = projectFloorPlanPreview(misTaggedForPreview, []);
    assert.equal(preview.hasObjects, true);
    assert.ok(preview.objects[0].xPct < 50 && preview.objects[0].wPct < 50, 'Preview normalizes legacy pixels into percentage viewport');
  });

  await t.test('6. Backend getVenueLayout generates canonical world defaults & syncs tables bidirectionally without duplicating or losing architectural objects', async () => {
    const projectId = `proj-sync-${Date.now()}`;

    // Initialize default layout (triggers default tables + canonical world layout)
    const initialLayout = await getVenueLayout(projectId);
    assert.equal(initialLayout.coordinate_system, 'world');
    assert.equal(initialLayout.migration_version, CURRENT_LAYOUT_MIGRATION_VERSION);
    assert.equal(initialLayout.venue_unit, 'm');
    assert.ok(initialLayout.venue_width === 30 && initialLayout.venue_height === 20);

    // Ensure architectural objects are in world meters (not pixels!)
    const stage = initialLayout.objects.find(o => o.object_type === 'stage');
    assert.ok(stage, 'Default stage created');
    assert.ok(stage!.width > 4 && stage!.width <= 15 && stage!.position_x < 25, 'Stage is in meters');

    const tables = await getEventTables(projectId);
    assert.equal(tables.length, 5);
    for (const tbl of tables) {
      const linked = initialLayout.objects.filter(o => o.object_reference_id === tbl.id);
      assert.equal(linked.length, 1, `Table ${tbl.table_number} synced cleanly once`);
    }

    // Create a new table -> automatically adds a canvas object without touching stage
    const createdTbl = await createTable(projectId, {
      table_name: 'Head Table VIP',
      table_number: '99',
      table_type: 'square',
      capacity: 12
    });
    const afterCreateLayout = await getVenueLayout(projectId);
    const createdObj = afterCreateLayout.objects.find(o => o.object_reference_id === createdTbl.id);
    assert.ok(createdObj, 'Newly created table appears on venue layout automatically');
    assert.equal(createdObj!.properties?.tableShape, 'square');
    assert.equal(createdObj!.properties?.capacity, 12);

    // Move & rotate the table on canvas and save with a legacy non-UUID custom element ID
    const movedObjects = afterCreateLayout.objects.map(o =>
      o.id === createdObj!.id
        ? { ...o, position_x: 14.5, position_y: 12.25, rotation: 35 }
        : o
    );
    movedObjects.push(
      makeObject({
        id: 'obj_1730000000_custom',
        project_id: projectId,
        venue_layout_id: afterCreateLayout.id,
        object_type: 'decor',
        label: 'Archway',
        position_x: 4,
        position_y: 4,
        width: 2.2,
        height: 1.5
      })
    );

    const savedLayout = await saveVenueLayout(projectId, { ...afterCreateLayout, objects: movedObjects });
    const sanitizedDecor = savedLayout.objects.find(o => o.label === 'Archway');
    assert.ok(sanitizedDecor, 'Custom decor object persisted');
    assert.equal(isValidUuid(sanitizedDecor!.id), true, 'Non-UUID obj_... ID sanitized to RFC4122 UUID before persistence');
    assert.equal(sanitizedDecor!.id, ensureValidUuid('obj_1730000000_custom'), 'Sanitization is deterministic');

    // Update table metadata via Table Manager -> updates label & capacity while keeping manual canvas x/y/rotation!
    await updateTable(projectId, createdTbl.id, {
      table_name: 'Royal Suite',
      capacity: 14,
      table_type: 'rectangular'
    });
    const afterUpdateLayout = await getVenueLayout(projectId);
    const updatedObj = afterUpdateLayout.objects.find(o => o.object_reference_id === createdTbl.id);
    assert.ok(updatedObj);
    assert.equal(updatedObj!.position_x, 14.5, 'Manual canvas X preserved on table update');
    assert.equal(updatedObj!.position_y, 12.25, 'Manual canvas Y preserved on table update');
    assert.equal(updatedObj!.rotation, 35, 'Manual rotation preserved on table update');
    assert.equal(updatedObj!.properties?.capacity, 14, 'Updated capacity synced to canvas');
    assert.equal(updatedObj!.properties?.tableShape, 'rectangular', 'Updated shape synced to canvas');
    assert.ok(updatedObj!.label?.includes('Royal Suite'), 'Updated label synced to canvas');

    // Delete table -> removes canvas table object without disturbing Archway or Stage
    await deleteTable(projectId, createdTbl.id);
    const afterDeleteLayout = await getVenueLayout(projectId);
    assert.equal(
      afterDeleteLayout.objects.some(o => o.object_reference_id === createdTbl.id),
      false,
      'Deleted table removed from canvas'
    );
    assert.ok(afterDeleteLayout.objects.some(o => o.label === 'Archway'), 'Decor preserved');
    assert.ok(afterDeleteLayout.objects.some(o => o.object_type === 'stage'), 'Stage preserved');
  });

  await t.test('7. Concurrent saveVenueLayout calls serialize cleanly via project lock without dropping objects', async () => {
    const projectId = `proj-lock-${Date.now()}`;
    const base = await getVenueLayout(projectId);
    const extraObj1 = makeObject({
      id: 'obj_concurrent_1',
      project_id: projectId,
      venue_layout_id: base.id,
      object_type: 'bar',
      label: 'Bar One',
      position_x: 3,
      position_y: 8,
      width: 3.2,
      height: 1.2
    });
    const extraObj2 = makeObject({
      id: 'obj_concurrent_2',
      project_id: projectId,
      venue_layout_id: base.id,
      object_type: 'photo_booth',
      label: 'Booth Two',
      position_x: 22,
      position_y: 8,
      width: 2.5,
      height: 2.5
    });

    const [res1, res2] = await Promise.all([
      saveVenueLayout(projectId, { ...base, objects: [...base.objects, extraObj1] }),
      saveVenueLayout(projectId, { ...base, objects: [...base.objects, extraObj1, extraObj2] })
    ]);

    assert.ok(res1.objects.length >= base.objects.length + 1);
    assert.ok(res2.objects.length >= base.objects.length + 2);
    const finalLoaded = await getVenueLayout(projectId);
    assert.ok(finalLoaded.objects.some(o => o.label === 'Bar One'));
    assert.ok(finalLoaded.objects.some(o => o.label === 'Booth Two'));
  });
});
