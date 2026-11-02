import React, { useState } from 'react';
import { Trash2, ArrowUp, ArrowDown, MousePointer2, Image as ImageIcon, Crop } from 'lucide-react';
import { useEditorStore } from '../store';
import { ImageLibraryModal } from './ImageLibraryModal';
import Button from '../../design-system/components/Button';

const FONTS = [
  'Inter', 'Playfair Display', 'Cormorant Garamond', 'Montserrat', 'Italiana', 'Parisienne', 'Great Vibes'
];

export const PropertiesPanel: React.FC = () => {
  const { elements, selectedId, updateElement, deleteElement, moveElementZ } = useEditorStore();
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const selectedElement = elements.find(el => el.id === selectedId);

  if (!selectedElement) {
    return (
      <aside className="w-72 bg-white border-l border-[#E8E8E5] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-10 h-10 bg-[#FAF9F7] border border-[#E8E8E5] rounded-full flex items-center justify-center mb-3 text-[#777777]">
          <MousePointer2 className="w-4 h-4" />
        </div>
        <h4 className="text-xs font-semibold text-[#252525]">No Selection</h4>
        <p className="text-[11px] text-[#777777] mt-1 leading-relaxed">
          Select an element on the canvas to inspect and edit its properties.
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-72 bg-white border-l border-[#E8E8E5] flex flex-col overflow-y-auto select-none">
      <div className="p-4 space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E5]">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#252525] capitalize">{selectedElement.type}</span>
            <span className="text-[10px] text-[#777777] font-mono">#{selectedElement.id.slice(0, 4)}</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => moveElementZ(selectedElement.id, 'up')} 
              className="p-1 hover:bg-[#FAF9F7] rounded text-[#777777] hover:text-[#252525] transition-colors"
              title="Bring Forward"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => moveElementZ(selectedElement.id, 'down')} 
              className="p-1 hover:bg-[#FAF9F7] rounded text-[#777777] hover:text-[#252525] transition-colors"
              title="Send Backward"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Text / Button Content */}
        {(selectedElement.type === 'text' || selectedElement.type === 'button') && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#777777]">Text Content</label>
            <textarea 
              value={selectedElement.text}
              onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
              className="w-full p-2.5 border border-[#E8E8E5] rounded-md bg-white text-xs text-[#252525] h-20 resize-none focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
            />
          </div>
        )}

        {/* Typography */}
        {(selectedElement.type === 'text' || selectedElement.type === 'button') && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#777777]">Font Family</label>
              <select 
                value={selectedElement.fontFamily}
                onChange={(e) => updateElement(selectedElement.id, { fontFamily: e.target.value })}
                className="w-full h-8 px-2.5 border border-[#E8E8E5] rounded-md bg-white text-xs text-[#252525] focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
              >
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#777777]">
                <span>Font Size</span>
                <span className="font-mono text-[#252525] tabular-nums">{selectedElement.fontSize}px</span>
              </div>
              <input 
                type="range" min="8" max="180" 
                value={selectedElement.fontSize}
                onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) })}
                className="w-full h-1 bg-[#E8E8E5] rounded appearance-none cursor-pointer accent-[#252525]"
              />
            </div>
          </div>
        )}

        {/* Color & Opacity */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-[#777777]">Appearance</label>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded border border-[#E8E8E5] relative overflow-hidden shrink-0 shadow-subtle" style={{ backgroundColor: selectedElement.fill }}>
              <input 
                type="color" 
                value={selectedElement.fill}
                onChange={(e) => updateElement(selectedElement.id, { fill: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
              />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-[11px] text-[#777777]">
                <span>Opacity</span>
                <span className="font-mono tabular-nums">{Math.round((selectedElement.opacity ?? 1) * 100)}%</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.01"
                value={selectedElement.opacity ?? 1}
                onChange={(e) => updateElement(selectedElement.id, { opacity: parseFloat(e.target.value) })}
                className="w-full h-1 bg-[#E8E8E5] rounded appearance-none cursor-pointer accent-[#252525]"
              />
            </div>
          </div>
        </div>

        {/* Image Controls */}
        {selectedElement.type === 'image' && (
          <div className="space-y-4 pt-2 border-t border-[#E8E8E5]">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#777777]">Image Source</label>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setIsLibraryOpen(true)}
                leftIcon={<ImageIcon className="w-3.5 h-3.5" />}
              >
                Browse Image Library
              </Button>
            </div>

            {/* Position & Crop Adjusters */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#252525]">
                <Crop className="w-3.5 h-3.5 text-[#8B806F]" />
                <span>Crop Framing</span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-[#777777]">
                  <span>Offset X</span>
                  <span className="font-mono tabular-nums">{selectedElement.cropX ?? 0}px</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max={selectedElement.imageNaturalWidth ? Math.max(0, selectedElement.imageNaturalWidth - 50) : 2000}
                  value={selectedElement.cropX ?? 0}
                  onChange={(e) => updateElement(selectedElement.id, { cropX: parseInt(e.target.value) })}
                  className="w-full h-1 bg-[#E8E8E5] rounded appearance-none cursor-pointer accent-[#252525]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-[#777777]">
                  <span>Offset Y</span>
                  <span className="font-mono tabular-nums">{selectedElement.cropY ?? 0}px</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max={selectedElement.imageNaturalHeight ? Math.max(0, selectedElement.imageNaturalHeight - 50) : 2000}
                  value={selectedElement.cropY ?? 0}
                  onChange={(e) => updateElement(selectedElement.id, { cropY: parseInt(e.target.value) })}
                  className="w-full h-1 bg-[#E8E8E5] rounded appearance-none cursor-pointer accent-[#252525]"
                />
              </div>

              <button
                type="button"
                onClick={() => updateElement(selectedElement.id, {
                  cropX: 0,
                  cropY: 0,
                  cropWidth: selectedElement.imageNaturalWidth || selectedElement.width,
                  cropHeight: selectedElement.imageNaturalHeight || selectedElement.height,
                })}
                className="w-full py-1 text-[11px] text-[#777777] hover:text-[#252525] border border-[#E8E8E5] rounded hover:bg-[#FAF9F7] transition-colors"
              >
                Reset Crop
              </button>
            </div>
          </div>
        )}

        {/* Delete Element Button */}
        <div className="pt-4 border-t border-[#E8E8E5]">
          <Button
            variant="danger"
            size="sm"
            className="w-full !bg-red-50 !text-red-700 !border-red-200 border hover:!bg-red-100"
            onClick={() => deleteElement(selectedElement.id)}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete Element
          </Button>
        </div>
      </div>

      <ImageLibraryModal 
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
      />
    </aside>
  );
};
