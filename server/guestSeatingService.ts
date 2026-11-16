import { getSupabaseAdmin, isSupabaseAvailable } from './supabaseAdmin';
import {
  Guest,
  GuestGroup,
  SeatingTable,
  SeatingAssignment,
  VenueLayout,
  VenueLayoutObject,
  GuestRSVPStatus
} from '../src/types';
import {
  CURRENT_LAYOUT_MIGRATION_VERSION,
  VenueUnit,
  getCanonicalObjectDefaults,
  getMinWorldDimension,
  getPixelsPerUnit,
  isLegacyLayout,
  migrateVenueLayout,
  normalizeVenueLayout,
  roundToDecimals
} from '../src/utils/venueCoordinates';

// Fallback in-memory storage for test/offline environments when Supabase env is unconfigured
interface EventStorage {
  guests: Map<string, Guest>;
  groups: Map<string, GuestGroup>;
  tables: Map<string, SeatingTable>;
  assignments: Map<string, SeatingAssignment>; // key: `${projectId}:${guestId}`
  layout: VenueLayout | null;
}

const memoryStore: Map<string, EventStorage> = new Map();
const layoutSaveLocks: Map<string, Promise<any>> = new Map();

function getEventMemoryStore(projectId: string): EventStorage {
  if (!memoryStore.has(projectId)) {
    memoryStore.set(projectId, {
      guests: new Map(),
      groups: new Map(),
      tables: new Map(),
      assignments: new Map(),
      layout: null
    });
  }
  return memoryStore.get(projectId)!;
}

async function withProjectSaveLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const prev = layoutSaveLocks.get(projectId) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  layoutSaveLocks.set(projectId, current);

  try {
    await prev.catch(() => {});
    return await fn();
  } finally {
    release();
    if (layoutSaveLocks.get(projectId) === current) {
      layoutSaveLocks.delete(projectId);
    }
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value?: string | null): boolean {
  return Boolean(value && UUID_REGEX.test(value.trim()));
}

/**
 * Generates an RFC4122 UUIDv4 compliant with Postgres UUID columns.
 */
function genId(_prefix: string = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Converts legacy non-UUID string IDs (e.g. `obj_173...`) into a deterministic RFC4122-valid UUID
 * before persisting to PostgreSQL UUID columns so 22P02 invalid UUID errors can never occur.
 */
export function ensureValidUuid(value?: string | null): string {
  if (value && UUID_REGEX.test(value.trim())) {
    return value.trim().toLowerCase();
  }
  if (!value || !value.trim()) {
    return genId('uuid');
  }

  // Deterministic 128-bit FNV-1a-derived UUIDv4 for stable mapping of non-UUID strings
  const str = value.trim();
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0xdeadbeef;
  let h3 = 0x811c9dc5 ^ 0xcafebabe;
  let h4 = 0x811c9dc5 ^ 0x12345678;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x01000193) >>> 0;
    h3 = Math.imul(h3 ^ (ch * 31 + i), 0x01000193) >>> 0;
    h4 = Math.imul(h4 ^ (ch * 17 + str.length), 0x01000193) >>> 0;
  }

  const hex =
    h1.toString(16).padStart(8, '0') +
    h2.toString(16).padStart(8, '0') +
    h3.toString(16).padStart(8, '0') +
    h4.toString(16).padStart(8, '0');

  const part1 = hex.slice(0, 8);
  const part2 = hex.slice(8, 12);
  const part3 = '4' + hex.slice(13, 16);
  const variantNibble = ['8', '9', 'a', 'b'][parseInt(hex.slice(16, 17), 16) % 4];
  const part4 = variantNibble + hex.slice(17, 20);
  const part5 = hex.slice(20, 32);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

function trySupabase() {
  if (!isSupabaseAvailable()) return null;
  return getSupabaseAdmin();
}

// -------------------------------------------------------------
// 1. GUEST MANAGEMENT SERVICE
// -------------------------------------------------------------

export async function getEventGuests(projectId: string): Promise<Guest[]> {
  const supabase = trySupabase();
  if (supabase) {
    const { data: guests, error } = await supabase
      .from('guests')
      .select('*, guest_group:guest_groups(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to load guests: ${error.message}`);
    }

    if (guests && guests.length > 0) {
      const { data: assignments, error: assignErr } = await supabase
        .from('seating_assignments')
        .select('guest_id, seating_table_id, seat_number, seating_tables(table_name, table_number)')
        .eq('project_id', projectId);

      if (assignErr) {
        throw new Error(`Failed to load guest assignments: ${assignErr.message}`);
      }

      const assignMap = new Map<string, any>();
      (assignments || []).forEach((a: any) => {
        assignMap.set(a.guest_id, {
          table_id: a.seating_table_id,
          table_name: a.seating_tables?.table_name,
          table_number: a.seating_tables?.table_number,
          seat_number: a.seat_number
        });
      });

      return guests.map((g: any) => {
        const a = assignMap.get(g.id);
        return {
          ...g,
          assigned_table_id: a?.table_id || null,
          assigned_table_name: a?.table_name || null,
          assigned_table_number: a?.table_number || null,
          seat_number: a?.seat_number || null
        };
      });
    }

    // Auto-sync from existing rsvps if guests table is empty
    const { data: rsvps, error: rsvpErr } = await supabase
      .from('rsvps')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (rsvpErr) {
      throw new Error(`Failed to check RSVPs for guest sync: ${rsvpErr.message}`);
    }

    if (rsvps && rsvps.length > 0) {
      const syncedGuests: Guest[] = [];
      for (const r of rsvps) {
        const guest = await syncGuestFromRSVP(projectId, r);
        syncedGuests.push(...guest);
      }
      return syncedGuests;
    }

    return [];
  }

  // Memory store fallback (tests / offline)
  const store = getEventMemoryStore(projectId);
  const result: Guest[] = [];
  store.guests.forEach((g) => {
    const assign = store.assignments.get(`${projectId}:${g.id}`);
    const table = assign ? store.tables.get(assign.seating_table_id) : null;
    const group = g.guest_group_id ? store.groups.get(g.guest_group_id) : null;

    result.push({
      ...g,
      guest_group: group || null,
      assigned_table_id: table ? table.id : null,
      assigned_table_name: table ? table.table_name : null,
      assigned_table_number: table ? table.table_number : null,
      seat_number: assign?.seat_number || null
    });
  });
  return result;
}

