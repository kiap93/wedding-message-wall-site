import React, { useState } from 'react';
import { 
  Type, 
  Image as ImageIcon, 
  Square, 
  Heart, 
  Sparkles, 
  Layers, 
  Settings, 
  Search, 
  Grid2X2
} from 'lucide-react';
import { useEditorStore } from '../store';

// Define the Material Design Library items
interface MaterialItem {
  id: string;
  name: string;
  category: 'botanicals' | 'frames' | 'borders' | 'badges';
  thumbnailUrl: string;
  // Options to send to addElement
  type: 'text' | 'image' | 'rect' | 'button';
  width: number;
  height: number;
  // Specific styling options
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  opacity?: number;
  src?: string;
  borderRadius?: number;
}

const PREMIUM_MATERIALS: MaterialItem[] = [
  // Botanicals
  {
    id: 'mat-bot-1',
    name: 'Eucalyptus Branch',
    category: 'botanicals',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=200',
    type: 'image',
    width: 200,
    height: 200,
    src: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=500',
  },
  {
    id: 'mat-bot-2',
    name: 'Ivory Rose Bouquet',
    category: 'botanicals',
    thumbnailUrl: 'https://images.unsplash.com/photo-1546842931-886c185b4c8c?auto=format&fit=crop&q=80&w=200',
    type: 'image',
    width: 180,
    height: 180,
    src: 'https://images.unsplash.com/photo-1546842931-886c185b4c8c?auto=format&fit=crop&q=80&w=500',
  },
  {
    id: 'mat-bot-3',
    name: 'Golden Monogram Leaves',
    category: 'botanicals',
    thumbnailUrl: 'https://images.unsplash.com/photo-1549417229-aa67d3263c09?auto=format&fit=crop&q=80&w=200',
    type: 'image',
    width: 220,
    height: 220,
    src: 'https://images.unsplash.com/photo-1549417229-aa67d3263c09?auto=format&fit=crop&q=80&w=500',
  },
  {
    id: 'mat-bot-4',
    name: 'Luxury Watercolor Bloom',
    category: 'botanicals',
    thumbnailUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&q=80&w=200',
    type: 'image',
    width: 180,
    height: 180,
    src: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&q=80&w=500',
  },
  {
    id: 'mat-bot-5',
    name: 'Bohemian Pampas Stem',
    category: 'botanicals',
    thumbnailUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=200',
    type: 'image',
    width: 160,
    height: 240,
    src: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=500',
  },
  {
    id: 'mat-bot-6',
    name: 'Golden Palm Detail',
    category: 'botanicals',
    thumbnailUrl: 'https://images.unsplash.com/photo-1512408869874-02e1b80461f7?auto=format&fit=crop&q=80&w=200',
    type: 'image',
    width: 170,
    height: 220,
    src: 'https://images.unsplash.com/photo-1512408869874-02e1b80461f7?auto=format&fit=crop&q=80&w=500',
  },

  // Frames & Arches
  {
    id: 'mat-frm-1',
    name: 'Elegance Archway Frame',
    category: 'frames',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005198143-e5283b519a7f?auto=format&fit=crop&q=80&w=200',
    type: 'image',
    width: 240,
    height: 320,
    src: 'https://images.unsplash.com/photo-1618005198143-e5283b519a7f?auto=format&fit=crop&q=80&w=500',
  },
  {
    id: 'mat-frm-2',
    name: 'Luxury Poly Wireframe',
    category: 'frames',
    thumbnailUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&q=80&w=200',
    type: 'image',
    width: 210,
    height: 210,
    src: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&q=80&w=500',
  },
  {
    id: 'mat-frm-3',
    name: 'Rustic Linen Canvas Card',
    category: 'frames',
    thumbnailUrl: 'https://images.unsplash.com/photo-1595122245592-3c35599c278e?auto=format&fit=crop&q=80&w=200',
    type: 'image',
    width: 280,
    height: 380,
    src: 'https://images.unsplash.com/photo-1595122245592-3c35599c278e?auto=format&fit=crop&q=80&w=600',
  },
  {
    id: 'mat-frm-4',
    name: 'Minimal Canvas Arch',
    category: 'frames',
    thumbnailUrl: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80&w=200',
    type: 'rect',
    width: 300,
    height: 420,
    fill: '#FAF8F3',
    borderRadius: 140,
    opacity: 0.9,
  },

  // Borders & Dividers
  {
    id: 'mat-bor-1',
    name: 'Classic Fine Golden Stroke',
    category: 'borders',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&q=80&w=200',
    type: 'rect',
    width: 280,
    height: 2,
    fill: '#C5A059',
    opacity: 0.5,
  },
  {
    id: 'mat-bor-2',
    name: 'Symmetrical Diamond Dots',
    category: 'borders',
    thumbnailUrl: 'https://images.unsplash.com/photo-1579783928621-7a13d66a62d1?auto=format&fit=crop&q=80&w=200',
    type: 'text',
    text: '•  ◇  •  ◇  •  ◇  •  ◇  •',
    width: 260,
    height: 30,
    fontFamily: 'Playfair Display',
    fontSize: 18,
    fill: '#C5A059',
  },
  {
    id: 'mat-bor-3',
    name: 'Luxury Dot-Row Divider',
    category: 'borders',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=200',
    type: 'text',
    text: '•   •   •   ⚜   •   •   •',
    width: 260,
    height: 30,
    fontFamily: 'Playfair Display',
    fontSize: 16,
    fill: '#C5A059',
  },

  // Badges & Seals
  {
    id: 'mat-bdg-1',
    name: 'Gold Wedding Wax Seal',
    category: 'badges',
    thumbnailUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=200',
    type: 'image',
    width: 110,
    height: 110,
    src: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'mat-bdg-2',
    name: 'Classic RSVP Circle Crest',
    category: 'badges',
    thumbnailUrl: 'https://images.unsplash.com/photo-1607513546191-20f854b47c09?auto=format&fit=crop&q=80&w=200',
    type: 'button',
    text: 'RSVP NOW ⚜',
    width: 160,
    height: 160,
    fill: '#2D2424',
    fontFamily: 'Playfair Display',
    fontSize: 15,
    borderRadius: 80,
  },
  {
    id: 'mat-bdg-3',
    name: 'Golden Calligraphy Welcome',
    category: 'badges',
    thumbnailUrl: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?auto=format&fit=crop&q=80&w=200',
    type: 'text',
    text: 'Together with families',
    width: 280,
    height: 50,
    fontFamily: 'Playfair Display',
    fontSize: 22,
    fill: '#C5A059',
  }
];

