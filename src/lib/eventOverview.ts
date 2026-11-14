import { API_BASE } from './config';
import { authenticatedFetch } from './auth';
import { getSupabase } from './supabase';
import {
  Guest,
  Message,
  SeatingTable,
  VenueLayout,
  VenueLayoutObject,
  WeddingEvent,
} from '../types';
import { EditorElement } from '../editor/store';

export interface OverviewStats {
  totalGuests: number;
  totalPax: number;
  confirmedRsvp: number;
  confirmedPax: number;
  declinedRsvp: number;
  pendingRsvp: number;
  assignedSeating: number;
  unassignedGuests: number;
  unassignedAllActive: number;
  totalWishMessages: number;
  approvedMessages: number;
  pendingMessages: number;
  rejectedMessages: number;
  totalTables: number;
  totalCapacity: number;
  seatingOccupancyPct: number;
  rsvpCompletionPct: number;
}

export interface CountdownInfo {
  daysRemaining: number | null;
  status: 'upcoming' | 'today' | 'past' | 'unscheduled';
  headline: string;
  sublabel: string;
}

export interface CustomEventMilestone {
  id: string;
  title: string;
  date: string;
  time?: string;
  category: 'ceremony' | 'reception' | 'rsvp' | 'invitation' | 'planning';
  location?: string;
  completed?: boolean;
}

export interface TimelineMilestone {
  id: string;
  title: string;
  subtitle?: string;
  dateLabel: string;
  sortKey: number;
  category: 'ceremony' | 'reception' | 'rsvp' | 'invitation' | 'wedding_day' | 'website' | 'planning';
  status: 'completed' | 'upcoming' | 'today' | 'scheduled';
  isCustom?: boolean;
  completed?: boolean;
}

export interface ParsedInvitationConfig {
  elements: EditorElement[];
  canvasWidth: number;
  canvasHeight: number;
  hasCustomDesign: boolean;
}

export interface FloorPlanProjectedObject {
  id: string;
  objectType: VenueLayoutObject['object_type'];
  label: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  rotation: number;
  isTable: boolean;
  isRound: boolean;
  tableNumber?: string;
  assignedCount?: number;
  capacity?: number;
  color?: string;
}

export interface FloorPlanPreviewModel {
  venueWidth: number;
  venueHeight: number;
  venueUnit: 'm' | 'ft';
  venueName: string;
  objects: FloorPlanProjectedObject[];
  hasObjects: boolean;
}

export interface OverviewWidgetErrors {
  guests?: string | null;
  tables?: string | null;
  layout?: string | null;
  messages?: string | null;
}

export interface EventOverviewBundle {
  guests: Guest[];
  tables: SeatingTable[];
  layout: VenueLayout | null;
  messages: Message[];
  errors: OverviewWidgetErrors;
}

function buildAuthHeaders(eventPin?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('wedding_session_token')
      : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (eventPin) {
    headers['X-Event-PIN'] = eventPin;
  }
  return headers;
}

/**
 * Computes timezone-safe wedding countdown from a YYYY-MM-DD or ISO date string.
 */
export function computeWeddingCountdown(
  weddingDate?: string | null,
  referenceDate: Date = new Date()
): CountdownInfo {
  if (!weddingDate || !weddingDate.trim()) {
    return {
      daysRemaining: null,
      status: 'unscheduled',
      headline: 'Date TBD',
      sublabel: 'Set wedding date in Event Details',
    };
  }

  let targetYear: number;
  let targetMonth: number;
  let targetDay: number;

  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(weddingDate.trim());
  if (isoDateMatch) {
    targetYear = Number(isoDateMatch[1]);
    targetMonth = Number(isoDateMatch[2]) - 1;
    targetDay = Number(isoDateMatch[3]);
  } else {
    const parsed = new Date(weddingDate);
    if (Number.isNaN(parsed.getTime())) {
      return {
        daysRemaining: null,
        status: 'unscheduled',
        headline: 'Invalid Date',
        sublabel: 'Update wedding date',
      };
    }
    targetYear = parsed.getFullYear();
    targetMonth = parsed.getMonth();
    targetDay = parsed.getDate();
  }

  const targetMidnight = new Date(targetYear, targetMonth, targetDay).getTime();
  const todayMidnight = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  ).getTime();

  const diffDays = Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return {
      daysRemaining: diffDays,
      status: 'upcoming',
      headline: `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'} Left`,
      sublabel: 'Until the celebration',
    };
  }

  if (diffDays === 0) {
    return {
      daysRemaining: 0,
      status: 'today',
      headline: 'Today is the Day',
      sublabel: 'Celebration in progress',
    };
  }

  const absDays = Math.abs(diffDays);
  return {
    daysRemaining: diffDays,
    status: 'past',
    headline: `${absDays} ${absDays === 1 ? 'Day' : 'Days'} Ago`,
    sublabel: 'Celebration completed',
  };
}

