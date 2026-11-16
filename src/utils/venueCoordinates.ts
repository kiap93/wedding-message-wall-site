import { VenueLayout, VenueLayoutObject, VenueObjectType } from '../types';

export type VenueUnit = 'm' | 'ft';
export type VenueOrientation = 'landscape' | 'portrait';

export const CURRENT_LAYOUT_MIGRATION_VERSION = 2;

export interface VenueDimensions {
  width: number;
  height: number;
  unit: VenueUnit;
  orientation: VenueOrientation;
  name?: string;
  description?: string;
  gridUnitStep: number;
}

export interface VenuePreset {
  id: string;
  name: string;
  widthM: number;
  heightM: number;
  widthFt: number;
  heightFt: number;
  description: string;
}

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const VENUE_PRESETS: VenuePreset[] = [
  {
    id: 'small',
    name: 'Small Hall',
    widthM: 15,
    heightM: 10,
    widthFt: 50,
    heightFt: 33,
    description: 'Intimate reception, tea ceremony or boutique dinner (approx. 50–80 guests)'
  },
  {
    id: 'medium',
    name: 'Medium Hall',
    widthM: 20,
    heightM: 15,
    widthFt: 65,
    heightFt: 50,
    description: 'Standard wedding reception with stage and dance floor (approx. 100–180 guests)'
  },
  {
    id: 'large',
    name: 'Large Ballroom',
    widthM: 30,
    heightM: 20,
    widthFt: 100,
    heightFt: 65,
    description: 'Grand ballroom with spacious aisles, dance floor, bar & buffet (approx. 200–350 guests)'
  },
  {
    id: 'long',
    name: 'Long Reception Hall',
    widthM: 35,
    heightM: 12,
    widthFt: 115,
    heightFt: 40,
    description: 'Elongated banquet hall or garden marquee layout (approx. 150–250 guests)'
  }
];

// Conversion constants
export const METERS_TO_FEET = 3.28084;
export const FEET_TO_METERS = 1 / METERS_TO_FEET;

/**
 * Screen Rendering Factor:
 * 1 meter = 60 canvas pixels.
 * 1 foot = ~18.288 canvas pixels (60 / 3.28084).
 */
export const PIXELS_PER_METER = 60;
export const PIXELS_PER_FOOT = PIXELS_PER_METER * FEET_TO_METERS; // ≈ 18.288

/**
 * Legacy pixel conversion factor:
 * Legacy canvas was 2000 x 1400 px for a 30m x 21m ballroom (2000 / 30 = 66.6667 px/m).
 */
export const LEGACY_PX_PER_METER = 2000 / 30;

export function getPixelsPerUnit(unit: VenueUnit = 'm'): number {
  return unit === 'ft' ? PIXELS_PER_FOOT : PIXELS_PER_METER;
}

export function roundToDecimals(val: number, decimals: number = 2): number {
  const safeVal = Number.isFinite(val) ? val : 0;
  const factor = Math.pow(10, decimals);
  return Math.round(safeVal * factor) / factor;
}

export function worldToScreen(worldVal: number, unit: VenueUnit = 'm'): number {
  return Math.round((Number.isFinite(worldVal) ? worldVal : 0) * getPixelsPerUnit(unit));
}

export function screenToWorld(screenPx: number, unit: VenueUnit = 'm', decimals: number = 2): number {
  const px = getPixelsPerUnit(unit);
  return roundToDecimals((Number.isFinite(screenPx) ? screenPx : 0) / px, decimals);
}

/**
 * Minimum object dimension in the configured world unit to guarantee zero-size invisibility cannot happen.
 */
export function getMinWorldDimension(unit: VenueUnit = 'm'): number {
  return unit === 'ft' ? 0.6 : 0.2;
}

/**
 * Canonical default dimensions (in world units) and visual styling for all 13 supported venue object types.
 */
