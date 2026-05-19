import React from 'react';
import { Trash2, ArrowUp, ArrowDown, MousePointer2 } from 'lucide-react';
import { useEditorStore } from '../store';
import { motion, AnimatePresence } from 'motion/react';

const FONTS = [
  'Inter', 'Playfair Display', 'Cormorant Garamond', 'Montserrat', 'Italiana', 'Parisienne', 'Great Vibes'
];

export const PropertiesPanel: React.FC = () => {
  const { elements, selectedId, updateElement, deleteElement, moveElementZ } = useEditorStore();
  const selectedElement = elements.find(el => el.id === selectedId);

  if (!selectedElement) {
    return (
      <aside className="w-80 bg-white border-l border-[#C5A059]/20 flex flex-col items-center justify-center p-12 text-center opacity-40">
        <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mb-4">
          <MousePointer2 className="w-6 h-6 text-gray-300" />
        </div>
        <h4 className="text-[10px] uppercase font-black tracking-widest text-[#2D2424]">Selection Tool</h4>
        <p className="text-[9px] mt-2 text-[#C5A059]">Click an element on the canvas to edit its properties</p>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-white border-l border-[#C5A059]/20 flex flex-col overflow-y-auto">
      <motion.div 
        key={selectedElement.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="p-6 space-y-8"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C5A059]">Design Properties</h3>
          <div className="flex gap-1">
            <button onClick={() => moveElementZ(selectedElement.id, 'up')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => moveElementZ(selectedElement.id, 'down')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Text Content */}
        {(selectedElement.type === 'text' || selectedElement.type === 'button') && (
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Content</label>
            <textarea 
              value={selectedElement.text}
              onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
              className="w-full p-4 border border-gray-100 rounded-2xl bg-gray-50 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-[#C5A059]/30"
            />
          </div>
        )}

        {/* Typography */}
        {(selectedElement.type === 'text' || selectedElement.type === 'button') && (
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Typography</label>
            <select 
              value={selectedElement.fontFamily}
              onChange={(e) => updateElement(selectedElement.id, { fontFamily: e.target.value })}
              className="w-full p-3 border border-gray-100 rounded-xl bg-gray-50 text-sm"
            >
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <div className="flex items-center gap-4 py-2">
              <input 
                type="range" min="8" max="200" 
                value={selectedElement.fontSize}
                onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) })}
                className="flex-1 h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#C5A059]"
              />
              <span className="text-[10px] font-black w-8">{selectedElement.fontSize}px</span>
            </div>
          </div>
        )}

        {/* Color */}
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Appearance</label>
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-2xl border border-gray-200 relative overflow-hidden shadow-sm" style={{ backgroundColor: selectedElement.fill }}>
              <input 
                type="color" 
                value={selectedElement.fill}
                onChange={(e) => updateElement(selectedElement.id, { fill: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
              />
            </div>
            <div className="flex-1 flex flex-col justify-center gap-1">
              <input 
                type="range" min="0" max="1" step="0.01"
                value={selectedElement.opacity ?? 1}
                onChange={(e) => updateElement(selectedElement.id, { opacity: parseFloat(e.target.value) })}
                className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#C5A059]"
              />
              <div className="flex justify-between text-[8px] font-black text-gray-400 uppercase tracking-widest">
                <span>Opacity</span>
                <span>{Math.round((selectedElement.opacity ?? 1) * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Image URL */}
        {selectedElement.type === 'image' && (
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Image Source</label>
            <input 
              type="text" 
              value={selectedElement.src}
              onChange={(e) => updateElement(selectedElement.id, { src: e.target.value })}
              className="w-full p-3 border border-gray-100 rounded-xl bg-gray-50 text-xs truncate"
            />
          </div>
        )}

        {/* Actions */}
        <div className="pt-8 border-t border-gray-100">
          <button 
            onClick={() => deleteElement(selectedElement.id)}
            className="w-full py-4 text-red-400 hover:text-red-500 font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 bg-red-50 rounded-2xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Delete Element
          </button>
        </div>
      </motion.div>
    </aside>
  );
};