/**
 * Computes all real-time event statistics strictly from live database collections.
 */
export function computeOverviewStats(
  guests: Guest[],
  tables: SeatingTable[],
  messages: Message[]
): OverviewStats {
  const totalGuests = guests.length;
  const totalPax = guests.reduce((sum, g) => sum + Math.max(1, Number(g.pax) || 1), 0);

  const confirmedGuests = guests.filter((g) => g.rsvp_status === 'attending');
  const declinedGuests = guests.filter((g) => g.rsvp_status === 'declined');
  const pendingGuests = guests.filter((g) => g.rsvp_status === 'pending');

  const confirmedRsvp = confirmedGuests.length;
  const confirmedPax = confirmedGuests.reduce(
    (sum, g) => sum + Math.max(1, Number(g.pax) || 1),
    0
  );
  const declinedRsvp = declinedGuests.length;
  const pendingRsvp = pendingGuests.length;

  const assignedSeating = guests.filter((g) => Boolean(g.assigned_table_id)).length;
  const unassignedGuests = confirmedGuests.filter((g) => !g.assigned_table_id).length;
  const unassignedAllActive = guests.filter(
    (g) => g.rsvp_status !== 'declined' && !g.assigned_table_id
  ).length;

  const totalTables = tables.length;
  const totalCapacity = tables.reduce((sum, t) => sum + Math.max(0, Number(t.capacity) || 0), 0);

  const respondedCount = confirmedRsvp + declinedRsvp;
  const rsvpCompletionPct =
    totalGuests > 0 ? Math.round((respondedCount / totalGuests) * 100) : 0;

  const seatingOccupancyPct =
    totalCapacity > 0 ? Math.min(100, Math.round((assignedSeating / totalCapacity) * 100)) : 0;

  const totalWishMessages = messages.length;
  const approvedMessages = messages.filter((m) => m.status === 'approved').length;
  const pendingMessages = messages.filter((m) => m.status === 'pending' || !m.status).length;
  const rejectedMessages = messages.filter((m) => m.status === 'rejected').length;

  return {
    totalGuests,
    totalPax,
    confirmedRsvp,
    confirmedPax,
    declinedRsvp,
    pendingRsvp,
    assignedSeating,
    unassignedGuests,
    unassignedAllActive,
    totalWishMessages,
    approvedMessages,
    pendingMessages,
    rejectedMessages,
    totalTables,
    totalCapacity,
    seatingOccupancyPct,
    rsvpCompletionPct,
  };
}

/**
 * Parses invitation_config safely (handles JSON string or object).
 */
export function parseInvitationConfig(rawConfig: any): ParsedInvitationConfig {
  if (!rawConfig) {
    return {
      elements: [],
      canvasWidth: 1000,
      canvasHeight: 1414,
      hasCustomDesign: false,
    };
  }

  let parsed = rawConfig;
  if (typeof rawConfig === 'string') {
    try {
      parsed = JSON.parse(rawConfig);
    } catch {
      return {
        elements: [],
        canvasWidth: 1000,
        canvasHeight: 1414,
        hasCustomDesign: false,
      };
    }
  }

  const elements: EditorElement[] = Array.isArray(parsed?.elements) ? parsed.elements : [];
  const canvasWidth = Number(parsed?.canvasWidth) > 0 ? Number(parsed.canvasWidth) : 1000;
  const canvasHeight = Number(parsed?.canvasHeight) > 0 ? Number(parsed.canvasHeight) : 1414;

  return {
    elements: elements.slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)),
    canvasWidth,
    canvasHeight,
    hasCustomDesign: elements.length > 0,
  };
}