export function getCanonicalObjectDefaults(
  type: VenueObjectType,
  unit: VenueUnit = 'm',
  tableShape?: string
): {
  width: number;
  height: number;
  label: string;
  properties: Record<string, any>;
} {
  const toUnit = (meters: number) =>
    unit === 'ft' ? roundToDecimals(meters * METERS_TO_FEET, 1) : roundToDecimals(meters, 2);

  switch (type) {
    case 'table': {
      const isRect = tableShape === 'rectangular';
      const isSquare = tableShape === 'square';
      return {
        width: isRect ? toUnit(2.4) : toUnit(1.8),
        height: isRect ? toUnit(1.1) : isSquare ? toUnit(1.8) : toUnit(1.8),
        label: 'Reception Table',
        properties: {
          tableShape: tableShape || 'round',
          capacity: 10
        }
      };
    }
    case 'couple_table':
      return {
        width: toUnit(3.8),
        height: toUnit(1.4),
        label: 'Bride & Groom Table',
        properties: { color: '#C5A059', textColor: '#1A1A1A' }
      };
    case 'stage':
      return {
        width: toUnit(8.0),
        height: toUnit(2.8),
        label: 'Main Stage & Altar',
        properties: { color: '#252525', textColor: '#FFFFFF' }
      };
    case 'dance_floor':
      return {
        width: toUnit(6.0),
        height: toUnit(5.0),
        label: 'Dance Floor',
        properties: { color: '#F2EFE9', textColor: '#252525' }
      };
    case 'entrance':
      return {
        width: toUnit(4.5),
        height: toUnit(1.2),
        label: 'Grand Entrance',
        properties: { color: '#8B806F', textColor: '#FFFFFF' }
      };
    case 'buffet':
      return {
        width: toUnit(5.0),
        height: toUnit(1.5),
        label: 'Buffet Catering',
        properties: { color: '#4A3E3D', textColor: '#FFFFFF' }
      };
    case 'bar':
      return {
        width: toUnit(3.2),
        height: toUnit(1.2),
        label: 'Cocktail Bar',
        properties: { color: '#3A443B', textColor: '#FFFFFF' }
      };
    case 'photo_booth':
      return {
        width: toUnit(2.5),
        height: toUnit(2.5),
        label: 'Photo Booth',
        properties: { color: '#FAF9F7', textColor: '#252525' }
      };
    case 'registration':
      return {
        width: toUnit(3.0),
        height: toUnit(1.2),
        label: 'Registration Desk',
        properties: { color: '#E8E3D9', textColor: '#252525' }
      };
    case 'pillar':
      return {
        width: toUnit(0.8),
        height: toUnit(0.8),
        label: 'Pillar',
        properties: { color: '#CCCCCC', textColor: '#252525' }
      };
    case 'wall':
      return {
        width: toUnit(5.0),
        height: toUnit(0.3),
        label: 'Wall Partition',
        properties: { color: '#252525', textColor: '#FFFFFF' }
      };
    case 'decor':
      return {
        width: toUnit(2.0),
        height: toUnit(2.0),
        label: 'Floral Decor',
        properties: { color: '#EFE6DD', textColor: '#5B4937' }
      };
    case 'label':
      return {
        width: toUnit(3.5),
        height: toUnit(1.0),
        label: 'Section Label',
        properties: { color: 'transparent', textColor: '#252525' }
      };
    default:
      return {
        width: toUnit(2.0),
        height: toUnit(2.0),
        label: 'Venue Element',
        properties: { color: '#FAF9F7', textColor: '#252525' }
      };
  }
}

/**
 * Converts a canonical world-space object to screen pixels for rendering.
 */
