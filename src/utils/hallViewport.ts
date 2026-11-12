import { VenueLayoutObject } from '../types';

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
 * Calculates the bounding box of all objects placed inside the wedding hall layout.
 * Includes chairs clearance around tables and accounts for object rotation.
 * If no objects are placed, falls back to the venue hall boundary.
 */
export function calculateHallBoundingBox(
  objects?: VenueLayoutObject[] | null,
  defaultWidth: number = 2000,
  defaultHeight: number = 1400,
  includeVenueBoundary: boolean = false
): HallBoundingBox {
  if (!objects || objects.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: defaultWidth,
      maxY: defaultHeight,
      width: defaultWidth,
      height: defaultHeight,
      centerX: defaultWidth / 2,
      centerY: defaultHeight / 2,
      hasObjects: false
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of objects) {
    const isTable = obj.object_type === 'table';
    // Visual clearance for chairs around tables (approx 24px on each side)
    const padding = isTable ? 24 : 0;
    const w = obj.width || 120;
    const h = obj.height || 120;

    const rotDeg = obj.rotation || 0;
    if (rotDeg === 0) {
      const left = obj.position_x - padding;
      const right = obj.position_x + w + padding;
      const top = obj.position_y - padding;
      const bottom = obj.position_y + h + padding;

      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    } else {
      // In Konva, Group rotates around origin (position_x, position_y).
      // Calculate world coordinates of all 4 corners including padding:
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
        const wx = obj.position_x + (pt.dx * cos - pt.dy * sin);
        const wy = obj.position_y + (pt.dx * sin + pt.dy * cos);

        if (wx < minX) minX = wx;
        if (wx > maxX) maxX = wx;
        if (wy < minY) minY = wy;
        if (wy > maxY) maxY = wy;
      }
    }
  }

  // If requested or if bounds are invalid, ensure venue boundary is encompassed
  if (includeVenueBoundary) {
    minX = Math.min(minX, 0);
    minY = Math.min(minY, 0);
    maxX = Math.max(maxX, defaultWidth);
    maxY = Math.max(maxY, defaultHeight);
  }

  // Safety fallback if invalid bounds
  if (minX === Infinity || maxX === -Infinity) {
    minX = 0;
    maxX = defaultWidth;
  }
  if (minY === Infinity || maxY === -Infinity) {
    minY = 0;
    maxY = defaultHeight;
  }

  // Ensure minimum dimensions to avoid division by zero or infinitesimally small boxes
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

export interface FitToScreenOptions {
  availableWidth: number;
  availableHeight: number;
  bbox: HallBoundingBox;
  minScale?: number;
  maxScale?: number;
  paddingPercent?: number; // 0.05 to 0.08 (5% - 8% visual padding)
}

/**
 * Calculates the exact scale and position transform to fit the bounding box
 * centered in the available canvas viewport with 5–8% visual padding.
 * Never modifies actual object positions, rotations, or dimensions.
 */
export function calculateFitToScreenTransform({
  availableWidth,
  availableHeight,
  bbox,
  minScale = 0.25,
  maxScale = 2.0,
  paddingPercent = 0.07 // 7% visual padding
}: FitToScreenOptions): { scale: number; position: { x: number; y: number } } {
  const safeW = Math.max(100, availableWidth);
  const safeH = Math.max(100, availableHeight);

  // Available space with visual padding applied on all edges
  const usableWidth = safeW * Math.max(0.7, 1 - paddingPercent * 2);
  const usableHeight = safeH * Math.max(0.7, 1 - paddingPercent * 2);

  // Calculate zoom scale to fit entire layout
  const scaleX = usableWidth / bbox.width;
  const scaleY = usableHeight / bbox.height;
  const calculatedScale = Math.min(scaleX, scaleY);

  const finalScale = Math.max(minScale, Math.min(maxScale, calculatedScale));

  // Center horizontally and vertically
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

  // Determine the world point at center of current view
  const worldX = focusPoint ? focusPoint.x : (centerX - currentPosition.x) / currentScale;
  const worldY = focusPoint ? focusPoint.y : (centerY - currentPosition.y) / currentScale;

  return {
    scale: targetScale,
    position: {
      x: Math.round(centerX - worldX * targetScale),
      y: Math.round(centerY - worldY * targetScale)
    }
  };
}
