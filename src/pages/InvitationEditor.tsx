import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Text, Image, Rect, Transformer, Group } from 'react-konva';
import { 
  Type, 
  Image as ImageIcon, 
  Square, 
  MousePointer2, 
  Layers, 
  ChevronLeft, 
  Save, 
  Smartphone, 
  Monitor, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Settings2, 
  Layout, 
  Heart,
  Mail,
  MoreVertical,
  Minus
} from 'lucide-react';
import { SketchPicker } from 'react-color';
import { motion, AnimatePresence } from 'motion/react';
import { getSupabase } from '../lib/supabase';
import { WeddingEvent } from '../types';

// --- Types ---

interface CanvasElement {
  id: string;
  type: 'text' | 'image' | 'rect' | 'button';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  opacity?: number;
  src?: string;
  borderRadius?: number;
  textAlign?: 'left' | 'center' | 'right';
  zIndex: number;
}

const FONTS = [
  'Inter',
  'Playfair Display',
  'Cormorant Garamond',
  'Montserrat',
  'Italiana',
  'Parisienne',
  'Great Vibes'
];

export default function InvitationEditor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<WeddingEvent | null>(null);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  // --- Initial Load ---

  useEffect(() => {
    async function loadProject() {
      if (!projectId) return;
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (data) {
        setProject(data);
        if (data.invitation_config) {
          const config = typeof data.invitation_config === 'string' 
            ? JSON.parse(data.invitation_config) 
            : data.invitation_config;
          setElements(config.elements || []);
        } else {
          // Default initial elements
          setElements([
            {
              id: 'initial_header',
              type: 'text',
              x: 100,
              y: 100,
              width: 300,
              height: 50,
              rotation: 0,
              text: 'Save the Date',
              fontSize: 48,
              fontFamily: 'Playfair Display',
              fill: '#2D2424',
              zIndex: 0
            }
          ]);
        }
      }
    }
    loadProject();
  }, [projectId]);

  // --- Canvas Resizing ---

  const handleResize = useCallback(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setStageSize({ width: clientWidth, height: clientHeight });
    }
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // --- Element Management ---

  const addElement = (type: CanvasElement['type']) => {
    const newElement: CanvasElement = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: stageSize.width / 2 - 100,
      y: stageSize.height / 2 - 25,
      width: 200,
      height: 50,
      rotation: 0,
      zIndex: elements.length,
      ...(type === 'text' && {
        text: 'New Text',
        fontSize: 24,
        fontFamily: 'Inter',
        fill: '#2D2424'
      }),
      ...(type === 'rect' && {
        fill: '#C5A059',
        opacity: 0.2
      }),
      ...(type === 'image' && {
        src: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80',
        width: 200,
        height: 200
      }),
      ...(type === 'button' && {
        text: 'RSVP NOW',
        fill: '#C5A059',
        fontSize: 14,
        fontFamily: 'Inter',
        borderRadius: 8
      })
    };
    setElements([...elements, newElement]);
    setSelectedId(newElement.id);
  };

  const updateElement = (id: string, updates: Partial<CanvasElement>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const deleteElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id));
    setSelectedId(null);
  };

  const moveZ = (id: string, dir: 'up' | 'down') => {
    const idx = elements.findIndex(el => el.id === id);
    if (idx === -1) return;
    const newElements = [...elements];
    if (dir === 'up' && idx < elements.length - 1) {
      [newElements[idx], newElements[idx + 1]] = [newElements[idx + 1], newElements[idx]];
    } else if (dir === 'down' && idx > 0) {
      [newElements[idx], newElements[idx - 1]] = [newElements[idx - 1], newElements[idx]];
    }
    setElements(newElements);
  };

  // --- Transformer Selection ---

  useEffect(() => {
    if (selectedId && trRef.current) {
      const selectedNode = stageRef.current.findOne('#' + selectedId);
      if (selectedNode) {
        trRef.current.nodes([selectedNode]);
        trRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedId]);

  const handleSelect = (e: any) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  };

  const handleSave = async () => {
    if (!projectId) return;
    setIsSaving(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('projects')
        .update({
          invitation_config: JSON.stringify({ elements })
        })
        .eq('id', projectId);
      
      if (error) throw error;
      // Show success toast or notification
    } catch (err) {
      console.error('Error saving invitation:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  return (
    <div className="h-screen w-screen bg-[#FDFCF0] flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-white border-b border-[#C5A059]/20 flex items-center justify-between px-6 z-50 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-[#C5A059]/10 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#2D2424]" />
          </button>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-widest text-[#2D2424]">Invitation Designer</h1>
            <p className="text-[10px] text-[#C5A059] font-medium">{project?.groom_name} & {project?.bride_name}</p>
          </div>
        </div>

        <div className="flex items-center bg-gray-50 rounded-2xl p-1 gap-1 border border-gray-200 shadow-inner">
          <button 
            onClick={() => setPreviewMode('desktop')}
            className={`p-2 rounded-xl transition-all ${previewMode === 'desktop' ? 'bg-white shadow-sm text-[#C5A059]' : 'text-gray-400 opacity-60'}`}
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setPreviewMode('mobile')}
            className={`p-2 rounded-xl transition-all ${previewMode === 'mobile' ? 'bg-white shadow-sm text-[#C5A059]' : 'text-gray-400 opacity-60'}`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#2D2424] text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-lg shadow-[#2D2424]/20 disabled:opacity-50"
          >
            {isSaving ? <Save className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Design
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Components */}
        <aside className="w-72 bg-white border-r border-[#C5A059]/20 flex flex-col gap-6 p-6 overflow-y-auto z-40">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C5A059] mb-4">Elements</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: 'text', icon: Type, label: 'Text' },
                { type: 'image', icon: ImageIcon, label: 'Photo' },
                { type: 'rect', icon: Square, label: 'Shape' },
                { type: 'button', icon: Heart, label: 'RSVP' }
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => addElement(item.type as any)}
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
        </aside>

        {/* Central Canvas Area */}
        <main className="flex-1 relative bg-gray-100 overflow-hidden flex items-center justify-center p-8">
          <div 
            ref={containerRef}
            className={`bg-white shadow-2xl transition-all duration-500 relative ${
              previewMode === 'mobile' ? 'w-[375px] h-[667px]' : 'w-full h-full max-w-[800px] max-h-[1132px]'
            }`}
          >
            <Stage
              width={previewMode === 'mobile' ? 375 : stageSize.width}
              height={previewMode === 'mobile' ? 667 : stageSize.height}
              onMouseDown={handleSelect}
              onTouchStart={handleSelect}
              ref={stageRef}
              className="absolute inset-0"
            >
              <Layer>
                {elements.map((el) => (
                  <ElementRenderer
                    key={el.id}
                    element={el}
                    isSelected={el.id === selectedId}
                    onSelect={() => setSelectedId(el.id)}
                    onChange={(newAttrs) => updateElement(el.id, newAttrs)}
                  />
                ))}
                {selectedId && (
                  <Transformer
                    ref={trRef}
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < 5 || newBox.height < 5) return oldBox;
                      return newBox;
                    }}
                  />
                )}
              </Layer>
            </Stage>
          </div>
        </main>

        {/* Right Sidebar - Properties */}
        <aside className="w-80 bg-white border-l border-[#C5A059]/20 flex flex-col z-40">
           <AnimatePresence mode="wait">
             {selectedElement ? (
               <motion.div 
                 key={selectedElement.id}
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: 20 }}
                 className="flex-1 flex flex-col p-6 overflow-y-auto"
               >
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C5A059]">Design Properties</h3>
                    <div className="flex gap-1">
                       <button 
                         onClick={() => moveZ(selectedElement.id, 'up')}
                         className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                       >
                         <ArrowUp className="w-3.5 h-3.5" />
                       </button>
                       <button 
                         onClick={() => moveZ(selectedElement.id, 'down')}
                         className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                       >
                         <ArrowDown className="w-3.5 h-3.5" />
                       </button>
                    </div>
                 </div>

                 <div className="space-y-8">
                   {/* Text Specific */}
                   {(selectedElement.type === 'text' || selectedElement.type === 'button') && (
                     <>
                       <div className="space-y-3">
                         <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Content</label>
                         <textarea 
                           value={selectedElement.text}
                           onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                           className="w-full p-4 border border-gray-100 rounded-2xl bg-gray-50 text-sm focus:outline-none focus:ring-1 focus:ring-[#C5A059]/30 resize-none h-24"
                         />
                       </div>

                       <div className="space-y-3">
                         <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Typography</label>
                         <select 
                           value={selectedElement.fontFamily}
                           onChange={(e) => updateElement(selectedElement.id, { fontFamily: e.target.value })}
                           className="w-full p-3 border border-gray-100 rounded-xl bg-gray-50 text-sm focus:outline-none"
                         >
                           {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                         </select>
                         <div className="flex items-center gap-4">
                            <input 
                              type="range" 
                              min="8" 
                              max="120" 
                              value={selectedElement.fontSize}
                              onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) })}
                              className="flex-1 h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#C5A059]"
                            />
                            <span className="text-[10px] font-black">{selectedElement.fontSize}px</span>
                         </div>
                       </div>
                     </>
                   )}

                   {/* Color Picker */}
                   <div className="space-y-3">
                     <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Color & Opacity</label>
                     <div className="flex gap-4">
                        <div 
                          className="w-12 h-12 rounded-2xl border border-gray-200 cursor-pointer shadow-sm relative overflow-hidden"
                          style={{ backgroundColor: selectedElement.fill }}
                        >
                           <input 
                             type="color" 
                             value={selectedElement.fill}
                             onChange={(e) => updateElement(selectedElement.id, { fill: e.target.value })}
                             className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
                           />
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-2">
                           <input 
                              type="range" 
                              min="0" 
                              max="1" 
                              step="0.01"
                              value={selectedElement.opacity || 1}
                              onChange={(e) => updateElement(selectedElement.id, { opacity: parseFloat(e.target.value) })}
                              className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#C5A059]"
                            />
                            <div className="flex justify-between text-[8px] font-black text-gray-400 uppercase tracking-widest">
                               <span>Opacity</span>
                               <span>{Math.round((selectedElement.opacity || 1) * 100)}%</span>
                            </div>
                        </div>
                     </div>
                   </div>

                   {/* Shape/Image Specific */}
                   {selectedElement.type === 'image' && (
                     <div className="space-y-3">
                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Image URL</label>
                        <input 
                          type="text" 
                          value={selectedElement.src}
                          onChange={(e) => updateElement(selectedElement.id, { src: e.target.value })}
                          className="w-full p-3 border border-gray-100 rounded-xl bg-gray-50 text-xs truncate"
                        />
                     </div>
                   )}

                   {/* Actions */}
                   <div className="pt-8 border-t border-gray-50">
                      <button 
                        onClick={() => deleteElement(selectedElement.id)}
                        className="w-full py-4 text-red-400 hover:text-red-500 font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 bg-red-50 rounded-2xl transition-all"
                      >
                         <Trash2 className="w-4 h-4" />
                         Remove Element
                      </button>
                   </div>
                 </div>
               </motion.div>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
                  <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mb-4">
                     <MousePointer2 className="w-6 h-6 text-gray-300" />
                  </div>
                  <h4 className="text-[10px] uppercase font-black tracking-widest text-[#2D2424]">Selection Tool</h4>
                  <p className="text-[9px] mt-2 text-[#C5A059]">Click an element on the canvas to edit its properties</p>
               </div>
             )}
           </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}

