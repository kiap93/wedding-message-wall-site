import { API_BASE } from './config';
import { authenticatedFetch } from './auth';
import { 
  Guest, 
  GuestGroup, 
  SeatingTable, 
  VenueLayout, 
  VenueLayoutObject 
} from '../types';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('wedding_session_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// -------------------------------------------------------------
// GUEST LIST API
// -------------------------------------------------------------

export async function fetchEventGuests(projectId: string): Promise<Guest[]> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/guests`);
    if (!res.ok) {
      throw new Error('Failed to fetch guests');
    }
    const data = await res.json();
    return data.guests || [];
  } catch (err) {
    console.error('Error fetching guests:', err);
    return [];
  }
}

export async function createEventGuest(projectId: string, guestData: Partial<Guest>): Promise<Guest> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/guests`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(guestData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create guest');
  }
  const data = await res.json();
  return data.guest;
}

export async function updateEventGuest(projectId: string, guestId: string, updates: Partial<Guest>): Promise<Guest> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/guests/${guestId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update guest');
  }
  const data = await res.json();
  return data.guest;
}

export async function deleteEventGuest(projectId: string, guestId: string): Promise<void> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/guests/${guestId}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete guest');
  }
}

export async function bulkUpdateGuests(
  projectId: string,
  action: 'delete' | 'set_status' | 'set_group' | 'toggle_vip',
  guestIds: string[],
  options?: { groupId?: string; rsvpStatus?: string; isVip?: boolean }
): Promise<Guest[]> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/guests/bulk`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action, guestIds, ...options })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to perform bulk operation');
  }
  const data = await res.json();
  return data.guests || [];
}

export async function importGuests(projectId: string, guests: Array<Partial<Guest>>): Promise<Guest[]> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/guests/import`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ guests })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to import guests');
  }
  const data = await res.json();
  return data.guests || [];
}

// -------------------------------------------------------------
// GUEST GROUPS API
// -------------------------------------------------------------

export async function fetchEventGroups(projectId: string): Promise<GuestGroup[]> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/guest-groups`);
    if (!res.ok) throw new Error('Failed to fetch groups');
    const data = await res.json();
    return data.groups || [];
  } catch (err) {
    console.error('Error fetching groups:', err);
    return [];
  }
}

export async function createEventGroup(projectId: string, groupData: Partial<GuestGroup>): Promise<GuestGroup> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/guest-groups`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(groupData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create group');
  }
  const data = await res.json();
  return data.group;
}

export async function updateEventGroup(projectId: string, groupId: string, updates: Partial<GuestGroup>): Promise<GuestGroup> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/guest-groups/${groupId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update group');
  }
  const data = await res.json();
  return data.group;
}

export async function deleteEventGroup(projectId: string, groupId: string): Promise<void> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/guest-groups/${groupId}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete group');
  }
}

// -------------------------------------------------------------
// TABLES & SEATING ASSIGNMENT API
// -------------------------------------------------------------

export async function fetchEventTables(projectId: string): Promise<SeatingTable[]> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/tables`);
    if (!res.ok) throw new Error('Failed to fetch tables');
    const data = await res.json();
    return data.tables || [];
  } catch (err) {
    console.error('Error fetching tables:', err);
    return [];
  }
}

export async function createEventTable(projectId: string, tableData: Partial<SeatingTable>): Promise<SeatingTable> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/tables`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(tableData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create table');
  }
  const data = await res.json();
  return data.table;
}

export async function updateEventTable(projectId: string, tableId: string, updates: Partial<SeatingTable>): Promise<SeatingTable> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/tables/${tableId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update table');
  }
  const data = await res.json();
  return data.table;
}

export async function deleteEventTable(projectId: string, tableId: string): Promise<void> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/tables/${tableId}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete table');
  }
}

export async function assignGuestToTable(
  projectId: string, 
  tableId: string, 
  guestId: string, 
  seatNumber?: number
): Promise<SeatingTable[]> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/tables/${tableId}/assign`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ guestId, seatNumber })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to assign guest to table');
  }
  const data = await res.json();
  return data.tables || [];
}

export async function assignGroupToTable(
  projectId: string, 
  tableId: string, 
  groupId: string
): Promise<{ tables: SeatingTable[]; assignedCount: number }> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/tables/${tableId}/assign-group`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ groupId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to assign group to table');
  }
  const data = await res.json();
  return { tables: data.tables || [], assignedCount: data.assignedCount || 0 };
}

export async function unassignGuest(projectId: string, guestId: string): Promise<SeatingTable[]> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/tables/unassign`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ guestId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to unassign guest');
  }
  const data = await res.json();
  return data.tables || [];
}

// -------------------------------------------------------------
// VENUE HALL LAYOUT API
// -------------------------------------------------------------

export async function fetchVenueLayout(projectId: string): Promise<VenueLayout> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/layout`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch venue layout');
  }
  const data = await res.json();
  return data.layout;
}

export async function saveVenueLayout(projectId: string, layout: Partial<VenueLayout>): Promise<VenueLayout> {
  const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/layout`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(layout)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save venue layout');
  }
  const data = await res.json();
  return data.layout;
}
