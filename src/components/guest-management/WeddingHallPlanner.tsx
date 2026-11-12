import React, { useState, useEffect, useRef } from 'react';
import { 
  Stage, 
  Layer, 
  Rect, 
  Circle, 
  Group, 
  Text as KonvaText, 
  Line, 
  Transformer 
} from 'react-konva';
import { 
  Plus, 
  Save, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2,
  Scan,
  PanelRightClose,
  PanelRightOpen,
  Grid, 
  Magnet,
  RotateCw, 
  Trash2, 
  Copy, 
  Scissors,
  Clipboard,
  Keyboard,
  Undo2, 
  Redo2, 
  Check, 
  Loader2, 
  Sparkles,
  Layers,
  CircleDot,
  RectangleHorizontal,
  Square,
  Compass,
  Download,
  Printer,
  Ruler,
  AlertTriangle,
  Sliders,
  Building2
} from 'lucide-react';
import { 
  VenueLayout, 
  VenueLayoutObject, 
  VenueObjectType, 
  SeatingTable, 
  Guest 
} from '../../types';
import { 
  calculateHallBoundingBox, 
  calculateFitToScreenTransform, 
  calculateZoom100Transform 
} from '../../utils/hallViewport';
import {
  VenueUnit,
  VenueOrientation,
  getPixelsPerUnit,
  worldToScreen,
  screenToWorld,
  roundToDecimals,
  formatVenueArea,
  isLegacyLayout,
  migrateVenueLayout,
  getOutOfBoundsObjects,
  repositionObjectsInsideVenue
} from '../../utils/venueCoordinates';
import { VenueSettingsModal } from './VenueSettingsModal';
import { 
  fetchVenueLayout, 
  saveVenueLayout, 
  fetchEventTables, 
  fetchEventGuests 
} from '../../lib/guestSeatingApi';
import Button from '../../design-system/components/Button';
import Badge from '../../design-system/components/Badge';

interface WeddingHallPlannerProps {
  projectId: string;
}