export async function createGuest(projectId: string, guestData: Partial<Guest>): Promise<Guest> {
  const newGuest: Guest = {
    id: genId('gst'),
    project_id: projectId,
    guest_group_id: guestData.guest_group_id || null,
    full_name: guestData.full_name?.trim() || 'New Guest',
    email: guestData.email?.trim() || '',
    phone: guestData.phone?.trim() || '',
    rsvp_status: guestData.rsvp_status || 'pending',
    pax: guestData.pax || 1,
    meal_preference: guestData.meal_preference || '',
    dietary_notes: guestData.dietary_notes || '',
    notes: guestData.notes || '',
    is_vip: Boolean(guestData.is_vip),
    is_plus_one: Boolean(guestData.is_plus_one),
    primary_guest_id: guestData.primary_guest_id || null,
    rsvp_id: guestData.rsvp_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const supabase = trySupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('guests')
      .insert([newGuest])
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create guest: ${error?.message || 'Unknown error'}`);
    }
    return data;
  }

  const store = getEventMemoryStore(projectId);
  store.guests.set(newGuest.id, newGuest);
  return newGuest;
}

export async function updateGuest(projectId: string, guestId: string, updates: Partial<Guest>): Promise<Guest | null> {
  const safeUpdates = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  const supabase = trySupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('guests')
      .update(safeUpdates)
      .eq('id', guestId)
      .eq('project_id', projectId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update guest: ${error.message}`);
    }
    return data || null;
  }

  const store = getEventMemoryStore(projectId);
  const existing = store.guests.get(guestId);
  if (!existing) return null;

  const updated = { ...existing, ...safeUpdates };
  store.guests.set(guestId, updated);
  return updated;
}

export async function deleteGuest(projectId: string, guestId: string): Promise<boolean> {
  const supabase = trySupabase();
  if (supabase) {
    const { error: assignErr } = await supabase
      .from('seating_assignments')
      .delete()
      .eq('guest_id', guestId)
      .eq('project_id', projectId);

    if (assignErr) {
      throw new Error(`Failed to clear guest assignment: ${assignErr.message}`);
    }

    const { error } = await supabase
      .from('guests')
      .delete()
      .eq('id', guestId)
      .eq('project_id', projectId);

    if (error) {
      throw new Error(`Failed to delete guest: ${error.message}`);
    }
    return true;
  }

  const store = getEventMemoryStore(projectId);
  store.assignments.delete(`${projectId}:${guestId}`);
  return store.guests.delete(guestId);
}

// -------------------------------------------------------------
// 2. GUEST GROUPS SERVICE
// -------------------------------------------------------------

export async function getEventGroups(projectId: string): Promise<GuestGroup[]> {
  const supabase = trySupabase();
  if (supabase) {
    const { data: groups, error } = await supabase
      .from('guest_groups')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to load guest groups: ${error.message}`);
    }

    const { data: countData } = await supabase
      .from('guests')
      .select('guest_group_id')
      .eq('project_id', projectId);

    const countMap = new Map<string, number>();
    (countData || []).forEach((g: any) => {
      if (g.guest_group_id) {
        countMap.set(g.guest_group_id, (countMap.get(g.guest_group_id) || 0) + 1);
      }
    });

    return (groups || []).map((grp: any) => ({
      ...grp,
      member_count: countMap.get(grp.id) || 0
    }));
  }

  const store = getEventMemoryStore(projectId);
  const result: GuestGroup[] = [];
  store.groups.forEach((grp) => {
    let memberCount = 0;
    store.guests.forEach((g) => {
      if (g.guest_group_id === grp.id) memberCount++;
    });
    result.push({ ...grp, member_count: memberCount });
  });
  return result;
}

export async function createGuestGroup(projectId: string, groupData: Partial<GuestGroup>): Promise<GuestGroup> {
  const newGroup: GuestGroup = {
    id: genId('grp'),
    project_id: projectId,
    group_name: groupData.group_name?.trim() || 'New Family / Group',
    invitation_reference: groupData.invitation_reference || '',
    color: groupData.color || '#8B806F',
    notes: groupData.notes || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const supabase = trySupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('guest_groups')
      .insert([newGroup])
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create guest group: ${error?.message || 'Unknown error'}`);
    }
    return { ...data, member_count: 0 };
  }

  const store = getEventMemoryStore(projectId);
  store.groups.set(newGroup.id, newGroup);
  return { ...newGroup, member_count: 0 };
}

export async function updateGuestGroup(projectId: string, groupId: string, updates: Partial<GuestGroup>): Promise<GuestGroup | null> {
  const safeUpdates = { ...updates, updated_at: new Date().toISOString() };

  const supabase = trySupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('guest_groups')
      .update(safeUpdates)
      .eq('id', groupId)
      .eq('project_id', projectId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update guest group: ${error.message}`);
    }
    return data || null;
  }

  const store = getEventMemoryStore(projectId);
  const existing = store.groups.get(groupId);
  if (!existing) return null;

  const updated = { ...existing, ...safeUpdates };
  store.groups.set(groupId, updated);
  return updated;
}

export async function deleteGuestGroup(projectId: string, groupId: string): Promise<boolean> {
  const supabase = trySupabase();
  if (supabase) {
    const { error: clearErr } = await supabase
      .from('guests')
      .update({ guest_group_id: null })
      .eq('guest_group_id', groupId)
      .eq('project_id', projectId);

    if (clearErr) {
      throw new Error(`Failed to clear group members: ${clearErr.message}`);
    }

    const { error } = await supabase
      .from('guest_groups')
      .delete()
      .eq('id', groupId)
      .eq('project_id', projectId);

    if (error) {
      throw new Error(`Failed to delete guest group: ${error.message}`);
    }
    return true;
  }

  const store = getEventMemoryStore(projectId);
  store.guests.forEach((g) => {
    if (g.guest_group_id === groupId) {
      g.guest_group_id = null;
    }
  });
  return store.groups.delete(groupId);
}

// -------------------------------------------------------------
// 3. TABLE MANAGEMENT & SEATING ASSIGNMENT
// -------------------------------------------------------------

export async function getEventTables(projectId: string): Promise<SeatingTable[]> {
  const supabase = trySupabase();
  if (supabase) {
    const { data: tables, error } = await supabase
      .from('seating_tables')
      .select('*')
      .eq('project_id', projectId)
      .order('table_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to load seating tables: ${error.message}`);
    }

    if (tables && tables.length > 0) {
      const allGuests = await getEventGuests(projectId);
      const guestMap = new Map<string, Guest>();
      allGuests.forEach((g) => guestMap.set(g.id, g));

      const { data: assignments, error: assignErr } = await supabase
        .from('seating_assignments')
        .select('*')
        .eq('project_id', projectId);

      if (assignErr) {
        throw new Error(`Failed to load seating assignments: ${assignErr.message}`);
      }

      const tableGuestMap = new Map<string, Guest[]>();
      (assignments || []).forEach((a: any) => {
        const guest = guestMap.get(a.guest_id);
        if (guest) {
          const list = tableGuestMap.get(a.seating_table_id) || [];
          list.push({ ...guest, seat_number: a.seat_number });
          tableGuestMap.set(a.seating_table_id, list);
        }
      });

      return tables.map((t: any) => {
        const assigned = tableGuestMap.get(t.id) || [];
        return {
          ...t,
          assigned_guests: assigned,
          assigned_count: assigned.length,
          remaining_seats: Math.max(0, t.capacity - assigned.length)
        };
      });
    }

    const defaultTables = await initializeDefaultTables(projectId);
    return defaultTables;
  }

  const store = getEventMemoryStore(projectId);
  if (store.tables.size === 0) {
    await initializeDefaultTables(projectId);
  }

  const result: SeatingTable[] = [];
  store.tables.forEach((t) => {
    const assigned: Guest[] = [];
    store.assignments.forEach((assign) => {
      if (assign.seating_table_id === t.id) {
        const guest = store.guests.get(assign.guest_id);
        if (guest) assigned.push({ ...guest, seat_number: assign.seat_number });
      }
    });

    result.push({
      ...t,
      assigned_guests: assigned,
      assigned_count: assigned.length,
      remaining_seats: Math.max(0, t.capacity - assigned.length)
    });
  });

  return result.sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true }));
}

