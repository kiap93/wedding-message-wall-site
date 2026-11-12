import { getSupabaseAdmin, isSupabaseAvailable, markSupabaseUnavailable } from './supabaseAdmin';
import { 
  Guest, 
  GuestGroup, 
  SeatingTable, 
  SeatingAssignment, 
  VenueLayout, 
  VenueLayoutObject,
  GuestRSVPStatus 
} from '../src/types';

// Fallback in-memory storage for test/offline environments
interface EventStorage {
  guests: Map<string, Guest>;
  groups: Map<string, GuestGroup>;
  tables: Map<string, SeatingTable>;
  assignments: Map<string, SeatingAssignment>; // key: `${projectId}:${guestId}`
  layout: VenueLayout | null;
}

const memoryStore: Map<string, EventStorage> = new Map();

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

// Helper to generate UUIDs compliant with Postgres UUID columns
function genId(prefix: string = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
    try {
      const { data: guests, error } = await supabase
        .from('guests')
        .select('*, guest_group:guest_groups(*)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (guests && guests.length > 0) {
        // Get table assignments
        const { data: assignments } = await supabase
          .from('seating_assignments')
          .select('guest_id, seating_table_id, seat_number, seating_tables(table_name, table_number)')
          .eq('project_id', projectId);

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
      const { data: rsvps } = await supabase
        .from('rsvps')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (rsvps && rsvps.length > 0) {
        const syncedGuests: Guest[] = [];
        for (const r of rsvps) {
          const guest = await syncGuestFromRSVP(projectId, r);
          syncedGuests.push(...guest);
        }
        return syncedGuests;
      }
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[GuestService] Supabase read fallback to memory store:', err.message);
    }
  }


  // Memory fallback
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
    try {
      const { data, error } = await supabase
        .from('guests')
        .insert([newGuest])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        return data;
      }
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[GuestService] Supabase insert fallback to memory store:', err.message);
    }
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
    try {
      const { data, error } = await supabase
        .from('guests')
        .update(safeUpdates)
        .eq('id', guestId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (!error && data) {
        return data;
      }
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[GuestService] Supabase update fallback to memory store:', err.message);
    }
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
    try {
      // Delete seating assignment first
      await supabase
        .from('seating_assignments')
        .delete()
        .eq('guest_id', guestId)
        .eq('project_id', projectId);

      const { error } = await supabase
        .from('guests')
        .delete()
        .eq('id', guestId)
        .eq('project_id', projectId);

      if (!error) return true;
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[GuestService] Supabase delete fallback to memory store:', err.message);
    }
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
    try {
      const { data: groups, error } = await supabase
        .from('guest_groups')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (!error && groups) {
        // Calculate member counts
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

        return groups.map((grp: any) => ({
          ...grp,
          member_count: countMap.get(grp.id) || 0
        }));
      }
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[GuestGroupService] Supabase read fallback to memory store:', err.message);
    }
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
    try {
      const { data, error } = await supabase
        .from('guest_groups')
        .insert([newGroup])
        .select()
        .single();

      if (!error && data) return { ...data, member_count: 0 };
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[GuestGroupService] Supabase insert fallback to memory store:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  store.groups.set(newGroup.id, newGroup);
  return { ...newGroup, member_count: 0 };
}

export async function updateGuestGroup(projectId: string, groupId: string, updates: Partial<GuestGroup>): Promise<GuestGroup | null> {
  const safeUpdates = { ...updates, updated_at: new Date().toISOString() };

  const supabase = trySupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('guest_groups')
        .update(safeUpdates)
        .eq('id', groupId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (!error && data) return data;
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[GuestGroupService] Supabase update fallback to memory store:', err.message);
    }
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
    try {
      // Nullify guest_group_id on members
      await supabase
        .from('guests')
        .update({ guest_group_id: null })
        .eq('guest_group_id', groupId)
        .eq('project_id', projectId);

      const { error } = await supabase
        .from('guest_groups')
        .delete()
        .eq('id', groupId)
        .eq('project_id', projectId);

      if (!error) return true;
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[GuestGroupService] Supabase delete fallback to memory store:', err.message);
    }
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
    try {
      const { data: tables, error } = await supabase
        .from('seating_tables')
        .select('*')
        .eq('project_id', projectId)
        .order('table_number', { ascending: true });

      if (!error && tables && tables.length > 0) {
        // Get all assigned guests
        const allGuests = await getEventGuests(projectId);
        const guestMap = new Map<string, Guest>();
        allGuests.forEach((g) => guestMap.set(g.id, g));

        const { data: assignments } = await supabase
          .from('seating_assignments')
          .select('*')
          .eq('project_id', projectId);

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

      // Default tables generation if none exist
      if (!tables || tables.length === 0) {
        const defaultTables = await initializeDefaultTables(projectId);
        return defaultTables;
      }
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[TableService] Supabase read fallback to memory store:', err.message);
    }
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
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('seating_tables')
        .insert([newTable])
        .select()
        .single();

      if (!error && data) {
        return { ...data, assigned_guests: [], assigned_count: 0, remaining_seats: data.capacity };
      }
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[TableService] Supabase insert fallback to memory store:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  store.tables.set(newTable.id, newTable);
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
    try {
      const { data, error } = await supabase
        .from('seating_tables')
        .update(safeUpdates)
        .eq('id', tableId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (!error && data) return data;
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[TableService] Supabase update fallback to memory store:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  const existing = store.tables.get(tableId);
  if (!existing) return null;

  const updated = { ...existing, ...safeUpdates };
  store.tables.set(tableId, updated);
  return updated;
}

export async function deleteTable(projectId: string, tableId: string): Promise<boolean> {
  const supabase = trySupabase();
  if (supabase) {
    try {
      // 1. Remove assignments for this table (guests become unassigned, NOT deleted!)
      await supabase
        .from('seating_assignments')
        .delete()
        .eq('seating_table_id', tableId)
        .eq('project_id', projectId);

      // 2. Remove layout object if placed
      await supabase
        .from('venue_layout_objects')
        .delete()
        .eq('object_reference_id', tableId)
        .eq('project_id', projectId);

      // 3. Delete table
      const { error } = await supabase
        .from('seating_tables')
        .delete()
        .eq('id', tableId)
        .eq('project_id', projectId);

      if (!error) return true;
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[TableService] Supabase delete fallback to memory store:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  // Unassign guests assigned to this table
  const toDeleteAssigns: string[] = [];
  store.assignments.forEach((assign, key) => {
    if (assign.seating_table_id === tableId) {
      toDeleteAssigns.push(key);
    }
  });
  toDeleteAssigns.forEach((k) => store.assignments.delete(k));

  return store.tables.delete(tableId);
}

export async function assignGuestToTable(
  projectId: string, 
  tableId: string, 
  guestId: string, 
  seatNumber?: number
): Promise<{ success: boolean; error?: string }> {
  // Check guest exists and is not declined
  const allGuests = await getEventGuests(projectId);
  const targetGuest = allGuests.find((g) => g.id === guestId);
  if (!targetGuest) {
    return { success: false, error: 'Guest not found' };
  }

  if (targetGuest.rsvp_status === 'declined') {
    return { success: false, error: 'Declined guests cannot be assigned to reception seats' };
  }

  // Check table capacity
  const tables = await getEventTables(projectId);
  const targetTable = tables.find((t) => t.id === tableId);
  if (!targetTable) {
    return { success: false, error: 'Table not found' };
  }

  // Check if guest is already assigned to this table
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
    try {
      // Upsert assignment using unique constraint (project_id, guest_id)
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

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[SeatingService] Supabase assign fallback to memory store:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  store.assignments.set(`${projectId}:${guestId}`, assignment);
  return { success: true };
}

export async function unassignGuestFromTable(projectId: string, guestId: string): Promise<boolean> {
  const supabase = trySupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('seating_assignments')
        .delete()
        .eq('guest_id', guestId)
        .eq('project_id', projectId);

      if (!error) return true;
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[SeatingService] Supabase unassign fallback to memory store:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  store.assignments.delete(`${projectId}:${guestId}`);
  return true;
}

export async function getEventAssignments(projectId: string): Promise<SeatingAssignment[]> {
  const supabase = trySupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('seating_assignments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (!error && data) return data;
    } catch (err: any) {
      markSupabaseUnavailable();
    }
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

  // Calculate required seats considering any already assigned to this table
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

export async function getVenueLayout(projectId: string): Promise<VenueLayout> {
  const supabase = trySupabase();
  if (supabase) {
    try {
      const { data: layout, error: layoutErr } = await supabase
        .from('venue_layouts')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (!layoutErr && layout) {
        const { data: objects } = await supabase
          .from('venue_layout_objects')
          .select('*')
          .eq('venue_layout_id', layout.id)
          .order('z_index', { ascending: true });

        return {
          ...layout,
          objects: objects || []
        };
      }
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[LayoutService] Supabase read fallback to memory store:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  if (!store.layout) {
    // Initialize default layout with existing tables
    const tables = await getEventTables(projectId);
    const defaultLayoutId = genId('lay');

    const layoutObjects: VenueLayoutObject[] = [
      // Stage at top center
      {
        id: genId('obj'),
        venue_layout_id: defaultLayoutId,
        project_id: projectId,
        object_type: 'stage',
        label: 'Main Stage & Altar',
        position_x: 650,
        position_y: 60,
        width: 700,
        height: 140,
        rotation: 0,
        properties: { color: '#252525', textColor: '#FFFFFF' },
        z_index: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      // Bride & Groom sweetheart table
      {
        id: genId('obj'),
        venue_layout_id: defaultLayoutId,
        project_id: projectId,
        object_type: 'couple_table',
        label: 'Bride & Groom Table',
        position_x: 900,
        position_y: 240,
        width: 200,
        height: 90,
        rotation: 0,
        properties: { color: '#C5A059', textColor: '#1A1A1A' },
        z_index: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      // Dance floor
      {
        id: genId('obj'),
        venue_layout_id: defaultLayoutId,
        project_id: projectId,
        object_type: 'dance_floor',
        label: 'Dance Floor',
        position_x: 800,
        position_y: 380,
        width: 400,
        height: 300,
        rotation: 0,
        properties: { color: '#F2EFE9', textColor: '#252525' },
        z_index: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      // Main Entrance at bottom
      {
        id: genId('obj'),
        venue_layout_id: defaultLayoutId,
        project_id: projectId,
        object_type: 'entrance',
        label: 'Grand Hall Entrance',
        position_x: 850,
        position_y: 1250,
        width: 300,
        height: 70,
        rotation: 0,
        properties: { color: '#8B806F', textColor: '#FFFFFF' },
        z_index: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // Place existing tables symmetrically around the dance floor
    const tablePositions = [
      { x: 380, y: 380 },
      { x: 1420, y: 380 },
      { x: 380, y: 650 },
      { x: 1420, y: 650 },
      { x: 380, y: 920 },
      { x: 1420, y: 920 },
      { x: 900, y: 780 }
    ];

    tables.forEach((t, index) => {
      const pos = tablePositions[index % tablePositions.length];
      const isRect = t.table_type === 'rectangular';
      layoutObjects.push({
        id: genId('obj'),
        venue_layout_id: defaultLayoutId,
        project_id: projectId,
        object_type: 'table',
        object_reference_id: t.id,
        label: `T${t.table_number}: ${t.table_name}`,
        position_x: pos.x,
        position_y: pos.y,
        width: isRect ? 180 : 130,
        height: isRect ? 90 : 130,
        rotation: 0,
        properties: {
          tableShape: t.table_type,
          capacity: t.capacity,
          tableNumber: t.table_number
        },
        z_index: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });

    store.layout = {
      id: defaultLayoutId,
      project_id: projectId,
      layout_name: 'Main Ballroom & Reception Hall',
      venue_width: 30,
      venue_height: 20,
      venue_unit: 'm',
      venue_orientation: 'landscape',
      venue_name: 'Main Ballroom & Reception Hall',
      venue_description: 'Spacious banquet ballroom with stage, dance floor, entrance and dining tables',
      grid_unit_step: 0.5,
      show_grid: true,
      show_rulers: true,
      coordinate_system: 'world',
      is_migrated: true,
      canvas_width: 2000,
      canvas_height: 1400,
      grid_size: 40,
      snap_to_grid: true,
      objects: layoutObjects,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  return store.layout;
}

export async function saveVenueLayout(
  projectId: string, 
  layoutData: {
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
    grid_size?: number;
    snap_to_grid?: boolean;
    objects?: VenueLayoutObject[];
  }
): Promise<VenueLayout> {
  const current = await getVenueLayout(projectId);

  // Compute synchronized canvas dimensions if venue dimensions are updated
  let resolvedCanvasW = layoutData.canvas_width ?? current.canvas_width;
  let resolvedCanvasH = layoutData.canvas_height ?? current.canvas_height;
  if (layoutData.venue_width && !layoutData.canvas_width) {
    const pxPerUnit = layoutData.venue_unit === 'ft' ? (60 / 3.28084) : 60;
    resolvedCanvasW = Math.round(layoutData.venue_width * pxPerUnit);
  }
  if (layoutData.venue_height && !layoutData.canvas_height) {
    const pxPerUnit = layoutData.venue_unit === 'ft' ? (60 / 3.28084) : 60;
    resolvedCanvasH = Math.round(layoutData.venue_height * pxPerUnit);
  }

  const updatedLayout: VenueLayout = {
    ...current,
    venue_width: layoutData.venue_width ?? current.venue_width ?? 30,
    venue_height: layoutData.venue_height ?? current.venue_height ?? 20,
    venue_unit: layoutData.venue_unit ?? current.venue_unit ?? 'm',
    venue_orientation: layoutData.venue_orientation ?? current.venue_orientation ?? 'landscape',
    venue_name: layoutData.venue_name ?? current.venue_name,
    venue_description: layoutData.venue_description ?? current.venue_description,
    grid_unit_step: layoutData.grid_unit_step ?? current.grid_unit_step ?? 0.5,
    show_grid: layoutData.show_grid ?? current.show_grid ?? true,
    show_rulers: layoutData.show_rulers ?? current.show_rulers ?? true,
    coordinate_system: layoutData.coordinate_system ?? current.coordinate_system ?? 'world',
    is_migrated: layoutData.is_migrated ?? current.is_migrated ?? true,
    canvas_width: resolvedCanvasW,
    canvas_height: resolvedCanvasH,
    grid_size: layoutData.grid_size ?? current.grid_size,
    snap_to_grid: layoutData.snap_to_grid ?? current.snap_to_grid,
    objects: layoutData.objects ?? current.objects,
    updated_at: new Date().toISOString()
  };

  const supabase = trySupabase();
  if (supabase) {
    try {
      await supabase
        .from('venue_layouts')
        .upsert({
          id: current.id,
          project_id: projectId,
          venue_width: updatedLayout.venue_width,
          venue_height: updatedLayout.venue_height,
          venue_unit: updatedLayout.venue_unit,
          venue_orientation: updatedLayout.venue_orientation,
          venue_name: updatedLayout.venue_name,
          venue_description: updatedLayout.venue_description,
          grid_unit_step: updatedLayout.grid_unit_step,
          show_grid: updatedLayout.show_grid,
          show_rulers: updatedLayout.show_rulers,
          coordinate_system: updatedLayout.coordinate_system,
          is_migrated: updatedLayout.is_migrated,
          canvas_width: updatedLayout.canvas_width,
          canvas_height: updatedLayout.canvas_height,
          grid_size: updatedLayout.grid_size,
          snap_to_grid: updatedLayout.snap_to_grid,
          updated_at: updatedLayout.updated_at
        });

      if (layoutData.objects) {
        // Upsert objects
        await supabase
          .from('venue_layout_objects')
          .delete()
          .eq('venue_layout_id', current.id);

        await supabase
          .from('venue_layout_objects')
          .insert(layoutData.objects.map((o) => ({
            ...o,
            venue_layout_id: current.id,
            project_id: projectId
          })));
      }
    } catch (err: any) {
      markSupabaseUnavailable();
      console.warn('[LayoutService] Supabase save fallback to memory store:', err.message);
    }
  }

  const store = getEventMemoryStore(projectId);
  store.layout = updatedLayout;
  return updatedLayout;
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

  // 1. Create or find group for this RSVP invitation
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

  // 2. Check if primary guest already exists for this rsvp_id or email
  const existingGuests = await getEventGuests(projectId);
  let primaryGuest = existingGuests.find((g) => (g.rsvp_id && g.rsvp_id === rsvpData.id) || (email && g.email === email));

  const syncedGuests: Guest[] = [];

  if (primaryGuest) {
    // Update existing primary guest
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
    // Create new primary guest
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

  // 3. Handle Plus-Ones if guest_count > 1 and attending
  if (attending && guestCount > 1 && primaryGuest) {
    const existingPlusOnes = existingGuests.filter((g) => g.primary_guest_id === primaryGuest?.id);

    // Create plus-ones up to guestCount - 1
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