export function worldObjectToScreen(
  obj: Pick<VenueLayoutObject, 'position_x' | 'position_y' | 'width' | 'height'>,
  unit: VenueUnit = 'm'
): ScreenRect {
  const px = getPixelsPerUnit(unit);
  const safeW = Number.isFinite(obj.width) && obj.width > 0 ? obj.width : 1.0;
  const safeH = Number.isFinite(obj.height) && obj.height > 0 ? obj.height : 1.0;
  return {
    x: Math.round((Number.isFinite(obj.position_x) ? obj.position_x : 0) * px),
    y: Math.round((Number.isFinite(obj.position_y) ? obj.position_y : 0) * px),
    width: Math.max(8, Math.round(safeW * px)),
    height: Math.max(8, Math.round(safeH * px))
  };
}

/**
 * Converts screen-pixel coordinates back into canonical world units.
 */
export function screenObjectToWorld(
  rect: ScreenRect,
  unit: VenueUnit = 'm',
  decimals: number = 2
): { position_x: number; position_y: number; width: number; height: number } {
  const px = getPixelsPerUnit(unit);
  const minWorld = getMinWorldDimension(unit);
  return {
    position_x: roundToDecimals(rect.x / px, decimals),
    position_y: roundToDecimals(rect.y / px, decimals),
    width: Math.max(minWorld, roundToDecimals(rect.width / px, decimals)),
    height: Math.max(minWorld, roundToDecimals(rect.height / px, decimals))
  };
}

/**
 * Centralized screen rectangle conversion for an object within a layout.
 * Strictly relies on layout unit/migration state — NEVER guesses from obj.width <= 25.
 */
export function getObjectScreenRect(
  obj: VenueLayoutObject,
  layoutOrUnit?: Partial<VenueLayout> | VenueUnit | null
): ScreenRect {
  if (!layoutOrUnit || typeof layoutOrUnit === 'string') {
    const unit: VenueUnit = layoutOrUnit === 'ft' ? 'ft' : 'm';
    return worldObjectToScreen(obj, unit);
  }

  const unit: VenueUnit = layoutOrUnit.venue_unit === 'ft' ? 'ft' : 'm';
  // If the layout is still un-migrated legacy pixels (e.g. a caller inspects raw legacy objects),
  // convert via legacy factor rather than multiplying pixel numbers by 60.
  if (isLegacyLayout(layoutOrUnit)) {
    const legacyW = layoutOrUnit.canvas_width && layoutOrUnit.canvas_width > 0 ? layoutOrUnit.canvas_width : 2000;
    const targetW =
      layoutOrUnit.venue_width && layoutOrUnit.venue_width > 0 && layoutOrUnit.venue_width <= 200
        ? layoutOrUnit.venue_width
        : unit === 'ft'
          ? 100
          : 30;
    const factor = legacyW / targetW;
    const isAlreadyMigratedObj = Boolean(obj.properties?.migrated_v2 || obj.properties?.world_unit);
    if (!isAlreadyMigratedObj) {
      const worldObj = {
        position_x: obj.position_x / factor,
        position_y: obj.position_y / factor,
        width: obj.width / factor,
        height: obj.height / factor
      };
      return worldObjectToScreen(worldObj, unit);
    }
  }

  return worldObjectToScreen(obj, unit);
}

/**
 * Formats venue area string with appropriate units.
 */
export function formatVenueArea(width: number, height: number, unit: VenueUnit): string {
  const area = roundToDecimals(width * height, 1);
  if (unit === 'm') {
    return `${area.toLocaleString()} m²`;
  }
  return `${area.toLocaleString()} sq ft`;
}

/**
 * Converts value between meters and feet.
 */
export function convertUnitValue(value: number, fromUnit: VenueUnit, toUnit: VenueUnit): number {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'm' && toUnit === 'ft') {
    return roundToDecimals(value * METERS_TO_FEET, 1);
  }
  return roundToDecimals(value * FEET_TO_METERS, 1);
}

/**
 * Converts an entire VenueLayout and all placed objects between meters and feet proportionally.
 */