async function initializeDefaultTables(projectId: string): Promise<SeatingTable[]> {
  const initialTemplates = [
    { name: 'Table 01 — Bride Family', number: '1', type: 'round' as const, capacity: 10, category: 'Family' },
    { name: 'Table 02 — Groom Family', number: '2', type: 'round' as const, capacity: 10, category: 'Family' },
    { name: 'Table 03 — Wedding Party & Friends', number: '3', type: 'round' as const, capacity: 8, category: 'Friends' },
    { name: 'Table 04 — Colleagues & Friends', number: '4', type: 'round' as const, capacity: 8, category: 'Colleagues' },
    { name: 'VIP Table — Honored Guests', number: '5', type: 'rectangular' as const, capacity: 10, category: 'VIP' }
  ];

  const created: SeatingTable[] = [];
  for (const t of initialTemplates) {
    const table = await createTable(projectId, {
      table_name: t.name,
      table_number: t.number,
      table_type: t.type,
      capacity: t.capacity,
      category: t.category
    });
    created.push(table);
  }
  return created;
}

/**
 * Finds the next clean non-overlapping world-coordinate slot inside the venue boundary
 * for a newly created or synced reception table.
 */
function findNonOverlappingWorldSlot(
  existingObjects: VenueLayoutObject[],
  width: number,
  height: number,
  venueWidth: number,
  venueHeight: number,
  unit: VenueUnit,
  preferredIndex: number = 0
): { x: number; y: number } {
  const margin = unit === 'ft' ? 4.0 : 1.5;
  const chairPad = unit === 'ft' ? 3.0 : 1.0;
  const stepX = Math.max(width + chairPad * 2, unit === 'ft' ? 12.0 : 3.6);
  const stepY = Math.max(height + chairPad * 2, unit === 'ft' ? 12.0 : 3.6);

  const overlaps = (candX: number, candY: number) => {
    const cLeft = candX - chairPad;
    const cRight = candX + width + chairPad;
    const cTop = candY - chairPad;
    const cBottom = candY + height + chairPad;

    return existingObjects.some((o) => {
      const oLeft = o.position_x;
      const oRight = o.position_x + o.width;
      const oTop = o.position_y;
      const oBottom = o.position_y + o.height;
      return cLeft < oRight && cRight > oLeft && cTop < oBottom && cBottom > oTop;
    });
  };

  // Symmetrical preferred positions around a standard ballroom first
  const symmetricSlots: Array<{ x: number; y: number }> =
    unit === 'ft'
      ? [
          { x: roundToDecimals(venueWidth * 0.16, 1), y: roundToDecimals(venueHeight * 0.28, 1) },
          { x: roundToDecimals(venueWidth * 0.72, 1), y: roundToDecimals(venueHeight * 0.28, 1) },
          { x: roundToDecimals(venueWidth * 0.16, 1), y: roundToDecimals(venueHeight * 0.52, 1) },
          { x: roundToDecimals(venueWidth * 0.72, 1), y: roundToDecimals(venueHeight * 0.52, 1) },
          { x: roundToDecimals(venueWidth * 0.44, 1), y: roundToDecimals(venueHeight * 0.65, 1) },
          { x: roundToDecimals(venueWidth * 0.16, 1), y: roundToDecimals(venueHeight * 0.72, 1) },
          { x: roundToDecimals(venueWidth * 0.72, 1), y: roundToDecimals(venueHeight * 0.72, 1) }
        ]
      : [
          { x: roundToDecimals(venueWidth * 0.16, 2), y: roundToDecimals(venueHeight * 0.28, 2) },
          { x: roundToDecimals(venueWidth * 0.74, 2), y: roundToDecimals(venueHeight * 0.28, 2) },
          { x: roundToDecimals(venueWidth * 0.16, 2), y: roundToDecimals(venueHeight * 0.52, 2) },
          { x: roundToDecimals(venueWidth * 0.74, 2), y: roundToDecimals(venueHeight * 0.52, 2) },
          { x: roundToDecimals(venueWidth * 0.44, 2), y: roundToDecimals(venueHeight * 0.65, 2) },
          { x: roundToDecimals(venueWidth * 0.16, 2), y: roundToDecimals(venueHeight * 0.72, 2) },
          { x: roundToDecimals(venueWidth * 0.74, 2), y: roundToDecimals(venueHeight * 0.72, 2) }
        ];

  const orderedCandidates = [
    ...symmetricSlots.slice(preferredIndex % symmetricSlots.length),
    ...symmetricSlots.slice(0, preferredIndex % symmetricSlots.length)
  ];

  for (const cand of orderedCandidates) {
    const cx = Math.max(margin, Math.min(venueWidth - width - margin, cand.x));
    const cy = Math.max(margin, Math.min(venueHeight - height - margin, cand.y));
    if (!overlaps(cx, cy)) {
      return { x: roundToDecimals(cx, 2), y: roundToDecimals(cy, 2) };
    }
  }

  // Systematic grid scan inside venue boundary
  const startY = Math.min(venueHeight * 0.25, margin + (unit === 'ft' ? 12 : 4));
  for (let y = startY; y + height + margin <= venueHeight; y += stepY) {
    for (let x = margin; x + width + margin <= venueWidth; x += stepX) {
      if (!overlaps(x, y)) {
        return { x: roundToDecimals(x, 2), y: roundToDecimals(y, 2) };
      }
    }
  }

  // Fallback inside safe central margin
  const offsetIndex = (preferredIndex % 5) * (unit === 'ft' ? 3 : 1);
  return {
    x: roundToDecimals(Math.max(margin, Math.min(venueWidth - width - margin, margin + offsetIndex)), 2),
    y: roundToDecimals(Math.max(margin, Math.min(venueHeight - height - margin, venueHeight * 0.5 + offsetIndex)), 2)
  };
}

function buildTableLayoutObject(
  layout: Pick<VenueLayout, 'id' | 'venue_width' | 'venue_height' | 'venue_unit'>,
  projectId: string,
  table: SeatingTable,
  existingObjects: VenueLayoutObject[],
  slotIndex: number = 0
): VenueLayoutObject {
  const unit: VenueUnit = layout.venue_unit === 'ft' ? 'ft' : 'm';
  const venueW = layout.venue_width || (unit === 'ft' ? 100 : 30);
  const venueH = layout.venue_height || (unit === 'ft' ? 65 : 20);
  const defaults = getCanonicalObjectDefaults('table', unit, table.table_type);
  const slot = findNonOverlappingWorldSlot(
    existingObjects,
    defaults.width,
    defaults.height,
    venueW,
    venueH,
    unit,
    slotIndex
  );

  const now = new Date().toISOString();
  return {
    id: genId('obj'),
    venue_layout_id: layout.id,
    project_id: projectId,
    object_type: 'table',
    object_reference_id: table.id,
    label: `T${table.table_number}: ${table.table_name}`,
    position_x: slot.x,
    position_y: slot.y,
    width: defaults.width,
    height: defaults.height,
    rotation: 0,
    properties: {
      tableShape: table.table_type,
      capacity: table.capacity,
      tableNumber: table.table_number,
      world_unit: unit,
      migrated_v2: true
    },
    z_index: 5,
    created_at: now,
    updated_at: now
  };
}

