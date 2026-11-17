import { API_BASE } from './config';
import { authenticatedFetch, extractApiErrorMessage, unwrapApiData } from './auth';
import {
  Guest,
  Message,
  SeatingTable,
  VenueLayout,
  VenueLayoutObject,
  WeddingEvent,
} from '../types';
import {
  getCanonicalObjectDefaults,
  METERS_TO_FEET,
  normalizeVenueLayout,
} from '../utils/venueCoordinates';
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

export type FloorPlanTableShape = 'round' | 'oval' | 'rectangular' | 'square' | 'custom';

export interface FloorPlanProjectedObject {
  id: string;
  objectType: VenueLayoutObject['object_type'];
  label: string;
  /** Legacy percentage fields preserved for compatibility */
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  /** Canonical world-space coordinates in venueUnit */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isTable: boolean;
  isCoupleTable: boolean;
  isRound: boolean;
  isOval: boolean;
  isSquare: boolean;
  tableShape: FloorPlanTableShape;
  tableNumber?: string;
  assignedCount?: number;
  capacity?: number;
  color?: string;
  textColor?: string;
}

export interface FloorPlanPreviewModel {
  venueWidth: number;
  venueHeight: number;
  venueUnit: 'm' | 'ft';
  venueName: string;
  gridUnitStep: number;
  objects: FloorPlanProjectedObject[];
  hasObjects: boolean;
}

export interface FloorPlanPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface UniformFloorPlanTransform {
  containerWidth: number;
  containerHeight: number;
  hallWidth: number;
  hallHeight: number;
  /** Uniform scale in SVG px per world unit (always scaleX === scaleY) */
  scale: number;
  scaleX: number;
  scaleY: number;
  renderedWidth: number;
  renderedHeight: number;
  offsetX: number;
  offsetY: number;
  padding: FloorPlanPadding;
}

export interface FloorPlanChairPoint {
  cx: number;
  cy: number;
  r: number;
  isHeadChair?: boolean;
}