// --- Internal Component for Element Rendering ---

function ElementRenderer({ element, isSelected, onSelect, onChange }: any) {
  const shapeRef = useRef<any>(null);
  const [image] = useImage(element.src || '');

  const handleDragEnd = (e: any) => {
    onChange({
      x: e.target.x(),
      y: e.target.y()
    });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    onChange({
      x: node.x(),
      y: node.y(),
      width: Math.max(5, node.width() * scaleX),
      height: Math.max(node.height() * scaleY),
      rotation: node.rotation()
    });
  };

  const commonProps = {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    draggable: true,
    ref: shapeRef,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
    opacity: element.opacity
  };

  if (element.type === 'text') {
    return (
      <Text
        {...commonProps}
        text={element.text}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fill={element.fill}
        align={element.textAlign}
      />
    );
  }

  if (element.type === 'rect') {
    return (
      <Rect
        {...commonProps}
        fill={element.fill}
      />
    );
  }

  if (element.type === 'image') {
    return (
      <Image
        {...commonProps}
        image={image}
      />
    );
  }

  if (element.type === 'button') {
    return (
      <Group {...commonProps}>
        <Rect
          width={element.width}
          height={element.height}
          fill={element.fill}
          cornerRadius={element.borderRadius || 0}
        />
        <Text
          width={element.width}
          height={element.height}
          text={element.text}
          fontSize={element.fontSize}
          fontFamily={element.fontFamily}
          fill="#FFFFFF"
          align="center"
          verticalAlign="middle"
        />
      </Group>
    );
  }

  return null;
}

// Helper hook for loading images
function useImage(url: string): [HTMLImageElement | undefined, 'loading' | 'loaded' | 'failed'] {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');

  useEffect(() => {
    if (!url) return;
    const img = new window.Image();
    img.src = url;
    img.onload = () => {
      setImage(img);
      setStatus('loaded');
    };
    img.onerror = () => setStatus('failed');
  }, [url]);

  return [image, status];
}