export async function createTable(projectId: string, tableData: Partial<SeatingTable>): Promise<SeatingTable> {
  const newTable: SeatingTable = {
    id: genId('tbl'),
    project_id: projectId,
    table_name: tableData.table_name?.trim() || `Table ${tableData.table_number || '1'}`,
    table_number: String(tableData.table_number || '1').trim(),
    table_type: tableData.table_type || 'round',
    capacity: Number(tableData.capacity) || 10,
    category: tableData.category || 'General',
    notes: tableData.notes || '',
    position_x: tableData.position_x !== undefined ? Number(tableData.position_x) : 100,
    position_y: tableData.position_y !== undefined ? Number(tableData.position_y) : 100,
    rotation: tableData.rotation !== undefined ? Number(tableData.rotation) : 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const supabase = trySupabase();
  let createdTable: SeatingTable = newTable;

  if (supabase) {
    const { data, error } = await supabase
      .from('seating_tables')
      .insert([newTable])
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create table: ${error?.message || 'Unknown error'}`);
    }
    createdTable = data;

    // Sync canvas object if venue layout already exists for this event
    const { data: existingLayout } = await supabase
      .from('venue_layouts')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (existingLayout) {
      const { data: existingObjs } = await supabase
        .from('venue_layout_objects')
        .select('*')
        .eq('venue_layout_id', existingLayout.id);

      const objsList: VenueLayoutObject[] = existingObjs || [];
      const alreadyPlaced = objsList.some(o => o.object_reference_id === createdTable.id);

      if (!alreadyPlaced) {
        const tableObj = buildTableLayoutObject(existingLayout, projectId, createdTable, objsList, objsList.length);
        const { error: objErr } = await supabase
          .from('venue_layout_objects')
          .insert([{
            ...tableObj,
            id: ensureValidUuid(tableObj.id),
            venue_layout_id: existingLayout.id,
            project_id: projectId
          }]);
        if (objErr) {
          console.warn('[TableService] Non-fatal canvas sync error on createTable:', objErr.message);
        }
      }
    }

    return { ...createdTable, assigned_guests: [], assigned_count: 0, remaining_seats: createdTable.capacity };
  }

  const store = getEventMemoryStore(projectId);
  store.tables.set(newTable.id, newTable);

  // Sync to memory layout if layout already initialized
  if (store.layout) {
    const alreadyPlaced = store.layout.objects.some(o => o.object_reference_id === newTable.id);
    if (!alreadyPlaced) {
      const normalized = normalizeVenueLayout(store.layout);
      const tableObj = buildTableLayoutObject(
        normalized,
        projectId,
        newTable,
        normalized.objects,
        store.tables.size - 1
      );
      store.layout = {
        ...normalized,
        objects: [...normalized.objects, tableObj],
        updated_at: new Date().toISOString()
      };
    }
  }

  return { ...newTable, assigned_guests: [], assigned_count: 0, remaining_seats: newTable.capacity };
}

export async function updateTable(projectId: string, tableId: string, updates: Partial<SeatingTable>): Promise<SeatingTable | null> {
  const safeUpdates: any = { ...updates, updated_at: new Date().toISOString() };
  if (updates.position_x !== undefined) safeUpdates.position_x = Number(updates.position_x);
  if (updates.position_y !== undefined) safeUpdates.position_y = Number(updates.position_y);
  if (updates.rotation !== undefined) safeUpdates.rotation = Number(updates.rotation);
  if (updates.capacity !== undefined) safeUpdates.capacity = Number(updates.capacity);

  const supabase = trySupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('seating_tables')
      .update(safeUpdates)
      .eq('id', tableId)
      .eq('project_id', projectId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update table: ${error.message}`);
    }
    if (!data) return null;

    // Synchronize matching canvas table objects while preserving canvas coordinates & rotation
    const { data: matchingObjs } = await supabase
      .from('venue_layout_objects')
      .select('*')
      .eq('project_id', projectId)
      .eq('object_reference_id', tableId);

    if (matchingObjs && matchingObjs.length > 0) {
      for (const obj of matchingObjs) {
        const nextProps = {
          ...(obj.properties || {}),
          tableNumber: data.table_number,
          capacity: data.capacity,
          tableShape: data.table_type
        };
        await supabase
          .from('venue_layout_objects')
          .update({
            label: `T${data.table_number}: ${data.table_name}`,
            properties: nextProps,
            updated_at: new Date().toISOString()
          })
          .eq('id', obj.id);
      }
    }

    return data;
  }

  const store = getEventMemoryStore(projectId);
  const existing = store.tables.get(tableId);
  if (!existing) return null;

  const updated = { ...existing, ...safeUpdates };
  store.tables.set(tableId, updated);

  if (store.layout) {
    store.layout = {
      ...store.layout,
      objects: store.layout.objects.map((o) => {
        if (o.object_reference_id !== tableId) return o;
        return {
          ...o,
          label: `T${updated.table_number}: ${updated.table_name}`,
          properties: {
            ...(o.properties || {}),
            tableNumber: updated.table_number,
            capacity: updated.capacity,
            tableShape: updated.table_type
          },
          updated_at: new Date().toISOString()
        };
      }),
      updated_at: new Date().toISOString()
    };
  }

  return updated;
}

export async function deleteTable(projectId: string, tableId: string): Promise<boolean> {
  const supabase = trySupabase();
  if (supabase) {
    // 1. Remove assignments for this table (guests become unassigned, NOT deleted)
    const { error: assignErr } = await supabase
      .from('seating_assignments')
      .delete()
      .eq('seating_table_id', tableId)
      .eq('project_id', projectId);

    if (assignErr) {
      throw new Error(`Failed to clear table assignments: ${assignErr.message}`);
    }

    // 2. Remove synced layout object(s) referencing this table, leaving unrelated objects intact
    const { error: objErr } = await supabase
      .from('venue_layout_objects')
      .delete()
      .eq('object_reference_id', tableId)
      .eq('project_id', projectId);

    if (objErr) {
      throw new Error(`Failed to remove table object from hall layout: ${objErr.message}`);
    }

    // 3. Delete table record
    const { error } = await supabase
      .from('seating_tables')
      .delete()
      .eq('id', tableId)
      .eq('project_id', projectId);

    if (error) {
      throw new Error(`Failed to delete table: ${error.message}`);
    }
    return true;
  }

  const store = getEventMemoryStore(projectId);
  const toDeleteAssigns: string[] = [];
  store.assignments.forEach((assign, key) => {
    if (assign.seating_table_id === tableId) {
      toDeleteAssigns.push(key);
    }
  });
  toDeleteAssigns.forEach((k) => store.assignments.delete(k));

  // Remove linked table object from canvas layout while preserving all other objects
  if (store.layout) {
    store.layout = {
      ...store.layout,
      objects: store.layout.objects.filter((o) => o.object_reference_id !== tableId),
      updated_at: new Date().toISOString()
    };
  }

  return store.tables.delete(tableId);
}