export interface UniformScreenObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  circleDiameter: number;
  circleRadius: number;
  rx: number;
  ry: number;
  rotation: number;
  pivotX: number;
  pivotY: number;
  chairs: FloorPlanChairPoint[];
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
 * Projects VenueLayout + SeatingTables into canonical world-space coordinates
 * (plus normalized percentage coordinates for backward-compatible callers).
 * Never mutates the input layout.
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

  if (!layout || !Array.isArray(layout.objects) || layout.objects.length === 0) {
    return {
      venueWidth,
      venueHeight,
      venueUnit: unit,
      venueName: layout?.venue_name || layout?.layout_name || 'Main Ballroom',
      gridUnitStep:
        layout?.grid_unit_step && layout.grid_unit_step > 0
          ? layout.grid_unit_step
          : unit === 'ft'
          ? 2
          : 1,
      objects: [],
      hasObjects: false,
    };
  }

  const normalized = normalizeVenueLayout(layout);
  const normUnit: 'm' | 'ft' = normalized.venue_unit === 'ft' ? 'ft' : 'm';
  const normW = normalized.venue_width > 0 ? normalized.venue_width : venueWidth;
  const normH = normalized.venue_height > 0 ? normalized.venue_height : venueHeight;
  const gridUnitStep =
    normalized.grid_unit_step && normalized.grid_unit_step > 0
      ? normalized.grid_unit_step
      : normUnit === 'ft'
      ? 2
      : 1;

  const tableMap = new Map<string, SeatingTable>();
  tables.forEach((t) => tableMap.set(t.id, t));

  const ovalTolerance = normUnit === 'ft' ? 0.35 : 0.1;

  const projected: FloorPlanProjectedObject[] = normalized.objects
    .slice()
    .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
    .map((obj) => {
      const worldX = Number.isFinite(obj.position_x) ? obj.position_x : 0;
      const worldY = Number.isFinite(obj.position_y) ? obj.position_y : 0;
      const worldW =
        Number.isFinite(obj.width) && obj.width > 0
          ? obj.width
          : getCanonicalObjectDefaults(obj.object_type, normUnit).width;
      const worldH =
        Number.isFinite(obj.height) && obj.height > 0
          ? obj.height
          : getCanonicalObjectDefaults(obj.object_type, normUnit).height;

      const xPct = Math.max(0, Math.min(100, (worldX / normW) * 100));
      const yPct = Math.max(0, Math.min(100, (worldY / normH) * 100));
      const wPct = Math.max(1.5, Math.min(100, (worldW / normW) * 100));
      const hPct = Math.max(1.5, Math.min(100, (worldH / normH) * 100));

      const linkedTable = obj.object_reference_id
        ? tableMap.get(obj.object_reference_id)
        : undefined;
      const isCoupleTable = obj.object_type === 'couple_table';
      const isTable = obj.object_type === 'table' || isCoupleTable;

      const rawShape = String(
        linkedTable?.table_type || obj.properties?.tableShape || 'round'
      ).toLowerCase();

      const tableShape: FloorPlanTableShape =
        rawShape === 'rectangular' || rawShape === 'custom'
          ? (rawShape as FloorPlanTableShape)
          : rawShape === 'square'
          ? 'square'
          : rawShape === 'oval'
          ? 'oval'
          : !linkedTable &&
            !obj.properties?.tableShape &&
            Math.abs(worldW - worldH) >= 0.25
          ? 'rectangular'
          : 'round';

      const isSquare = obj.object_type === 'table' && tableShape === 'square';
      const isOval =
        obj.object_type === 'table' &&
        (tableShape === 'oval' ||
          (tableShape === 'round' && Math.abs(worldW - worldH) > ovalTolerance && obj.properties?.tableShape === 'oval'));
      const isRound =
        obj.object_type === 'table' && tableShape === 'round' && !isOval;

      const defaults = getCanonicalObjectDefaults(
        obj.object_type,
        normUnit,
        tableShape
      );

      return {
        id: obj.id,
        objectType: obj.object_type,
        label:
          linkedTable?.table_number
            ? `T${linkedTable.table_number}`
            : obj.label || defaults.label || obj.object_type.replace('_', ' '),
        xPct,
        yPct,
        wPct,
        hPct,
        x: worldX,
        y: worldY,
        width: worldW,
        height: worldH,
        rotation: obj.rotation || 0,
        isTable,
        isCoupleTable,
        isRound,
        isOval,
        isSquare,
        tableShape,
        tableNumber: linkedTable?.table_number || obj.properties?.tableNumber,
        assignedCount: linkedTable?.assigned_count ?? 0,
        capacity: linkedTable?.capacity ?? obj.properties?.capacity,
        color: obj.properties?.color || defaults.properties?.color,
        textColor: obj.properties?.textColor || defaults.properties?.textColor,
      };
    });

  return {
    venueWidth: normW,
    venueHeight: normH,
    venueUnit: normUnit,
    venueName:
      normalized.venue_name ||
      layout.venue_name ||
      layout.layout_name ||
      'Main Ballroom',
    gridUnitStep,
    objects: projected,
    hasObjects: projected.length > 0,
  };
}

export function getDefaultFloorPlanPadding(containerWidth: number): FloorPlanPadding {
  if (containerWidth < 400) {
    return { top: 24, right: 12, bottom: 12, left: 28 };
  }
  return { top: 28, right: 18, bottom: 16, left: 34 };
}

/**
 * Computes responsive SVG stage dimensions for a measured container width,
 * preserving natural aspect ratios for landscape, portrait, and narrow halls
 * while keeping height bounded cleanly across desktop and mobile viewports.
 */
