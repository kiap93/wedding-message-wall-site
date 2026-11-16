import { VenueLayout, VenueLayoutObject } from '../types';
import { getObjectScreenRect, getPixelsPerUnit, VenueUnit } from './venueCoordinates';

export interface HallBoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  hasObjects: boolean;
}

/**
 * Calculates the bounding box (in canvas screen pixels) of all objects placed inside the wedding hall layout.
 * Includes chair clearance around tables and accounts for object rotation.
 * If no objects are placed, falls back to the venue hall boundary.
 */
export function calculateHallBoundingBox(
  objects?: VenueLayoutObject[] | null,
  defaultWidth: number = 1800,
  defaultHeight: number = 1200,
  includeVenueBoundary: boolean = false
): HallBoundingBox {
  const safeDefaultW = Math.max(120, Number.isFinite(defaultWidth) && defaultWidth > 0 ? defaultWidth : 1800);
  const safeDefaultH = Math.max(120, Number.isFinite(defaultHeight) && defaultHeight > 0 ? defaultHeight : 1200);

  if (!objects || objects.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: safeDefaultW,
      maxY: safeDefaultH,
      width: safeDefaultW,
      height: safeDefaultH,
      centerX: safeDefaultW / 2,
      centerY: safeDefaultH / 2,
      hasObjects: false
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of objects) {
    const isTable = obj.object_type === 'table';
    // Visual clearance for chairs around tables (approx 24px on each side in screen space)
    const padding = isTable ? 24 : 0;
    const x = Number.isFinite(obj.position_x) ? obj.position_x : 0;
    const y = Number.isFinite(obj.position_y) ? obj.position_y : 0;
    const w = Number.isFinite(obj.width) && obj.width > 0 ? obj.width : 120;
    const h = Number.isFinite(obj.height) && obj.height > 0 ? obj.height : 120;

    const rotDeg = Number.isFinite(obj.rotation) ? obj.rotation : 0;
    if (rotDeg === 0) {
      const left = x - padding;
      const right = x + w + padding;
      const top = y - padding;
      const bottom = y + h + padding;

      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    } else {
      const rad = (rotDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const localCorners = [
        { dx: -padding, dy: -padding },
        { dx: w + padding, dy: -padding },
        { dx: w + padding, dy: h + padding },
        { dx: -padding, dy: h + padding }
      ];

      for (const pt of localCorners) {
        const wx = x + (pt.dx * cos - pt.dy * sin);
        const wy = y + (pt.dx * sin + pt.dy * cos);

        if (wx < minX) minX = wx;
        if (wx > maxX) maxX = wx;
        if (wy < minY) minY = wy;
        if (wy > maxY) maxY = wy;
      }
    }
  }

  // Ensure venue boundary is encompassed when requested (includes top ruler space if desired)
  if (includeVenueBoundary) {
    minX = Math.min(minX, 0);
    minY = Math.min(minY, 0);
    maxX = Math.max(maxX, safeDefaultW);
    maxY = Math.max(maxY, safeDefaultH);
  }

  if (minX === Infinity || maxX === -Infinity) {
    minX = 0;
    maxX = safeDefaultW;
  }
  if (minY === Infinity || maxY === -Infinity) {
    minY = 0;
    maxY = safeDefaultH;
  }

  const width = Math.max(120, maxX - minX);
  const height = Math.max(120, maxY - minY);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
    hasObjects: true
  };
}

/**
 * Convenience wrapper for canonical world-coordinate VenueLayout objects:
 * converts objects to screen pixels using getObjectScreenRect() before computing the hall bounding box.
 */
export function calculateWorldHallBoundingBox(
  layout: VenueLayout | null | undefined,
  includeVenueBoundary: boolean = true
): HallBoundingBox {
  const unit: VenueUnit = layout?.venue_unit === 'ft' ? 'ft' : 'm';
  const px = getPixelsPerUnit(unit);
  const hallW = Math.round((layout?.venue_width || (unit === 'ft' ? 100 : 30)) * px);
  const hallH = Math.round((layout?.venue_height || (unit === 'ft' ? 65 : 20)) * px);

  const screenObjects: VenueLayoutObject[] = (layout?.objects || []).map(obj => {
    const rect = getObjectScreenRect(obj, layout);
    return {
      ...obj,
      position_x: rect.x,
      position_y: rect.y,
      width: rect.width,
      height: rect.height
    };
  });

  return calculateHallBoundingBox(screenObjects, hallW, hallH, includeVenueBoundary);
}

export interface FitToScreenOptions {
  availableWidth: number;
  availableHeight: number;
  bbox: HallBoundingBox;
  minScale?: number;
  maxScale?: number;
  paddingPercent?: number;
}

/**
 * Calculates the exact scale and position transform to fit the bounding box
 * centered in the available canvas viewport with visual padding.
 * Never modifies actual object positions, rotations, or dimensions.
 */
export function calculateFitToScreenTransform({
  availableWidth,
  availableHeight,
  bbox,
  minScale = 0.25,
  maxScale = 2.0,
  paddingPercent = 0.07
}: FitToScreenOptions): { scale: number; position: { x: number; y: number } } {
  const safeW = Math.max(100, availableWidth);
  const safeH = Math.max(100, availableHeight);

  const usableWidth = safeW * Math.max(0.7, 1 - paddingPercent * 2);
  const usableHeight = safeH * Math.max(0.7, 1 - paddingPercent * 2);

  const safeBoxW = Math.max(120, bbox.width);
  const safeBoxH = Math.max(120, bbox.height);

  const scaleX = usableWidth / safeBoxW;
  const scaleY = usableHeight / safeBoxH;
  const calculatedScale = Math.min(scaleX, scaleY);

  const finalScale = Math.max(minScale, Math.min(maxScale, calculatedScale));

  const posX = safeW / 2 - bbox.centerX * finalScale;
  const posY = safeH / 2 - bbox.centerY * finalScale;

  return {
    scale: Number(finalScale.toFixed(4)),
    position: {
      x: Math.round(posX),
      y: Math.round(posY)
    }
  };
}

/**
 * Calculates transform for 100% Zoom (1:1 scale), keeping the current
 * viewport center focused on the same world coordinates.
 */
export function calculateZoom100Transform({
  currentScale,
  currentPosition,
  viewportWidth,
  viewportHeight,
  focusPoint
}: {
  currentScale: number;
  currentPosition: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
  focusPoint?: { x: number; y: number };
}): { scale: number; position: { x: number; y: number } } {
  const targetScale = 1.0;
  const centerX = viewportWidth / 2;
  const centerY = viewportHeight / 2;
  const safeScale = currentScale > 0 ? currentScale : 1;

  const worldX = focusPoint ? focusPoint.x : (centerX - currentPosition.x) / safeScale;
  const worldY = focusPoint ? focusPoint.y : (centerY - currentPosition.y) / safeScale;

  return {
    scale: targetScale,
    position: {
      x: Math.round(centerX - worldX * targetScale),
      y: Math.round(centerY - worldY * targetScale)
    }
  };
}
