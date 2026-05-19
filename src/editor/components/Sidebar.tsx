import React from 'react';
import { Type, Image as ImageIcon, Square, Heart, MousePointer2 } from 'lucide-react';
import { useEditorStore } from '../store';
import { WORLD_WIDTH } from '../utils/coordinates';

const ELEMENT_TYPES = [
  { type: 'text', icon: Type, label: 'Text' },
  { type: 'image', icon: ImageIcon, label: 'Photo' },
  { type: 'rect', icon: Square, label: 'Shape' },
  { type: 'button', icon: Heart, label: 'RSVP' }
] as const;

import { Settings } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { addElement, canvasHeight, setCanvasHeight } = useEditorStore();

  const handleAdd = (type: typeof ELEMENT_TYPES[number]['type']) => {
    addElement({
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: WORLD_WIDTH / 2 - 100,
      y: canvasHeight / 2 - 50,
      width: 200,
      height: type === 'image' ? 200 : 100,
      rotation: 0,
      zIndex: 0, // Store handles this
      ...(type === 'text' && {
        text: 'Save the Date',
        fontSize: 40,
        fontFamily: 'Playfair Display',
        fill: '#2D2424',
      }),
      ...(type === 'rect' && {
        fill: '#C5A059',
        opacity: 0.2,
      }),
      ...(type === 'image' && {
        src: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80',
      }),
      ...(type === 'button' && {
        text: 'RSVP NOW',
        fill: '#C5A059',
        fontSize: 18,
        fontFamily: 'Inter',
        borderRadius: 8,
      }),
    });
  };

  return (
    <aside className="w-72 bg-white border-r border-[#C5A059]/20 flex flex-col gap-6 p-6 overflow-y-auto">
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C5A059] mb-4">Elements</h3>
        <div className="grid grid-cols-2 gap-3">
          {ELEMENT_TYPES.map((item) => (
            <button
              key={item.type}
              onClick={() => handleAdd(item.type)}
              className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-white hover:border-[#C5A059]/30 hover:shadow-md transition-all group"
            >
              <item.icon className="w-5 h-5 text-gray-400 group-hover:text-[#C5A059]" />
              <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 group-hover:text-[#2D2424]">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
         <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C5A059] mb-4">Presets</h3>
         <div className="space-y-3">
           <button className="w-full p-4 border border-[#C5A059]/10 rounded-2xl text-left hover:border-[#C5A059]/30 transition-all bg-gradient-to-br from-[#FDFCF0] to-white">
             <p className="font-serif italic text-lg text-[#2D2424]">Romantic Script</p>
             <p className="text-[9px] uppercase tracking-widest text-[#C5A059] mt-1">Wedding Header</p>
           </button>
           <button className="w-full p-4 border border-[#C5A059]/10 rounded-2xl text-left hover:border-[#C5A059]/30 transition-all bg-white">
             <p className="font-sans font-bold text-lg text-[#2D2424]">MINIMAL BOLD</p>
             <p className="text-[9px] uppercase tracking-widest text-[#C5A059] mt-1">Modern Invitation</p>
           </button>
         </div>
      </div>

      <div className="mt-auto pt-8 border-t border-gray-50 flex flex-col gap-4">
         <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-[#C5A059]" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C5A059]">Page Layout</h3>
         </div>
         <div className="space-y-4">
            <div className="flex flex-col gap-2">
               <label className="text-[9px] uppercase font-bold text-gray-400">Page Height (px)</label>
               <div className="flex items-center gap-4">
                  <input 
                    type="range"
                    min="500"
                    max="20000"
                    step="100"
                    value={canvasHeight}
                    onChange={(e) => setCanvasHeight(parseInt(e.target.value))}
                    className="flex-1 h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#C5A059]"
                  />
                  <input 
                    type="number"
                    value={canvasHeight}
                    onChange={(e) => setCanvasHeight(parseInt(e.target.value))}
                    className="w-16 p-1 text-center border border-gray-100 rounded text-xs focus:outline-none"
                  />
               </div>
               <p className="text-[8px] text-gray-300 italic">*Max height 20,000px for long scrolls</p>
            </div>
         </div>
      </div>
    </aside>
  );
};