/**
 * Extracts ceremony, reception, RSVP deadline, invitation & custom milestones from event data.
 */
export function extractEventMilestones(
  event: Partial<WeddingEvent>,
  referenceDate: Date = new Date()
): TimelineMilestone[] {
  const milestones: TimelineMilestone[] = [];
  const todayMs = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  ).getTime();

  const parseDateSortKey = (dateStr?: string): number | null => {
    if (!dateStr) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
    }
    const parsed = new Date(dateStr);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  };

  const getDateStatus = (ms: number | null): TimelineMilestone['status'] => {
    if (ms === null) return 'scheduled';
    if (ms === todayMs) return 'today';
    if (ms < todayMs) return 'completed';
    return 'upcoming';
  };

  const formatDate = (dateStr?: string): string => {
    const ms = parseDateSortKey(dateStr);
    if (ms === null) return dateStr || 'Scheduled';
    return new Date(ms).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  let websiteConfig = event.website_config;
  if (typeof websiteConfig === 'string') {
    try {
      websiteConfig = JSON.parse(websiteConfig);
    } catch {
      websiteConfig = null;
    }
  }

  const sections: any[] = Array.isArray(websiteConfig?.sections) ? websiteConfig.sections : [];

  // 1. Invitation Launch / Created
  const invConfig = parseInvitationConfig(event.invitation_config);
  if (invConfig.hasCustomDesign) {
    const invDateMs = parseDateSortKey(event.updated_at || event.created_at);
    milestones.push({
      id: 'ms-invitation',
      title: 'Digital Invitations Prepared',
      subtitle: `${invConfig.elements.length} stationery elements configured`,
      dateLabel: formatDate(event.updated_at || event.created_at),
      sortKey: invDateMs ?? Date.now() - 86400000 * 30,
      category: 'invitation',
      status: 'completed',
    });
  }

  // 2. RSVP Deadline from website builder config
  const rsvpSection = sections.find((s) => s?.type === 'rsvp');
  const rsvpDeadline = rsvpSection?.content?.rsvpDeadline;
  if (rsvpDeadline) {
    const rsvpMs = parseDateSortKey(rsvpDeadline);
    milestones.push({
      id: 'ms-rsvp-deadline',
      title: 'RSVP Response Deadline',
      subtitle: rsvpSection?.content?.rsvpNote || 'Final guest headcount & meal selection due',
      dateLabel: formatDate(rsvpDeadline),
      sortKey: rsvpMs ?? (parseDateSortKey(event.wedding_date) || Date.now()) - 86400000 * 14,
      category: 'rsvp',
      status: getDateStatus(rsvpMs),
    });
  }

  // 3. Website Published
  if (event.website_status === 'published' && event.website_published_at) {
    const pubMs = parseDateSortKey(event.website_published_at);
    milestones.push({
      id: 'ms-website-live',
      title: 'Wedding Website Published',
      subtitle: event.slug ? `/${event.slug}/website is live for guests` : 'Live for guests',
      dateLabel: formatDate(event.website_published_at),
      sortKey: pubMs ?? Date.now(),
      category: 'website',
      status: 'completed',
    });
  }

  // 4. Ceremony & Reception schedule events from website builder
  const scheduleSection = sections.find((s) => s?.type === 'schedule');
  const scheduleEvents: any[] = Array.isArray(scheduleSection?.content?.events)
    ? scheduleSection.content.events
    : [];
  const weddingMs = parseDateSortKey(event.wedding_date);

  scheduleEvents.forEach((item, idx) => {
    const titleLower = String(item?.title || '').toLowerCase();
    const category: TimelineMilestone['category'] =
      titleLower.includes('ceremony') || titleLower.includes('vow')
        ? 'ceremony'
        : 'reception';
    milestones.push({
      id: `ms-schedule-${item?.id || idx}`,
      title: item?.title || `Event Segment ${idx + 1}`,
      subtitle: [item?.location, item?.description].filter(Boolean).join(' · ') || undefined,
      dateLabel: item?.time
        ? `${formatDate(event.wedding_date)} · ${item.time}`
        : formatDate(event.wedding_date),
      sortKey: (weddingMs ?? Date.now()) + idx + 1,
      category,
      status: getDateStatus(weddingMs),
    });
  });

  // 5. Primary Wedding Day
  if (event.wedding_date) {
    milestones.push({
      id: 'ms-wedding-day',
      title:
        event.groom_name && event.bride_name
          ? `${event.groom_name} & ${event.bride_name} Wedding Day`
          : event.name || 'Wedding Celebration',
      subtitle: event.location || 'Venue location to be announced',
      dateLabel: formatDate(event.wedding_date),
      sortKey: weddingMs ?? Date.now(),
      category: 'wedding_day',
      status: getDateStatus(weddingMs),
    });
  }

  // 6. Custom planner milestones saved in website_config.overviewMilestones
  const customMilestones: CustomEventMilestone[] = Array.isArray(
    websiteConfig?.overviewMilestones
  )
    ? websiteConfig.overviewMilestones
    : [];

  customMilestones.forEach((cm) => {
    const cmMs = parseDateSortKey(cm.date);
    milestones.push({
      id: cm.id,
      title: cm.title,
      subtitle: cm.location || undefined,
      dateLabel: cm.time ? `${formatDate(cm.date)} · ${cm.time}` : formatDate(cm.date),
      sortKey: cmMs ?? Date.now(),
      category: cm.category || 'planning',
      status: cm.completed ? 'completed' : getDateStatus(cmMs),
      isCustom: true,
      completed: Boolean(cm.completed),
    });
  });

  return milestones.sort((a, b) => a.sortKey - b.sortKey);
}