export async function assignGuestToTable(
  projectId: string,
  tableId: string,
  guestId: string,
  seatNumber?: number
): Promise<{ success: boolean; error?: string }> {
  const allGuests = await getEventGuests(projectId);
  const targetGuest = allGuests.find((g) => g.id === guestId);
  if (!targetGuest) {
    return { success: false, error: 'Guest not found' };
  }

  if (targetGuest.rsvp_status === 'declined') {
    return { success: false, error: 'Declined guests cannot be assigned to reception seats' };
  }

  const tables = await getEventTables(projectId);
  const targetTable = tables.find((t) => t.id === tableId);
  if (!targetTable) {
    return { success: false, error: 'Table not found' };
  }

  const alreadyAssignedToThis = targetTable.assigned_guests?.some((g) => g.id === guestId);
  if (!alreadyAssignedToThis && (targetTable.assigned_count || 0) >= targetTable.capacity) {
    return { success: false, error: `Table "${targetTable.table_name}" is full (Capacity: ${targetTable.capacity} seats)` };
  }

  const assignment: SeatingAssignment = {
    id: genId('asg'),
    project_id: projectId,
    guest_id: guestId,
    seating_table_id: tableId,
    seat_number: seatNumber || undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const supabase = trySupabase();
  if (supabase) {
    const { error } = await supabase
      .from('seating_assignments')
      .upsert(
        {
          project_id: projectId,
          guest_id: guestId,
          seating_table_id: tableId,
          seat_number: seatNumber || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'project_id, guest_id' }
      );

    if (error) {
      throw new Error(`Failed to assign guest to table: ${error.message}`);
    }
    return { success: true };
  }

  const store = getEventMemoryStore(projectId);
  store.assignments.set(`${projectId}:${guestId}`, assignment);
  return { success: true };
}

export async function unassignGuestFromTable(projectId: string, guestId: string): Promise<boolean> {
  const supabase = trySupabase();
  if (supabase) {
    const { error } = await supabase
      .from('seating_assignments')
      .delete()
      .eq('guest_id', guestId)
      .eq('project_id', projectId);

    if (error) {
      throw new Error(`Failed to unassign guest: ${error.message}`);
    }
    return true;
  }

  const store = getEventMemoryStore(projectId);
  store.assignments.delete(`${projectId}:${guestId}`);
  return true;
}

export async function getEventAssignments(projectId: string): Promise<SeatingAssignment[]> {
  const supabase = trySupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('seating_assignments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to load seating assignments: ${error.message}`);
    }
    return data || [];
  }

  const store = getEventMemoryStore(projectId);
  const result: SeatingAssignment[] = [];
  store.assignments.forEach((asg) => {
    if (asg.project_id === projectId) {
      result.push(asg);
    }
  });
  return result;
}

export async function assignGroupToTable(
  projectId: string,
  tableId: string,
  groupId: string
): Promise<{ success: boolean; assignedCount: number; error?: string }> {
  const allGuests = await getEventGuests(projectId);
  const groupGuests = allGuests.filter((g) => g.guest_group_id === groupId && g.rsvp_status !== 'declined');

  if (groupGuests.length === 0) {
    return { success: false, assignedCount: 0, error: 'No attending guests found in this group' };
  }

  const tables = await getEventTables(projectId);
  const targetTable = tables.find((t) => t.id === tableId);
  if (!targetTable) {
    return { success: false, assignedCount: 0, error: 'Table not found' };
  }

  const alreadyAtTableCount = groupGuests.filter((g) => g.assigned_table_id === tableId).length;
  const newSeatsRequired = groupGuests.length - alreadyAtTableCount;
  const availableSeats = targetTable.capacity - (targetTable.assigned_count || 0);

  if (newSeatsRequired > availableSeats) {
    return {
      success: false,
      assignedCount: 0,
      error: `Table "${targetTable.table_name}" does not have enough seats (Needs ${newSeatsRequired}, has ${availableSeats} available)`
    };
  }

  let assignedCount = 0;
  for (const guest of groupGuests) {
    const res = await assignGuestToTable(projectId, tableId, guest.id);
    if (res.success) assignedCount++;
  }

  return { success: true, assignedCount };
}

// -------------------------------------------------------------
// 4. VENUE HALL LAYOUT SERVICE
// -------------------------------------------------------------

/**
 * Generates a fresh default layout in canonical world coordinates (meters by default).
 * Never mixes pixel object coordinates with `coordinate_system = 'world'`.
 */
function createCanonicalDefaultLayout(projectId: string, tables: SeatingTable[]): VenueLayout {
  const layoutId = genId('lay');
  const now = new Date().toISOString();
  const unit: VenueUnit = 'm';
  const venueWidth = 30.0;
  const venueHeight = 20.0;
  const gridUnitStep = 0.5;
  const px = getPixelsPerUnit(unit);

  const stageDef = getCanonicalObjectDefaults('stage', unit);
  const coupleDef = getCanonicalObjectDefaults('couple_table', unit);
  const danceDef = getCanonicalObjectDefaults('dance_floor', unit);
  const entranceDef = getCanonicalObjectDefaults('entrance', unit);

  const objects: VenueLayoutObject[] = [
    {
      id: genId('obj'),
      venue_layout_id: layoutId,
      project_id: projectId,
      object_type: 'stage',
      object_reference_id: null,
      label: stageDef.label,
      position_x: roundToDecimals((venueWidth - 11.0) / 2, 2), // 9.5m
      position_y: 1.0,
      width: 11.0,
      height: 2.2,
      rotation: 0,
      properties: { ...stageDef.properties, world_unit: unit, migrated_v2: true },
      z_index: 1,
      created_at: now,
      updated_at: now
    },
    {
      id: genId('obj'),
      venue_layout_id: layoutId,
      project_id: projectId,
      object_type: 'couple_table',
      object_reference_id: null,
      label: coupleDef.label,
      position_x: roundToDecimals((venueWidth - coupleDef.width) / 2, 2), // 13.1m
      position_y: 3.8,
      width: coupleDef.width,
      height: coupleDef.height,
      rotation: 0,
      properties: { ...coupleDef.properties, world_unit: unit, migrated_v2: true },
      z_index: 2,
      created_at: now,
      updated_at: now
    },
    {
      id: genId('obj'),
      venue_layout_id: layoutId,
      project_id: projectId,
      object_type: 'dance_floor',
      object_reference_id: null,
      label: danceDef.label,
      position_x: roundToDecimals((venueWidth - 6.8) / 2, 2), // 11.6m
      position_y: 6.0,
      width: 6.8,
      height: 4.8,
      rotation: 0,
      properties: { ...danceDef.properties, world_unit: unit, migrated_v2: true },
      z_index: 1,
      created_at: now,
      updated_at: now
    },
    {
      id: genId('obj'),
      venue_layout_id: layoutId,
      project_id: projectId,
      object_type: 'entrance',
      object_reference_id: null,
      label: entranceDef.label,
      position_x: roundToDecimals((venueWidth - 5.0) / 2, 2), // 12.5m
      position_y: 17.8,
      width: 5.0,
      height: 1.2,
      rotation: 0,
      properties: { ...entranceDef.properties, world_unit: unit, migrated_v2: true },
      z_index: 1,
      created_at: now,
      updated_at: now
    }
  ];

  const baseLayout: VenueLayout = {
    id: layoutId,
    project_id: projectId,
    layout_name: 'Main Ballroom & Reception Hall',
    venue_width: venueWidth,
    venue_height: venueHeight,
    venue_unit: unit,
    venue_orientation: 'landscape',
    venue_name: 'Main Ballroom & Reception Hall',
    venue_description: 'Spacious banquet ballroom with stage, dance floor, entrance and dining tables',
    grid_unit_step: gridUnitStep,
    show_grid: true,
    show_rulers: true,
    coordinate_system: 'world',
    is_migrated: true,
    migration_version: CURRENT_LAYOUT_MIGRATION_VERSION,
    canvas_width: Math.round(venueWidth * px), // 1800
    canvas_height: Math.round(venueHeight * px), // 1200
    grid_size: Math.round(gridUnitStep * px), // 30
    snap_to_grid: true,
    objects,
    created_at: now,
    updated_at: now
  };

  tables.forEach((t, idx) => {
    const tblObj = buildTableLayoutObject(baseLayout, projectId, t, baseLayout.objects, idx);
    baseLayout.objects.push(tblObj);
  });

  return baseLayout;
}

