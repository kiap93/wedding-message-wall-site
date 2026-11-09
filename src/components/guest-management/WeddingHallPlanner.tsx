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
  Grid, 
  RotateCw, 
  Trash2, 
  Copy, 
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
  Printer
} from 'lucide-react';
import { 
  VenueLayout, 
  VenueLayoutObject, 
  VenueObjectType, 
  SeatingTable, 
  Guest 
} from '../../types';
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
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // Canvas Viewport State
  const [scale, setScale] = useState(0.85);
  const [position, setPosition] = useState({ x: 50, y: 30 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Undo / Redo History
  const [history, setHistory] = useState<VenueLayoutObject[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

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
      setLayout(lData);
      setTables(tData);
      setGuests(gData);

      // Initialize history
      if (lData && lData.objects) {
        setHistory([JSON.parse(JSON.stringify(lData.objects))]);
        setHistoryIndex(0);
      }
    } catch (err) {
      console.error('Error loading wedding hall layout:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Helper to commit state changes to history
  const commitObjectsChange = (newObjects: VenueLayoutObject[]) => {
    if (!layout) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newObjects)));
    if (newHistory.length > 30) newHistory.shift();

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setLayout({ ...layout, objects: newObjects });
  };

  const undo = () => {
    if (historyIndex > 0 && layout) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setLayout({ ...layout, objects: JSON.parse(JSON.stringify(history[newIndex])) });
      setSelectedObjectId(null);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1 && layout) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setLayout({ ...layout, objects: JSON.parse(JSON.stringify(history[newIndex])) });
      setSelectedObjectId(null);
    }
  };

  // Attach Transformer when an object is selected
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    if (selectedObjectId) {
      const node = stageRef.current.findOne(`#${selectedObjectId}`);
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer().batchDraw();
        return;
      }
    }
    trRef.current.nodes([]);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedObjectId, layout]);

  // Handle Zoom In / Out / Reset
  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (direction === 'reset') {
      setScale(0.85);
      setPosition({ x: 50, y: 30 });
    } else {
      const factor = direction === 'in' ? 1.15 : 0.85;
      setScale(prev => Math.max(0.3, Math.min(2.5, prev * factor)));
    }
  };

  // Save Layout to Backend
  const handleSave = async () => {
    if (!layout) return;
    setIsSaving(true);
    try {
      await saveVenueLayout(projectId, {
        canvas_width: layout.canvas_width,
        canvas_height: layout.canvas_height,
        grid_size: layout.grid_size,
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

    let width = 140;
    let height = 140;
    let label = 'New Element';
    let properties: any = {};

    if (type === 'table') {
      const targetTable = tables.find(t => t.id === refTableId);
      const isRect = targetTable?.table_type === 'rectangular';
      width = isRect ? 180 : 130;
      height = isRect ? 90 : 130;
      label = targetTable ? `T${targetTable.table_number}: ${targetTable.table_name}` : 'Reception Table';
      properties = {
        tableShape: targetTable?.table_type || 'round',
        capacity: targetTable?.capacity || 10,
        tableNumber: targetTable?.table_number || '1'
      };
    } else if (type === 'stage') {
      width = 500;
      height = 120;
      label = 'Main Stage';
      properties = { color: '#252525', textColor: '#FFFFFF' };
    } else if (type === 'dance_floor') {
      width = 360;
      height = 260;
      label = 'Dance Floor';
      properties = { color: '#F2EFE9', textColor: '#252525' };
    } else if (type === 'entrance') {
      width = 240;
      height = 60;
      label = 'Grand Entrance';
      properties = { color: '#8B806F', textColor: '#FFFFFF' };
    } else if (type === 'buffet') {
      width = 300;
      height = 80;
      label = 'Buffet & Catering';
      properties = { color: '#4A3E3D', textColor: '#FFFFFF' };
    } else if (type === 'bar') {
      width = 200;
      height = 70;
      label = 'Cocktail Bar';
      properties = { color: '#3A443B', textColor: '#FFFFFF' };
    } else if (type === 'photo_booth') {
      width = 150;
      height = 150;
      label = 'Photo Booth';
      properties = { color: '#FAF9F7', textColor: '#252525' };
    } else if (type === 'pillar') {
      width = 60;
      height = 60;
      label = 'Pillar';
      properties = { color: '#CCCCCC' };
    } else if (type === 'wall') {
      width = 400;
      height = 20;
      label = 'Wall Partition';
      properties = { color: '#252525' };
    }

    const newObj: VenueLayoutObject = {
      id: newId,
      venue_layout_id: layout.id,
      project_id: projectId,
      object_type: type,
      object_reference_id: refTableId || null,
      label,
      position_x: Math.round((-position.x + 300) / gridSize) * gridSize,
      position_y: Math.round((-position.y + 250) / gridSize) * gridSize,
      width,
      height,
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

  const handleDeleteSelected = () => {
    if (!selectedObjectId || !layout) return;
    const newObjects = layout.objects.filter(o => o.id !== selectedObjectId);
    commitObjectsChange(newObjects);
    setSelectedObjectId(null);
  };

  const handleDuplicateSelected = () => {
    if (!selectedObjectId || !layout) return;
    const original = layout.objects.find(o => o.id === selectedObjectId);
    if (!original) return;

    const dupId = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const duplicate: VenueLayoutObject = {
      ...original,
      id: dupId,
      position_x: original.position_x + 30,
      position_y: original.position_y + 30,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const newObjects = [...layout.objects, duplicate];
    commitObjectsChange(newObjects);
    setSelectedObjectId(dupId);
  };

  // Helper to snap coordinates
  const snapVal = (val: number, size: number) => {
    return snapToGrid ? Math.round(val / size) * size : val;
  };

  const selectedObject = layout?.objects.find(o => o.id === selectedObjectId);

  // Render Chairs around table visually
  const renderChairs = (obj: VenueLayoutObject, capacity: number, isRect: boolean) => {
    const chairs: React.ReactNode[] = [];
    const count = Math.min(24, Math.max(2, capacity || 8));
    const chairSize = 12;

    if (isRect) {
      // Chairs along top and bottom
      const perSide = Math.ceil(count / 2);
      const step = obj.width / (perSide + 1);
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
            y={obj.height + chairSize / 2 + 2}
            radius={chairSize / 2}
            fill="#8B806F"
            stroke="#252525"
            strokeWidth={1}
          />
        );
      }
    } else {
      // Radial chairs around circle
      const radius = obj.width / 2;
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

  // Generate background grid lines
  const renderGridLines = () => {
    if (!showGrid || !layout) return null;
    const lines: React.ReactNode[] = [];
    const gridSize = layout.grid_size || 40;
    const width = layout.canvas_width || 2000;
    const height = layout.canvas_height || 1400;

    for (let x = 0; x <= width; x += gridSize) {
      lines.push(
        <Line
          key={`grid-x-${x}`}
          points={[x, 0, x, height]}
          stroke="#E8E8E5"
          strokeWidth={x % (gridSize * 5) === 0 ? 1 : 0.5}
        />
      );
    }
    for (let y = 0; y <= height; y += gridSize) {
      lines.push(
        <Line
          key={`grid-y-${y}`}
          points={[0, y, width, y]}
          stroke="#E8E8E5"
          strokeWidth={y % (gridSize * 5) === 0 ? 1 : 0.5}
        />
      );
    }
    return lines;
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-[#E8E8E5] shadow-subtle flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left Elements Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 mr-2 pr-2 border-r border-[#E8E8E5]">
            <Compass className="w-4 h-4 text-[#8B806F]" />
            <span className="text-xs font-semibold text-[#252525]">Hall Planner</span>
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
        </div>

        {/* Center / Right Canvas Controls */}
        <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
          {/* Undo / Redo */}
          <div className="flex items-center gap-1 bg-[#FAF9F7] p-0.5 rounded-md border border-[#E8E8E5]">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className={`p-1.5 rounded transition-colors ${historyIndex > 0 ? 'text-[#252525] hover:bg-white' : 'text-stone-300 cursor-not-allowed'}`}
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className={`p-1.5 rounded transition-colors ${historyIndex < history.length - 1 ? 'text-[#252525] hover:bg-white' : 'text-stone-300 cursor-not-allowed'}`}
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-[#FAF9F7] p-0.5 rounded-md border border-[#E8E8E5]">
            <button
              onClick={() => handleZoom('in')}
              className="p-1.5 text-[#777777] hover:text-[#252525] hover:bg-white rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-medium px-1 text-[#252525]">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => handleZoom('out')}
              className="p-1.5 text-[#777777] hover:text-[#252525] hover:bg-white rounded transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoom('reset')}
              className="p-1.5 text-[#777777] hover:text-[#252525] hover:bg-white rounded transition-colors"
              title="Fit to Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Grid Toggles */}
          <button
            onClick={() => setShowGrid(prev => !prev)}
            className={`px-2.5 h-8 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showGrid ? 'bg-white text-[#252525] border-[#D4D4CE]' : 'bg-[#FAF9F7] text-stone-400 border-[#E8E8E5]'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>

          {/* Save Layout Action */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            leftIcon={saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
            className="!h-8 !text-xs !bg-[#252525]"
          >
            {saveSuccess ? 'Layout Saved' : 'Save Layout'}
          </Button>
        </div>
      </div>

      {/* Main Interactive Canvas Workspace with Contextual Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Interactive Konva Canvas (9 cols) */}
        <div 
          ref={containerRef}
          className="lg:col-span-9 bg-[#FAF9F7] rounded-xl border border-[#E8E8E5] shadow-subtle overflow-hidden relative h-[700px] select-none"
        >
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
              width={containerRef.current?.clientWidth || 900}
              height={700}
              scaleX={scale}
              scaleY={scale}
              x={position.x}
              y={position.y}
              draggable={!selectedObjectId}
              onDragEnd={(e) => {
                if (e.target === stageRef.current) {
                  setPosition({ x: e.target.x(), y: e.target.y() });
                }
              }}
              onMouseDown={(e) => {
                // Deselect if clicked on empty canvas
                if (e.target === stageRef.current) {
                  setSelectedObjectId(null);
                }
              }}
            >
              {/* Layer 1: Floor boundary & Grid */}
              <Layer>
                {/* Hall Boundary */}
                <Rect
                  x={0}
                  y={0}
                  width={layout?.canvas_width || 2000}
                  height={layout?.canvas_height || 1400}
                  fill="#FFFFFF"
                  stroke="#D4D4CE"
                  strokeWidth={2}
                  shadowColor="rgba(0,0,0,0.06)"
                  shadowBlur={15}
                />
                {renderGridLines()}
              </Layer>

              {/* Layer 2: Venue and Table Objects */}
              <Layer>
                {layout?.objects.map((obj) => {
                  const isSelected = selectedObjectId === obj.id;
                  const isTable = obj.object_type === 'table';
                  const targetTable = isTable ? tables.find(t => t.id === obj.object_reference_id) : null;
                  const assignedCount = targetTable?.assigned_count || 0;
                  const capacity = targetTable?.capacity || obj.properties?.capacity || 10;
                  const isRect = obj.properties?.tableShape === 'rectangular';

                  return (
                    <Group
                      key={obj.id}
                      id={obj.id}
                      x={obj.position_x}
                      y={obj.position_y}
                      width={obj.width}
                      height={obj.height}
                      rotation={obj.rotation}
                      draggable
                      onClick={() => setSelectedObjectId(obj.id)}
                      onTap={() => setSelectedObjectId(obj.id)}
                      onDragEnd={(e) => {
                        const gridSize = layout.grid_size || 40;
                        const newX = snapVal(e.target.x(), gridSize);
                        const newY = snapVal(e.target.y(), gridSize);
                        e.target.position({ x: newX, y: newY });

                        const newObjects = layout.objects.map(o => 
                          o.id === obj.id ? { ...o, position_x: newX, position_y: newY } : o
                        );
                        commitObjectsChange(newObjects);
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target;
                        const scaleX = node.scaleX();
                        const scaleY = node.scaleY();
                        node.scaleX(1);
                        node.scaleY(1);

                        const newObjects = layout.objects.map(o => 
                          o.id === obj.id ? {
                            ...o,
                            position_x: node.x(),
                            position_y: node.y(),
                            width: Math.max(40, node.width() * scaleX),
                            height: Math.max(30, node.height() * scaleY),
                            rotation: Math.round(node.rotation())
                          } : o
                        );
                        commitObjectsChange(newObjects);
                      }}
                    >
                      {/* Render Visual Object Based on Type */}
                      {isTable ? (
                        <>
                          {/* Chairs around table */}
                          {renderChairs(obj, capacity, isRect)}

                          {/* Table Body */}
                          {isRect ? (
                            <Rect
                              width={obj.width}
                              height={obj.height}
                              cornerRadius={8}
                              fill="#FFFFFF"
                              stroke={isSelected ? "#8B806F" : "#252525"}
                              strokeWidth={isSelected ? 3 : 1.5}
                              shadowColor="rgba(0,0,0,0.08)"
                              shadowBlur={6}
                            />
                          ) : (
                            <Circle
                              x={obj.width / 2}
                              y={obj.width / 2}
                              radius={obj.width / 2}
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
                            width={obj.width}
                            y={isRect ? obj.height / 2 - 14 : obj.width / 2 - 14}
                          />

                          <KonvaText
                            text={`${assignedCount} / ${capacity}`}
                            fontSize={11}
                            fontFamily="monospace"
                            fill={assignedCount >= capacity ? "#DC2626" : "#059669"}
                            align="center"
                            width={obj.width}
                            y={isRect ? obj.height / 2 + 2 : obj.width / 2 + 2}
                          />
                        </>
                      ) : (
                        /* Architectural & Venue Objects */
                        <>
                          <Rect
                            width={obj.width}
                            height={obj.height}
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
                            width={obj.width}
                            y={obj.height / 2 - 6}
                          />
                        </>
                      )}
                    </Group>
                  );
                })}

                {/* Transformer for selected item */}
                <Transformer
                  ref={trRef}
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
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-[#E8E8E5] text-[11px] font-mono text-[#777777] shadow-xs">
            Drag items to position • Drag empty space to pan • Wheel to zoom
          </div>
        </div>

        {/* RIGHT PANEL: Contextual Properties Inspector (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-[#E8E8E5] shadow-subtle p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E8E8E5]">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#252525]">
              {selectedObject ? 'Object Properties' : 'Hall Blueprint'}
            </h4>
            {selectedObject && (
              <Badge variant="taupe" size="sm">
                {selectedObject.object_type}
              </Badge>
            )}
          </div>

          {selectedObject ? (
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
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-[#777777] block font-mono">X Pos</span>
                  <div className="font-mono text-[11px] p-1.5 bg-[#FAF9F7] rounded border border-[#E8E8E5]">
                    {Math.round(selectedObject.position_x)}px
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-[#777777] block font-mono">Y Pos</span>
                  <div className="font-mono text-[11px] p-1.5 bg-[#FAF9F7] rounded border border-[#E8E8E5]">
                    {Math.round(selectedObject.position_y)}px
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-[#777777] block font-mono">Width</span>
                  <div className="font-mono text-[11px] p-1.5 bg-[#FAF9F7] rounded border border-[#E8E8E5]">
                    {Math.round(selectedObject.width)}px
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-[#777777] block font-mono">Rotation</span>
                  <div className="font-mono text-[11px] p-1.5 bg-[#FAF9F7] rounded border border-[#E8E8E5]">
                    {Math.round(selectedObject.rotation)}°
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
            <div className="space-y-4 text-xs text-[#777777]">
              <p className="leading-relaxed">
                Click any table, stage, or venue element on the canvas to inspect coordinates, change dimensions, or delete it.
              </p>

              <div className="p-3 rounded-lg bg-[#FAF9F7] border border-[#E8E8E5] space-y-2">
                <div className="font-semibold text-[#252525]">Venue Layout Dimensions</div>
                <div className="flex justify-between text-[11px]">
                  <span>Hall Canvas:</span>
                  <span className="font-mono">{layout?.canvas_width || 2000} x {layout?.canvas_height || 1400}px</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Grid Step:</span>
                  <span className="font-mono">{layout?.grid_size || 40}px</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Total Placed Objects:</span>
                  <span className="font-mono">{layout?.objects.length || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