export function convertLayoutUnit(layout: VenueLayout, toUnit: VenueUnit): VenueLayout {
  const normalized = normalizeVenueLayout(layout);
  const fromUnit: VenueUnit = normalized.venue_unit === 'ft' ? 'ft' : 'm';
  if (fromUnit === toUnit) return normalized;

  const newW = convertUnitValue(normalized.venue_width || 30, fromUnit, toUnit);
  const newH = convertUnitValue(normalized.venue_height || 20, fromUnit, toUnit);
  const newStep = toUnit === 'ft' ? 2.0 : 0.5;
  const px = getPixelsPerUnit(toUnit);

  const convertedObjects = normalized.objects.map(obj => ({
    ...obj,
    position_x: convertUnitValue(obj.position_x, fromUnit, toUnit),
    position_y: convertUnitValue(obj.position_y, fromUnit, toUnit),
    width: Math.max(getMinWorldDimension(toUnit), convertUnitValue(obj.width, fromUnit, toUnit)),
    height: Math.max(getMinWorldDimension(toUnit), convertUnitValue(obj.height, fromUnit, toUnit)),
    properties: {
      ...(obj.properties || {}),
      world_unit: toUnit
    }
  }));

  return {
    ...normalized,
    venue_width: newW,
    venue_height: newH,
    venue_unit: toUnit,
    grid_unit_step: newStep,
    canvas_width: Math.round(newW * px),
    canvas_height: Math.round(newH * px),
    grid_size: Math.round(newStep * px),
    objects: convertedObjects
  };
}

/**
 * Detects whether an individual object holds legacy pixel-scale coordinates.
 */
function isObjectPixelScale(
  obj: VenueLayoutObject,
  unit: VenueUnit,
  venueWidth: number,
  venueHeight: number
): boolean {
  if (obj.properties?.migrated_v2 === true) {
    return false;
  }

  const w = Number(obj.width) || 0;
  const h = Number(obj.height) || 0;
  const x = Math.abs(Number(obj.position_x) || 0);
  const y = Math.abs(Number(obj.position_y) || 0);

  if (unit === 'ft') {
    // In feet (~50-150ft hall), tables are ~6ft, stage ~26ft; pixel coords are >= 90 width or >= 280 pos
    return w >= 90 || h >= 90 || x >= Math.max(280, venueWidth * 2.5) || y >= Math.max(280, venueHeight * 2.5);
  }

  // In meters (~15-40m hall), tables are ~1.8m, stage ~8-12m; pixel coords are >= 35 width or >= 120 pos
  return w >= 35 || h >= 35 || x >= Math.max(120, venueWidth * 2.5) || y >= Math.max(120, venueHeight * 2.5);
}

/**
 * Determines whether a layout needs migration from legacy pixel coordinates.
 * Handles BOTH untagged legacy layouts AND broken layouts mis-tagged as `coordinate_system = 'world'`
 * by column defaults while containing pixel-scale object coordinates.
 */
export function isLegacyLayout(layout: Partial<VenueLayout> | null | undefined): boolean {
  if (!layout) return false;

  // Version 2+ layouts have been explicitly migrated & verified idempotently
  if (Number(layout.migration_version) >= CURRENT_LAYOUT_MIGRATION_VERSION) {
    return false;
  }

  const unit: VenueUnit = layout.venue_unit === 'ft' ? 'ft' : 'm';
  const vw =
    layout.venue_width && layout.venue_width > 0
      ? layout.venue_width
      : unit === 'ft'
        ? 100
        : 30;
  const vh =
    layout.venue_height && layout.venue_height > 0
      ? layout.venue_height
      : unit === 'ft'
        ? 65
        : 20;

  // Even if coordinate_system === 'world' or is_migrated === true, inspect object metrics
  // to catch rows corrupted by DB column-default migrations (e.g., 20261113_custom_venue_dimensions.sql).
  if (Array.isArray(layout.objects) && layout.objects.length > 0) {
    if (layout.objects.some(o => isObjectPixelScale(o, unit, vw, vh))) {
      return true;
    }
  }

  // If tagged as world and no pixel-scale objects were found, it is already world-coordinate
  if (
    layout.coordinate_system === 'world' ||
    layout.coordinate_system === 'world_meters' ||
    layout.coordinate_system === 'world_feet'
  ) {
    return false;
  }

  // Reasonable venue dimensions explicitly present and no pixel objects
  if (layout.venue_width && layout.venue_width <= 200 && layout.venue_height && layout.venue_height <= 200) {
    return false;
  }

  // Untagged legacy pixel layout (no coordinate_system and no valid venue_width)
  if ((layout.canvas_width === 2000 || !layout.canvas_width) && !layout.venue_width) {
    return true;
  }

  if (layout.coordinate_system === 'pixel' || (!layout.coordinate_system && (layout.canvas_width || 0) >= 800)) {
    return true;
  }

  return false;
}

