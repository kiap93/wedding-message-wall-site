import {
  getEventGuests,
  createGuest,
  updateGuest,
  deleteGuest,
  getEventGroups,
  createGuestGroup,
  deleteGuestGroup,
  getEventTables,
  createTable,
  updateTable,
  deleteTable,
  assignGuestToTable,
  unassignGuestFromTable,
  assignGroupToTable,
  getVenueLayout,
  saveVenueLayout,
  syncGuestFromRSVP
} from '../server/guestSeatingService';
import { Guest, SeatingTable } from '../src/types';

async function runTests() {
  console.log('🧪 Starting EventFrame Guest List, Table Assignment & Hall Planner Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  const testProjectId = `test_event_${Date.now()}`;
  const otherProjectId = `other_event_${Date.now()}`;

  // =========================================================================
  // TEST GROUP 1: GUEST MANAGEMENT
  // =========================================================================
  console.log('--- Test Group 1: Guest Management & Groups ---');

  // 1.1 Create Guest
  const guest1 = await createGuest(testProjectId, {
    full_name: 'Lady Eleanor Vance',
    email: 'eleanor@example.com',
    phone: '+15551234567',
    rsvp_status: 'attending',
    pax: 1,
    meal_preference: 'Beef Tenderloin',
    dietary_notes: 'Nut allergy',
    is_vip: true
  });
  assert(guest1.id !== undefined, 'Guest created with unique ID');
  assert(guest1.full_name === 'Lady Eleanor Vance', 'Guest full_name preserved');
  assert(guest1.is_vip === true, 'VIP flag saved');

  // 1.2 Edit Guest
  const updatedGuest1 = await updateGuest(testProjectId, guest1.id, {
    dietary_notes: 'Nut allergy, no shellfish'
  });
  assert(updatedGuest1?.dietary_notes === 'Nut allergy, no shellfish', 'Guest info successfully updated');

  // 1.3 Create Guest Group & Assign
  const group1 = await createGuestGroup(testProjectId, {
    group_name: 'Bride Immediate Family',
    color: '#8B806F'
  });
  assert(group1.group_name === 'Bride Immediate Family', 'Guest Group created');

  await updateGuest(testProjectId, guest1.id, { guest_group_id: group1.id });
  const allGuests = await getEventGuests(testProjectId);
  const reloadedGuest1 = allGuests.find(g => g.id === guest1.id);
  assert(reloadedGuest1?.guest_group_id === group1.id, 'Guest assigned to family group');

  // 1.4 Delete Group (Members must become ungrouped, NOT deleted)
  const groupToDelete = await createGuestGroup(testProjectId, { group_name: 'Temp Group' });
  const guestInTemp = await createGuest(testProjectId, { full_name: 'Temp Guest', guest_group_id: groupToDelete.id });
  await deleteGuestGroup(testProjectId, groupToDelete.id);
  const reloadedTempGuest = (await getEventGuests(testProjectId)).find(g => g.id === guestInTemp.id);
  assert(reloadedTempGuest !== undefined, 'Deleting group does not delete guest');
  assert(reloadedTempGuest?.guest_group_id === null, 'Deleting group nullifies guest_group_id on members');

  // =========================================================================
  // TEST GROUP 2: RSVP INTEGRATION & DEDUPLICATION
  // =========================================================================
  console.log('\n--- Test Group 2: RSVP Synchronization & Plus-Ones ---');

  // 2.1 Sync RSVP with plus-one (guest_count = 2)
  const synced = await syncGuestFromRSVP(testProjectId, {
    id: 'rsvp_123',
    name: 'Sir Arthur Miller',
    email: 'arthur@example.com',
    attending: true,
    guest_count: 2,
    meal_preference: 'Atlantic Salmon',
    is_vip: false
  });

  assert(synced.length === 2, 'RSVP with guest_count=2 created primary guest + 1 plus-one');
  const primaryArthur = synced.find(g => !g.is_plus_one);
  const plusOneArthur = synced.find(g => g.is_plus_one);
  assert(primaryArthur?.full_name === 'Sir Arthur Miller', 'Primary guest name correct');
  assert(plusOneArthur?.primary_guest_id === primaryArthur?.id, 'Plus-one linked to primary guest');

  // 2.2 Repeat RSVP Submission (Deduplication)
  const reSynced = await syncGuestFromRSVP(testProjectId, {
    id: 'rsvp_123',
    name: 'Sir Arthur Miller',
    email: 'arthur@example.com',
    attending: true,
    guest_count: 2,
    meal_preference: 'Vegetarian Risotto' // Changed meal preference
  });
  const guestsAfterResync = await getEventGuests(testProjectId);
  const arthurCount = guestsAfterResync.filter(g => g.email === 'arthur@example.com').length;
  assert(arthurCount === 1, 'Duplicate RSVP submission updates existing guest without duplicating');
  const updatedArthur = guestsAfterResync.find(g => g.email === 'arthur@example.com');
  assert(updatedArthur?.meal_preference === 'Vegetarian Risotto', 'Repeat RSVP updates guest preferences');

  // 2.3 Declined RSVP handling
  const declinedSync = await syncGuestFromRSVP(testProjectId, {
    id: 'rsvp_declined',
    name: 'Declined Relative',
    email: 'declined@example.com',
    attending: false,
    guest_count: 1
  });
  assert(declinedSync[0].rsvp_status === 'declined', 'Declined RSVP marked as declined');

  // =========================================================================
  // TEST GROUP 3: TABLE MANAGEMENT & SEATING ASSIGNMENT
  // =========================================================================
  console.log('\n--- Test Group 3: Table Management & Seating Assignments ---');

  // 3.1 Create Table with capacity 2
  const table1 = await createTable(testProjectId, {
    table_name: 'Table 01 — VIP Altar',
    table_number: '1',
    table_type: 'round',
    capacity: 2,
    category: 'VIP'
  });
  assert(table1.id !== undefined, 'Table created');
  assert(table1.capacity === 2, 'Table capacity set to 2');

  // 3.2 Assign Guest to Table
  const assignResult1 = await assignGuestToTable(testProjectId, table1.id, guest1.id);
  assert(assignResult1.success === true, 'Assigned Guest 1 to Table 1');

  // 3.3 Overcapacity Prevention (Capacity = 2)
  await assignGuestToTable(testProjectId, table1.id, primaryArthur!.id); // 2 of 2
  const overcapacityAssign = await assignGuestToTable(testProjectId, table1.id, plusOneArthur!.id); // 3 of 2 -> Should FAIL!
  assert(overcapacityAssign.success === false, 'Assignment rejected when table is at full capacity');
  assert(overcapacityAssign.error?.includes('full'), 'Clear error feedback on overcapacity');

  // 3.4 Declined Guest Cannot Be Seated
  const declinedGuest = (await getEventGuests(testProjectId)).find(g => g.rsvp_status === 'declined');
  const declinedAssign = await assignGuestToTable(testProjectId, table1.id, declinedGuest!.id);
  assert(declinedAssign.success === false, 'Declined guest cannot be assigned a seat');

  // 3.5 Unassign Guest
  await unassignGuestFromTable(testProjectId, guest1.id);
  const tablesAfterUnassign = await getEventTables(testProjectId);
  const reloadedT1 = tablesAfterUnassign.find(t => t.id === table1.id);
  assert(reloadedT1?.assigned_count === 1, 'Unassigning guest decreases table occupancy to 1');

  // 3.6 Delete Table (Guests must become unassigned, NOT deleted!)
  await deleteTable(testProjectId, table1.id);
  const guestsAfterTableDelete = await getEventGuests(testProjectId);
  const reloadedArthur = guestsAfterTableDelete.find(g => g.id === primaryArthur!.id);
  assert(reloadedArthur !== undefined, 'Deleting table does not delete guest');
  assert(reloadedArthur?.assigned_table_id === null, 'Deleting table unassigns seated guests');

  // =========================================================================
  // TEST GROUP 4: WEDDING HALL LAYOUT PLANNER & SYNCHRONIZATION
  // =========================================================================
  console.log('\n--- Test Group 4: Wedding Hall Layout Planner & Canvas Sync ---');

  // 4.1 Initialize Layout
  const initialLayout = await getVenueLayout(testProjectId);
  assert(initialLayout.canvas_width >= 1000, 'Canvas has valid width');
  assert(initialLayout.objects.length > 0, 'Initial layout automatically includes venue objects (Stage, Entrance, etc.)');

  const stageObject = initialLayout.objects.find(o => o.object_type === 'stage');
  assert(stageObject !== undefined, 'Main Stage object exists on canvas');

  // 4.2 Move Object & Update Coordinates
  const updatedStageX = 720;
  const updatedStageY = 80;
  const updatedObjects = initialLayout.objects.map(o => 
    o.id === stageObject?.id ? { ...o, position_x: updatedStageX, position_y: updatedStageY } : o
  );

  const savedLayout = await saveVenueLayout(testProjectId, {
    canvas_width: 2200,
    canvas_height: 1500,
    objects: updatedObjects
  });

  const reloadedStage = savedLayout.objects.find(o => o.id === stageObject?.id);
  assert(reloadedStage?.position_x === updatedStageX, 'Stage X coordinate persisted');
  assert(reloadedStage?.position_y === updatedStageY, 'Stage Y coordinate persisted');
  assert(savedLayout.canvas_width === 2200, 'Updated canvas dimensions persisted');

  // 4.3 Table Physical Position Separation
  // Moving a table on canvas must NOT change seating assignments
  const newTable = await createTable(testProjectId, {
    table_name: 'Table 10',
    table_number: '10',
    capacity: 8
  });
  await assignGuestToTable(testProjectId, newTable.id, guest1.id);

  // Re-save layout with new table coordinates
  const layoutWithTable = await saveVenueLayout(testProjectId, {
    objects: [
      ...savedLayout.objects,
      {
        id: 'obj_t10',
        venue_layout_id: savedLayout.id,
        project_id: testProjectId,
        object_type: 'table',
        object_reference_id: newTable.id,
        label: 'T10: Table 10',
        position_x: 500,
        position_y: 600,
        width: 130,
        height: 130,
        rotation: 45,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
  });

  const tablesCheck = await getEventTables(testProjectId);
  const reloadedNewTable = tablesCheck.find(t => t.id === newTable.id);
  assert(reloadedNewTable?.assigned_count === 1, 'Guest assignment preserved after layout movement');
  assert(reloadedNewTable?.assigned_guests?.[0].id === guest1.id, 'Assigned guest identity preserved');

  // =========================================================================
  // TEST GROUP 5: CROSS-EVENT SECURITY & ISOLATION
  // =========================================================================
  console.log('\n--- Test Group 5: Cross-Event Security & Data Isolation ---');

  const otherEventGuests = await getEventGuests(otherProjectId);
  assert(otherEventGuests.length === 0, 'Other event has isolated empty guest list');
  const otherEventTables = await getEventTables(otherProjectId);
  // Default tables for other event are isolated
  assert(otherEventTables.every(t => t.project_id === otherProjectId), 'Tables scoped strictly to correct event');

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