/**
 * Reconciles a layout with live seating tables:
 * - Adds missing table objects cleanly without duplicates
 * - Syncs table number, name, capacity, and shape onto linked table objects while keeping canvas coordinates
 * - Never deletes existing non-table venue objects or unlinked custom duplicates
 */
export function reconcileLayoutWithTables(
  layout: VenueLayout,
  tables: SeatingTable[]
): { layout: VenueLayout; addedObjects: VenueLayoutObject[]; changed: boolean } {
  if (!tables || tables.length === 0) {
    return { layout, addedObjects: [], changed: false };
  }

  let changed = false;
  const tableMap = new Map<string, SeatingTable>();
  tables.forEach(t => tableMap.set(t.id, t));

  const linkedTableIds = new Set<string>();
  const updatedObjects: VenueLayoutObject[] = layout.objects.map((obj) => {
    if (obj.object_type === 'table' && obj.object_reference_id) {
      linkedTableIds.add(obj.object_reference_id);
      const tbl = tableMap.get(obj.object_reference_id);
      if (tbl) {
        const expectedLabel = `T${tbl.table_number}: ${tbl.table_name}`;
        const curProps = obj.properties || {};
        if (
          obj.label !== expectedLabel ||
          curProps.tableNumber !== tbl.table_number ||
          curProps.capacity !== tbl.capacity ||
          curProps.tableShape !== tbl.table_type
        ) {
          changed = true;
          return {
            ...obj,
            label: expectedLabel,
            properties: {
              ...curProps,
              tableNumber: tbl.table_number,
              capacity: tbl.capacity,
              tableShape: tbl.table_type
            }
          };
        }
      }
    }
    return obj;
  });

  const addedObjects: VenueLayoutObject[] = [];
  tables.forEach((tbl, idx) => {
    if (!linkedTableIds.has(tbl.id)) {
      const newObj = buildTableLayoutObject(layout, layout.project_id, tbl, updatedObjects, idx);
      updatedObjects.push(newObj);
      addedObjects.push(newObj);
      linkedTableIds.add(tbl.id);
      changed = true;
    }
  });

  if (!changed) {
    return { layout, addedObjects: [], changed: false };
  }

  return {
    layout: {
      ...layout,
      objects: updatedObjects,
      updated_at: new Date().toISOString()
    },
    addedObjects,
    changed: true
  };
}

/**
 * Sanitizes layout object fields prior to Supabase persistence (UUIDs + finite numeric bounds).
 */