/**
 * Explicit, idempotent migration function:
 * Converts legacy pixel layouts (including mis-tagged DB rows) into canonical world coordinates.
 * Preserves all object IDs, object_reference_id links, rotations, labels, capacities, and custom properties.
 * Never resets or drops objects, and never scales an already-migrated layout a second time.
 */
export function migrateVenueLayout(layout: VenueLayout): VenueLayout {
  if (!isLegacyLayout(layout)) {
    return layout;
  }

  const unit: VenueUnit = layout.venue_unit === 'ft' ? 'ft' : 'm';
  const objects = Array.isArray(layout.objects) ? layout.objects : [];

  // Infer legacy canvas bounds cleanly
  const maxObjRight = objects.reduce((max, o) => Math.max(max, (o.position_x || 0) + (o.width || 0)), 0);
  const maxObjBottom = objects.reduce((max, o) => Math.max(max, (o.position_y || 0) + (o.height || 0)), 0);

  const legacyWidth =
    layout.canvas_width && layout.canvas_width >= 800
      ? layout.canvas_width
      : Math.max(2000, Math.ceil(maxObjRight));
  const legacyHeight =
    layout.canvas_height && layout.canvas_height >= 600
      ? layout.canvas_height
      : Math.max(1400, Math.ceil(maxObjBottom));

  const hasExplicitVenueDims =
    Boolean(layout.venue_width && layout.venue_width > 0 && layout.venue_width <= 200) &&
    Boolean(layout.venue_height && layout.venue_height > 0 && layout.venue_height <= 200);

  const targetW = hasExplicitVenueDims
    ? Number(layout.venue_width)
    : unit === 'ft'
      ? 100.0
      : 30.0;
  const targetH = hasExplicitVenueDims
    ? Number(layout.venue_height)
    : roundToDecimals((legacyHeight / legacyWidth) * targetW, 1);

  // Uniform pixel-to-world divisor preserves round circles as 1:1 circles while keeping items within bounds
  const factorX = legacyWidth / targetW;
  const factorY = legacyHeight / targetH;
  const conversionFactor = hasExplicitVenueDims
    ? Math.max(factorX, factorY)
    : factorX; // 2000 / 30 = 66.6667

  const minDim = getMinWorldDimension(unit);

  const migratedObjects: VenueLayoutObject[] = objects.map(obj => {
    const alreadyWorldObj =
      Boolean(obj.properties?.migrated_v2) ||
      (Boolean(obj.properties?.world_unit) && !isObjectPixelScale(obj, unit, targetW, targetH));

    if (alreadyWorldObj) {
      return {
        ...obj,
        width: Math.max(minDim, roundToDecimals(obj.width || minDim, 2)),
        height: Math.max(minDim, roundToDecimals(obj.height || minDim, 2)),
        properties: {
          ...(obj.properties || {}),
          migrated_v2: true,
          world_unit: unit
        }
      };
    }

    const worldW = Math.max(minDim, roundToDecimals((obj.width || 120) / conversionFactor, 2));
    const worldH = Math.max(minDim, roundToDecimals((obj.height || 120) / conversionFactor, 2));
    const worldX = roundToDecimals((obj.position_x || 0) / conversionFactor, 2);
    const worldY = roundToDecimals((obj.position_y || 0) / conversionFactor, 2);

    return {
      ...obj,
      position_x: worldX,
      position_y: worldY,
      width: worldW,
      height: worldH,
      properties: {
        ...(obj.properties || {}),
        legacy_position_x: obj.properties?.legacy_position_x ?? obj.position_x,
        legacy_position_y: obj.properties?.legacy_position_y ?? obj.position_y,
        legacy_width: obj.properties?.legacy_width ?? obj.width,
        legacy_height: obj.properties?.legacy_height ?? obj.height,
        world_unit: unit,
        migrated_v2: true
      }
    };
  });

  const pxPerUnit = getPixelsPerUnit(unit);
  const gridStep = layout.grid_unit_step && layout.grid_unit_step > 0 ? layout.grid_unit_step : unit === 'ft' ? 2.0 : 0.5;

  return {
    ...layout,
    venue_width: targetW,
    venue_height: targetH,
    venue_unit: unit,
    venue_orientation: targetW >= targetH ? 'landscape' : 'portrait',
    grid_unit_step: gridStep,
    show_grid: layout.show_grid ?? true,
    show_rulers: layout.show_rulers ?? true,
    coordinate_system: 'world',
    is_migrated: true,
    migration_version: CURRENT_LAYOUT_MIGRATION_VERSION,
    canvas_width: Math.round(targetW * pxPerUnit),
    canvas_height: Math.round(targetH * pxPerUnit),
    grid_size: Math.round(gridStep * pxPerUnit),
    objects: migratedObjects,
    updated_at: new Date().toISOString()
  };
}