export default function WeddingHallPlanner({ projectId }: WeddingHallPlannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  const [layout, setLayout] = useState<VenueLayout | null>(null);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  
  // Multi-Selection State & Backwards Compatibility
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const selectedObjectId = selectedObjectIds.length > 0 ? selectedObjectIds[0] : null;
  const setSelectedObjectId = (id: string | null) => {
    setSelectedObjectIds(id ? [id] : []);
  };

  // Clipboard & Shortcuts UI State
  const [clipboard, setClipboard] = useState<VenueLayoutObject[]>([]);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Interaction State Machine
  type InteractionState = 'IDLE' | 'OBJECT_SELECTED' | 'OBJECT_DRAGGING' | 'CANVAS_PANNING';
  const [interactionState, setInteractionState] = useState<InteractionState>('IDLE');

  // Canvas Viewport State (Zoom & Pan)
  const [scale, setScale] = useState(0.85);
  const [position, setPosition] = useState({ x: 50, y: 30 });
  const [containerWidth, setContainerWidth] = useState(900);
  const [containerHeight, setContainerHeight] = useState(700);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [isVenueSettingsOpen, setIsVenueSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic Venue World Dimensions & Coordinate System (Layer A & B)
  const currentUnit: VenueUnit = (layout?.venue_unit as VenueUnit) || 'm';
  const pxPerUnit = getPixelsPerUnit(currentUnit);
  const venueWidthM = layout?.venue_width || (currentUnit === 'm' ? 30 : 100);
  const venueHeightM = layout?.venue_height || (currentUnit === 'm' ? 20 : 65);
  const venueWidthPx = Math.round(venueWidthM * pxPerUnit);
  const venueHeightPx = Math.round(venueHeightM * pxPerUnit);
  const gridUnitStep = layout?.grid_unit_step || (currentUnit === 'm' ? 0.5 : 2.0);
  const gridStepPx = Math.round(gridUnitStep * pxPerUnit);

  // Out of Bounds Detection
  const outOfBounds = layout?.objects 
    ? getOutOfBoundsObjects(layout.objects, venueWidthM, venueHeightM) 
    : { outOfBoundsIds: [], outOfBoundsObjects: [] };

  // Maximize Workspace & Collapsible Panels
  const [isMaximized, setIsMaximized] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const mainWrapperRef = useRef<HTMLDivElement>(null);

  // References to keep event handlers current without reattaching listeners
  const scaleRef = useRef(scale);
  const posRef = useRef(position);
  const panStartRef = useRef<{ startX: number; startY: number; origPosX: number; origPosY: number; button: number } | null>(null);
  const isPanningRef = useRef(false);

  // State refs for keyboard event listener safety
  const layoutRef = useRef(layout);
  const selectedObjectIdsRef = useRef(selectedObjectIds);
  const clipboardRef = useRef(clipboard);
  const dragGroupStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const arrowBatchTimerRef = useRef<any>(null);
  const arrowBatchInitialLayoutRef = useRef<VenueLayoutObject[] | null>(null);

  useEffect(() => { layoutRef.current = layout; }, [layout]);
  useEffect(() => { selectedObjectIdsRef.current = selectedObjectIds; }, [selectedObjectIds]);
  useEffect(() => { clipboardRef.current = clipboard; }, [clipboard]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { posRef.current = position; }, [position]);

  // Track responsive container width & height with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0) setContainerWidth(w);
        if (h > 0) setContainerHeight(h);
      }
    };
    updateSize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updateSize();
      });
      ro.observe(container);
    }

    window.addEventListener('resize', updateSize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [isMaximized, isInspectorCollapsed]);

  // Mouse Wheel Zoom: cursor-centered, smooth, prevents page scroll when inside editor
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent browser page scrolling while pointer is inside the editor
      e.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const rect = container.getBoundingClientRect();
      const pointer = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      const oldScale = scaleRef.current;
      const oldPos = posRef.current;

      // Calculate world coordinates underneath the cursor before zoom
      const mousePointTo = {
        x: (pointer.x - oldPos.x) / oldScale,
        y: (pointer.y - oldPos.y) / oldScale
      };

      // Zoom factor: smooth incremental zoom
      const scaleBy = 1.08;
      const isZoomIn = e.deltaY < 0; // scroll up = zoom in
      const minScale = 0.25;
      const maxScale = 3.0;

      let newScale = isZoomIn ? oldScale * scaleBy : oldScale / scaleBy;
      newScale = Math.max(minScale, Math.min(maxScale, newScale));

      // Calculate new position so the world position under cursor remains visually stationary
      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale
      };

      setScale(newScale);
      setPosition(newPos);
    };

    // Non-passive listener so e.preventDefault() reliably halts page scrolling
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Right-click (button 2) and Middle-click (button 1) canvas panning
  const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2 || e.button === 1) {
      e.preventDefault();
      e.stopPropagation();

      isPanningRef.current = true;
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origPosX: posRef.current.x,
        origPosY: posRef.current.y,
        button: e.button
      };
      setInteractionState('CANVAS_PANNING');

      const onPointerMove = (evt: PointerEvent) => {
        if (!panStartRef.current || !isPanningRef.current) return;
        const dx = evt.clientX - panStartRef.current.startX;
        const dy = evt.clientY - panStartRef.current.startY;
        setPosition({
          x: panStartRef.current.origPosX + dx,
          y: panStartRef.current.origPosY + dy
        });
      };

      const onPointerUp = (evt: PointerEvent) => {
        if (evt.button === panStartRef.current?.button) {
          isPanningRef.current = false;
          panStartRef.current = null;
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);
          setInteractionState(selectedObjectId ? 'OBJECT_SELECTED' : 'IDLE');
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    }
  };

  // Undo / Redo History (up to 100 states)
  const [history, setHistory] = useState<VenueLayoutObject[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  useEffect(() => {
    loadLayoutData();
  }, [projectId]);

  async function loadLayoutData() {
    setIsLoading(true);
    try {
      const [lData, tData, gData] = await Promise.all([
        fetchVenueLayout(projectId),
        fetchEventTables(projectId),
        fetchEventGuests(projectId)
      ]);
      let resolvedLayout = lData;
      if (lData && isLegacyLayout(lData)) {
        resolvedLayout = migrateVenueLayout(lData);
        // Persist migrated layout once so repeated migration never occurs
        saveVenueLayout(projectId, resolvedLayout).catch(err => {
          console.warn('Auto-save migrated layout error:', err);
        });
      }

      setLayout(resolvedLayout);
      setTables(tData);
      setGuests(gData);
      setShowRulers(resolvedLayout?.show_rulers ?? true);
      setShowGrid(resolvedLayout?.show_grid ?? true);
      setSnapToGrid(resolvedLayout?.snap_to_grid ?? true);

      // Initialize history
      if (resolvedLayout && resolvedLayout.objects) {
        const initHist = [JSON.parse(JSON.stringify(resolvedLayout.objects))];
        setHistory(initHist);
        setHistoryIndex(0);
        historyRef.current = initHist;
        historyIndexRef.current = 0;

        // Automatically fit layout to screen on initial load
        setTimeout(() => {
          handleFitToScreen(resolvedLayout.objects);
        }, 60);
      }
    } catch (err) {
      console.error('Error loading wedding hall layout:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Helper to commit state changes to history (up to 100 entries)
  const commitObjectsChange = (newObjects: VenueLayoutObject[]) => {
    const currentHist = historyRef.current;
    const currentIndex = historyIndexRef.current;
    const newHistory = currentHist.slice(0, currentIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newObjects)));
    if (newHistory.length > 100) newHistory.shift();

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;

    if (layoutRef.current) {
      setLayout({ ...layoutRef.current, objects: newObjects });
    }
  };

  const undo = () => {
    if (historyIndexRef.current > 0 && layoutRef.current) {
      const newIndex = historyIndexRef.current - 1;
      setHistoryIndex(newIndex);
      historyIndexRef.current = newIndex;
      const restored = JSON.parse(JSON.stringify(historyRef.current[newIndex]));
      setLayout({ ...layoutRef.current, objects: restored });
      // Keep only selected IDs that still exist in the restored state
      setSelectedObjectIds(prev => prev.filter(id => restored.some((o: VenueLayoutObject) => o.id === id)));
    }
  };

  const redo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1 && layoutRef.current) {
      const newIndex = historyIndexRef.current + 1;
      setHistoryIndex(newIndex);
      historyIndexRef.current = newIndex;
      const restored = JSON.parse(JSON.stringify(historyRef.current[newIndex]));
      setLayout({ ...layoutRef.current, objects: restored });
      setSelectedObjectIds(prev => prev.filter(id => restored.some((o: VenueLayoutObject) => o.id === id)));
    }
  };

  // Attach Transformer when object(s) are selected
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    if (selectedObjectIds.length > 0) {
      const nodes: any[] = [];
      selectedObjectIds.forEach(id => {
        const node = stageRef.current?.findOne(`#${id}`);
        if (node) nodes.push(node);
      });

      if (nodes.length > 0) {
        trRef.current.nodes(nodes);
        // CRITICAL: Disable listening on Transformer internal '.back' shapes so clicks reach Group for drag
        const backs = trRef.current.find('.back');
        backs.forEach((b: any) => b.listening(false));
        trRef.current.getLayer()?.batchDraw();
        return;
      }
    }
    trRef.current.nodes([]);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedObjectIds, layout]);

  // Clipboard & Object Action Handlers
  const handleCopy = () => {
    const currentLayout = layoutRef.current;
    const selIds = selectedObjectIdsRef.current;
    if (!currentLayout || selIds.length === 0) return;

    const itemsToCopy = currentLayout.objects.filter(o => selIds.includes(o.id));
    if (itemsToCopy.length === 0) return;

    const cloned = JSON.parse(JSON.stringify(itemsToCopy));
    setClipboard(cloned);
    clipboardRef.current = cloned;
  };

  const handleCut = () => {
    const currentLayout = layoutRef.current;
    const selIds = selectedObjectIdsRef.current;
    if (!currentLayout || selIds.length === 0) return;

    const itemsToCopy = currentLayout.objects.filter(o => selIds.includes(o.id));
    if (itemsToCopy.length === 0) return;

    const cloned = JSON.parse(JSON.stringify(itemsToCopy));
    setClipboard(cloned);
    clipboardRef.current = cloned;

    const remaining = currentLayout.objects.filter(o => !selIds.includes(o.id));
    commitObjectsChange(remaining);
    setSelectedObjectIds([]);
  };

  const handlePaste = () => {
    const currentLayout = layoutRef.current;
    const items = clipboardRef.current;
    if (!currentLayout || items.length === 0) return;

    const offset = 30;
    const newSelectedIds: string[] = [];
    const pastedObjects: VenueLayoutObject[] = items.map((orig, index) => {
      const newId = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${index}`;
      newSelectedIds.push(newId);

      const clonedProps = orig.properties ? JSON.parse(JSON.stringify(orig.properties)) : {};

      // Wedding data rule: pasted tables must NEVER inherit assigned guests!
      return {
        ...orig,
        id: newId,
        object_reference_id: null,
        label: orig.label ? `${orig.label} (Copy)` : 'Copy',
        position_x: orig.position_x + offset,
        position_y: orig.position_y + offset,
        properties: clonedProps,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    const newObjects = [...currentLayout.objects, ...pastedObjects];
    commitObjectsChange(newObjects);
    setSelectedObjectIds(newSelectedIds);
    // Update clipboard so subsequent pastes cascade
    setClipboard(pastedObjects);
    clipboardRef.current = pastedObjects;
  };

  const handleDuplicateSelected = () => {
    const currentLayout = layoutRef.current;
    const selIds = selectedObjectIdsRef.current;
    if (!currentLayout || selIds.length === 0) return;

    const offset = 30;
    const newSelectedIds: string[] = [];
    const duplicated: VenueLayoutObject[] = [];

    currentLayout.objects.forEach(orig => {
      if (selIds.includes(orig.id)) {
        const newId = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        newSelectedIds.push(newId);
        const clonedProps = orig.properties ? JSON.parse(JSON.stringify(orig.properties)) : {};
        duplicated.push({
          ...orig,
          id: newId,
          object_reference_id: null, // Never copy guest assignments
          label: orig.label ? `${orig.label} (Copy)` : 'Copy',
          position_x: orig.position_x + offset,
          position_y: orig.position_y + offset,
          properties: clonedProps,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    });

    if (duplicated.length === 0) return;
    const newObjects = [...currentLayout.objects, ...duplicated];
    commitObjectsChange(newObjects);
    setSelectedObjectIds(newSelectedIds);
  };

  const handleDeleteSelected = () => {
    const currentLayout = layoutRef.current;
    const selIds = selectedObjectIdsRef.current;
    if (!currentLayout || selIds.length === 0) return;

    const newObjects = currentLayout.objects.filter(o => !selIds.includes(o.id));
    commitObjectsChange(newObjects);
    setSelectedObjectIds([]);
  };

  const handleSelectAll = () => {
    const currentLayout = layoutRef.current;
    if (!currentLayout || currentLayout.objects.length === 0) return;
    setSelectedObjectIds(currentLayout.objects.map(o => o.id));
    setInteractionState('OBJECT_SELECTED');
  };

  // Debounced Arrow Key movement (groups continuous nudges into 1 history state)
  const handleArrowMove = (dx: number, dy: number) => {
    const currentLayout = layoutRef.current;
    const selIds = selectedObjectIdsRef.current;
    if (!currentLayout || selIds.length === 0) return;

    // Snapshot state at start of batch if not already active
    if (!arrowBatchInitialLayoutRef.current) {
      arrowBatchInitialLayoutRef.current = JSON.parse(JSON.stringify(currentLayout.objects));
    }

    const isWorld = currentLayout.coordinate_system === 'world' || (currentLayout.venue_width !== undefined);

    // Immediately update coordinates for 60fps responsive feel
    const updatedObjects = currentLayout.objects.map(obj => {
      if (selIds.includes(obj.id)) {
        return {
          ...obj,
          position_x: isWorld ? roundToDecimals(obj.position_x + dx, 2) : Math.round(obj.position_x + dx),
          position_y: isWorld ? roundToDecimals(obj.position_y + dy, 2) : Math.round(obj.position_y + dy)
        };
      }
      return obj;
    });

    setLayout({ ...currentLayout, objects: updatedObjects });
    layoutRef.current = { ...currentLayout, objects: updatedObjects };

    if (arrowBatchTimerRef.current) {
      clearTimeout(arrowBatchTimerRef.current);
    }

    arrowBatchTimerRef.current = setTimeout(() => {
      arrowBatchInitialLayoutRef.current = null;
      arrowBatchTimerRef.current = null;

      const finalObjects = layoutRef.current?.objects || updatedObjects;
      const currentHist = historyRef.current;
      const currentIndex = historyIndexRef.current;
      const newHistory = currentHist.slice(0, currentIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(finalObjects)));
      if (newHistory.length > 100) newHistory.shift();

      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
    }, 350);
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const isInputActive = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return false;
      const tagName = target.tagName?.toLowerCase();
      return (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target.isContentEditable ||
        target.getAttribute?.('contenteditable') === 'true'
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Never interfere with typing inside input fields, textareas, etc.
      if (isInputActive(e)) return;

      const isMod = e.ctrlKey || e.metaKey; // Windows/Linux Ctrl or macOS Cmd
      const key = e.key.toLowerCase();

      // Ctrl + S: Save layout
      if (isMod && key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      // Ctrl + A: Select All
      if (isMod && key === 'a') {
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // Ctrl + C: Copy
      if (isMod && key === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Ctrl + X: Cut
      if (isMod && key === 'x') {
        e.preventDefault();
        handleCut();
        return;
      }

      // Ctrl + V: Paste
      if (isMod && key === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }

      // Ctrl + D: Duplicate
      if (isMod && key === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      // Ctrl + Z: Undo / Ctrl + Shift + Z: Redo
      if (isMod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      // Ctrl + Y: Redo
      if (isMod && key === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Delete or Backspace: Delete selected
      if (key === 'delete' || key === 'backspace') {
        if (selectedObjectIdsRef.current.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
          return;
        }
      }

      // Shift + F: Fit to Screen
      if (e.shiftKey && (key === 'f')) {
        e.preventDefault();
        handleFitToScreen();
        return;
      }

      // Shift + M: Toggle Maximize Workspace
      if (e.shiftKey && (key === 'm')) {
        e.preventDefault();
        toggleMaximize();
        return;
      }

      // Ctrl / Cmd + 0 or 1: 100% Zoom
      if (isMod && (key === '0' || key === '1')) {
        e.preventDefault();
        handleZoom100();
        return;
      }

      // Escape: Deselect objects, or exit maximize if nothing selected
      if (key === 'escape') {
        e.preventDefault();
        if (selectedObjectIdsRef.current.length > 0) {
          setSelectedObjectIds([]);
          setInteractionState('IDLE');
        } else if (isMaximized) {
          toggleMaximize();
        }
        return;
      }

      // Arrow Keys: Nudge position (1px, or 10px with Shift)
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        if (selectedObjectIdsRef.current.length > 0) {
          e.preventDefault();
          const isWorld = layoutRef.current?.coordinate_system === 'world' || (layoutRef.current?.venue_width !== undefined);
          const step = isWorld ? (e.shiftKey ? 1.0 : 0.1) : (e.shiftKey ? 10 : 1);
          let dx = 0;
          let dy = 0;
          if (key === 'arrowup') dy = -step;
          if (key === 'arrowdown') dy = step;
          if (key === 'arrowleft') dx = -step;
          if (key === 'arrowright') dx = step;
          handleArrowMove(dx, dy);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMaximized]);

  // Synchronize with native browser fullscreen changes (e.g. user pressed Esc in browser)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isMaximized) {
        setIsMaximized(false);
        setTimeout(() => handleFitToScreen(), 80);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isMaximized]);

  // Fit to Screen: centers and scales entire venue boundary and all objects inside viewport with 7% visual padding
  const handleFitToScreen = (
    customObjects?: VenueLayoutObject[],
    customW?: number,
    customH?: number
  ) => {
    const curLayout = layoutRef.current;
    const objectsToFit = customObjects || curLayout?.objects || [];
    const u: VenueUnit = (curLayout?.venue_unit as VenueUnit) || 'm';
    const px = getPixelsPerUnit(u);
    const hallWidth = customW || (curLayout?.venue_width ? Math.round(curLayout.venue_width * px) : curLayout?.canvas_width) || 1800;
    const hallHeight = customH || (curLayout?.venue_height ? Math.round(curLayout.venue_height * px) : curLayout?.canvas_height) || 1200;

    const container = containerRef.current;
    const availWidth = container?.clientWidth || containerWidth || 900;
    const availHeight = container?.clientHeight || containerHeight || 700;

    // Convert world objects to screen coordinates for bounding box calculation
    const screenObjects: VenueLayoutObject[] = objectsToFit.map(o => {
      const isWorld = curLayout?.coordinate_system === 'world' || (o.width <= 25 && o.height <= 25);
      if (isWorld) {
        return {
          ...o,
          position_x: Math.round(o.position_x * px),
          position_y: Math.round(o.position_y * px),
          width: Math.round(o.width * px),
          height: Math.round(o.height * px)
        };
      }
      return o;
    });

    const bbox = calculateHallBoundingBox(screenObjects, hallWidth, hallHeight, true);
    const transform = calculateFitToScreenTransform({
      availableWidth: availWidth,
      availableHeight: availHeight,
      bbox,
      minScale: 0.25,
      maxScale: 2.0,
      paddingPercent: 0.07 // 7% visual padding
    });

    setScale(transform.scale);
    setPosition(transform.position);
    scaleRef.current = transform.scale;
    posRef.current = transform.position;
  };

  // 100% Zoom (1:1 scale)
  const handleZoom100 = () => {
    const container = containerRef.current;
    const availWidth = container?.clientWidth || containerWidth || 900;
    const availHeight = container?.clientHeight || containerHeight || 700;

    const transform = calculateZoom100Transform({
      currentScale: scaleRef.current,
      currentPosition: posRef.current,
      viewportWidth: availWidth,
      viewportHeight: availHeight
    });

    setScale(transform.scale);
    setPosition(transform.position);
    scaleRef.current = transform.scale;
    posRef.current = transform.position;
  };

  // Maximize / Restore Workspace
  const toggleMaximize = () => {
    const nextMaximized = !isMaximized;
    setIsMaximized(nextMaximized);

    // Optional native fullscreen with graceful fallback
    if (nextMaximized) {
      if (mainWrapperRef.current && document.fullscreenEnabled && !document.fullscreenElement) {
        mainWrapperRef.current.requestFullscreen?.().catch(() => {});
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }

    // Auto-fit to newly expanded screen dimensions after layout transition
    setTimeout(() => {
      handleFitToScreen();
    }, 80);
  };

  // Handle Zoom In / Out / Reset
  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (direction === 'reset') {
      handleFitToScreen();
    } else {
      const container = containerRef.current;
      const factor = direction === 'in' ? 1.15 : 0.85;
      const minScale = 0.25;
      const maxScale = 3.0;
      const newScale = Math.max(minScale, Math.min(maxScale, scale * factor));

      if (container) {
        // Zoom centered on the viewport center point
        const centerX = container.clientWidth / 2;
        const centerY = container.clientHeight / 2;
        const mousePointTo = {
          x: (centerX - position.x) / scale,
          y: (centerY - position.y) / scale
        };
        setPosition({
          x: centerX - mousePointTo.x * newScale,
          y: centerY - mousePointTo.y * newScale
        });
      }
      setScale(newScale);
    }
  };

  // Apply Venue Dimensions from VenueSettingsModal
  const handleApplyVenueSettings = async (settings: {
    venue_width: number;
    venue_height: number;
    venue_unit: VenueUnit;
    venue_orientation: VenueOrientation;
    venue_name?: string;
    venue_description?: string;
    grid_unit_step: number;
    repositionOutOfBounds?: boolean;
  }) => {
    if (!layout) return;
    let updatedObjects = layout.objects;
    if (settings.repositionOutOfBounds) {
      updatedObjects = repositionObjectsInsideVenue(
        layout.objects,
        settings.venue_width,
        settings.venue_height
      );
    }

    const px = getPixelsPerUnit(settings.venue_unit);
    const newCanvasW = Math.round(settings.venue_width * px);
    const newCanvasH = Math.round(settings.venue_height * px);

    const updatedLayout: VenueLayout = {
      ...layout,
      venue_width: settings.venue_width,
      venue_height: settings.venue_height,
      venue_unit: settings.venue_unit,
      venue_orientation: settings.venue_orientation,
      venue_name: settings.venue_name,
      venue_description: settings.venue_description,
      grid_unit_step: settings.grid_unit_step,
      canvas_width: newCanvasW,
      canvas_height: newCanvasH,
      grid_size: Math.round(settings.grid_unit_step * px),
      coordinate_system: 'world',
      is_migrated: true,
      objects: updatedObjects
    };

    setLayout(updatedLayout);
    commitObjectsChange(updatedObjects);

    setTimeout(() => {
      handleFitToScreen(updatedObjects, newCanvasW, newCanvasH);
    }, 60);

    try {
      await saveVenueLayout(projectId, updatedLayout);
    } catch (err: any) {
      console.warn('Auto-save venue settings error:', err.message);
    }
  };

  // Reposition Out of Bounds Objects Inside Venue
  const handleRepositionOutOfBounds = () => {
    if (!layout) return;
    const repositioned = repositionObjectsInsideVenue(layout.objects, venueWidthM, venueHeightM);
    commitObjectsChange(repositioned);
  };

  // Save Layout to Backend
  const handleSave = async () => {
    if (!layout) return;
    setIsSaving(true);
    try {
      await saveVenueLayout(projectId, {
        venue_width: layout.venue_width || venueWidthM,
        venue_height: layout.venue_height || venueHeightM,
        venue_unit: layout.venue_unit || currentUnit,
        venue_orientation: layout.venue_orientation || (venueWidthM >= venueHeightM ? 'landscape' : 'portrait'),
        venue_name: layout.venue_name,
        venue_description: layout.venue_description,
        grid_unit_step: gridUnitStep,
        show_grid: showGrid,
        show_rulers: showRulers,
        coordinate_system: 'world',
        is_migrated: true,
        canvas_width: venueWidthPx,
        canvas_height: venueHeightPx,
        grid_size: gridStepPx,
        snap_to_grid: snapToGrid,
        objects: layout.objects
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      alert('Error saving hall layout: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Add Venue Element
  const handleAddObject = (type: VenueObjectType, refTableId?: string) => {
    if (!layout) return;

    const newId = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const gridSize = layout.grid_size || 40;

    const isWorld = layout.coordinate_system === 'world' || (layout.venue_width !== undefined);
    const u: VenueUnit = (layout.venue_unit as VenueUnit) || 'm';

    let width = isWorld ? (u === 'm' ? 1.8 : 6.0) : 140;
    let height = isWorld ? (u === 'm' ? 1.8 : 6.0) : 140;
    let label = 'New Element';
    let properties: any = {};

    if (type === 'table') {
      const targetTable = tables.find(t => t.id === refTableId);
      const isRect = targetTable?.table_type === 'rectangular';
      if (isWorld) {
        width = isRect ? (u === 'm' ? 2.4 : 8.0) : (u === 'm' ? 1.8 : 6.0);
        height = isRect ? (u === 'm' ? 1.0 : 3.3) : (u === 'm' ? 1.8 : 6.0);
      } else {
        width = isRect ? 180 : 130;
        height = isRect ? 90 : 130;
      }
      label = targetTable ? `T${targetTable.table_number}: ${targetTable.table_name}` : 'Reception Table';
      properties = {
        tableShape: targetTable?.table_type || 'round',
        capacity: targetTable?.capacity || 10,
        tableNumber: targetTable?.table_number || '1'
      };
    } else if (type === 'stage') {
      width = isWorld ? (u === 'm' ? 8.0 : 26.0) : 500;
      height = isWorld ? (u === 'm' ? 3.0 : 10.0) : 120;
      label = 'Main Stage & Altar';
      properties = { color: '#252525', textColor: '#FFFFFF' };
    } else if (type === 'dance_floor') {
      width = isWorld ? (u === 'm' ? 6.0 : 20.0) : 360;
      height = isWorld ? (u === 'm' ? 5.0 : 16.0) : 260;
      label = 'Dance Floor';
      properties = { color: '#F2EFE9', textColor: '#252525' };
    } else if (type === 'entrance') {
      width = isWorld ? (u === 'm' ? 4.0 : 13.0) : 240;
      height = isWorld ? (u === 'm' ? 1.2 : 4.0) : 60;
      label = 'Grand Entrance';
      properties = { color: '#8B806F', textColor: '#FFFFFF' };
    } else if (type === 'buffet') {
      width = isWorld ? (u === 'm' ? 5.0 : 16.0) : 300;
      height = isWorld ? (u === 'm' ? 1.5 : 5.0) : 80;
      label = 'Buffet Catering';
      properties = { color: '#4A3E3D', textColor: '#FFFFFF' };
    } else if (type === 'bar') {
      width = isWorld ? (u === 'm' ? 3.0 : 10.0) : 200;
      height = isWorld ? (u === 'm' ? 1.2 : 4.0) : 70;
      label = 'Cocktail Bar';
      properties = { color: '#3A443B', textColor: '#FFFFFF' };
    } else if (type === 'photo_booth') {
      width = isWorld ? (u === 'm' ? 2.5 : 8.0) : 150;
      height = isWorld ? (u === 'm' ? 2.5 : 8.0) : 150;
      label = 'Photo Booth';
      properties = { color: '#FAF9F7', textColor: '#252525' };
    } else if (type === 'pillar') {
      width = isWorld ? (u === 'm' ? 0.8 : 2.6) : 60;
      height = isWorld ? (u === 'm' ? 0.8 : 2.6) : 60;
      label = 'Pillar';
      properties = { color: '#CCCCCC' };
    } else if (type === 'wall') {
      width = isWorld ? (u === 'm' ? 5.0 : 16.0) : 400;
      height = isWorld ? (u === 'm' ? 0.3 : 1.0) : 20;
      label = 'Wall Partition';
      properties = { color: '#252525' };
    }

    let posX = 100;
    let posY = 100;
    if (isWorld) {
      const centerScreenX = (-position.x + (containerRef.current?.clientWidth || 800) / 2) / scale;
      const centerScreenY = (-position.y + (containerRef.current?.clientHeight || 600) / 2) / scale;
      let rawWorldX = screenToWorld(centerScreenX, u);
      let rawWorldY = screenToWorld(centerScreenY, u);
      if (snapToGrid) {
        rawWorldX = Math.round(rawWorldX / gridUnitStep) * gridUnitStep;
        rawWorldY = Math.round(rawWorldY / gridUnitStep) * gridUnitStep;
      }
      posX = Math.max(0.5, Math.min(venueWidthM - width - 0.5, roundToDecimals(rawWorldX, 2)));
      posY = Math.max(0.5, Math.min(venueHeightM - height - 0.5, roundToDecimals(rawWorldY, 2)));
    } else {
      posX = Math.round((-position.x + 300) / gridSize) * gridSize;
      posY = Math.round((-position.y + 250) / gridSize) * gridSize;
    }

    const newObj: VenueLayoutObject = {
      id: newId,
      venue_layout_id: layout.id,
      project_id: projectId,
      object_type: type,
      object_reference_id: refTableId || null,
      label,
      position_x: posX,
      position_y: posY,
      width: roundToDecimals(width, 2),
      height: roundToDecimals(height, 2),
      rotation: 0,
      properties,
      z_index: type === 'table' ? 5 : 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const newObjects = [...layout.objects, newObj];
    commitObjectsChange(newObjects);
    setSelectedObjectId(newId);
  };



  // Helper to snap coordinates
  const snapVal = (val: number, size: number) => {
    return snapToGrid ? Math.round(val / size) * size : val;
  };

  const selectedObject = layout?.objects.find(o => o.id === selectedObjectId);

  // Helper to convert world object coordinates to screen-space render dimensions
  const getObjectScreenRect = (obj: VenueLayoutObject) => {
    const isWorld = layout?.coordinate_system === 'world' || (obj.width <= 25 && obj.height <= 25);
    if (isWorld) {
      return {
        x: Math.round(obj.position_x * pxPerUnit),
        y: Math.round(obj.position_y * pxPerUnit),
        width: Math.max(20, Math.round(obj.width * pxPerUnit)),
        height: Math.max(20, Math.round(obj.height * pxPerUnit))
      };
    }
    return {
      x: obj.position_x,
      y: obj.position_y,
      width: obj.width,
      height: obj.height
    };
  };

  // Render Chairs around table visually
  const renderChairs = (obj: VenueLayoutObject, capacity: number, isRect: boolean, screenW: number, screenH: number) => {
    const chairs: React.ReactNode[] = [];
    const count = Math.min(24, Math.max(2, capacity || 8));
    const chairSize = Math.max(8, Math.round(0.38 * pxPerUnit));

    if (isRect) {
      // Chairs along top and bottom
      const perSide = Math.ceil(count / 2);
      const step = screenW / (perSide + 1);
      for (let i = 1; i <= perSide; i++) {
        chairs.push(
          <Circle
            key={`chair-top-${i}`}
            x={step * i}
            y={-chairSize / 2 - 2}
            radius={chairSize / 2}
            fill="#8B806F"
            stroke="#252525"
            strokeWidth={1}
          />
        );
        chairs.push(
          <Circle
            key={`chair-bot-${i}`}
            x={step * i}
            y={screenH + chairSize / 2 + 2}
            radius={chairSize / 2}
            fill="#8B806F"
            stroke="#252525"
            strokeWidth={1}
          />
        );
      }
    } else {
      // Radial chairs around circle
      const radius = screenW / 2;
      const chairDistance = radius + chairSize / 2 + 4;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI;
        const cx = radius + chairDistance * Math.cos(angle);
        const cy = radius + chairDistance * Math.sin(angle);
        chairs.push(
          <Circle
            key={`chair-rad-${i}`}
            x={cx}
            y={cy}
            radius={chairSize / 2}
            fill="#FAF9F7"
            stroke="#8B806F"
            strokeWidth={1.5}
          />
        );
      }
    }

    return chairs;
  };

  // Generate background grid lines scaled to venue dimensions
  const renderGridLines = () => {
    if (!showGrid || !layout) return null;
    const lines: React.ReactNode[] = [];
    const stepPx = gridStepPx || 30;
    const majorStepPx = stepPx * (currentUnit === 'm' ? (gridUnitStep === 0.5 ? 10 : 5) : 5);

    for (let x = 0; x <= venueWidthPx; x += stepPx) {
      const isMajor = x % majorStepPx === 0;
      lines.push(
        <Line
          key={`grid-x-${x}`}
          points={[x, 0, x, venueHeightPx]}
          stroke={isMajor ? "#D4D4CE" : "#EAEAE5"}
          strokeWidth={isMajor ? 1 : 0.5}
        />
      );
    }
    for (let y = 0; y <= venueHeightPx; y += stepPx) {
      const isMajor = y % majorStepPx === 0;
      lines.push(
        <Line
          key={`grid-y-${y}`}
          points={[0, y, venueWidthPx, y]}
          stroke={isMajor ? "#D4D4CE" : "#EAEAE5"}
          strokeWidth={isMajor ? 1 : 0.5}
        />
      );
    }
    return lines;
  };

  // Render Horizontal & Vertical measurement rulers with real-world units
  const renderRulers = () => {
    if (!showRulers) return null;

    const rulerThickness = 24;
    const majorInterval = currentUnit === 'm' ? 5 : 10;
    const hNodes: React.ReactNode[] = [];
    const vNodes: React.ReactNode[] = [];

    // Horizontal Ruler Ticks (along top)
    for (let val = 0; val <= venueWidthM; val += gridUnitStep) {
      const screenX = Math.round(val * pxPerUnit);
      const isMajor = Math.abs(val % majorInterval) < 0.01 || val === 0 || val >= venueWidthM;
      const isMedium = Math.abs(val % 1) < 0.01;

      hNodes.push(
        <Line
          key={`hr-tick-${val}`}
          points={[screenX, - (isMajor ? rulerThickness : (isMedium ? 12 : 6)), screenX, 0]}
          stroke={isMajor ? "#78716C" : (isMedium ? "#A8A29E" : "#D6D3D1")}
          strokeWidth={isMajor ? 1.2 : 0.8}
        />
      );

      if (isMajor && screenX < venueWidthPx - 20) {
        hNodes.push(
          <KonvaText
            key={`hr-txt-${val}`}
            x={screenX + 3}
            y={-20}
            text={`${val}${currentUnit}`}
            fontSize={9}
            fontFamily="monospace"
            fill="#44403C"
            fontStyle="bold"
          />
        );
      }
    }

    // Vertical Ruler Ticks (along left)
    for (let val = 0; val <= venueHeightM; val += gridUnitStep) {
      const screenY = Math.round(val * pxPerUnit);
      const isMajor = Math.abs(val % majorInterval) < 0.01 || val === 0 || val >= venueHeightM;
      const isMedium = Math.abs(val % 1) < 0.01;

      vNodes.push(
        <Line
          key={`vr-tick-${val}`}
          points={[- (isMajor ? rulerThickness : (isMedium ? 12 : 6)), screenY, 0, screenY]}
          stroke={isMajor ? "#78716C" : (isMedium ? "#A8A29E" : "#D6D3D1")}
          strokeWidth={isMajor ? 1.2 : 0.8}
        />
      );

      if (isMajor && screenY < venueHeightPx - 15) {
        vNodes.push(
          <KonvaText
            key={`vr-txt-${val}`}
            x={-22}
            y={screenY + 2}
            text={`${val}`}
            fontSize={9}
            fontFamily="monospace"
            fill="#44403C"
            fontStyle="bold"
          />
        );
      }
    }

    return (
      <Layer id="rulers-layer">
        {/* Horizontal Top Ruler Bar */}
        <Rect
          x={0}
          y={-rulerThickness}
          width={venueWidthPx}
          height={rulerThickness}
          fill="#FAF9F7"
          stroke="#D4D4CE"
          strokeWidth={1}
        />
        {hNodes}

        {/* Vertical Left Ruler Bar */}
        <Rect
          x={-rulerThickness}
          y={0}
          width={rulerThickness}
          height={venueHeightPx}
          fill="#FAF9F7"
          stroke="#D4D4CE"
          strokeWidth={1}
        />
        {vNodes}

        {/* Top-Left Corner Box with Unit Badge */}
        <Rect
          x={-rulerThickness}
          y={-rulerThickness}
          width={rulerThickness}
          height={rulerThickness}
          fill="#EAE8E3"
          stroke="#D4D4CE"
          strokeWidth={1}
        />
        <KonvaText
          x={-20}
          y={-17}
          text={currentUnit}
          fontSize={10}
          fontFamily="monospace"
          fill="#78716C"
          fontStyle="bold"
        />
      </Layer>
    );
  };

  return (
    <div 
      ref={mainWrapperRef}
      className={
        isMaximized 
          ? "fixed inset-0 z-50 bg-[#FAF9F7] flex flex-col p-2 md:p-3 overflow-hidden select-none" 
          : "space-y-4"
      }
    >
      {/* Top Toolbar */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-[#E8E8E5] shadow-subtle flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shrink-0">
        {/* Left Elements Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 mr-1 sm:mr-2 pr-2 border-r border-[#E8E8E5]">
            <Compass className="w-4 h-4 text-[#8B806F]" />
            <span className="text-xs font-semibold text-[#252525]">Hall Planner</span>
            {isMaximized && (
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#FAF9F7] text-[#8B806F] border border-[#E8E8E5]">
                Maximized
              </span>
            )}
          </div>

          {/* Add Table Dropdown */}
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleAddObject('table', e.target.value);
                e.target.value = '';
              }
            }}
            className="h-8 px-2 text-xs bg-[#FAF9F7] text-[#252525] border border-[#E8E8E5] rounded-md font-medium focus:outline-none"
            defaultValue=""
          >
            <option value="" disabled>+ Add Table to Canvas</option>
            {tables.map(t => (
              <option key={t.id} value={t.id}>
                Table {t.table_number}: {t.table_name} ({t.assigned_count || 0}/{t.capacity})
              </option>
            ))}
          </select>

          {/* Add Venue Element Dropdown */}
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleAddObject(e.target.value as VenueObjectType);
                e.target.value = '';
              }
            }}
            className="h-8 px-2 text-xs bg-[#FAF9F7] text-[#252525] border border-[#E8E8E5] rounded-md font-medium focus:outline-none"
            defaultValue=""
          >
            <option value="" disabled>+ Add Venue Element</option>
            <option value="stage">Main Stage & Altar</option>
            <option value="couple_table">Sweetheart Couple Table</option>
            <option value="dance_floor">Dance Floor</option>
            <option value="entrance">Grand Entrance</option>
            <option value="buffet">Buffet Catering Area</option>
            <option value="bar">Cocktail Bar</option>
            <option value="photo_booth">Photo Booth</option>
            <option value="pillar">Pillar</option>
            <option value="wall">Wall Divider</option>
          </select>

          {/* Venue Dimensions Settings Button */}
          <button
            type="button"
            onClick={() => setIsVenueSettingsOpen(true)}
            className="h-8 px-2.5 text-xs bg-[#FAF9F7] text-[#252525] hover:bg-white border border-[#E8E8E5] hover:border-[#8B806F] rounded-md font-medium transition-colors flex items-center gap-1.5"
            title="Configure Venue Dimensions, Orientation & Units"
          >
            <Ruler className="w-3.5 h-3.5 text-[#8B806F]" />
            <span className="font-semibold">{venueWidthM}{currentUnit} × {venueHeightM}{currentUnit}</span>
            <span className="hidden xl:inline text-[10px] text-[#8B806F] font-mono">
              ({formatVenueArea(venueWidthM, venueHeightM, currentUnit)})
            </span>
          </button>
        </div>

        {/* Center / Right Canvas Controls */}
        <div className="flex items-center gap-1.5 flex-wrap justify-between md:justify-end">
          {/* Clipboard Actions */}
          <div className="flex items-center gap-0.5 bg-[#FAF9F7] p-0.5 rounded-md border border-[#E8E8E5]">
            <button
              onClick={handleCut}
              disabled={selectedObjectIds.length === 0}
              className={`p-1.5 rounded transition-colors ${selectedObjectIds.length > 0 ? 'text-[#252525] hover:bg-white' : 'text-stone-300 cursor-not-allowed'}`}
              title="Cut (Ctrl/Cmd + X)"
            >
              <Scissors className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCopy}
              disabled={selectedObjectIds.length === 0}
              className={`p-1.5 rounded transition-colors ${selectedObjectIds.length > 0 ? 'text-[#252525] hover:bg-white' : 'text-stone-300 cursor-not-allowed'}`}
              title="Copy (Ctrl/Cmd + C)"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handlePaste}
              disabled={clipboard.length === 0}
              className={`p-1.5 rounded transition-colors ${clipboard.length > 0 ? 'text-[#252525] hover:bg-white' : 'text-stone-300 cursor-not-allowed'}`}
              title="Paste (Ctrl/Cmd + V)"
            >
              <Clipboard className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDuplicateSelected}
              disabled={selectedObjectIds.length === 0}
              className={`p-1.5 rounded transition-colors ${selectedObjectIds.length > 0 ? 'text-[#252525] hover:bg-white' : 'text-stone-300 cursor-not-allowed'}`}
              title="Duplicate (Ctrl/Cmd + D)"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedObjectIds.length === 0}
              className={`p-1.5 rounded transition-colors ${selectedObjectIds.length > 0 ? 'text-rose-600 hover:bg-rose-50' : 'text-stone-300 cursor-not-allowed'}`}
              title="Delete (Delete / Backspace)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 bg-[#FAF9F7] p-0.5 rounded-md border border-[#E8E8E5]">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className={`p-1.5 rounded transition-colors ${historyIndex > 0 ? 'text-[#252525] hover:bg-white' : 'text-stone-300 cursor-not-allowed'}`}
              title="Undo (Ctrl/Cmd + Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className={`p-1.5 rounded transition-colors ${historyIndex < history.length - 1 ? 'text-[#252525] hover:bg-white' : 'text-stone-300 cursor-not-allowed'}`}
              title="Redo (Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom & Viewport Controls Group */}
          <div className="flex items-center gap-1 bg-[#FAF9F7] p-0.5 rounded-md border border-[#E8E8E5]">
            {/* Fit to Screen Action */}
            <button
              onClick={() => handleFitToScreen()}
              className="px-2 py-1 text-xs font-medium text-[#252525] hover:bg-white rounded transition-colors flex items-center gap-1"
              title="Fit to Screen (Shift + F) - Centers and fits all wedding elements"
            >
              <Scan className="w-3.5 h-3.5 text-[#8B806F]" />
              <span className="hidden sm:inline">Fit</span>
            </button>

            {/* Zoom Out */}
            <button
              onClick={() => handleZoom('out')}
              className="p-1.5 text-[#777777] hover:text-[#252525] hover:bg-white rounded transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            {/* Zoom Percentage / Quick 100% Toggle */}
            <button
              onClick={handleZoom100}
              className="px-1.5 py-0.5 text-[11px] font-mono font-medium text-[#252525] hover:bg-white rounded transition-colors"
              title="Click for 100% Zoom"
            >
              {Math.round(scale * 100)}%
            </button>

            {/* Zoom In */}
            <button
              onClick={() => handleZoom('in')}
              className="p-1.5 text-[#777777] hover:text-[#252525] hover:bg-white rounded transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            {/* 100% (1:1) Zoom Button */}
            <button
              onClick={handleZoom100}
              className={`px-1.5 py-0.5 text-[11px] font-medium rounded transition-colors ${
                Math.round(scale * 100) === 100 
                  ? 'bg-white text-[#252525] shadow-2xs font-semibold' 
                  : 'text-[#777777] hover:text-[#252525] hover:bg-white'
              }`}
              title="100% Scale (1:1)"
            >
              1:1
            </button>
          </div>

          {/* Grid, Snap & Rulers Toggles */}
          <button
            onClick={() => setShowGrid(prev => !prev)}
            className={`px-2 h-8 rounded-md text-xs font-medium border transition-colors flex items-center gap-1 ${
              showGrid ? 'bg-white text-[#252525] border-[#D4D4CE]' : 'bg-[#FAF9F7] text-stone-400 border-[#E8E8E5]'
            }`}
            title="Toggle Grid display"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid</span>
          </button>

          <button
            onClick={() => setSnapToGrid(prev => !prev)}
            className={`px-2 h-8 rounded-md text-xs font-medium border transition-colors flex items-center gap-1 ${
              snapToGrid ? 'bg-white text-[#252525] border-[#D4D4CE]' : 'bg-[#FAF9F7] text-stone-400 border-[#E8E8E5]'
            }`}
            title="Toggle snapping to grid"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Snap</span>
          </button>

          <button
            onClick={() => setShowRulers(prev => !prev)}
            className={`px-2 h-8 rounded-md text-xs font-medium border transition-colors flex items-center gap-1 ${
              showRulers ? 'bg-white text-[#252525] border-[#D4D4CE]' : 'bg-[#FAF9F7] text-stone-400 border-[#E8E8E5]'
            }`}
            title="Toggle measurement rulers"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rulers</span>
          </button>

          {/* Maximize / Restore Workspace Button */}
          <button
            onClick={toggleMaximize}
            className={`px-2.5 h-8 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              isMaximized 
                ? 'bg-[#252525] text-white border-[#252525] shadow-xs' 
                : 'bg-[#FAF9F7] text-[#252525] hover:bg-white border-[#E8E8E5]'
            }`}
            title={isMaximized ? "Exit Maximize (Shift+M or Esc)" : "Maximize Canvas Workspace (Shift+M)"}
          >
            {isMaximized ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-amber-300" />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#8B806F]" />
                <span className="hidden sm:inline">Maximize</span>
              </>
            )}
          </button>

          {/* Toggle Collapsible Inspector Panel Button */}
          <button
            onClick={() => setIsInspectorCollapsed(prev => !prev)}
            className={`px-2.5 h-8 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              !isInspectorCollapsed
                ? 'bg-white text-[#252525] border-[#D4D4CE]'
                : 'bg-[#FAF9F7] text-[#777777] hover:text-[#252525] border-[#E8E8E5]'
            }`}
            title={isInspectorCollapsed ? "Show Inspector Panel" : "Hide Inspector Panel"}
          >
            {isInspectorCollapsed ? (
              <>
                <PanelRightOpen className="w-3.5 h-3.5 text-[#8B806F]" />
                <span className="hidden md:inline">Panel</span>
              </>
            ) : (
              <>
                <PanelRightClose className="w-3.5 h-3.5 text-[#8B806F]" />
                <span className="hidden md:inline">Hide</span>
              </>
            )}
          </button>

          {/* Keyboard Shortcuts Dialog Trigger */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="px-2 h-8 rounded-md text-xs font-medium bg-[#FAF9F7] text-[#777777] hover:text-[#252525] hover:bg-white border border-[#E8E8E5] transition-colors flex items-center gap-1"
            title="View Keyboard Shortcuts"
          >
            <Keyboard className="w-3.5 h-3.5 text-[#8B806F]" />
            <span className="hidden sm:inline">Shortcuts</span>
          </button>

          {/* Save Layout Action */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            leftIcon={saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
            className="!h-8 !text-xs !bg-[#252525]"
            title="Save Layout (Ctrl/Cmd + S)"
          >
            {saveSuccess ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Out of Bounds Warning Alert Banner */}
      {outOfBounds.outOfBoundsIds.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-xs flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{outOfBounds.outOfBoundsIds.length} object{outOfBounds.outOfBoundsIds.length > 1 ? 's' : ''}</strong> currently placed outside the {venueWidthM}{currentUnit} × {venueHeightM}{currentUnit} venue boundary.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setSelectedObjectIds(outOfBounds.outOfBoundsIds)}
              className="px-2.5 py-1 bg-white border border-amber-300 rounded text-[11px] font-medium text-amber-900 hover:bg-amber-100/50 transition-colors"
            >
              Select Affected
            </button>
            <button 
              type="button"
              onClick={handleRepositionOutOfBounds}
              className="px-2.5 py-1 bg-[#252525] text-white rounded text-[11px] font-medium hover:bg-[#3E3E3E] transition-colors"
            >
              Auto-Fit Inside Venue
            </button>
          </div>
        </div>
      )}

      {/* Main Interactive Canvas Workspace with Contextual Inspector */}
      <div className={
        isMaximized
          ? "flex-1 min-h-0 flex flex-col lg:flex-row gap-2.5 items-stretch relative overflow-hidden"
          : `grid grid-cols-1 ${isInspectorCollapsed ? 'lg:grid-cols-1' : 'lg:grid-cols-12'} gap-4 items-start`
      }>
        {/* Interactive Konva Canvas */}
        <div 
          ref={containerRef}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={handleContainerPointerDown}
          className={`bg-[#FAF9F7] rounded-xl border border-[#E8E8E5] shadow-subtle overflow-hidden relative select-none ${
            isMaximized 
              ? "flex-1 min-w-0 h-full" 
              : isInspectorCollapsed 
              ? "w-full h-[620px] lg:h-[720px]" 
              : "lg:col-span-9 h-[620px] lg:h-[720px]"
          } ${interactionState === 'CANVAS_PANNING' ? 'cursor-grabbing' : 'cursor-default'}`}
        >
          {/* Floating Show Inspector Panel Button when collapsed */}
          {isInspectorCollapsed && (
            <button
              onClick={() => setIsInspectorCollapsed(false)}
              className="absolute top-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1.5 rounded-lg border border-[#E8E8E5] text-xs font-medium text-[#252525] shadow-xs flex items-center gap-1.5 hover:bg-white z-10 transition-colors"
              title="Open Inspector Panel"
            >
              <PanelRightOpen className="w-3.5 h-3.5 text-[#8B806F]" />
              <span className="hidden sm:inline">Properties</span>
            </button>
          )}

          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-20">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-[#8B806F] animate-spin" />
                <span className="text-xs font-mono text-[#777777]">Loading Wedding Hall Canvas...</span>
              </div>
            </div>
          ) : (
            <Stage
              ref={stageRef}
              width={containerWidth}
              height={containerHeight}
              scaleX={scale}
              scaleY={scale}
              x={position.x}
              y={position.y}
              draggable={false}
              onMouseDown={(e) => {
                // Left-click on empty canvas space deselects objects and supports empty-space panning
                if (e.evt.button === 0) {
                  const clickedOnEmpty = e.target === stageRef.current || e.target.id() === 'floor-boundary' || e.target.id() === 'grid-layer';
                  if (clickedOnEmpty) {
                    setSelectedObjectIds([]);
                    setInteractionState('IDLE');

                    // Allow left-drag on empty space to pan the canvas
                    isPanningRef.current = true;
                    panStartRef.current = {
                      startX: e.evt.clientX,
                      startY: e.evt.clientY,
                      origPosX: posRef.current.x,
                      origPosY: posRef.current.y,
                      button: 0
                    };
                    setInteractionState('CANVAS_PANNING');

                    const onPointerMove = (evt: PointerEvent) => {
                      if (!panStartRef.current || !isPanningRef.current) return;
                      const dx = evt.clientX - panStartRef.current.startX;
                      const dy = evt.clientY - panStartRef.current.startY;
                      setPosition({
                        x: panStartRef.current.origPosX + dx,
                        y: panStartRef.current.origPosY + dy
                      });
                    };

                    const onPointerUp = (evt: PointerEvent) => {
                      if (evt.button === 0) {
                        isPanningRef.current = false;
                        panStartRef.current = null;
                        window.removeEventListener('pointermove', onPointerMove);
                        window.removeEventListener('pointerup', onPointerUp);
                        window.removeEventListener('pointercancel', onPointerUp);
                        setInteractionState('IDLE');
                      }
                    };

                    window.addEventListener('pointermove', onPointerMove);
                    window.addEventListener('pointerup', onPointerUp);
                    window.addEventListener('pointercancel', onPointerUp);
                  }
                }
              }}
            >
              {/* Layer 0: Measurement Rulers */}
              {renderRulers()}

              {/* Layer 1: Floor boundary & Grid */}
              <Layer id="grid-layer">
                {/* Hall Boundary */}
                <Rect
                  id="floor-boundary"
                  x={0}
                  y={0}
                  width={venueWidthPx}
                  height={venueHeightPx}
                  fill="#FFFFFF"
                  stroke="#252525"
                  strokeWidth={2}
                  shadowColor="rgba(0,0,0,0.08)"
                  shadowBlur={18}
                />
                {renderGridLines()}
              </Layer>

              {/* Layer 2: Venue and Table Objects */}
              <Layer>
                {layout?.objects.map((obj) => {
                  const isSelected = selectedObjectIds.includes(obj.id);
                  const isTable = obj.object_type === 'table';
                  const targetTable = isTable ? tables.find(t => t.id === obj.object_reference_id) : null;
                  const assignedCount = targetTable?.assigned_count || 0;
                  const capacity = targetTable?.capacity || obj.properties?.capacity || 10;
                  const isRect = obj.properties?.tableShape === 'rectangular';
                  const screenRect = getObjectScreenRect(obj);
                  const isOut = outOfBounds.outOfBoundsIds.includes(obj.id);

                  return (
                    <Group
                      key={obj.id}
                      id={obj.id}
                      x={screenRect.x}
                      y={screenRect.y}
                      width={screenRect.width}
                      height={screenRect.height}
                      rotation={obj.rotation}
                      draggable={interactionState !== 'CANVAS_PANNING'}
                      onMouseDown={(e) => {
                        // Left-click object selection
                        if (e.evt.button === 0) {
                          e.cancelBubble = true;
                          const isMultiKey = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
                          if (isMultiKey) {
                            setSelectedObjectIds(prev => 
                              prev.includes(obj.id) ? prev.filter(id => id !== obj.id) : [...prev, obj.id]
                            );
                            setInteractionState('OBJECT_SELECTED');
                          } else {
                            if (!selectedObjectIds.includes(obj.id)) {
                              setSelectedObjectIds([obj.id]);
                            }
                            setInteractionState('OBJECT_SELECTED');
                          }
                        }
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true;
                        setSelectedObjectIds([obj.id]);
                        setInteractionState('OBJECT_SELECTED');
                      }}
                      onDragStart={(e) => {
                        if (e.target.id() === obj.id) {
                          e.cancelBubble = true;
                          let currentSel = selectedObjectIdsRef.current;
                          if (!currentSel.includes(obj.id)) {
                            currentSel = [obj.id];
                            setSelectedObjectIds([obj.id]);
                          }
                          setInteractionState('OBJECT_DRAGGING');

                          // Record start positions of all currently selected objects in screen coordinates
                          const map = new Map<string, { x: number; y: number }>();
                          if (layoutRef.current) {
                            layoutRef.current.objects.forEach(o => {
                              if (currentSel.includes(o.id)) {
                                const sRect = getObjectScreenRect(o);
                                map.set(o.id, { x: sRect.x, y: sRect.y });
                              }
                            });
                          }
                          dragGroupStartPositionsRef.current = map;
                        }
                      }}
                      onDragMove={(e) => {
                        if (e.target.id() === obj.id) {
                          e.cancelBubble = true;
                          const origSelf = dragGroupStartPositionsRef.current.get(obj.id);
                          if (origSelf && stageRef.current) {
                            const dx = e.target.x() - origSelf.x;
                            const dy = e.target.y() - origSelf.y;

                            // Move peer selected nodes on the canvas
                            selectedObjectIdsRef.current.forEach(otherId => {
                              if (otherId !== obj.id) {
                                const otherNode = stageRef.current?.findOne(`#${otherId}`);
                                const origOther = dragGroupStartPositionsRef.current.get(otherId);
                                if (otherNode && origOther) {
                                  otherNode.position({
                                    x: origOther.x + dx,
                                    y: origOther.y + dy
                                  });
                                }
                              }
                            });
                          }

                          if (trRef.current) {
                            trRef.current.update();
                          }
                        }
                      }}
                      onDragEnd={(e) => {
                        if (e.target.id() === obj.id) {
                          e.cancelBubble = true;
                          const origSelf = dragGroupStartPositionsRef.current.get(obj.id);
                          const isWorld = layoutRef.current?.coordinate_system === 'world' || (obj.width <= 25);
                          const u: VenueUnit = (layoutRef.current?.venue_unit as VenueUnit) || 'm';
                          const px = getPixelsPerUnit(u);
                          const step = layoutRef.current?.grid_unit_step || 0.5;

                          if (origSelf && layoutRef.current) {
                            let snappedSelfX = e.target.x();
                            let snappedSelfY = e.target.y();

                            if (snapToGrid) {
                              if (isWorld) {
                                let worldX = snappedSelfX / px;
                                let worldY = snappedSelfY / px;
                                worldX = Math.round(worldX / step) * step;
                                worldY = Math.round(worldY / step) * step;
                                snappedSelfX = Math.round(worldX * px);
                                snappedSelfY = Math.round(worldY * px);
                              } else {
                                const gridSize = layoutRef.current.grid_size || 40;
                                snappedSelfX = Math.round(snappedSelfX / gridSize) * gridSize;
                                snappedSelfY = Math.round(snappedSelfY / gridSize) * gridSize;
                              }
                            }

                            const dx = snappedSelfX - origSelf.x;
                            const dy = snappedSelfY - origSelf.y;

                            e.target.position({ x: snappedSelfX, y: snappedSelfY });

                            const selIds = selectedObjectIdsRef.current;
                            const newObjects = layoutRef.current.objects.map(o => {
                              if (selIds.includes(o.id)) {
                                const origPos = dragGroupStartPositionsRef.current.get(o.id);
                                if (origPos) {
                                  const finalScreenX = o.id === obj.id ? snappedSelfX : Math.round(origPos.x + dx);
                                  const finalScreenY = o.id === obj.id ? snappedSelfY : Math.round(origPos.y + dy);
                                  const otherNode = stageRef.current?.findOne(`#${o.id}`);
                                  if (otherNode) otherNode.position({ x: finalScreenX, y: finalScreenY });

                                  const finalWorldX = isWorld ? roundToDecimals(finalScreenX / px, 2) : finalScreenX;
                                  const finalWorldY = isWorld ? roundToDecimals(finalScreenY / px, 2) : finalScreenY;

                                  return {
                                    ...o,
                                    position_x: finalWorldX,
                                    position_y: finalWorldY
                                  };
                                }
                              }
                              return o;
                            });

                            dragGroupStartPositionsRef.current.clear();
                            commitObjectsChange(newObjects);
                            if (trRef.current) {
                              trRef.current.update();
                            }
                          }
                          setInteractionState('OBJECT_SELECTED');
                        }
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target;
                        const scaleX = node.scaleX();
                        const scaleY = node.scaleY();
                        node.scaleX(1);
                        node.scaleY(1);

                        if (layoutRef.current) {
                          const isWorld = layoutRef.current.coordinate_system === 'world' || (obj.width <= 25);
                          const u: VenueUnit = (layoutRef.current.venue_unit as VenueUnit) || 'm';
                          const px = getPixelsPerUnit(u);

                          const finalScreenW = Math.max(20, Math.round(node.width() * scaleX));
                          const finalScreenH = Math.max(20, Math.round(node.height() * scaleY));
                          const finalScreenX = Math.round(node.x());
                          const finalScreenY = Math.round(node.y());

                          const finalWorldX = isWorld ? roundToDecimals(finalScreenX / px, 2) : finalScreenX;
                          const finalWorldY = isWorld ? roundToDecimals(finalScreenY / px, 2) : finalScreenY;
                          const finalWorldW = isWorld ? roundToDecimals(finalScreenW / px, 2) : finalScreenW;
                          const finalWorldH = isWorld ? roundToDecimals(finalScreenH / px, 2) : finalScreenH;

                          const newObjects = layoutRef.current.objects.map(o => 
                            o.id === obj.id ? {
                              ...o,
                              position_x: finalWorldX,
                              position_y: finalWorldY,
                              width: finalWorldW,
                              height: finalWorldH,
                              rotation: Math.round(node.rotation())
                            } : o
                          );
                          commitObjectsChange(newObjects);
                          if (trRef.current) {
                            trRef.current.update();
                          }
                        }
                      }}
                    >
                      {/* Out of Bounds Warning Outline */}
                      {isOut && (
                        <Rect
                          x={-6}
                          y={-6}
                          width={screenRect.width + 12}
                          height={screenRect.height + 12}
                          stroke="#EF4444"
                          strokeWidth={2}
                          dash={[6, 3]}
                          cornerRadius={6}
                          listening={false}
                        />
                      )}

                      {/* Render Visual Object Based on Type */}
                      {isTable ? (
                        <>
                          {/* Chairs around table */}
                          {renderChairs(obj, capacity, isRect, screenRect.width, screenRect.height)}

                          {/* Table Body */}
                          {isRect ? (
                            <Rect
                              width={screenRect.width}
                              height={screenRect.height}
                              cornerRadius={8}
                              fill="#FFFFFF"
                              stroke={isSelected ? "#8B806F" : "#252525"}
                              strokeWidth={isSelected ? 3 : 1.5}
                              shadowColor="rgba(0,0,0,0.08)"
                              shadowBlur={6}
                            />
                          ) : (
                            <Circle
                              x={screenRect.width / 2}
                              y={screenRect.width / 2}
                              radius={screenRect.width / 2}
                              fill="#FFFFFF"
                              stroke={isSelected ? "#8B806F" : "#252525"}
                              strokeWidth={isSelected ? 3 : 1.5}
                              shadowColor="rgba(0,0,0,0.08)"
                              shadowBlur={6}
                            />
                          )}

                          {/* Table Label & Seating Occupancy text */}
                          <KonvaText
                            text={`Table ${targetTable?.table_number || obj.properties?.tableNumber || '1'}`}
                            fontSize={12}
                            fontStyle="bold"
                            fontFamily="Inter, sans-serif"
                            fill="#252525"
                            align="center"
                            width={screenRect.width}
                            y={isRect ? screenRect.height / 2 - 14 : screenRect.width / 2 - 14}
                          />

                          <KonvaText
                            text={`${assignedCount} / ${capacity}`}
                            fontSize={11}
                            fontFamily="monospace"
                            fill={assignedCount >= capacity ? "#DC2626" : "#059669"}
                            align="center"
                            width={screenRect.width}
                            y={isRect ? screenRect.height / 2 + 2 : screenRect.width / 2 + 2}
                          />
                        </>
                      ) : (
                        /* Architectural & Venue Objects */
                        <>
                          <Rect
                            width={screenRect.width}
                            height={screenRect.height}
                            cornerRadius={obj.object_type === 'pillar' ? 30 : 6}
                            fill={obj.properties?.color || "#FAF9F7"}
                            stroke={isSelected ? "#8B806F" : "#252525"}
                            strokeWidth={isSelected ? 2.5 : 1}
                            shadowColor="rgba(0,0,0,0.06)"
                            shadowBlur={4}
                          />
                          <KonvaText
                            text={obj.label || obj.object_type.toUpperCase()}
                            fontSize={11}
                            fontStyle="bold"
                            fontFamily="Inter, sans-serif"
                            fill={obj.properties?.textColor || "#252525"}
                            align="center"
                            width={screenRect.width}
                            y={screenRect.height / 2 - 6}
                          />
                        </>
                      )}
                    </Group>
                  );
                })}

                {/* Transformer for selected item */}
                <Transformer
                  ref={trRef}
                  shouldOverdrawWholeArea={false}
                  ignoreStroke={true}
                  rotateEnabled={true}
                  resizeEnabled={true}
                  borderStroke="#8B806F"
                  borderStrokeWidth={1.5}
                  borderDash={[4, 4]}
                  anchorStroke="#8B806F"
                  anchorFill="#FFFFFF"
                  anchorSize={8}
                  anchorCornerRadius={2}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 40 || newBox.height < 30) {
                      return oldBox;
                    }
                    return newBox;
                  }}
                  enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                />
              </Layer>
            </Stage>
          )}

          {/* Navigation Hint Pill */}
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-[#E8E8E5] text-[11px] font-mono text-[#777777] shadow-xs flex items-center gap-2">
            <span>Left-click to drag • Shift+Click multi-select • Right-click pan • Wheel zoom • Ctrl+C/V/Z</span>
            <button
              onClick={() => setShowShortcutsModal(true)}
              className="underline text-[#8B806F] hover:text-[#252525] ml-1 font-sans"
            >
              Shortcuts list
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Contextual Properties Inspector */}
        {!isInspectorCollapsed && (
          <div className={
            isMaximized
              ? "w-full lg:w-80 shrink-0 bg-white rounded-xl border border-[#E8E8E5] shadow-subtle p-4 space-y-4 overflow-y-auto max-h-[35vh] lg:max-h-full"
              : "lg:col-span-3 bg-white rounded-xl border border-[#E8E8E5] shadow-subtle p-4 space-y-4"
          }>
            <div className="flex items-center justify-between pb-2 border-b border-[#E8E8E5]">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#252525]">
                {selectedObjectIds.length > 1
                  ? 'Multiple Selection'
                  : selectedObject
                  ? 'Object Properties'
                  : 'Hall Blueprint'}
              </h4>
              <div className="flex items-center gap-1.5">
                {selectedObjectIds.length > 1 ? (
                  <Badge variant="taupe" size="sm">
                    {selectedObjectIds.length} Objects
                  </Badge>
                ) : selectedObject ? (
                  <Badge variant="taupe" size="sm">
                    {selectedObject.object_type}
                  </Badge>
                ) : null}
                <button
                  onClick={() => setIsInspectorCollapsed(true)}
                  className="p-1 text-[#777777] hover:text-[#252525] rounded transition-colors"
                  title="Collapse Inspector Panel"
                >
                  <PanelRightClose className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Case 1: Multi-Selection Panel */}
            {selectedObjectIds.length > 1 ? (
              <div className="space-y-4">
                <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E8E8E5] space-y-2 text-xs">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-[#777777] block">
                    Selection Summary
                  </span>
                  <div className="flex justify-between text-[#252525] font-medium">
                    <span>Selected Elements:</span>
                    <span className="font-mono">{selectedObjectIds.length}</span>
                  </div>
                  {(() => {
                    const selObjs = layout?.objects.filter(o => selectedObjectIds.includes(o.id)) || [];
                    const tablesCount = selObjs.filter(o => o.object_type === 'table').length;
                    const venueCount = selObjs.length - tablesCount;
                    return (
                      <div className="text-[11px] text-[#777777] space-y-0.5">
                        {tablesCount > 0 && <div>• {tablesCount} Reception {tablesCount === 1 ? 'Table' : 'Tables'}</div>}
                        {venueCount > 0 && <div>• {venueCount} Venue / Stage {venueCount === 1 ? 'Element' : 'Elements'}</div>}
                      </div>
                    );
                  })()}
                  <div className="text-[11px] text-[#8B806F] pt-1">
                    Drag any item to move all selected objects together. Use arrow keys to nudge.
                  </div>
                </div>

                {/* Actions for Multi-Selection */}
                <div className="pt-2 border-t border-[#E8E8E5] space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDuplicateSelected}
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                    className="w-full !h-8 !text-xs"
                  >
                    Duplicate ({selectedObjectIds.length}) Objects
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteSelected}
                    leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
                    className="w-full !h-8 !text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                  >
                    Delete ({selectedObjectIds.length}) Objects
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedObjectIds([])}
                    className="w-full !h-8 !text-xs text-stone-500"
                  >
                    Deselect All (Esc)
                  </Button>
                </div>
              </div>
            ) : selectedObject ? (
              /* Case 2: Single Object Inspector */
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-[#777777] block mb-1">Label</label>
                  <input
                    type="text"
                    value={selectedObject.label || ''}
                    onChange={(e) => {
                      const newObjects = layout!.objects.map(o => 
                        o.id === selectedObject.id ? { ...o, label: e.target.value } : o
                      );
                      commitObjectsChange(newObjects);
                    }}
                    className="w-full h-8 px-2.5 text-xs bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[#252525] focus:outline-none"
                  />
                </div>

                {selectedObject.object_type === 'table' && (
                  <>
                    <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E8E8E5] space-y-1 text-xs">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-[#777777] block">
                        Synchronized Table
                      </span>
                      <div className="font-semibold text-[#252525]">
                        {tables.find(t => t.id === selectedObject.object_reference_id)?.table_name || 'Reception Table'}
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        Capacity: {selectedObject.properties?.capacity || 10} seats
                      </div>
                    </div>
                  </>
                )}

                {/* Coordinates & Dimensions */}
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8B806F]">
                    Real-World Geometry ({currentUnit})
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-[#777777] block font-mono">X ({currentUnit})</span>
                      <input
                        type="number"
                        step={gridUnitStep}
                        value={roundToDecimals(selectedObject.position_x, 2)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const newObjects = layout!.objects.map(o => 
                            o.id === selectedObject.id ? { ...o, position_x: roundToDecimals(val, 2) } : o
                          );
                          commitObjectsChange(newObjects);
                        }}
                        className="w-full h-7 px-2 font-mono text-[11px] bg-[#FAF9F7] rounded border border-[#E8E8E5] text-[#252525] focus:outline-none focus:border-[#252525]"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-[#777777] block font-mono">Y ({currentUnit})</span>
                      <input
                        type="number"
                        step={gridUnitStep}
                        value={roundToDecimals(selectedObject.position_y, 2)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const newObjects = layout!.objects.map(o => 
                            o.id === selectedObject.id ? { ...o, position_y: roundToDecimals(val, 2) } : o
                          );
                          commitObjectsChange(newObjects);
                        }}
                        className="w-full h-7 px-2 font-mono text-[11px] bg-[#FAF9F7] rounded border border-[#E8E8E5] text-[#252525] focus:outline-none focus:border-[#252525]"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-[#777777] block font-mono">Width ({currentUnit})</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.2"
                        value={roundToDecimals(selectedObject.width, 2)}
                        onChange={(e) => {
                          const val = Math.max(0.2, parseFloat(e.target.value) || 0.2);
                          const newObjects = layout!.objects.map(o => 
                            o.id === selectedObject.id ? { ...o, width: roundToDecimals(val, 2) } : o
                          );
                          commitObjectsChange(newObjects);
                        }}
                        className="w-full h-7 px-2 font-mono text-[11px] bg-[#FAF9F7] rounded border border-[#E8E8E5] text-[#252525] focus:outline-none focus:border-[#252525]"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-[#777777] block font-mono">Height ({currentUnit})</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.2"
                        value={roundToDecimals(selectedObject.height, 2)}
                        onChange={(e) => {
                          const val = Math.max(0.2, parseFloat(e.target.value) || 0.2);
                          const newObjects = layout!.objects.map(o => 
                            o.id === selectedObject.id ? { ...o, height: roundToDecimals(val, 2) } : o
                          );
                          commitObjectsChange(newObjects);
                        }}
                        className="w-full h-7 px-2 font-mono text-[11px] bg-[#FAF9F7] rounded border border-[#E8E8E5] text-[#252525] focus:outline-none focus:border-[#252525]"
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-[#777777] block font-mono">Rotation (Degrees)</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="5"
                          value={selectedObject.rotation || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            const newObjects = layout!.objects.map(o => 
                              o.id === selectedObject.id ? { ...o, rotation: val } : o
                            );
                            commitObjectsChange(newObjects);
                          }}
                          className="flex-1 accent-[#252525]"
                        />
                        <span className="font-mono text-xs w-10 text-right">{selectedObject.rotation || 0}°</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-[#E8E8E5] space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDuplicateSelected}
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                    className="w-full !h-8 !text-xs"
                  >
                    Duplicate Object
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteSelected}
                    leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
                    className="w-full !h-8 !text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                  >
                    Remove from Canvas
                  </Button>
                </div>
              </div>
            ) : (
              /* Case 3: Blueprint Overview */
              <div className="space-y-4 text-xs text-[#777777]">
                <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E8E5] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[#252525] flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#8B806F]" />
                      Venue Configuration
                    </span>
                    <Badge variant="taupe" size="sm">
                      {layout?.venue_orientation || (venueWidthM >= venueHeightM ? 'Landscape' : 'Portrait')}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[#777777]">Venue Name:</span>
                      <span className="font-medium text-[#252525] truncate max-w-[150px]">
                        {layout?.venue_name || layout?.layout_name || 'Main Ballroom'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#777777]">Dimensions:</span>
                      <span className="font-mono font-semibold text-[#252525]">
                        {venueWidthM}{currentUnit} × {venueHeightM}{currentUnit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#777777]">Total Floor Area:</span>
                      <span className="font-mono text-[#252525]">
                        {formatVenueArea(venueWidthM, venueHeightM, currentUnit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#777777]">Grid Step:</span>
                      <span className="font-mono text-[#252525]">
                        {gridUnitStep} {currentUnit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#777777]">Placed Elements:</span>
                      <span className="font-mono text-[#252525]">{layout?.objects.length || 0}</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsVenueSettingsOpen(true)}
                    leftIcon={<Sliders className="w-3.5 h-3.5 text-[#8B806F]" />}
                    className="w-full !h-8 !text-xs !bg-white"
                  >
                    Edit Venue Dimensions & Presets
                  </Button>
                </div>

                <p className="leading-relaxed text-[11px] text-[#8B806F]">
                  Click any table, stage, or element on the canvas to inspect coordinates, change dimensions, or delete it.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Venue Settings Modal */}
      {layout && (
        <VenueSettingsModal
          isOpen={isVenueSettingsOpen}
          onClose={() => setIsVenueSettingsOpen(false)}
          layout={layout}
          onApplySettings={handleApplyVenueSettings}
        />
      )}

      {/* Keyboard Shortcuts Cheat-Sheet Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E8E8E5] space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E5]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#FAF9F7] rounded-lg border border-[#E8E8E5]">
                  <Keyboard className="w-5 h-5 text-[#8B806F]" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#252525]">Keyboard & Mouse Shortcuts</h3>
                  <p className="text-xs text-[#777777]">Precision controls for Wedding Hall Planning</p>
                </div>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="text-stone-400 hover:text-[#252525] p-1 rounded-md transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Clipboard Section */}
              <div className="space-y-2">
                <h5 className="font-semibold uppercase tracking-wider text-[11px] text-[#8B806F]">Clipboard</h5>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Copy Selected</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Ctrl / ⌘ + C</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Paste Object</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Ctrl / ⌘ + V</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Cut Selected</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Ctrl / ⌘ + X</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Duplicate</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Ctrl / ⌘ + D</kbd>
                  </div>
                </div>
              </div>

              {/* History & Save Section */}
              <div className="space-y-2">
                <h5 className="font-semibold uppercase tracking-wider text-[11px] text-[#8B806F]">History & Save</h5>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Undo</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Ctrl / ⌘ + Z</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Redo</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Ctrl / ⌘ + Shift + Z</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Save Blueprint</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Ctrl / ⌘ + S</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Select All</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Ctrl / ⌘ + A</kbd>
                  </div>
                </div>
              </div>

              {/* Positioning Section */}
              <div className="space-y-2">
                <h5 className="font-semibold uppercase tracking-wider text-[11px] text-[#8B806F]">Nudge & Move</h5>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Nudge 1px</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Arrow Keys</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Nudge 10px</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Shift + Arrows</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Delete Object</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Delete / Backspace</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Deselect</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Escape</kbd>
                  </div>
                </div>
              </div>

              {/* Navigation & Canvas */}
              <div className="space-y-2">
                <h5 className="font-semibold uppercase tracking-wider text-[11px] text-[#8B806F]">Canvas & Workspace</h5>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Fit to Screen</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Shift + F</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Maximize / Exit</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Shift + M</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">100% Zoom (1:1)</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Ctrl / ⌘ + 0</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Multi-select</span>
                    <kbd className="px-1.5 py-0.5 bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[11px] font-mono text-[#252525]">Shift + Click</kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Pan Canvas</span>
                    <span className="text-[11px] font-mono text-[#252525]">Right or Middle-Drag</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#F2EFE9]">
                    <span className="text-[#555555]">Smooth Zoom</span>
                    <span className="text-[11px] font-mono text-[#252525]">Mouse Wheel</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8E8E5] flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowShortcutsModal(false)}
                className="!bg-[#252525] text-white"
              >
                Got It
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
