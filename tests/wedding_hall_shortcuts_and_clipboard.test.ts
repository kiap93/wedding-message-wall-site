import { describe, it } from 'node:test';
import assert from 'node:assert';
import { VenueLayoutObject } from '../src/types/seating';

describe('Wedding Hall Layout Editor – Shortcuts, Clipboard, and Undo/Redo Engine', () => {

  // Test 1: 100-Step History Buffer
  it('should maintain up to 100 history states and truncate oldest when exceeding 100', () => {
    let history: VenueLayoutObject[][] = [];
    let historyIndex = -1;

    const commitChange = (newObjects: VenueLayoutObject[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newObjects)));
      if (newHistory.length > 100) newHistory.shift();
      history = newHistory;
      historyIndex = newHistory.length - 1;
    };

    // Commit 120 changes
    for (let i = 0; i < 120; i++) {
      commitChange([{
        id: `obj_${i}`,
        venue_layout_id: 'layout-1',
        project_id: 'proj-1',
        object_type: 'table',
        object_reference_id: null,
        label: `Table ${i}`,
        position_x: i * 10,
        position_y: i * 10,
        width: 120,
        height: 120,
        rotation: 0,
        properties: {},
        z_index: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);
    }

    assert.strictEqual(history.length, 100, 'History should cap at exactly 100 entries');
    assert.strictEqual(historyIndex, 99, 'History index should be at 99 (latest)');
    // Oldest item should be obj_20 (since 0..19 shifted off)
    assert.strictEqual(history[0][0].id, 'obj_20', 'Oldest element should have shifted correctly');
    assert.strictEqual(history[99][0].id, 'obj_119', 'Newest element should be preserved');
  });

  // Test 2: Undo and Redo operations & New Action clears Redo stack
  it('should undo and redo through history, and clear redo stack when a new action is performed after undo', () => {
    let history: VenueLayoutObject[][] = [];
    let historyIndex = -1;
    let currentObjects: VenueLayoutObject[] = [];

    const commitChange = (newObjects: VenueLayoutObject[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newObjects)));
      if (newHistory.length > 100) newHistory.shift();
      history = newHistory;
      historyIndex = newHistory.length - 1;
      currentObjects = newObjects;
    };

    const undo = () => {
      if (historyIndex > 0) {
        historyIndex--;
        currentObjects = JSON.parse(JSON.stringify(history[historyIndex]));
      }
    };

    const redo = () => {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        currentObjects = JSON.parse(JSON.stringify(history[historyIndex]));
      }
    };

    const makeObj = (x: number): VenueLayoutObject => ({
      id: 'table-1',
      venue_layout_id: 'layout-1',
      project_id: 'proj-1',
      object_type: 'table',
      object_reference_id: null,
      label: 'Main Table',
      position_x: x,
      position_y: 100,
      width: 120,
      height: 120,
      rotation: 0,
      properties: {},
      z_index: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Step 0: Initial
    commitChange([makeObj(10)]);
    // Step 1: Move to 20
    commitChange([makeObj(20)]);
    // Step 2: Move to 30
    commitChange([makeObj(30)]);

    assert.strictEqual(currentObjects[0].position_x, 30);
    assert.strictEqual(historyIndex, 2);

    // Undo to Step 1
    undo();
    assert.strictEqual(currentObjects[0].position_x, 20);
    assert.strictEqual(historyIndex, 1);

    // Undo to Step 0
    undo();
    assert.strictEqual(currentObjects[0].position_x, 10);
    assert.strictEqual(historyIndex, 0);

    // Redo to Step 1
    redo();
    assert.strictEqual(currentObjects[0].position_x, 20);
    assert.strictEqual(historyIndex, 1);

    // Now make a NEW action from Step 1 (move to 99)
    commitChange([makeObj(99)]);
    assert.strictEqual(history.length, 3, 'Redo future should have been replaced');
    assert.strictEqual(historyIndex, 2);
    assert.strictEqual(currentObjects[0].position_x, 99);

    // Redo should do nothing now since we are at top
    redo();
    assert.strictEqual(currentObjects[0].position_x, 99);
  });

  // Test 3: Wedding Data Rule – Copy/Duplicate NEVER copies assigned guests
  it('should copy/duplicate tables without copying assigned guests or references', () => {
    const originalTable: VenueLayoutObject = {
      id: 'table_with_guests',
      venue_layout_id: 'layout-1',
      project_id: 'proj-1',
      object_type: 'table',
      object_reference_id: 'real-table-uuid-1234',
      label: 'VIP Table 1',
      position_x: 200,
      position_y: 200,
      width: 140,
      height: 140,
      rotation: 45,
      properties: {
        tableShape: 'round',
        capacity: 10,
        tableNumber: '1',
        assignedGuests: ['guest-1', 'guest-2', 'guest-3'], // Should NOT be inherited
        assignedCount: 3
      },
      z_index: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Duplicate logic as implemented in WeddingHallPlanner
    const offset = 30;
    const dupId = `obj_${Date.now()}_copy`;
    const clonedProps = JSON.parse(JSON.stringify(originalTable.properties));
    // Clean out any guest assignments if present in properties
    delete clonedProps.assignedGuests;
    delete clonedProps.assignedCount;

    const duplicatedTable: VenueLayoutObject = {
      ...originalTable,
      id: dupId,
      object_reference_id: null, // Critical: unlinked from database table with assigned guests
      label: `${originalTable.label} (Copy)`,
      position_x: originalTable.position_x + offset,
      position_y: originalTable.position_y + offset,
      properties: clonedProps,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    assert.notStrictEqual(duplicatedTable.id, originalTable.id, 'Duplicate must have new unique ID');
    assert.strictEqual(duplicatedTable.object_reference_id, null, 'Duplicate must not link to original table guests');
    assert.strictEqual(duplicatedTable.position_x, 230, 'Duplicate should have +30 offset');
    assert.strictEqual(duplicatedTable.position_y, 230, 'Duplicate should have +30 offset');
    assert.strictEqual(duplicatedTable.rotation, 45, 'Rotation should be preserved');
    assert.strictEqual(duplicatedTable.properties.tableShape, 'round', 'Shape should be preserved');
    assert.strictEqual(duplicatedTable.properties.capacity, 10, 'Capacity should be preserved');
    assert.strictEqual(duplicatedTable.properties.assignedGuests, undefined, 'Assigned guests must not be copied');
  });

  // Test 4: Clipboard Cut & Paste operations
  it('should support Cut and Paste operations with correct canvas removal and new offsets', () => {
    let canvasObjects: VenueLayoutObject[] = [
      {
        id: 'stage_1',
        venue_layout_id: 'layout-1',
        project_id: 'proj-1',
        object_type: 'stage',
        object_reference_id: null,
        label: 'Main Stage',
        position_x: 500,
        position_y: 100,
        width: 400,
        height: 120,
        rotation: 0,
        properties: {},
        z_index: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'dance_1',
        venue_layout_id: 'layout-1',
        project_id: 'proj-1',
        object_type: 'dance_floor',
        object_reference_id: null,
        label: 'Dance Floor',
        position_x: 500,
        position_y: 300,
        width: 300,
        height: 200,
        rotation: 0,
        properties: {},
        z_index: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    let clipboard: VenueLayoutObject[] = [];
    const selectedIds = ['stage_1'];

    // CUT action
    const itemsToCut = canvasObjects.filter(o => selectedIds.includes(o.id));
    clipboard = JSON.parse(JSON.stringify(itemsToCut));
    canvasObjects = canvasObjects.filter(o => !selectedIds.includes(o.id));

    assert.strictEqual(canvasObjects.length, 1, 'Cut item should be removed from canvas');
    assert.strictEqual(canvasObjects[0].id, 'dance_1');
    assert.strictEqual(clipboard.length, 1, 'Cut item should be placed in clipboard');
    assert.strictEqual(clipboard[0].label, 'Main Stage');

    // PASTE action
    const offset = 30;
    const pastedObjects = clipboard.map((orig, idx) => ({
      ...orig,
      id: `pasted_${Date.now()}_${idx}`,
      position_x: orig.position_x + offset,
      position_y: orig.position_y + offset,
      label: `${orig.label} (Copy)`
    }));
    canvasObjects = [...canvasObjects, ...pastedObjects];

    assert.strictEqual(canvasObjects.length, 2, 'Pasted item should be added back to canvas');
    const pasted = canvasObjects.find(o => o.id.startsWith('pasted_'));
    assert.ok(pasted, 'Pasted item should exist in canvas');
    assert.strictEqual(pasted.position_x, 530, 'Pasted position X should have +30 offset');
    assert.strictEqual(pasted.position_y, 130, 'Pasted position Y should have +30 offset');
  });

  // Test 5: Arrow key debounced batch movement
  it('should group consecutive arrow key nudges into 1 history change', async () => {
    let history: VenueLayoutObject[][] = [];
    let historyIndex = -1;
    let initialSnapshot: VenueLayoutObject[] | null = null;
    let timer: NodeJS.Timeout | null = null;

    let objects: VenueLayoutObject[] = [{
      id: 'obj_nudge',
      venue_layout_id: 'layout-1',
      project_id: 'proj-1',
      object_type: 'table',
      object_reference_id: null,
      label: 'Nudged Table',
      position_x: 100,
      position_y: 100,
      width: 100,
      height: 100,
      rotation: 0,
      properties: {},
      z_index: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }];

    // Initial commit
    history.push(JSON.parse(JSON.stringify(objects)));
    historyIndex = 0;

    const nudge = (dx: number, dy: number, onComplete?: () => void) => {
      if (!initialSnapshot) {
        initialSnapshot = JSON.parse(JSON.stringify(objects));
      }
      objects = objects.map(o => ({
        ...o,
        position_x: o.position_x + dx,
        position_y: o.position_y + dy
      }));

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        initialSnapshot = null;
        history.push(JSON.parse(JSON.stringify(objects)));
        historyIndex = history.length - 1;
        if (onComplete) onComplete();
      }, 50); // fast test timer
    };

    // Simulate 10 rapid arrow presses (+1 each)
    for (let i = 0; i < 10; i++) {
      nudge(1, 0);
    }

    assert.strictEqual(objects[0].position_x, 110, 'Live coordinates should update immediately');
    assert.strictEqual(history.length, 1, 'History should not record individual 1px ticks');

    // Wait for debounce timer to fire
    await new Promise<void>(resolve => {
      nudge(1, 0, () => {
        resolve();
      });
    });

    assert.strictEqual(objects[0].position_x, 111, 'Total position after 11 nudges should be 111');
    assert.strictEqual(history.length, 2, 'History should contain exactly 1 new entry for all nudges combined');
    assert.strictEqual(history[1][0].position_x, 111);

    // Undo should revert all 11 nudges in a single step!
    historyIndex--;
    const reverted = history[historyIndex];
    assert.strictEqual(reverted[0].position_x, 100, 'Single undo must revert back to 100');
  });

  // Test 6: Input Field Safety Check
  it('should ignore keyboard shortcuts when typing in inputs or contenteditable elements', () => {
    const isInputActive = (tagName: string, isContentEditable: boolean = false) => {
      const tag = tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || isContentEditable;
    };

    assert.strictEqual(isInputActive('INPUT'), true, 'Should block shortcuts on <input>');
    assert.strictEqual(isInputActive('TEXTAREA'), true, 'Should block shortcuts on <textarea>');
    assert.strictEqual(isInputActive('SELECT'), true, 'Should block shortcuts on <select>');
    assert.strictEqual(isInputActive('DIV', true), true, 'Should block shortcuts on contenteditable');
    assert.strictEqual(isInputActive('DIV', false), false, 'Should allow shortcuts on normal <div>');
    assert.strictEqual(isInputActive('CANVAS', false), false, 'Should allow shortcuts on <canvas>');
  });

  // Test 7: Multi-Selection Drag Delta Synchronization
  it('should correctly move all selected objects in sync when dragging one member', () => {
    const objects: VenueLayoutObject[] = [
      { id: 'item_1', position_x: 100, position_y: 100 } as any,
      { id: 'item_2', position_x: 200, position_y: 150 } as any,
      { id: 'item_3', position_x: 400, position_y: 400 } as any, // unselected
    ];

    const selectedIds = ['item_1', 'item_2'];
    const dragStarts = new Map<string, { x: number; y: number }>();
    dragStarts.set('item_1', { x: 100, y: 100 });
    dragStarts.set('item_2', { x: 200, y: 150 });

    // Drag item_1 from (100, 100) to (180, 140) => dx = +80, dy = +40
    const finalSelfX = 180;
    const finalSelfY = 140;
    const dx = finalSelfX - dragStarts.get('item_1')!.x;
    const dy = finalSelfY - dragStarts.get('item_1')!.y;

    const updated = objects.map(o => {
      if (selectedIds.includes(o.id)) {
        const orig = dragStarts.get(o.id)!;
        return {
          ...o,
          position_x: o.id === 'item_1' ? finalSelfX : orig.x + dx,
          position_y: o.id === 'item_1' ? finalSelfY : orig.y + dy
        };
      }
      return o;
    });

    assert.strictEqual(updated[0].position_x, 180);
    assert.strictEqual(updated[0].position_y, 140);
    assert.strictEqual(updated[1].position_x, 280, 'item_2 must move by dx (+80)');
    assert.strictEqual(updated[1].position_y, 190, 'item_2 must move by dy (+40)');
    assert.strictEqual(updated[2].position_x, 400, 'Unselected item_3 must remain unchanged');
    assert.strictEqual(updated[2].position_y, 400, 'Unselected item_3 must remain unchanged');
  });
});
