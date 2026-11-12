import { VenueLayout, VenueLayoutObject } from '../types';

export type VenueUnit = 'm' | 'ft';
export type VenueOrientation = 'landscape' | 'portrait';

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
 * In Canvas Rendering (Layer B), how many screen pixels represent 1 world unit?
 * 1 meter = 60 canvas pixels.
 * 1 foot = ~18.288 canvas pixels (60 / 3.28084).
 */
export const PIXELS_PER_METER = 60;
export const PIXELS_PER_FOOT = PIXELS_PER_METER * FEET_TO_METERS; // ≈ 18.288

export function getPixelsPerUnit(unit: VenueUnit): number {
  return unit === 'm' ? PIXELS_PER_METER : PIXELS_PER_FOOT;
}

/**
 * Safely rounds numbers to 2 decimal places to prevent floating point drift.
 */
export function roundToDecimals(val: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Converts world measurement to screen pixels.
 */
export function worldToScreen(worldVal: number, unit: VenueUnit = 'm'): number {
  return Math.round(worldVal * getPixelsPerUnit(unit));
}

/**
 * Converts screen pixels to world measurement.
 */
export function screenToWorld(screenPx: number, unit: VenueUnit = 'm', decimals: number = 2): number {
  return roundToDecimals(screenPx / getPixelsPerUnit(unit), decimals);
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
 * Legacy pixel conversion factor:
 * In the legacy system, canvas was 2000 x 1400 px.
 * A standard ballroom of 30m x 21m mapped to this with ratio 2000 / 30 = 66.6667 px/meter.
 */
export const LEGACY_PX_PER_METER = 2000 / 30; // 66.66666666666667

/**
 * Determines whether a layout needs migration from legacy pixel coordinates.
 */
export function isLegacyLayout(layout: Partial<VenueLayout> | null | undefined): boolean {
  if (!layout) return false;
  // If already tagged as world coordinates, it's not legacy
  if (layout.coordinate_system === 'world' || layout.coordinate_system === 'world_meters' || layout.coordinate_system === 'world_feet') {
    return false;
  }
  // If venue_width is already defined and reasonable, it's not legacy
  if (layout.venue_width && layout.venue_width <= 200 && layout.venue_height && layout.venue_height <= 200) {
    return false;
  }
  // If objects have width > 30, they are in legacy pixel coordinates (e.g. 130px for a table)
  if (layout.objects && layout.objects.some(o => (o.width && o.width >= 35) || (o.position_x && o.position_x >= 200))) {
    return true;
  }
  // If canvas_width is 2000 and venue_width is missing
  if ((layout.canvas_width === 2000 || !layout.canvas_width) && !layout.venue_width) {
    return true;
  }
  return false;
}

/**
 * Explicit migration function:
 * Converts legacy 2000x1400 pixel layout into world-coordinate system.
 * Preserves all table IDs, guest assignments, rotations, and relationships.
 * Idempotent: NEVER applies repeated scaling once migrated.
 */
export function migrateVenueLayout(layout: VenueLayout): VenueLayout {
  if (!isLegacyLayout(layout)) {
    return layout;
  }

  const legacyWidth = layout.canvas_width || 2000;
  const legacyHeight = layout.canvas_height || 1400;

  // Determine equivalent real-world dimensions in meters
  // Default to 30.0m x 21.0m (proportional to 2000 x 1400)
  const venueWidthM = 30.0;
  const venueHeightM = roundToDecimals((legacyHeight / legacyWidth) * venueWidthM, 1); // 21.0m
  const conversionFactor = legacyWidth / venueWidthM; // 66.6667 px/m

  const migratedObjects: VenueLayoutObject[] = (layout.objects || []).map(obj => {
    // Check if individual object was already in meters (e.g. obj.width <= 25)
    const isObjAlreadyMeters = obj.width <= 25 && obj.height <= 25 && obj.position_x <= 100 && obj.position_y <= 100;
    
    const worldW = isObjAlreadyMeters ? obj.width : Math.max(0.5, roundToDecimals(obj.width / conversionFactor, 2));
    const worldH = isObjAlreadyMeters ? obj.height : Math.max(0.5, roundToDecimals(obj.height / conversionFactor, 2));
    const worldX = isObjAlreadyMeters ? obj.position_x : roundToDecimals(obj.position_x / conversionFactor, 2);
    const worldY = isObjAlreadyMeters ? obj.position_y : roundToDecimals(obj.position_y / conversionFactor, 2);

    return {
      ...obj,
      position_x: worldX,
      position_y: worldY,
      width: worldW,
      height: worldH,
      properties: {
        ...(obj.properties || {}),
        legacy_position_x: obj.position_x,
        legacy_position_y: obj.position_y,
        legacy_width: obj.width,
        legacy_height: obj.height,
        world_unit: 'm'
      }
    };
  });

  return {
    ...layout,
    venue_width: venueWidthM,
    venue_height: venueHeightM,
    venue_unit: 'm',
    venue_orientation: venueWidthM >= venueHeightM ? 'landscape' : 'portrait',
    grid_unit_step: 0.5,
    show_grid: layout.show_grid ?? true,
    show_rulers: layout.show_rulers ?? true,
    coordinate_system: 'world',
    // Retain canvas_width and canvas_height for backward compatibility with legacy consumers
    canvas_width: Math.round(venueWidthM * PIXELS_PER_METER), // 1800 px
    canvas_height: Math.round(venueHeightM * PIXELS_PER_METER), // 1260 px
    grid_size: Math.round(0.5 * PIXELS_PER_METER), // 30 px
    objects: migratedObjects,
    updated_at: new Date().toISOString()
  };
}

/**
 * Checks which objects fall outside the configured venue boundary.
 * An object is considered out of bounds if its bounding box exceeds [0, venueWidth] or [0, venueHeight].
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

    // Check all 4 corners if rotated, or simple bounds if unrotated
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

    // Calculate effective bounding box footprint
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