/**
 * Guarantees a VenueLayout is in canonical v2 world coordinates with valid numeric bounds,
 * synchronized canvas dimensions, and non-zero safe object dimensions.
 */
export function normalizeVenueLayout(layout: VenueLayout): VenueLayout {
  const migrated = isLegacyLayout(layout) ? migrateVenueLayout(layout) : layout;
  const unit: VenueUnit = migrated.venue_unit === 'ft' ? 'ft' : 'm';
  const venueWidth = migrated.venue_width && migrated.venue_width > 0 ? migrated.venue_width : unit === 'ft' ? 100 : 30;
  const venueHeight = migrated.venue_height && migrated.venue_height > 0 ? migrated.venue_height : unit === 'ft' ? 65 : 20;
  const pxPerUnit = getPixelsPerUnit(unit);
  const gridUnitStep = migrated.grid_unit_step && migrated.grid_unit_step > 0 ? migrated.grid_unit_step : unit === 'ft' ? 2.0 : 0.5;
  const minDim = getMinWorldDimension(unit);

  const normalizedObjects: VenueLayoutObject[] = (Array.isArray(migrated.objects) ? migrated.objects : []).map(obj => {
    const safeWidth = Number.isFinite(obj.width) && obj.width > 0 ? roundToDecimals(obj.width, 2) : Math.max(minDim, unit === 'ft' ? 6.0 : 1.8);
    const safeHeight = Number.isFinite(obj.height) && obj.height > 0 ? roundToDecimals(obj.height, 2) : Math.max(minDim, unit === 'ft' ? 6.0 : 1.8);
    const safeX = Number.isFinite(obj.position_x) ? roundToDecimals(obj.position_x, 2) : 1;
    const safeY = Number.isFinite(obj.position_y) ? roundToDecimals(obj.position_y, 2) : 1;

    return {
      ...obj,
      position_x: safeX,
      position_y: safeY,
      width: Math.max(minDim, safeWidth),
      height: Math.max(minDim, safeHeight),
      rotation: Number.isFinite(obj.rotation) ? obj.rotation : 0,
      properties: {
        ...(obj.properties || {}),
        world_unit: unit,
        migrated_v2: true
      }
    };
  });

  return {
    ...migrated,
    venue_width: venueWidth,
    venue_height: venueHeight,
    venue_unit: unit,
    venue_orientation: migrated.venue_orientation || (venueWidth >= venueHeight ? 'landscape' : 'portrait'),
    grid_unit_step: gridUnitStep,
    show_grid: migrated.show_grid ?? true,
    show_rulers: migrated.show_rulers ?? true,
    snap_to_grid: migrated.snap_to_grid ?? true,
    coordinate_system: 'world',
    is_migrated: true,
    migration_version: CURRENT_LAYOUT_MIGRATION_VERSION,
    canvas_width: Math.round(venueWidth * pxPerUnit),
    canvas_height: Math.round(venueHeight * pxPerUnit),
    grid_size: Math.round(gridUnitStep * pxPerUnit),
    objects: normalizedObjects
  };
}