/**
 * Projects VenueLayout + SeatingTables into percentage coordinates [0..100]
 * for a crisp miniature floor plan SVG preview.
 */
export function projectFloorPlanPreview(
  layout: VenueLayout | null,
  tables: SeatingTable[]
): FloorPlanPreviewModel {
  const unit: 'm' | 'ft' = layout?.venue_unit === 'ft' ? 'ft' : 'm';
  const venueWidth =
    Number(layout?.venue_width) > 0
      ? Number(layout?.venue_width)
      : unit === 'm'
      ? 30
      : 100;
  const venueHeight =
    Number(layout?.venue_height) > 0
      ? Number(layout?.venue_height)
      : unit === 'm'
      ? 20
      : 65;

  const rawObjects = Array.isArray(layout?.objects) ? layout!.objects : [];
  if (rawObjects.length === 0) {
    return {
      venueWidth,
      venueHeight,
      venueUnit: unit,
      venueName: layout?.venue_name || layout?.layout_name || 'Main Ballroom',
      objects: [],
      hasObjects: false,
    };
  }

  const tableMap = new Map<string, SeatingTable>();
  tables.forEach((t) => tableMap.set(t.id, t));

  const legacyW = Number(layout?.canvas_width) > 0 ? Number(layout!.canvas_width) : 1600;
  const legacyH = Number(layout?.canvas_height) > 0 ? Number(layout!.canvas_height) : 1000;

  const isWorldLayout = layout?.coordinate_system === 'world';

  const projected: FloorPlanProjectedObject[] = rawObjects
    .slice()
    .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
    .map((obj) => {
      const objIsWorld = isWorldLayout || obj.width <= 25;
      const totalW = objIsWorld ? venueWidth : legacyW;
      const totalH = objIsWorld ? venueHeight : legacyH;

      const xPct = Math.max(0, Math.min(100, (obj.position_x / totalW) * 100));
      const yPct = Math.max(0, Math.min(100, (obj.position_y / totalH) * 100));
      const wPct = Math.max(1.5, Math.min(100, (obj.width / totalW) * 100));
      const hPct = Math.max(1.5, Math.min(100, (obj.height / totalH) * 100));

      const linkedTable = obj.object_reference_id
        ? tableMap.get(obj.object_reference_id)
        : undefined;
      const isTable =
        obj.object_type === 'table' || obj.object_type === 'couple_table';
      const isRound =
        obj.object_type === 'table' &&
        (linkedTable?.table_type === 'round' ||
          obj.properties?.tableShape === 'round' ||
          (!linkedTable && Math.abs(obj.width - obj.height) < 0.25));

      return {
        id: obj.id,
        objectType: obj.object_type,
        label:
          linkedTable?.table_number
            ? `T${linkedTable.table_number}`
            : obj.label || obj.object_type.replace('_', ' '),
        xPct,
        yPct,
        wPct,
        hPct,
        rotation: obj.rotation || 0,
        isTable,
        isRound,
        tableNumber: linkedTable?.table_number || obj.properties?.tableNumber,
        assignedCount: linkedTable?.assigned_count ?? 0,
        capacity: linkedTable?.capacity ?? obj.properties?.capacity,
        color: obj.properties?.color,
      };
    });

  return {
    venueWidth,
    venueHeight,
    venueUnit: unit,
    venueName: layout?.venue_name || layout?.layout_name || 'Main Ballroom',
    objects: projected,
    hasObjects: projected.length > 0,
  };
}

