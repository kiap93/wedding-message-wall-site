/**
 * Editor Coordinate Utilities
 * 
 * Works with a "World Space" (virtual coordinates, e.g. 1000x1414)
 * and "Screen Space" (actual stage pixels).
 */

export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 1414;

export const toWorld = (screenCoord: number, scale: number) => screenCoord / scale;
export const toScreen = (worldCoord: number, scale: number) => worldCoord * scale;

export const getFitScale = (containerWidth: number, containerHeight: number, padding = 40) => {
  const availableW = containerWidth - padding * 2;
  const availableH = containerHeight - padding * 2;
  
  const scaleW = availableW / WORLD_WIDTH;
  const scaleH = availableH / WORLD_HEIGHT;
  
  return Math.min(scaleW, scaleH);
};
