import assert from 'node:assert/strict';
import {
  computeOverviewStats,
  computeWeddingCountdown,
  extractEventMilestones,
  fetchEventOverviewBundle,
  parseInvitationConfig,
  projectFloorPlanPreview,
} from '../src/lib/eventOverview';
import { Guest, Message, SeatingTable, VenueLayout, WeddingEvent } from '../src/types';

async function runTests() {
  console.log('Running Event Overview Dashboard tests...');

  // 1. Real-time KPI computation accuracy
  const sampleGuests: Guest[] = [
    {
      id: 'g1',
      project_id: 'evt-1',
      full_name: 'Alice Chen',
      rsvp_status: 'attending',
      pax: 2,
      assigned_table_id: 't1',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'g2',
      project_id: 'evt-1',
      full_name: 'Brian Tan',
      rsvp_status: 'attending',
      pax: 1,
      assigned_table_id: null,
      created_at: '2026-01-02',
      updated_at: '2026-01-02',
    },
    {
      id: 'g3',
      project_id: 'evt-1',
      full_name: 'Clara Lim',
      rsvp_status: 'declined',
      pax: 1,
      assigned_table_id: null,
      created_at: '2026-01-03',
      updated_at: '2026-01-03',
    },
    {
      id: 'g4',
      project_id: 'evt-1',
      full_name: 'David Wong',
      rsvp_status: 'pending',
      pax: 2,
      assigned_table_id: null,
      created_at: '2026-01-04',
      updated_at: '2026-01-04',
    },
  ];

  const sampleTables: SeatingTable[] = [
    {
      id: 't1',
      project_id: 'evt-1',
      table_name: 'Gardenia',
      table_number: '1',
      table_type: 'round',
      capacity: 10,
      assigned_count: 1,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 't2',
      project_id: 'evt-1',
      table_name: 'Orchid',
      table_number: '2',
      table_type: 'rectangular',
      capacity: 8,
      assigned_count: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ];

  const sampleMessages: Message[] = [
    { id: 'm1', name: 'Alice', message: 'Best wishes!', timestamp: 1700000000000, status: 'approved' },
    { id: 'm2', name: 'Brian', message: 'So excited!', timestamp: 1700000001000, status: 'pending' },
    { id: 'm3', name: 'Spam', message: 'Ignore', timestamp: 1700000002000, status: 'rejected' },
  ];

  const stats = computeOverviewStats(sampleGuests, sampleTables, sampleMessages);
  assert.equal(stats.totalGuests, 4);
  assert.equal(stats.totalPax, 6);
  assert.equal(stats.confirmedRsvp, 2);
  assert.equal(stats.confirmedPax, 3);
  assert.equal(stats.declinedRsvp, 1);
  assert.equal(stats.pendingRsvp, 1);
  assert.equal(stats.assignedSeating, 1);
  assert.equal(stats.unassignedGuests, 1); // g2 attending & unassigned
  assert.equal(stats.unassignedAllActive, 2); // g2 + g4 pending
  assert.equal(stats.totalWishMessages, 3);
  assert.equal(stats.approvedMessages, 1);
  assert.equal(stats.pendingMessages, 1);
  assert.equal(stats.rejectedMessages, 1);
  assert.equal(stats.totalTables, 2);
  assert.equal(stats.totalCapacity, 18);
  assert.equal(stats.seatingOccupancyPct, 6); // round(1/18*100)
  assert.equal(stats.rsvpCompletionPct, 75); // 3 responded out of 4
  console.log('✓ computeOverviewStats verified');

  // 2. Empty state KPIs
  const emptyStats = computeOverviewStats([], [], []);
  assert.equal(emptyStats.totalGuests, 0);
  assert.equal(emptyStats.rsvpCompletionPct, 0);
  assert.equal(emptyStats.seatingOccupancyPct, 0);
  console.log('✓ Empty stats zero-state verified');

  // 3. Countdown computation
  const refDate = new Date(2026, 5, 10, 14, 30, 0); // June 10, 2026
  const upcoming = computeWeddingCountdown('2026-06-20', refDate);
  assert.equal(upcoming.status, 'upcoming');
  assert.equal(upcoming.daysRemaining, 10);
  assert.equal(upcoming.headline, '10 Days Left');

  const today = computeWeddingCountdown('2026-06-10', refDate);
  assert.equal(today.status, 'today');
  assert.equal(today.daysRemaining, 0);

  const past = computeWeddingCountdown('2026-06-05', refDate);
  assert.equal(past.status, 'past');
  assert.equal(past.daysRemaining, -5);

  const unscheduled = computeWeddingCountdown(null, refDate);
  assert.equal(unscheduled.status, 'unscheduled');
  assert.equal(unscheduled.daysRemaining, null);
  console.log('✓ computeWeddingCountdown verified');

  // 4. Event Timeline milestones extraction
  const mockEvent: Partial<WeddingEvent> = {
    id: 'evt-1',
    name: 'Lucas & Sofia',
    groom_name: 'Lucas',
    bride_name: 'Sofia',
    wedding_date: '2026-08-15',
    location: 'Villa Erba',
    website_status: 'published',
    website_published_at: '2026-05-01',
    slug: 'lucas-sofia',
    invitation_config: JSON.stringify({
      elements: [{ id: 'el1', type: 'text', x: 0, y: 0, width: 100, height: 50, rotation: 0, zIndex: 1, text: 'Invite' }],
      canvasWidth: 1000,
      canvasHeight: 1414,
    }),
    website_config: {
      sections: [
        { id: 's-rsvp', type: 'rsvp', enabled: true, content: { rsvpDeadline: '2026-07-15' } },
        {
          id: 's-sched',
          type: 'schedule',
          enabled: true,
          content: {
            events: [
              { id: 'e1', time: '4:00 PM', title: 'Garden Ceremony', location: 'Lakeside Lawn' },
              { id: 'e2', time: '7:00 PM', title: 'Grand Reception', location: 'Ballroom' },
            ],
          },
        },
      ],
      overviewMilestones: [
        { id: 'cm1', title: 'Cake Tasting', date: '2026-06-01', category: 'planning', completed: true },
      ],
    },
  };

  const milestones = extractEventMilestones(mockEvent, new Date(2026, 5, 10));
  assert.ok(milestones.some((m) => m.id === 'ms-invitation'));
  assert.ok(milestones.some((m) => m.id === 'ms-rsvp-deadline' && m.category === 'rsvp'));
  assert.ok(milestones.some((m) => m.category === 'ceremony'));
  assert.ok(milestones.some((m) => m.category === 'reception'));
  assert.ok(milestones.some((m) => m.id === 'ms-wedding-day'));
  assert.ok(milestones.some((m) => m.id === 'cm1' && m.completed === true));
  console.log('✓ extractEventMilestones verified');

  // 5. Invitation config parser
  const parsedInv = parseInvitationConfig(mockEvent.invitation_config);
  assert.equal(parsedInv.hasCustomDesign, true);
  assert.equal(parsedInv.elements.length, 1);
  assert.equal(parseInvitationConfig(null).hasCustomDesign, false);
  console.log('✓ parseInvitationConfig verified');

  // 6. Floor plan miniature projection (world coordinates + table linking)
  const sampleLayout: VenueLayout = {
    id: 'lay-1',
    project_id: 'evt-1',
    layout_name: 'Grand Ballroom',
    venue_name: 'Crystal Pavilion',
    venue_width: 30,
    venue_height: 20,
    venue_unit: 'm',
    coordinate_system: 'world',
    canvas_width: 1800,
    canvas_height: 1200,
    grid_size: 30,
    snap_to_grid: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    objects: [
      {
        id: 'obj-stage',
        venue_layout_id: 'lay-1',
        project_id: 'evt-1',
        object_type: 'stage',
        label: 'Main Stage',
        position_x: 9,
        position_y: 1,
        width: 12,
        height: 3,
        rotation: 0,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'obj-t1',
        venue_layout_id: 'lay-1',
        project_id: 'evt-1',
        object_type: 'table',
        object_reference_id: 't1',
        position_x: 6,
        position_y: 8,
        width: 2.4,
        height: 2.4,
        rotation: 0,
        created_at: '',
        updated_at: '',
      },
    ],
  };

  const fp = projectFloorPlanPreview(sampleLayout, sampleTables);
  assert.equal(fp.hasObjects, true);
  assert.equal(fp.venueName, 'Crystal Pavilion');
  assert.equal(fp.objects.length, 2);
  const t1Obj = fp.objects.find((o) => o.id === 'obj-t1')!;
  assert.equal(t1Obj.isTable, true);
  assert.equal(t1Obj.isRound, true);
  assert.equal(t1Obj.tableNumber, '1');
  assert.equal(t1Obj.assignedCount, 1);
  assert.equal(t1Obj.capacity, 10);
  assert.equal(t1Obj.xPct, 20); // 6 / 30 * 100
  assert.equal(t1Obj.yPct, 40); // 8 / 20 * 100
  console.log('✓ projectFloorPlanPreview verified');

  // 7. Cross-organization isolation check
  await assert.rejects(
    () =>
      fetchEventOverviewBundle({
        projectId: 'evt-1',
        expectedAgencyId: 'agency-A',
        projectAgencyId: 'agency-B',
      }),
    /Cross-organization access denied/
  );
  console.log('✓ Cross-organization isolation verified');

  console.log('All Event Overview Dashboard tests passed!');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