/**
 * Fetches all Event Overview Dashboard data strictly scoped to projectId and agencyId.
 * Uses Promise.allSettled so one failing sub-resource does not crash the dashboard.
 */
export async function fetchEventOverviewBundle(params: {
  projectId: string;
  expectedAgencyId?: string;
  projectAgencyId?: string;
  eventPin?: string;
}): Promise<EventOverviewBundle> {
  const { projectId, expectedAgencyId, projectAgencyId, eventPin } = params;

  if (!projectId) {
    throw new Error('Missing event project identifier');
  }

  // Strict multi-tenant isolation check before querying
  if (expectedAgencyId && projectAgencyId && expectedAgencyId !== projectAgencyId) {
    throw new Error('Cross-organization access denied for this event');
  }

  const headers = buildAuthHeaders(eventPin);
  const errors: OverviewWidgetErrors = {};

  const guestsPromise = authenticatedFetch(`${API_BASE}/api/projects/${projectId}/guests`, {
    headers,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Unable to load guest list');
    }
    const data = await res.json();
    return (data.guests || []) as Guest[];
  });

  const tablesPromise = authenticatedFetch(`${API_BASE}/api/projects/${projectId}/tables`, {
    headers,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Unable to load seating tables');
    }
    const data = await res.json();
    return (data.tables || []) as SeatingTable[];
  });

  const layoutPromise = authenticatedFetch(`${API_BASE}/api/projects/${projectId}/layout`, {
    headers,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Unable to load floor plan');
    }
    const data = await res.json();
    return (data.layout || null) as VenueLayout | null;
  });

  const messagesPromise = (async (): Promise<Message[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('project_id', projectId)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(error.message || 'Unable to load wish wall messages');
    }
    return (data || []) as Message[];
  })();

  const [guestsRes, tablesRes, layoutRes, messagesRes] = await Promise.allSettled([
    guestsPromise,
    tablesPromise,
    layoutPromise,
    messagesPromise,
  ]);

  const guests = guestsRes.status === 'fulfilled' ? guestsRes.value : [];
  if (guestsRes.status === 'rejected') {
    errors.guests = guestsRes.reason?.message || 'Unable to load guests';
  }

  const tables = tablesRes.status === 'fulfilled' ? tablesRes.value : [];
  if (tablesRes.status === 'rejected') {
    errors.tables = tablesRes.reason?.message || 'Unable to load tables';
  }

  const layout = layoutRes.status === 'fulfilled' ? layoutRes.value : null;
  if (layoutRes.status === 'rejected') {
    errors.layout = layoutRes.reason?.message || 'Unable to load floor plan';
  }

  const messages = messagesRes.status === 'fulfilled' ? messagesRes.value : [];
  if (messagesRes.status === 'rejected') {
    errors.messages = messagesRes.reason?.message || 'Unable to load wish wall';
  }

  return { guests, tables, layout, messages, errors };
}