/**
 * Checks which objects fall outside the configured venue boundary.
 */
export function getOutOfBoundsObjects(
  objects: VenueLayoutObject[],
  venueWidth: number,
  venueHeight: number
): { outOfBoundsIds: string[]; outOfBoundsObjects: VenueLayoutObject[] } {
  const outOfBoundsObjects: VenueLayoutObject[] = [];
  const outOfBoundsIds: string[] = [];

  for (const obj of objects) {
    const x = obj.position_x;
    const y = obj.position_y;
    const w = obj.width;
    const h = obj.height;

    const rot = obj.rotation || 0;
    let isOutside = false;

    if (rot === 0) {
      if (x < -0.01 || y < -0.01 || (x + w) > venueWidth + 0.01 || (y + h) > venueHeight + 0.01) {
        isOutside = true;
      }
    } else {
      const rad = (rot * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const corners = [
        { dx: 0, dy: 0 },
        { dx: w, dy: 0 },
        { dx: w, dy: h },
        { dx: 0, dy: h }
      ];

      for (const c of corners) {
        const wx = x + (c.dx * cos - c.dy * sin);
        const wy = y + (c.dx * sin + c.dy * cos);
        if (wx < -0.01 || wy < -0.01 || wx > venueWidth + 0.01 || wy > venueHeight + 0.01) {
          isOutside = true;
          break;
        }
      }
    }

    if (isOutside) {
      outOfBoundsObjects.push(obj);
      outOfBoundsIds.push(obj.id);
    }
  }

  return { outOfBoundsIds, outOfBoundsObjects };
}

/**
 * Repositions any out-of-bounds objects inward to fit inside the venue boundary.
 * Strictly preserves object IDs, widths, heights, rotations, capacities, and guest assignments.
 */
export function repositionObjectsInsideVenue(
  objects: VenueLayoutObject[],
  venueWidth: number,
  venueHeight: number,
  margin: number = 0.5
): VenueLayoutObject[] {
  return objects.map(obj => {
    const w = obj.width;
    const h = obj.height;
    const rot = obj.rotation || 0;

    let effW = w;
    let effH = h;
    if (rot !== 0) {
      const rad = (Math.abs(rot) * Math.PI) / 180;
      effW = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
      effH = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
    }

    const maxX = Math.max(margin, venueWidth - effW - margin);
    const maxY = Math.max(margin, venueHeight - effH - margin);

    const clampedX = Math.max(margin, Math.min(maxX, obj.position_x));
    const clampedY = Math.max(margin, Math.min(maxY, obj.position_y));

    if (clampedX !== obj.position_x || clampedY !== obj.position_y) {
      return {
        ...obj,
        position_x: roundToDecimals(clampedX, 2),
        position_y: roundToDecimals(clampedY, 2)
      };
    }

    return obj;
  });
}