function sanitizeObjectsForDb(
  objects: VenueLayoutObject[],
  layoutId: string,
  projectId: string,
  unit: VenueUnit
): VenueLayoutObject[] {
  const minDim = getMinWorldDimension(unit);
  const seenIds = new Set<string>();
  const sanitized: VenueLayoutObject[] = [];

  for (const obj of objects) {
    let validId = ensureValidUuid(obj.id);
    if (seenIds.has(validId)) {
      validId = genId('obj');
    }
    seenIds.add(validId);

    const w = Number.isFinite(obj.width) && obj.width > 0 ? roundToDecimals(obj.width, 2) : Math.max(minDim, unit === 'ft' ? 6.0 : 1.8);
    const h = Number.isFinite(obj.height) && obj.height > 0 ? roundToDecimals(obj.height, 2) : Math.max(minDim, unit === 'ft' ? 6.0 : 1.8);

    sanitized.push({
      ...obj,
      id: validId,
      venue_layout_id: layoutId,
      project_id: projectId,
      object_type: obj.object_type || 'table',
      object_reference_id: obj.object_reference_id || null,
      position_x: Number.isFinite(obj.position_x) ? roundToDecimals(obj.position_x, 2) : 1,
      position_y: Number.isFinite(obj.position_y) ? roundToDecimals(obj.position_y, 2) : 1,
      width: Math.max(minDim, w),
      height: Math.max(minDim, h),
      rotation: Number.isFinite(obj.rotation) ? roundToDecimals(obj.rotation, 2) : 0,
      properties: {
        ...(obj.properties || {}),
        world_unit: unit,
        migrated_v2: true
      },
      z_index: Number.isFinite(obj.z_index) ? Math.round(obj.z_index!) : 1,
      created_at: obj.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  return sanitized;
}

/**
 * Persists layout + objects atomically to Supabase using `save_venue_layout_atomic` RPC,
 * with a snapshot-and-rollback fallback if the RPC function is not yet deployed.
 */
async function persistLayoutToSupabase(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  layoutToSave: VenueLayout,
  objectsProvided: boolean
): Promise<VenueLayout> {
  const unit: VenueUnit = layoutToSave.venue_unit === 'ft' ? 'ft' : 'm';
  const layoutId = ensureValidUuid(layoutToSave.id);
  const sanitizedObjects = sanitizeObjectsForDb(
    layoutToSave.objects || [],
    layoutId,
    layoutToSave.project_id,
    unit
  );

  const layoutPayload = {
    id: layoutId,
    project_id: layoutToSave.project_id,
    layout_name: layoutToSave.layout_name || 'Main Ballroom & Reception Hall',
    venue_width: layoutToSave.venue_width ?? (unit === 'ft' ? 100 : 30),
    venue_height: layoutToSave.venue_height ?? (unit === 'ft' ? 65 : 20),
    venue_unit: unit,
    venue_orientation: layoutToSave.venue_orientation || 'landscape',
    venue_name: layoutToSave.venue_name ?? null,
    venue_description: layoutToSave.venue_description ?? null,
    grid_unit_step: layoutToSave.grid_unit_step ?? (unit === 'ft' ? 2.0 : 0.5),
    show_grid: layoutToSave.show_grid ?? true,
    show_rulers: layoutToSave.show_rulers ?? true,
    coordinate_system: 'world',
    is_migrated: true,
    migration_version: CURRENT_LAYOUT_MIGRATION_VERSION,
    canvas_width: layoutToSave.canvas_width,
    canvas_height: layoutToSave.canvas_height,
    grid_size: layoutToSave.grid_size,
    snap_to_grid: layoutToSave.snap_to_grid ?? true,
    updated_at: new Date().toISOString()
  };

  // Attempt atomic Postgres RPC first
  const { data: rpcData, error: rpcError } = await supabase.rpc('save_venue_layout_atomic', {
    p_layout: layoutPayload,
    p_objects: objectsProvided ? sanitizedObjects : null
  });

  if (!rpcError && rpcData) {
    const savedRow = rpcData.layout || layoutPayload;
    const savedObjs = Array.isArray(rpcData.objects) ? rpcData.objects : sanitizedObjects;
    return normalizeVenueLayout({
      ...savedRow,
      objects: savedObjs
    });
  }

  const isRpcMissing =
    rpcError &&
    (rpcError.code === '42883' ||
      rpcError.code === 'PGRST202' ||
      rpcError.message?.toLowerCase().includes('save_venue_layout_atomic'));

  if (rpcError && !isRpcMissing) {
    throw new Error(`Atomic venue layout save failed: ${rpcError.message}`);
  }

  // Fallback transactional emulation with explicit error checking & snapshot rollback
  const { data: upsertedLayout, error: upsertErr } = await supabase
    .from('venue_layouts')
    .upsert(layoutPayload, { onConflict: 'project_id' })
    .select()
    .single();

  if (upsertErr || !upsertedLayout) {
    throw new Error(`Failed to save venue layout metadata: ${upsertErr?.message || 'Unknown error'}`);
  }

  const finalLayoutId = upsertedLayout.id;
  const finalObjects = sanitizedObjects.map((o) => ({
    ...o,
    venue_layout_id: finalLayoutId
  }));

  if (objectsProvided) {
    // 1. Snapshot previous objects so any write failure can restore state cleanly
    const { data: previousObjectsSnapshot, error: snapErr } = await supabase
      .from('venue_layout_objects')
      .select('*')
      .eq('venue_layout_id', finalLayoutId);

    if (snapErr) {
      throw new Error(`Failed to snapshot existing layout objects: ${snapErr.message}`);
    }

    // 2. Delete existing objects for this layout
    const { error: delErr } = await supabase
      .from('venue_layout_objects')
      .delete()
      .eq('venue_layout_id', finalLayoutId);

    if (delErr) {
      throw new Error(`Failed to replace venue layout objects: ${delErr.message}`);
    }

    // 3. Insert validated objects; roll back snapshot if insert fails!
    if (finalObjects.length > 0) {
      const { error: insErr } = await supabase
        .from('venue_layout_objects')
        .insert(finalObjects);

      if (insErr) {
        if (previousObjectsSnapshot && previousObjectsSnapshot.length > 0) {
          await supabase.from('venue_layout_objects').insert(previousObjectsSnapshot);
        }
        throw new Error(`Failed to save venue layout objects: ${insErr.message}`);
      }
    }

    return normalizeVenueLayout({
      ...upsertedLayout,
      objects: finalObjects
    });
  }

  const { data: existingObjects, error: fetchObjErr } = await supabase
    .from('venue_layout_objects')
    .select('*')
    .eq('venue_layout_id', finalLayoutId)
    .order('z_index', { ascending: true });

  if (fetchObjErr) {
    throw new Error(`Failed to load saved venue layout objects: ${fetchObjErr.message}`);
  }

  return normalizeVenueLayout({
    ...upsertedLayout,
    objects: existingObjects || []
  });
}

export async function getVenueLayout(projectId: string): Promise<VenueLayout> {
  const supabase = trySupabase();

  if (supabase) {
    const { data: layout, error: layoutErr } = await supabase
      .from('venue_layouts')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (layoutErr) {
      throw new Error(`Failed to load venue layout: ${layoutErr.message}`);
    }

    if (layout) {
      const { data: objects, error: objErr } = await supabase
        .from('venue_layout_objects')
        .select('*')
        .eq('venue_layout_id', layout.id)
        .order('z_index', { ascending: true });

      if (objErr) {
        throw new Error(`Failed to load venue layout objects: ${objErr.message}`);
      }

      let hydrated: VenueLayout = {
        ...layout,
        objects: objects || []
      };

      const needsMigration = isLegacyLayout(hydrated);
      if (needsMigration) {
        hydrated = migrateVenueLayout(hydrated);
      } else {
        hydrated = normalizeVenueLayout(hydrated);
      }

      // Safely fetch seating tables to ensure table <-> canvas sync without deleting objects on failure
      let tables: SeatingTable[] = [];
      try {
        tables = await getEventTables(projectId);
      } catch (tblErr: any) {
        console.warn('[LayoutService] Skipping table reconciliation because getEventTables failed:', tblErr?.message);
      }

      const reconciled = tables.length > 0
        ? reconcileLayoutWithTables(hydrated, tables)
        : { layout: hydrated, addedObjects: [], changed: false };

      if (needsMigration || reconciled.changed) {
        try {
          return await withProjectSaveLock(projectId, () =>
            persistLayoutToSupabase(supabase, reconciled.layout, true)
          );
        } catch (persistErr: any) {
          console.warn('[LayoutService] Auto-persist after migration/reconciliation failed:', persistErr?.message);
        }
      }

      return normalizeVenueLayout(reconciled.layout);
    }

    // First time opening layout for this project: generate canonical world default & persist
    const tables = await getEventTables(projectId);
    const defaultLayout = createCanonicalDefaultLayout(projectId, tables);
    return await withProjectSaveLock(projectId, () =>
      persistLayoutToSupabase(supabase, defaultLayout, true)
    );
  }

  // Memory store fallback (tests / offline)
  const store = getEventMemoryStore(projectId);
  const tables = await getEventTables(projectId);

  if (!store.layout) {
    store.layout = createCanonicalDefaultLayout(projectId, tables);
    return store.layout;
  }

  let resolved = store.layout;
  if (isLegacyLayout(resolved)) {
    resolved = migrateVenueLayout(resolved);
  } else {
    resolved = normalizeVenueLayout(resolved);
  }

  const reconciled = reconcileLayoutWithTables(resolved, tables);
  store.layout = normalizeVenueLayout(reconciled.layout);
  return store.layout;
}

export async function saveVenueLayout(
  projectId: string,
  layoutData: {
    layout_name?: string;
    canvas_width?: number;
    canvas_height?: number;
    venue_width?: number;
    venue_height?: number;
    venue_unit?: 'm' | 'ft';
    venue_orientation?: 'landscape' | 'portrait';
    venue_name?: string;
    venue_description?: string;
    grid_unit_step?: number;
    show_grid?: boolean;
    show_rulers?: boolean;
    coordinate_system?: string;
    is_migrated?: boolean;
    migration_version?: number;
    grid_size?: number;
    snap_to_grid?: boolean;
    objects?: VenueLayoutObject[];
  }
): Promise<VenueLayout> {
  return await withProjectSaveLock(projectId, async () => {
    const current = await getVenueLayout(projectId);

    const targetUnit: VenueUnit = (layoutData.venue_unit || current.venue_unit || 'm') === 'ft' ? 'ft' : 'm';
    const targetVenueW = layoutData.venue_width ?? current.venue_width ?? (targetUnit === 'ft' ? 100 : 30);
    const targetVenueH = layoutData.venue_height ?? current.venue_height ?? (targetUnit === 'ft' ? 65 : 20);
    const pxPerUnit = getPixelsPerUnit(targetUnit);

    let resolvedCanvasW = layoutData.canvas_width ?? current.canvas_width;
    let resolvedCanvasH = layoutData.canvas_height ?? current.canvas_height;
    if (layoutData.venue_width && !layoutData.canvas_width) {
      resolvedCanvasW = Math.round(targetVenueW * pxPerUnit);
    }
    if (layoutData.venue_height && !layoutData.canvas_height) {
      resolvedCanvasH = Math.round(targetVenueH * pxPerUnit);
    }

    let updatedLayout: VenueLayout = {
      ...current,
      layout_name: layoutData.layout_name ?? current.layout_name,
      venue_width: targetVenueW,
      venue_height: targetVenueH,
      venue_unit: targetUnit,
      venue_orientation: layoutData.venue_orientation ?? current.venue_orientation ?? (targetVenueW >= targetVenueH ? 'landscape' : 'portrait'),
      venue_name: layoutData.venue_name ?? current.venue_name,
      venue_description: layoutData.venue_description ?? current.venue_description,
      grid_unit_step: layoutData.grid_unit_step ?? current.grid_unit_step ?? (targetUnit === 'ft' ? 2.0 : 0.5),
      show_grid: layoutData.show_grid ?? current.show_grid ?? true,
      show_rulers: layoutData.show_rulers ?? current.show_rulers ?? true,
      coordinate_system: 'world',
      is_migrated: true,
      migration_version: CURRENT_LAYOUT_MIGRATION_VERSION,
      canvas_width: resolvedCanvasW,
      canvas_height: resolvedCanvasH,
      grid_size: layoutData.grid_size ?? Math.round((layoutData.grid_unit_step ?? current.grid_unit_step ?? 0.5) * pxPerUnit),
      snap_to_grid: layoutData.snap_to_grid ?? current.snap_to_grid ?? true,
      objects: layoutData.objects ?? current.objects,
      updated_at: new Date().toISOString()
    };

    // Preserve explicit custom canvas dimensions only if caller explicitly provided them without changing venue_width/height
    const normalized = normalizeVenueLayout(updatedLayout);
    if (layoutData.canvas_width !== undefined && !layoutData.venue_width) {
      normalized.canvas_width = layoutData.canvas_width;
    }
    if (layoutData.canvas_height !== undefined && !layoutData.venue_height) {
      normalized.canvas_height = layoutData.canvas_height;
    }

    const supabase = trySupabase();
    if (supabase) {
      return await persistLayoutToSupabase(supabase, normalized, layoutData.objects !== undefined);
    }

    const store = getEventMemoryStore(projectId);
    const sanitizedForMemory: VenueLayout = {
      ...normalized,
      id: ensureValidUuid(normalized.id),
      objects: normalized.objects.map((o) => ({
        ...o,
        id: ensureValidUuid(o.id),
        venue_layout_id: ensureValidUuid(normalized.id),
        project_id: projectId
      }))
    };
    store.layout = sanitizedForMemory;
    return sanitizedForMemory;
  });
}

// -------------------------------------------------------------
// 5. RSVP TO GUEST SYNCHRONIZATION
// -------------------------------------------------------------

export async function syncGuestFromRSVP(projectId: string, rsvpData: any): Promise<Guest[]> {
  const guestName = rsvpData.name?.trim() || 'Guest';
  const email = rsvpData.email?.trim() || '';
  const attending = Boolean(rsvpData.attending);
  const rsvpStatus: GuestRSVPStatus = attending ? 'attending' : 'declined';
  const guestCount = Number(rsvpData.guest_count) || 1;
  const isVip = Boolean(rsvpData.is_vip || rsvpData.guest_category === 'VIP');
  const meal = rsvpData.meal_preference || '';
  const dietary = rsvpData.dietary_requirements || '';

  let groupId: string | null = null;
  const groups = await getEventGroups(projectId);
  const groupName = `${guestName} Party`;
  const existingGroup = groups.find((g) => g.invitation_reference === rsvpData.id || g.group_name === groupName);

  if (existingGroup) {
    groupId = existingGroup.id;
  } else if (guestCount > 1 || attending) {
    const newGroup = await createGuestGroup(projectId, {
      group_name: groupName,
      invitation_reference: rsvpData.id,
      notes: `RSVP Submission by ${guestName}`
    });
    groupId = newGroup.id;
  }

  const existingGuests = await getEventGuests(projectId);
  let primaryGuest = existingGuests.find((g) => (g.rsvp_id && g.rsvp_id === rsvpData.id) || (email && g.email === email));

  const syncedGuests: Guest[] = [];

  if (primaryGuest) {
    const updated = await updateGuest(projectId, primaryGuest.id, {
      full_name: guestName,
      email,
      rsvp_status: rsvpStatus,
      pax: guestCount,
      meal_preference: meal,
      dietary_notes: dietary,
      is_vip: isVip,
      guest_group_id: groupId || primaryGuest.guest_group_id,
      rsvp_id: rsvpData.id
    });
    if (updated) primaryGuest = updated;
    syncedGuests.push(primaryGuest!);
  } else {
    primaryGuest = await createGuest(projectId, {
      full_name: guestName,
      email,
      rsvp_status: rsvpStatus,
      pax: guestCount,
      meal_preference: meal,
      dietary_notes: dietary,
      is_vip: isVip,
      is_plus_one: false,
      guest_group_id: groupId,
      rsvp_id: rsvpData.id
    });
    syncedGuests.push(primaryGuest);
  }

  if (attending && guestCount > 1 && primaryGuest) {
    const existingPlusOnes = existingGuests.filter((g) => g.primary_guest_id === primaryGuest?.id);
    const plusOnesNeeded = guestCount - 1;
    for (let i = 1; i <= plusOnesNeeded; i++) {
      const plusOneLabel = `${guestName}'s Guest ${i > 1 ? i : ''}`.trim();
      const existing = existingPlusOnes[i - 1];

      if (existing) {
        const updated = await updateGuest(projectId, existing.id, {
          rsvp_status: 'attending',
          guest_group_id: groupId || existing.guest_group_id
        });
        if (updated) syncedGuests.push(updated);
      } else {
        const newPlusOne = await createGuest(projectId, {
          full_name: plusOneLabel,
          rsvp_status: 'attending',
          pax: 1,
          is_plus_one: true,
          primary_guest_id: primaryGuest.id,
          guest_group_id: groupId,
          rsvp_id: rsvpData.id
        });
        syncedGuests.push(newPlusOne);
      }
    }
  }

  return syncedGuests;
}