export function computeResponsiveFloorPlanStageSize(
  availableWidth: number,
  hallWidth: number,
  hallHeight: number,
  options?: {
    minHeight?: number;
    maxHeight?: number;
    padding?: FloorPlanPadding;
  }
): { width: number; height: number } {
  const safeWidth = Math.max(220, Math.round(availableWidth || 600));
  const padding = options?.padding ?? getDefaultFloorPlanPadding(safeWidth);
  const isCompact = safeWidth < 420;
  const minHeight = options?.minHeight ?? (isCompact ? 180 : 220);
  const maxHeight = options?.maxHeight ?? (isCompact ? 300 : 380);

  const safeHallW = hallWidth > 0 ? hallWidth : 30;
  const safeHallH = hallHeight > 0 ? hallHeight : 20;

  const innerW = Math.max(60, safeWidth - padding.left - padding.right);
  const idealInnerH = innerW * (safeHallH / safeHallW);

  const minInnerH = Math.max(80, minHeight - padding.top - padding.bottom);
  const maxInnerH = Math.max(minInnerH, maxHeight - padding.top - padding.bottom);
  const clampedInnerH = Math.max(minInnerH, Math.min(maxInnerH, Math.round(idealInnerH)));

  return {
    width: safeWidth,
    height: clampedInnerH + padding.top + padding.bottom,
  };
}

/**
 * Computes a single uniform scale (`scale = min(innerW / hallW, innerH / hallH)`)
 * and centered offsets for rendering any venue aspect ratio without distortion.
 */
export function computeUniformFloorPlanTransform(params: {
  containerWidth: number;
  containerHeight: number;
  hallWidth: number;
  hallHeight: number;
  padding?: Partial<FloorPlanPadding>;
}): UniformFloorPlanTransform {
  const safeContainerW = Math.max(120, params.containerWidth);
  const safeContainerH = Math.max(120, params.containerHeight);
  const safeHallW = params.hallWidth > 0 ? params.hallWidth : 30;
  const safeHallH = params.hallHeight > 0 ? params.hallHeight : 20;

  const defaultPad = getDefaultFloorPlanPadding(safeContainerW);
  const padding: FloorPlanPadding = {
    top: params.padding?.top ?? defaultPad.top,
    right: params.padding?.right ?? defaultPad.right,
    bottom: params.padding?.bottom ?? defaultPad.bottom,
    left: params.padding?.left ?? defaultPad.left,
  };

  const innerW = Math.max(20, safeContainerW - padding.left - padding.right);
  const innerH = Math.max(20, safeContainerH - padding.top - padding.bottom);

  const scale = Math.min(innerW / safeHallW, innerH / safeHallH);
  const renderedWidth = safeHallW * scale;
  const renderedHeight = safeHallH * scale;
  const offsetX = padding.left + (innerW - renderedWidth) / 2;
  const offsetY = padding.top + (innerH - renderedHeight) / 2;

  return {
    containerWidth: safeContainerW,
    containerHeight: safeContainerH,
    hallWidth: safeHallW,
    hallHeight: safeHallH,
    scale,
    scaleX: scale,
    scaleY: scale,
    renderedWidth,
    renderedHeight,
    offsetX,
    offsetY,
    padding,
  };
}

