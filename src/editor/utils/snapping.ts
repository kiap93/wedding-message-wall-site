
import { EditorElement } from '../store';

export interface GuideLine {
  type: 'h' | 'v';
  pos: number;
}

const SNAP_THRESHOLD = 5;

export const getSnappingGuides = (
  dragElement: EditorElement,
  otherElements: EditorElement[],
  canvasWidth: number,
  canvasHeight: number
) => {
  const result: { guides: GuideLine[], snappedX: number | null, snappedY: number | null } = {
    guides: [],
    snappedX: null,
    snappedY: null
  };

  const dragBound = {
    left: dragElement.x,
    centerX: dragElement.x + dragElement.width / 2,
    right: dragElement.x + dragElement.width,
    top: dragElement.y,
    centerY: dragElement.y + dragElement.height / 2,
    bottom: dragElement.y + dragElement.height,
  };

  const others = [
    ...otherElements.filter(el => el.id !== dragElement.id),
    // Add canvas bounds as snapping targets
    { x: 0, y: 0, width: canvasWidth, height: canvasHeight, id: 'canvas' }
  ];

  others.forEach(el => {
    const elBound = {
      left: el.x,
      centerX: el.x + el.width / 2,
      right: el.x + el.width,
      top: el.y,
      centerY: el.y + el.height / 2,
      bottom: el.y + el.height,
    };

    // Vertical guides (snapping X)
    const vSnaps = [
      { drag: dragBound.left, target: elBound.left, offset: 0 },
      { drag: dragBound.right, target: elBound.right, offset: -dragElement.width },
      { drag: dragBound.centerX, target: elBound.centerX, offset: -dragElement.width / 2 },
      { drag: dragBound.left, target: elBound.right, offset: 0 },
      { drag: dragBound.right, target: elBound.left, offset: -dragElement.width },
    ];

    vSnaps.forEach(s => {
      if (Math.abs(s.drag - s.target) < SNAP_THRESHOLD) {
        result.guides.push({ type: 'v', pos: s.target });
        result.snappedX = s.target + s.offset;
      }
    });

    // Horizontal guides (snapping Y)
    const hSnaps = [
      { drag: dragBound.top, target: elBound.top, offset: 0 },
      { drag: dragBound.bottom, target: elBound.bottom, offset: -dragElement.height },
      { drag: dragBound.centerY, target: elBound.centerY, offset: -dragElement.height / 2 },
      { drag: dragBound.top, target: elBound.bottom, offset: 0 },
      { drag: dragBound.bottom, target: elBound.top, offset: -dragElement.height },
    ];

    hSnaps.forEach(s => {
      if (Math.abs(s.drag - s.target) < SNAP_THRESHOLD) {
        result.guides.push({ type: 'h', pos: s.target });
        result.snappedY = s.target + s.offset;
      }
    });
  });

  return result;
};
