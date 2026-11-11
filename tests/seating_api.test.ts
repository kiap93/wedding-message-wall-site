import {
  getEventTables,
  createTable,
  updateTable,
  deleteTable,
  assignGuestToTable,
  unassignGuestFromTable,
  assignGroupToTable,
  getVenueLayout,
  saveVenueLayout,
  getEventAssignments,
  createGuest,
  getEventGuests
} from '../server/guestSeatingService';

const BASE_URL = 'http://localhost:3000';

async function runSeatingApiTests() {
  console.log('🧪 Starting EventFrame Wedding Seating API & Worker Integration Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`, detail !== undefined ? detail : '');
      failed++;
    }
  }

  const testProjectId = `test_event_seating_${Date.now()}`;
  const headersWithAuth = {
    'Content-Type': 'application/json',
    'x-test-suite': 'true'
  };

  // =========================================================================
  // TEST 1: Create Table (POST /api/projects/:projectId/tables)
  // =========================================================================
  console.log('--- Test 1: Create Table ---');
  const createRes = await fetch(`${BASE_URL}/api/projects/${testProjectId}/tables`, {
    method: 'POST',
    headers: headersWithAuth,
    body: JSON.stringify({
      table_name: 'Imperial Ballroom Table 1',
      table_number: '1',
      table_type: 'round',
      capacity: 8,
      category: 'VIP Guests',
      position_x: 250,
      position_y: 350,
      rotation: 0
    })
  });

  assert(createRes.status === 201, `Status code is 201 (got ${createRes.status})`);
  const createData = await createRes.json();
  assert(createData.success === true, 'Response indicates success: true');
  assert(createData.table !== undefined, 'Response includes table object');
  assert(createData.table.table_name === 'Imperial Ballroom Table 1', 'Table name matches');
  assert(createData.table.capacity === 8, 'Table capacity matches 8');
  assert(createData.table.position_x === 250, 'Table position_x preserved');
  assert(createData.table.position_y === 350, 'Table position_y preserved');
  const table1Id = createData.table.id;

  // =========================================================================
  // TEST 2: Retrieve Tables (GET /api/projects/:projectId/tables)
  // =========================================================================
  console.log('--- Test 2: Retrieve Tables ---');
  const getRes = await fetch(`${BASE_URL}/api/projects/${testProjectId}/tables`, {
    headers: headersWithAuth
  });

  assert(getRes.status === 200, `Status code is 200 (got ${getRes.status})`);
  const getData = await getRes.json();
  assert(getData.success === true, 'Get tables returns success');
  assert(Array.isArray(getData.tables), 'Returns tables array');
  const foundTable1 = getData.tables.find((t: any) => t.id === table1Id);
  assert(foundTable1 !== undefined, 'Created table exists in retrieved list');
  assert(foundTable1.capacity === 8, 'Capacity is accurate in list');

  // =========================================================================
  // TEST 3: Update Table (PUT /api/projects/:projectId/tables/:tableId)
  // =========================================================================
  console.log('--- Test 3: Update Table ---');
  const updateRes = await fetch(`${BASE_URL}/api/projects/${testProjectId}/tables/${table1Id}`, {
    method: 'PUT',
    headers: headersWithAuth,
    body: JSON.stringify({
      table_name: 'Imperial Ballroom Table 1 (Renamed)',
      capacity: 10,
      position_x: 320,
      position_y: 450,
      rotation: 45
    })
  });

  assert(updateRes.status === 200, `Update status is 200 (got ${updateRes.status})`);
  const updateData = await updateRes.json();
  assert(updateData.table.table_name === 'Imperial Ballroom Table 1 (Renamed)', 'Table name updated');
  assert(updateData.table.capacity === 10, 'Capacity updated to 10');
  assert(updateData.table.position_x === 320, 'Position X updated');
  assert(updateData.table.rotation === 45, 'Rotation updated');

  // =========================================================================
  // TEST 4: Delete Empty Table (DELETE /api/projects/:projectId/tables/:tableId)
  // =========================================================================
  console.log('--- Test 4: Delete Empty Table ---');
  // Create a temporary empty table
  const tempTable = await createTable(testProjectId, {
    table_name: 'Temporary Table To Delete',
    table_number: 'Temp-99',
    capacity: 4
  });

  const deleteEmptyRes = await fetch(`${BASE_URL}/api/projects/${testProjectId}/tables/${tempTable.id}`, {
    method: 'DELETE',
    headers: headersWithAuth
  });

  assert(deleteEmptyRes.status === 200, `Empty table delete status is 200 (got ${deleteEmptyRes.status})`);
  const deleteEmptyData = await deleteEmptyRes.json();
  assert(deleteEmptyData.success === true, 'Deleted empty table returns success: true');

  // Verify it no longer exists in tables list
  const tablesAfterDelete = await getEventTables(testProjectId);
  assert(!tablesAfterDelete.some(t => t.id === tempTable.id), 'Table successfully removed from database');

  // =========================================================================
  // TEST 5: Assign Guest to Table (POST /api/projects/:id/tables/:tableId/assign)
  // =========================================================================
  console.log('--- Test 5: Assign Guest to Table ---');
  const guest1 = await createGuest(testProjectId, {
    full_name: 'Lord Alistair Sterling',
    email: 'alistair@example.com',
    rsvp_status: 'attending',
    pax: 1
  });

  const assignRes = await fetch(`${BASE_URL}/api/projects/${testProjectId}/tables/${table1Id}/assign`, {
    method: 'POST',
    headers: headersWithAuth,
    body: JSON.stringify({
      guestId: guest1.id,
      seatNumber: 1
    })
  });

  assert(assignRes.status === 200, `Assign guest status is 200 (got ${assignRes.status})`);
  const assignData = await assignRes.json();
  assert(assignData.success === true, 'Assignment succeeded');
  const tableWithGuest = assignData.tables.find((t: any) => t.id === table1Id);
  assert(tableWithGuest.assigned_count === 1, 'Assigned count incremented to 1');
  assert(tableWithGuest.assigned_guests.some((g: any) => g.id === guest1.id), 'Guest is in assigned_guests array');

  // =========================================================================
  // TEST 6: Move Guest Between Tables
  // =========================================================================
  console.log('--- Test 6: Move Guest Between Tables ---');
  // Create Table 2
  const table2 = await createTable(testProjectId, {
    table_name: 'Garden Terrace Table 2',
    table_number: '2',
    capacity: 6
  });

  // Move guest1 from table1 to table2
  const moveRes = await fetch(`${BASE_URL}/api/projects/${testProjectId}/tables/${table2.id}/assign`, {
    method: 'POST',
    headers: headersWithAuth,
    body: JSON.stringify({
      guestId: guest1.id,
      seatNumber: 2
    })
  });

  assert(moveRes.status === 200, `Move guest status is 200 (got ${moveRes.status})`);
  const moveData = await moveRes.json();
  const updatedT1 = moveData.tables.find((t: any) => t.id === table1Id);
  const updatedT2 = moveData.tables.find((t: any) => t.id === table2.id);

  assert(updatedT1.assigned_count === 0, 'Table 1 occupancy decreased back to 0');
  assert(updatedT2.assigned_count === 1, 'Table 2 occupancy increased to 1');
  assert(updatedT2.assigned_guests.some((g: any) => g.id === guest1.id), 'Guest 1 is now seated at Table 2');

  // =========================================================================
  // TEST 7: Reject Over-Capacity Assignments
  // =========================================================================
  console.log('--- Test 7: Reject Over-Capacity Assignments ---');
  // Create a tiny table of capacity 1
  const tinyTable = await createTable(testProjectId, {
    table_name: 'Intimate Table 3',
    table_number: '3',
    capacity: 1
  });

  // Assign Guest 1 to tiny table (1/1 seats occupied)
  const tinyAssignRes1 = await assignGuestToTable(testProjectId, tinyTable.id, guest1.id);
  assert(tinyAssignRes1.success === true, 'Seated first guest at tiny table');

  // Create Guest 2
  const guest2 = await createGuest(testProjectId, {
    full_name: 'Lady Beatrice Sterling',
    email: 'beatrice@example.com',
    rsvp_status: 'attending',
    pax: 1
  });

  // Attempt to assign Guest 2 to the same full table
  const overCapRes = await fetch(`${BASE_URL}/api/projects/${testProjectId}/tables/${tinyTable.id}/assign`, {
    method: 'POST',
    headers: headersWithAuth,
    body: JSON.stringify({
      guestId: guest2.id
    })
  });

  assert(overCapRes.status === 400, `Rejects over-capacity assignment with 400 (got ${overCapRes.status})`);
  const overCapData = await overCapRes.json();
  assert(overCapData.error !== undefined && overCapData.error.includes('full'), 'Error message specifies table is full');

  // Verify Guest 2 was not seated
  const tinyTableCheck = (await getEventTables(testProjectId)).find(t => t.id === tinyTable.id);
  assert(tinyTableCheck?.assigned_count === 1, 'Table occupancy remained at maximum capacity (1)');

  // =========================================================================
  // TEST 8: Reject Unauthorized Access
  // =========================================================================
  console.log('--- Test 8: Reject Unauthorized Access ---');
  const unauthRes = await fetch(`${BASE_URL}/api/projects/${testProjectId}/tables`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      // No auth token, no x-test-suite
    },
    body: JSON.stringify({
      table_name: 'Hacker Table',
      capacity: 5
    })
  });

  assert(unauthRes.status === 403, `Unauthorized request rejected with 403 (got ${unauthRes.status})`);
  const unauthData = await unauthRes.json();
  assert(unauthData.error !== undefined, 'Returns error for unauthorized request');

  // =========================================================================
  // TEST 9: Reject Invalid Project IDs
  // =========================================================================
  console.log('--- Test 9: Reject Invalid Project IDs ---');
  const invalidRes = await fetch(`${BASE_URL}/api/projects/non_existent_project_99999/tables`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
      // No auth
    }
  });

  assert(invalidRes.status === 403 || invalidRes.status === 404, `Invalid project rejected with 403/404 (got ${invalidRes.status})`);

  // =========================================================================
  // TEST 10: Handle Duplicate Assignments
  // =========================================================================
  console.log('--- Test 10: Handle Duplicate Assignments ---');
  // Assigning guest1 to tinyTable again when guest1 is already seated there
  const duplicateRes = await assignGuestToTable(testProjectId, tinyTable.id, guest1.id);
  assert(duplicateRes.success === true, 'Duplicate assignment handled idempotently');
  const checkDuplicate = (await getEventTables(testProjectId)).find(t => t.id === tinyTable.id);
  assert(checkDuplicate?.assigned_count === 1, 'Occupancy does not double-count duplicate assignment');

  // =========================================================================
  // TEST 11: Handle Concurrent Assignment Requests Safely
  // =========================================================================
  console.log('--- Test 11: Handle Concurrent Assignment Requests ---');
  // Create Table with capacity 2
  const raceTable = await createTable(testProjectId, {
    table_name: 'Race Table',
    table_number: 'Race-1',
    capacity: 2
  });

  // Create 5 different attending guests
  const raceGuests = await Promise.all([
    createGuest(testProjectId, { full_name: 'Guest C1', rsvp_status: 'attending' }),
    createGuest(testProjectId, { full_name: 'Guest C2', rsvp_status: 'attending' }),
    createGuest(testProjectId, { full_name: 'Guest C3', rsvp_status: 'attending' }),
    createGuest(testProjectId, { full_name: 'Guest C4', rsvp_status: 'attending' }),
    createGuest(testProjectId, { full_name: 'Guest C5', rsvp_status: 'attending' })
  ]);

  // Fire 5 concurrent requests in parallel using Promise.all
  const results = await Promise.all(
    raceGuests.map(g => assignGuestToTable(testProjectId, raceTable.id, g.id))
  );

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  const finalRaceTable = (await getEventTables(testProjectId)).find(t => t.id === raceTable.id);
  assert(finalRaceTable?.assigned_count === 2, `Capacity strictly honored under concurrent load (got ${finalRaceTable?.assigned_count}/2)`);
  assert(successCount === 2, `Exactly 2 concurrent assignments succeeded (got ${successCount})`);
  assert(failureCount === 3, `Excess concurrent assignments rejected (got ${failureCount})`);

  // =========================================================================
  // TEST 12: Prevent Deleting Tables with Assigned Guests Without Force
  // =========================================================================
  console.log('--- Test 12: Prevent Deleting Occupied Tables Without Force ---');
  // raceTable currently has 2 assigned guests. Attempt DELETE without force
  const deleteOccupiedNoForce = await fetch(`${BASE_URL}/api/projects/${testProjectId}/tables/${raceTable.id}`, {
    method: 'DELETE',
    headers: headersWithAuth
  });

  assert(deleteOccupiedNoForce.status === 400, `Deleting occupied table without force returns 400 (got ${deleteOccupiedNoForce.status})`);
  const occupiedErr = await deleteOccupiedNoForce.json();
  assert(occupiedErr.error.includes('assigned guest'), 'Error clearly explains table has assigned guests');

  // Verify table was NOT deleted
  const tableStillExists = (await getEventTables(testProjectId)).some(t => t.id === raceTable.id);
  assert(tableStillExists, 'Occupied table preserved');

  // Now delete WITH force=true
  const deleteWithForce = await fetch(`${BASE_URL}/api/projects/${testProjectId}/tables/${raceTable.id}?force=true`, {
    method: 'DELETE',
    headers: headersWithAuth
  });

  assert(deleteWithForce.status === 200, `Deleting with force=true returns 200 (got ${deleteWithForce.status})`);
  const tableNowDeleted = !(await getEventTables(testProjectId)).some(t => t.id === raceTable.id);
  assert(tableNowDeleted, 'Table deleted after explicit force');

  // Check that the seated guests were safely unassigned and NOT deleted from the database
  const allGuestsAfterDelete = await getEventGuests(testProjectId);
  const preservedGuest = allGuestsAfterDelete.find(g => g.id === raceGuests[0].id);
  assert(preservedGuest !== undefined, 'Guests are preserved in guest list');
  assert(preservedGuest?.assigned_table_id === null, 'Guests are safely unassigned');

  // =========================================================================
  // TEST 13: Seating Assignments API (GET /api/projects/:id/seating-assignments)
  // =========================================================================
  console.log('--- Test 13: Retrieve All Seating Assignments ---');
  const asgRes = await fetch(`${BASE_URL}/api/projects/${testProjectId}/seating-assignments`, {
    headers: headersWithAuth
  });

  assert(asgRes.status === 200, `Seating assignments endpoint returns 200 (got ${asgRes.status})`);
  const asgData = await asgRes.json();
  assert(asgData.success === true, 'Returns success: true');
  assert(Array.isArray(asgData.assignments), 'Returns assignments array');

  // =========================================================================
  // TEST 14: Venue Hall Layout API (GET & POST /api/projects/:id/venue-layout)
  // =========================================================================
  console.log('--- Test 14: Venue Hall Layout API ---');
  const layoutGetRes = await fetch(`${BASE_URL}/api/projects/${testProjectId}/venue-layout`, {
    headers: headersWithAuth
  });

  assert(layoutGetRes.status === 200, `Layout GET returns 200 (got ${layoutGetRes.status})`);
  const layoutGetData = await layoutGetRes.json();
  assert(layoutGetData.success === true, 'Layout response has success: true');
  assert(layoutGetData.layout !== undefined, 'Layout response contains layout object');

  const layoutSaveRes = await fetch(`${BASE_URL}/api/projects/${testProjectId}/venue-layout`, {
    method: 'POST',
    headers: headersWithAuth,
    body: JSON.stringify({
      layout_name: 'Grand Ballroom Plan A',
      canvas_width: 2400,
      canvas_height: 1600,
      grid_size: 50,
      snap_to_grid: true
    })
  });

  assert(layoutSaveRes.status === 200, `Layout POST returns 200 (got ${layoutSaveRes.status})`);
  const layoutSaveData = await layoutSaveRes.json();
  assert(layoutSaveData.layout.layout_name === 'Grand Ballroom Plan A', 'Layout name saved');
  assert(layoutSaveData.layout.canvas_width === 2400, 'Canvas width saved');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSeatingApiTests().catch((err) => {
  console.error('Fatal error running seating API tests:', err);
  process.exit(1);
});
