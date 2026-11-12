import React, { useState, useEffect } from 'react';
import { 
  X, 
  Ruler, 
  RotateCw, 
  Sliders, 
  Building2, 
  Check, 
  AlertTriangle,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  VenueUnit, 
  VenueOrientation, 
  VENUE_PRESETS, 
  formatVenueArea, 
  roundToDecimals, 
  convertUnitValue,
  getOutOfBoundsObjects
} from '../../utils/venueCoordinates';
import { VenueLayout, VenueLayoutObject } from '../../types';

interface VenueSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  layout: VenueLayout;
  onApplySettings: (updatedFields: {
    venue_width: number;
    venue_height: number;
    venue_unit: VenueUnit;
    venue_orientation: VenueOrientation;
    venue_name?: string;
    venue_description?: string;
    grid_unit_step: number;
    repositionOutOfBounds?: boolean;
  }) => void;
}

export const VenueSettingsModal: React.FC<VenueSettingsModalProps> = ({
  isOpen,
  onClose,
  layout,
  onApplySettings
}) => {
  const currentUnit = (layout.venue_unit as VenueUnit) || 'm';
  const initialWidth = layout.venue_width || (currentUnit === 'm' ? 30 : 100);
  const initialHeight = layout.venue_height || (currentUnit === 'm' ? 20 : 65);

  const [unit, setUnit] = useState<VenueUnit>(currentUnit);
  const [width, setWidth] = useState<number>(initialWidth);
  const [height, setHeight] = useState<number>(initialHeight);
  const [orientation, setOrientation] = useState<VenueOrientation>(
    layout.venue_orientation || (initialWidth >= initialHeight ? 'landscape' : 'portrait')
  );
  const [venueName, setVenueName] = useState<string>(layout.venue_name || layout.layout_name || 'Main Ballroom');
  const [venueDescription, setVenueDescription] = useState<string>(layout.venue_description || '');
  const [gridUnitStep, setGridUnitStep] = useState<number>(layout.grid_unit_step || 0.5);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [autoReposition, setAutoReposition] = useState<boolean>(true);

  // Sync state whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      const u = (layout.venue_unit as VenueUnit) || 'm';
      const w = layout.venue_width || (u === 'm' ? 30 : 100);
      const h = layout.venue_height || (u === 'm' ? 20 : 65);
      setUnit(u);
      setWidth(w);
      setHeight(h);
      setOrientation(layout.venue_orientation || (w >= h ? 'landscape' : 'portrait'));
      setVenueName(layout.venue_name || layout.layout_name || 'Main Ballroom');
      setVenueDescription(layout.venue_description || '');
      setGridUnitStep(layout.grid_unit_step || (u === 'm' ? 0.5 : 2.0));
      setAutoReposition(true);

      // Check matching preset
      const match = VENUE_PRESETS.find(p => 
        (u === 'm' && Math.abs(p.widthM - w) < 0.1 && Math.abs(p.heightM - h) < 0.1) ||
        (u === 'ft' && Math.abs(p.widthFt - w) < 0.5 && Math.abs(p.heightFt - h) < 0.5)
      );
      setSelectedPresetId(match ? match.id : null);
    }
  }, [isOpen, layout]);

  if (!isOpen) return null;

  // Handle Preset selection
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = VENUE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    let targetW = unit === 'm' ? preset.widthM : preset.widthFt;
    let targetH = unit === 'm' ? preset.heightM : preset.heightFt;

    if (orientation === 'portrait' && targetW > targetH) {
      const temp = targetW;
      targetW = targetH;
      targetH = temp;
    }

    setWidth(targetW);
    setHeight(targetH);
  };

  // Handle Unit Switch (converts values appropriately)
  const handleToggleUnit = (newUnit: VenueUnit) => {
    if (newUnit === unit) return;
    const convertedW = convertUnitValue(width, unit, newUnit);
    const convertedH = convertUnitValue(height, unit, newUnit);
    setUnit(newUnit);
    setWidth(convertedW);
    setHeight(convertedH);
    setGridUnitStep(newUnit === 'm' ? 0.5 : 2.0);
  };

  // Handle Orientation Toggle / Swap
  const handleToggleOrientation = (newOrientation: VenueOrientation) => {
    if (newOrientation === orientation) return;
    setOrientation(newOrientation);
    // Swap dimensions
    const newW = height;
    const newH = width;
    setWidth(newW);
    setHeight(newH);
  };

  const handleSwapDimensions = () => {
    const newW = height;
    const newH = width;
    const newOri = newW >= newH ? 'landscape' : 'portrait';
    setWidth(newW);
    setHeight(newH);
    setOrientation(newOri);
    setSelectedPresetId(null);
  };

  // Check out of bounds objects based on current width and height
  // Note: if unit is changed or objects are in meters, check against width/height
  const currentObjects = layout.objects || [];
  const { outOfBoundsObjects } = getOutOfBoundsObjects(currentObjects, width, height);
  const outOfBoundsCount = outOfBoundsObjects.length;

  const handleSave = () => {
    if (width <= 0 || height <= 0) return;
    onApplySettings({
      venue_width: roundToDecimals(width, 1),
      venue_height: roundToDecimals(height, 1),
      venue_unit: unit,
      venue_orientation: orientation,
      venue_name: venueName.trim() || 'Wedding Venue',
      venue_description: venueDescription.trim(),
      grid_unit_step: gridUnitStep,
      repositionOutOfBounds: outOfBoundsCount > 0 && autoReposition
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-[#E8E8E5] rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#E8E8E5] flex items-center justify-between bg-[#FAF9F7]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#8B806F]/10 flex items-center justify-center text-[#8B806F]">
              <Ruler className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-semibold text-[#252525]">Venue Dimensions & Canvas Settings</h3>
              <p className="text-xs text-[#8B806F]">Configure real-world floor plan dimensions and grid units</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-md text-[#8B806F] hover:text-[#252525] hover:bg-[#E8E8E5]/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-[#252525]">
          {/* Presets Bar */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8B806F] uppercase tracking-wider mb-2">
              Venue Size Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {VENUE_PRESETS.map((p) => {
                const isSelected = selectedPresetId === p.id;
                const dimStr = unit === 'm' ? `${p.widthM}m × ${p.heightM}m` : `${p.widthFt}ft × ${p.heightFt}ft`;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                      isSelected 
                        ? 'border-[#252525] bg-[#252525] text-white shadow-xs' 
                        : 'border-[#E8E8E5] bg-[#FAF9F7] hover:border-[#8B806F] text-[#252525]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs leading-tight mb-1">{p.name}</div>
                      <div className={`font-mono text-[10px] ${isSelected ? 'text-white/80' : 'text-[#8B806F]'}`}>
                        {dimStr}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dimension Inputs & Units */}
          <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E8E5] space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-[#252525] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#8B806F]" />
                Dimensions & Measurement Unit
              </span>

              {/* Unit Selector (Meters vs Feet) */}
              <div className="flex items-center bg-white p-0.5 rounded-md border border-[#E8E8E5]">
                <button
                  type="button"
                  onClick={() => handleToggleUnit('m')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    unit === 'm' ? 'bg-[#252525] text-white shadow-xs' : 'text-[#8B806F] hover:text-[#252525]'
                  }`}
                >
                  Meters (m)
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleUnit('ft')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    unit === 'ft' ? 'bg-[#252525] text-white shadow-xs' : 'text-[#8B806F] hover:text-[#252525]'
                  }`}
                >
                  Feet (ft)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-[11px] text-[#8B806F] mb-1 font-medium">
                  Venue Width ({unit})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    max="200"
                    step="0.5"
                    value={width}
                    onChange={(e) => {
                      setWidth(Math.max(1, parseFloat(e.target.value) || 0));
                      setSelectedPresetId(null);
                    }}
                    className="w-full h-9 pl-3 pr-8 rounded-lg bg-white border border-[#E8E8E5] text-xs font-mono font-medium focus:outline-none focus:border-[#252525]"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-[#8B806F] font-mono">{unit}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#8B806F] mb-1 font-medium">
                  Venue Height ({unit})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    max="200"
                    step="0.5"
                    value={height}
                    onChange={(e) => {
                      setHeight(Math.max(1, parseFloat(e.target.value) || 0));
                      setSelectedPresetId(null);
                    }}
                    className="w-full h-9 pl-3 pr-8 rounded-lg bg-white border border-[#E8E8E5] text-xs font-mono font-medium focus:outline-none focus:border-[#252525]"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-[#8B806F] font-mono">{unit}</span>
                </div>
              </div>
            </div>

            {/* Orientation & Quick Swap */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E8E8E5]/70 flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#8B806F]">Orientation:</span>
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-[#E8E8E5]">
                  <button
                    type="button"
                    onClick={() => handleToggleOrientation('landscape')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      orientation === 'landscape' ? 'bg-[#FAF9F7] text-[#252525] font-semibold' : 'text-[#8B806F]'
                    }`}
                  >
                    Landscape
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleOrientation('portrait')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      orientation === 'portrait' ? 'bg-[#FAF9F7] text-[#252525] font-semibold' : 'text-[#8B806F]'
                    }`}
                  >
                    Portrait
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSwapDimensions}
                className="flex items-center gap-1 text-[11px] text-[#8B806F] hover:text-[#252525] px-2 py-1 rounded bg-white border border-[#E8E8E5] hover:border-[#8B806F] transition-colors"
                title="Swap width and height"
              >
                <RotateCw className="w-3 h-3" />
                <span>Swap Dimensions</span>
              </button>

              <div className="text-[11px] text-[#8B806F]">
                Total Floor Area:{' '}
                <span className="font-mono font-semibold text-[#252525]">
                  {formatVenueArea(width, height, unit)}
                </span>
              </div>
            </div>
          </div>

          {/* Grid Unit Step Selection */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F7] border border-[#E8E8E5]">
            <div>
              <div className="font-semibold text-xs text-[#252525]">Grid Snapping & Ruler Interval</div>
              <div className="text-[11px] text-[#8B806F]">Distance between grid snap points in real-world units</div>
            </div>
            <select
              value={gridUnitStep}
              onChange={(e) => setGridUnitStep(parseFloat(e.target.value))}
              className="h-8 px-2.5 rounded-md bg-white border border-[#E8E8E5] text-xs font-mono font-medium focus:outline-none"
            >
              {unit === 'm' ? (
                <>
                  <option value={0.25}>0.25 meters (Fine)</option>
                  <option value={0.5}>0.5 meters (Recommended)</option>
                  <option value={1.0}>1.0 meter (Standard)</option>
                  <option value={2.0}>2.0 meters (Coarse)</option>
                </>
              ) : (
                <>
                  <option value={1.0}>1.0 foot (Fine)</option>
                  <option value={2.0}>2.0 feet (Recommended)</option>
                  <option value={5.0}>5.0 feet (Standard)</option>
                </>
              )}
            </select>
          </div>

          {/* Venue Details */}
          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-semibold text-[#8B806F] uppercase tracking-wider mb-1">
                Venue Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Grand Starlight Ballroom, Sunset Glasshouse"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className="w-full h-8 px-3 rounded-lg bg-[#FAF9F7] border border-[#E8E8E5] text-xs focus:outline-none focus:border-[#252525]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#8B806F] uppercase tracking-wider mb-1">
                Venue Description & Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. 2nd floor ballroom, 12 chandeliers, exit to west terrace garden"
                value={venueDescription}
                onChange={(e) => setVenueDescription(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-[#FAF9F7] border border-[#E8E8E5] text-xs focus:outline-none focus:border-[#252525] resize-none"
              />
            </div>
          </div>

          {/* Out of Bounds Warning & Auto Reposition Option */}
          {outOfBoundsCount > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold text-amber-900">
                    {outOfBoundsCount} object{outOfBoundsCount > 1 ? 's' : ''} currently placed outside the new boundary
                  </div>
                  <div className="text-[11px] text-amber-700 mt-0.5">
                    Reducing the venue boundary to {width}{unit} × {height}{unit} leaves some tables or venue elements past the walls.
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 pt-1 text-[11px] text-amber-900 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoReposition}
                  onChange={(e) => setAutoReposition(e.target.checked)}
                  className="rounded text-[#252525] focus:ring-0"
                />
                <span>Automatically reposition outside objects to safely fit inside the new boundary</span>
              </label>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[#E8E8E5] bg-[#FAF9F7] flex items-center justify-between">
          <div className="text-[11px] text-[#8B806F]">
            Preserves table IDs, guest assignments, capacities, and rotations.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-[#E8E8E5] bg-white text-xs font-medium text-[#252525] hover:bg-[#FAF9F7] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-[#252525] text-white text-xs font-medium hover:bg-[#3E3E3E] transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Dimensions</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