const BASIC_ELEMENT_TYPES = [
  { type: 'text', icon: Type, label: 'Text Box' },
  { type: 'image', icon: ImageIcon, label: 'Photo' },
  { type: 'rect', icon: Square, label: 'Shape' },
  { type: 'button', icon: Heart, label: 'RSVP' }
] as const;

export const Sidebar: React.FC = () => {
  const { 
    addElement, 
    canvasHeight, 
    canvasWidth,
    setCanvasHeight,
    scale,
    pan,
    viewportWidth,
    viewportHeight
  } = useEditorStore();

  const [activeTab, setActiveTab] = useState<'materials' | 'basic' | 'layout'>('materials');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'botanicals' | 'frames' | 'borders' | 'badges'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate coordinates dynamic focus center
  const getSpawnCoords = (width: number, height: number) => {
    const screenCenterX = viewportWidth / 2;
    const screenCenterY = viewportHeight / 2;

    const canvasCenterX = (screenCenterX - pan.x) / scale;
    const canvasCenterY = (screenCenterY - pan.y) / scale;

    let targetX = canvasCenterX - width / 2;
    let targetY = canvasCenterY - height / 2;

    targetX = Math.max(10, Math.min(canvasWidth - width - 10, targetX));
    targetY = Math.max(10, Math.min(canvasHeight - height - 10, targetY));

    if (isNaN(targetX) || isNaN(targetY)) {
      return { x: canvasWidth / 2 - width / 2, y: canvasHeight / 2 - height / 2 };
    }

    return { x: targetX, y: targetY };
  };

  const handleAddBasic = (type: typeof BASIC_ELEMENT_TYPES[number]['type']) => {
    const itemWidth = 200;
    const itemHeight = type === 'image' ? 200 : 100;
    const coords = getSpawnCoords(itemWidth, itemHeight);

    addElement({
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: coords.x,
      y: coords.y,
      width: itemWidth,
      height: itemHeight,
      rotation: 0,
      zIndex: 0,
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

  const handleAddMaterial = (item: MaterialItem) => {
    const coords = getSpawnCoords(item.width, item.height);

    addElement({
      id: Math.random().toString(36).substr(2, 9),
      type: item.type,
      x: coords.x,
      y: coords.y,
      width: item.width,
      height: item.height,
      rotation: 0,
      zIndex: 0,
      ...(item.type === 'text' && {
        text: item.text || 'Material Text',
        fontSize: item.fontSize || 32,
        fontFamily: item.fontFamily || 'Playfair Display',
        fill: item.fill || '#2D2424',
      }),
      ...(item.type === 'rect' && {
        fill: item.fill || '#C5A059',
        opacity: item.opacity || 0.3,
        borderRadius: item.borderRadius || 0,
      }),
      ...(item.type === 'image' && {
        src: item.src || item.thumbnailUrl,
      }),
      ...(item.type === 'button' && {
        text: item.text || 'Submit',
        fill: item.fill || '#C5A059',
        fontSize: item.fontSize || 16,
        fontFamily: item.fontFamily || 'Inter',
        borderRadius: item.borderRadius || 8,
      }),
    });
  };

  // Filter materials based on search query and category
  const filteredMaterials = PREMIUM_MATERIALS.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <aside className="w-80 bg-white border-r border-[#C5A059]/20 flex flex-col h-full overflow-hidden select-none">
      {/* Premium Tab Bar Selector */}
      <div className="flex border-b border-[#C5A059]/10 bg-gray-50/50 p-2 gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('materials')}
          className={`flex-1 py-2.5 px-3 rounded-xl flex flex-col items-center gap-1 transition-all text-center ${
            activeTab === 'materials'
              ? 'bg-white shadow-sm border border-[#C5A059]/30 text-[#2D2424] font-black'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'
          }`}
        >
          <Sparkles className={`w-4 h-4 ${activeTab === 'materials' ? 'text-[#C5A059]' : 'text-gray-400'}`} />
          <span className="text-[9px] uppercase tracking-widest font-bold">Materials</span>
        </button>

        <button
          onClick={() => setActiveTab('basic')}
          className={`flex-1 py-2.5 px-3 rounded-xl flex flex-col items-center gap-1 transition-all text-center ${
            activeTab === 'basic'
              ? 'bg-white shadow-sm border border-[#C5A059]/30 text-[#2D2424] font-black'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'
          }`}
        >
          <Layers className={`w-4 h-4 ${activeTab === 'basic' ? 'text-[#C5A059]' : 'text-gray-400'}`} />
          <span className="text-[9px] uppercase tracking-widest font-bold">Basic</span>
        </button>

        <button
          onClick={() => setActiveTab('layout')}
          className={`flex-1 py-2.5 px-3 rounded-xl flex flex-col items-center gap-1 transition-all text-center ${
            activeTab === 'layout'
              ? 'bg-white shadow-sm border border-[#C5A059]/30 text-[#2D2424] font-black'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'
          }`}
        >
          <Settings className={`w-4 h-4 ${activeTab === 'layout' ? 'text-[#C5A059]' : 'text-gray-400'}`} />
          <span className="text-[9px] uppercase tracking-widest font-bold">Canvas</span>
        </button>
      </div>

      {/* Main Tab View Contents */}
      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin flex flex-col gap-5">
        
        {/* TAB 1: PREMIUM PRESET MATERIALS */}
        {activeTab === 'materials' && (
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search designer materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] transition-all bg-gray-50/50"
              />
            </div>

            {/* Elegant Horizontal Category Pill Selectors */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 shrink-0 -mx-1 px-1 scrollbar-none">
              {(['all', 'botanicals', 'frames', 'borders', 'badges'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-[#C5A059] border-[#C5A059] text-white'
                      : 'bg-white border-gray-100 text-gray-400 hover:border-[#C5A059]/30 hover:text-gray-600'
                  }`}
                >
                  {cat === 'all' && '✨ All'}
                  {cat === 'botanicals' && '🌸 Florals'}
                  {cat === 'frames' && '🖼️ Frames'}
                  {cat === 'borders' && '⚜️ Lines'}
                  {cat === 'badges' && '📜 Seals'}
                </button>
              ))}
            </div>

            {/* Materials Grid */}
            {filteredMaterials.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-100 rounded-2xl">
                <p className="text-xs text-gray-400 font-serif italic">No designer items found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5">
                {filteredMaterials.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleAddMaterial(item)}
                    className="group border border-gray-100 rounded-xl overflow-hidden hover:border-[#C5A059]/30 hover:shadow-md hover:-translate-y-0.5 transition-all text-left bg-gradient-to-br from-white to-gray-50/20"
                  >
                    <div className="aspect-square bg-white relative flex items-center justify-center p-2.5 overflow-hidden border-b border-gray-50">
                      {item.type === 'image' ? (
                        <img 
                          src={item.thumbnailUrl} 
                          alt={item.name} 
                          className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                          referrerPolicy="no-referrer"
                        />
                      ) : item.type === 'rect' ? (
                        <div 
                          className="w-14 h-20 border border-[#C5A059]/40 bg-[#C5A059]/5 flex items-center justify-center transition-all group-hover:bg-[#C5A059]/10 rounded"
                          style={{ borderRadius: item.borderRadius ? `${item.borderRadius / 6}px` : '4px' }}
                        >
                          <Grid2X2 className="w-3.5 h-3.5 text-[#C5A059]/50" />
                        </div>
                      ) : item.type === 'text' ? (
                        <div className="text-center font-serif text-[11px] text-[#C5A059] tracking-wider px-1">
                          {item.text && item.text.length > 25 ? item.text.slice(0, 25) + '...' : item.text}
                        </div>
                      ) : (
                        <div className="px-3 py-1 bg-[#2D2424] text-[#C5A059] text-[9px] rounded-full uppercase tracking-widest font-bold">
                          {item.text}
                        </div>
                      )}
                      
                      {/* Interactive Add Indicator */}
                      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="bg-white/95 px-2 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase text-[#2D2424] shadow-sm flex items-center gap-1 scale-90 group-hover:scale-100 transition-transform">
                          Add Material
                        </span>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-[10px] font-bold text-gray-700 truncate">{item.name}</p>
                      <p className="text-[8px] uppercase tracking-wider text-gray-400 mt-0.5">{item.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RAW BASIC LAYERS */}
        {activeTab === 'basic' && (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C5A059] mb-4">Core Blank Elements</h3>
              <div className="grid grid-cols-2 gap-3.5">
                {BASIC_ELEMENT_TYPES.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => handleAddBasic(item.type)}
                    className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col items-center gap-2.5 hover:bg-white hover:border-[#C5A059]/30 hover:shadow-md transition-all group"
                  >
                    <item.icon className="w-5 h-5 text-gray-400 group-hover:text-[#C5A059] transition-colors" />
                    <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 group-hover:text-[#2D2424]">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C5A059] mb-4">Preset Layout Styles</h3>
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
          </div>
        )}

        {/* TAB 3: CANVAS SIZE CONFIGURATION */}
        {activeTab === 'layout' && (
          <div className="flex flex-col gap-5 pt-2">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C5A059] mb-4">Page Dimensity</h3>
              <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[9px] uppercase font-bold text-gray-400">Total Page Height</label>
                    <span className="text-xs font-mono font-bold text-[#C5A059]">{canvasHeight}px</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range"
                      min="500"
                      max="20000"
                      step="100"
                      value={canvasHeight}
                      onChange={(e) => setCanvasHeight(parseInt(e.target.value))}
                      className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#C5A059]"
                    />
                  </div>
                  <p className="text-[8px] text-gray-300 italic mt-1">*Max height size allows up to 20,000px scrolls for rich multi-sections layout.</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-50 pt-4 flex flex-col gap-2">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C5A059]">Layout Guidelines</h3>
               <p className="text-[10px] text-gray-400 leading-relaxed">
                 You can hold <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-mono">Spacebar</kbd> and drag any part of the background to pan & adjust your view once you zoom in or adjust cards. Use <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-mono">Ctrl / Cmd + Wheel</kbd> to zoom in/out of the frame canvas easily.
               </p>
            </div>
          </div>
        )}

      </div>
    </aside>
  );
};