function computeTableChairPoints(
  obj: FloorPlanProjectedObject,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
  unit: 'm' | 'ft'
): FloorPlanChairPoint[] {
  if (obj.objectType !== 'table') return [];
  const count = Math.min(24, Math.max(2, obj.capacity || 8));
  const chairWorldDiam = unit === 'ft' ? 0.38 * METERS_TO_FEET : 0.38;
  const chairSize = Math.max(3, chairWorldDiam * scale);
  const chairR = chairSize / 2;
  const gap = Math.max(1, chairR * 0.35);

  const points: FloorPlanChairPoint[] = [];

  if (obj.tableShape === 'rectangular' || obj.tableShape === 'custom') {
    const hasEndChairs = count >= 6 && width >= chairSize * 3 && height >= chairSize * 1.8;
    const endCount = hasEndChairs ? 2 : 0;
    const sideTotal = Math.max(2, count - endCount);
    const topCount = Math.ceil(sideTotal / 2);
    const botCount = Math.max(1, sideTotal - topCount);

    const topStep = width / (topCount + 1);
    for (let i = 1; i <= topCount; i++) {
      points.push({
        cx: x + topStep * i,
        cy: y - chairR - gap,
        r: chairR,
      });
    }
    const botStep = width / (botCount + 1);
    for (let i = 1; i <= botCount; i++) {
      points.push({
        cx: x + botStep * i,
        cy: y + height + chairR + gap,
        r: chairR,
      });
    }
    if (hasEndChairs) {
      points.push(
        {
          cx: x - chairR - gap,
          cy: y + height / 2,
          r: chairR,
          isHeadChair: true,
        },
        {
          cx: x + width + chairR + gap,
          cy: y + height / 2,
          r: chairR,
          isHeadChair: true,
        }
      );
    }
    return points;
  }

  if (obj.tableShape === 'square') {
    const basePerSide = Math.floor(count / 4);
    const remainder = count % 4;
    const sides = [0, 1, 2, 3].map((s) => basePerSide + (s < remainder ? 1 : 0));

    for (let i = 1; i <= sides[0]; i++) {
      points.push({ cx: x + (width / (sides[0] + 1)) * i, cy: y - chairR - gap, r: chairR });
    }
    for (let i = 1; i <= sides[1]; i++) {
      points.push({ cx: x + width + chairR + gap, cy: y + (height / (sides[1] + 1)) * i, r: chairR });
    }
    for (let i = 1; i <= sides[2]; i++) {
      points.push({ cx: x + (width / (sides[2] + 1)) * i, cy: y + height + chairR + gap, r: chairR });
    }
    for (let i = 1; i <= sides[3]; i++) {
      points.push({ cx: x - chairR - gap, cy: y + (height / (sides[3] + 1)) * i, r: chairR });
    }
    return points;
  }

  // Round / oval radial chairs (uniformly scaled radii)
  const rx = (obj.isRound ? Math.min(width, height) / 2 : width / 2) + chairR + gap;
  const ry = (obj.isRound ? Math.min(width, height) / 2 : height / 2) + chairR + gap;
  const cx = x + width / 2;
  const cy = y + height / 2;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI;
    points.push({
      cx: cx + rx * Math.cos(angle),
      cy: cy + ry * Math.sin(angle),
      r: chairR,
    });
  }

  return points;
}

/**
 * Projects a canonical world-space object into uniform screen/SVG coordinates.
 * Rotation pivots around top-left (x, y) to match WeddingHallPlanner Konva Groups.
 */
export function projectObjectWithUniformScale(
  obj: FloorPlanProjectedObject,
  transform: UniformFloorPlanTransform,
  unit: 'm' | 'ft' = 'm'
): UniformScreenObject {
  const { scale, offsetX, offsetY } = transform;
  const x = offsetX + obj.x * scale;
  const y = offsetY + obj.y * scale;
  const width = obj.width * scale;
  const height = obj.height * scale;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const circleDiameter = Math.min(width, height);
  const circleRadius = circleDiameter / 2;

  return {
    id: obj.id,
    x,
    y,
    width,
    height,
    cx,
    cy,
    circleDiameter,
    circleRadius,
    rx: width / 2,
    ry: height / 2,
    rotation: obj.rotation || 0,
    pivotX: x,
    pivotY: y,
    chairs: computeTableChairPoints(obj, x, y, width, height, scale, unit),
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
      throw new Error(extractApiErrorMessage(body, 'Unable to load guest list'));
    }
    const data = await res.json();
    return (data.guests || []) as Guest[];
  });

  const tablesPromise = authenticatedFetch(`${API_BASE}/api/projects/${projectId}/tables`, {
    headers,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(extractApiErrorMessage(body, 'Unable to load seating tables'));
    }
    const data = await res.json();
    return (data.tables || []) as SeatingTable[];
  });

  const layoutPromise = authenticatedFetch(`${API_BASE}/api/projects/${projectId}/layout`, {
    headers,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(extractApiErrorMessage(body, 'Unable to load floor plan'));
    }
    const data = await res.json();
    return (data.layout || null) as VenueLayout | null;
  });

  const messagesParams = new URLSearchParams({
    projectId,
    includeAll: 'true',
    limit: '100',
  });
  const messagesPromise = authenticatedFetch(`${API_BASE}/api/messages?${messagesParams.toString()}`, {
    headers,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(extractApiErrorMessage(body, 'Unable to load wish wall messages'));
    }
    const json = await res.json().catch(() => null);
    const unwrapped = unwrapApiData<any>(json);
    if (Array.isArray(unwrapped)) return unwrapped as Message[];
    if (Array.isArray(json?.messages)) return json.messages as Message[];
    return [] as Message[];
  });

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
