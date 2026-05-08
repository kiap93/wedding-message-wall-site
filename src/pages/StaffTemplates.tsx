import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Save, Trash2, Palette, ArrowLeft, Loader2, Sparkles, Code, Layout, Settings, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { fetchTemplates, saveTemplate, deleteTemplate } from '../lib/templates';
import { WeddingTemplate, TemplateColors } from '../types';
import { useUser } from '../lib/UserContext';

export default function StaffTemplates() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WeddingTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<WeddingTemplate> | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'html' | 'card'>('settings');
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);

  // Security check: Only allow staff (for now, admin email or demo account)
  const isStaff = user?.email === 'buildsiteasia@gmail.com' || user?.email?.includes('@eventframe.io');

  useEffect(() => {
    if (!isStaff && user) {
      navigate('/workspace');
      return;
    }
    loadTemplates();
  }, [user]);

  async function loadTemplates() {
    setIsLoading(true);
    const data = await fetchTemplates();
    setTemplates(data);
    setIsLoading(false);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate || !editingTemplate.name) return;
    
    setIsSaving(true);
    console.log('Attempting save as:', user?.email, 'isStaff:', isStaff);
    try {
      await saveTemplate(editingTemplate as any);
      await loadTemplates();
      setEditingTemplate(null);
    } catch (err: any) {
      console.error('Failed to save template:', err);
      // More descriptive error
      const msg = err.message || 'Unknown error';
      if (msg.includes('row-level security')) {
        alert('Security Policy Blocked: You may need to run the SQL script I provided in the chat to allow your email to manage templates.');
      } else if (msg.includes('column "font_sans"')) {
        alert('Database Outdated: The "font_sans" column is missing. Please run the provided SQL script to update your table schema.');
      } else {
        alert(`Failed to save template: ${msg}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this aesthetic plugin?')) return;
    try {
      await deleteTemplate(id);
      await loadTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCF0]">
        <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCF0] text-[#2D2424] p-8 md:p-16">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row items-center justify-between mb-16 gap-6">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/workspace')}
              className="p-3 rounded-full bg-white border border-[#C5A059]/30 text-[#C5A059] hover:bg-[#C5A059] hover:text-white transition-all shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-serif mb-2 tracking-tight flex items-center gap-3">
                <Palette className="w-8 h-8 text-[#C5A059]" />
                Aesthetic Plugins
              </h1>
              <p className="text-sm opacity-60 font-sans tracking-[0.2em] uppercase">Staff Engine: Create & Manage Experience Presets</p>
            </div>
          </div>
          
          <button 
            onClick={() => setEditingTemplate({
              name: '',
              description: '',
              variant: 'custom',
              fontSerif: 'font-serif',
              fontSans: 'font-sans',
              colors: {
                background: 'bg-[#F9FAFB]',
                card: 'bg-white',
                text: 'text-black',
                accent: 'text-[#C5A059]',
                border: 'border-gray-200',
                headerText: 'text-gray-900',
                subtleText: 'text-gray-500'
              },
              iconType: 'heart',
              html: '<div class="custom-display-wrapper">\n  <div id="messages-container"></div>\n</div>',
              card_html: '<div class="p-6 bg-white rounded-3xl shadow-lg border border-gray-100">\n  <h3 class="text-xl font-serif text-gray-900 mb-2">{{name}}</h3>\n  <p class="text-gray-600 italic">{{message}}</p>\n</div>',
              css: '.custom-display-wrapper {\n  position: relative;\n  width: 100%;\n  height: 100vh;\n  overflow: hidden;\n  background: #f9fafb;\n}\n\n#messages-container {\n  position: relative;\n  width: 100%;\n  height: 100%;\n}\n\n.custom-card-wrapper {\n  position: absolute;\n  right: -500px;\n  white-space: nowrap;\n  top: calc((var(--index) % 6) * 120px);\n  animation: danmuMove 15s linear infinite;\n  animation-delay: calc(var(--index) * -2s);\n}\n\n@keyframes danmuMove {\n  from { transform: translateX(0); }\n  to { transform: translateX(calc(-100vw - 700px)); }\n}'
            })}
            className="flex items-center gap-2 px-8 py-4 bg-[#C5A059] text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl shadow-[#C5A059]/20"
          >
            <Plus className="w-4 h-4" />
            Deploy Aesthetic Plugin
          </button>
        </header>

        <div className="flex flex-col lg:flex-row gap-12 min-h-[800px]">
          {/* List Section - Collapsible or small when editing */}
          <div className={`${editingTemplate ? 'lg:w-1/4' : 'w-full'} space-y-6 transition-all duration-500`}>
            <h2 className="text-xl font-bold uppercase tracking-widest opacity-40 mb-6">Active Presets</h2>
            <div className="grid grid-cols-1 gap-4 max-h-[700px] overflow-y-auto pr-2">
              {templates.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => setEditingTemplate(t)}
                  className={`group p-4 rounded-3xl border transition-all cursor-pointer ${editingTemplate?.id === t.id ? 'bg-[#C5A059] text-white border-[#C5A059]' : 'bg-white border-[#C5A059]/10 hover:shadow-md'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editingTemplate?.id === t.id ? 'bg-white/20' : t.colors.background + ' ' + t.colors.border + ' border'}`}>
                      <Sparkles className={`w-5 h-5 ${editingTemplate?.id === t.id ? 'text-white' : t.colors.accent}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{t.name}</h3>
                      <p className={`text-[10px] uppercase tracking-wider opacity-60 ${editingTemplate?.id === t.id ? 'text-white/80' : ''}`}>{t.variant}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Editor & Preview Section */}
          <AnimatePresence mode="wait">
            {editingTemplate ? (
              <motion.div 
                key={editingTemplate.id || 'new'}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="flex-1 flex flex-col lg:flex-row gap-8"
              >
                {/* Editor Panel */}
                <div className="flex-1 bg-white p-8 rounded-[2.5rem] border border-[#C5A059]/20 shadow-2xl overflow-hidden flex flex-col min-h-[800px]">
                  <div className="flex gap-4 mb-6 bg-gray-50 p-2 rounded-2xl shrink-0">
                    <button 
                      onClick={() => setActiveTab('settings')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-white text-[#C5A059] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Settings
                    </button>
                    <button 
                      onClick={() => setActiveTab('html')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'html' ? 'bg-white text-[#C5A059] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      Global Design
                    </button>
                    <button 
                      onClick={() => setActiveTab('card')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'card' ? 'bg-white text-[#C5A059] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <Layout className="w-3.5 h-3.5" />
                      Card Template
                    </button>
                  </div>

                  <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto pr-2 mb-6">
                      {activeTab === 'settings' && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Preset Name</label>
                              <input 
                                type="text"
                                required
                                value={editingTemplate.name || ''}
                                onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})}
                                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#C5A059] transition-all"
                                placeholder="e.g. Neo-Gothic Minimal"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Internal Description</label>
                              <textarea 
                                value={editingTemplate.description || ''}
                                onChange={e => setEditingTemplate({...editingTemplate, description: e.target.value})}
                                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#C5A059] transition-all resize-none"
                                rows={2}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Layout Engine</label>
                              <select 
                                value={editingTemplate.variant}
                                onChange={e => setEditingTemplate({...editingTemplate, variant: e.target.value as any})}
                                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#C5A059] transition-all"
                              >
                                <option value="masonry">Masonry Grid</option>
                                <option value="hanging">Hanging Polaroid</option>
                                <option value="floating">Floating Bubbles</option>
                                <option value="grid">Standard Grid</option>
                                <option value="custom">Custom HTML Engine</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Icon Set</label>
                              <select 
                                value={editingTemplate.iconType}
                                onChange={e => setEditingTemplate({...editingTemplate, iconType: e.target.value as any})}
                                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#C5A059] transition-all"
                              >
                                <option value="heart">Hearts</option>
                                <option value="leaf">Botanical</option>
                                <option value="star">Celestial</option>
                                <option value="camera">Photographic</option>
                                <option value="mail">Postal</option>
                                <option value="palette">Artistic</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#C5A059]">Color Palette (Tailwind Classes)</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] opacity-40 mb-1">Background Class</label>
                                <input 
                                  type="text"
                                  value={editingTemplate.colors?.background}
                                  onChange={e => setEditingTemplate({
                                    ...editingTemplate, 
                                    colors: { ...editingTemplate.colors!, background: e.target.value } 
                                  })}
                                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-xs"
                                  placeholder="bg-[#FFFFFF]"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] opacity-40 mb-1">Accent Text Class</label>
                                <input 
                                  type="text"
                                  value={editingTemplate.colors?.accent}
                                  onChange={e => setEditingTemplate({
                                    ...editingTemplate, 
                                    colors: { ...editingTemplate.colors!, accent: e.target.value } 
                                  })}
                                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-xs"
                                  placeholder="text-blue-500"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'html' && (
                        <div className="space-y-6 h-full flex flex-col">
                          <div className="flex-1 flex flex-col min-h-[300px]">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Global CSS</label>
                            <textarea
                              className="flex-1 p-4 bg-gray-50 font-mono text-xs border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#C5A059] transition-all resize-none"
                              value={editingTemplate.css || ''}
                              onChange={(e) => setEditingTemplate({...editingTemplate, css: e.target.value})}
                              placeholder="/* Custom CSS */"
                            />
                          </div>
                          <div className="flex-1 flex flex-col min-h-[300px]">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Global HTML Container</label>
                            <textarea
                              className="flex-1 p-4 bg-gray-50 font-mono text-xs border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#C5A059] transition-all resize-none"
                              value={editingTemplate.html || ''}
                              onChange={(e) => setEditingTemplate({...editingTemplate, html: e.target.value})}
                              placeholder="<div id='messages-container'></div>"
                            />
                          </div>
                        </div>
                      )}

                      {activeTab === 'card' && (
                        <div className="h-full flex flex-col">
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Card Template (HTML)</label>
                          <textarea
                            className="flex-1 p-4 bg-gray-50 font-mono text-xs border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#C5A059] transition-all resize-none min-h-[400px]"
                            value={editingTemplate.card_html || ''}
                            onChange={(e) => setEditingTemplate({...editingTemplate, card_html: e.target.value})}
                            placeholder="<div>{{name}}: {{message}}</div>"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4 pt-6 border-t border-gray-50 shrink-0">
                      <button 
                        type="button"
                        onClick={() => setEditingTemplate(null)}
                        className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={isSaving}
                        className="flex-1 py-4 bg-[#2D2424] text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#2D2424]/20"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Deploy Aesthetic Plugin
                      </button>
                    </div>
                  </form>
                </div>

                {/* Preview Panel - Fixed Side-by-Side */}
                <div className="flex-1 bg-white rounded-[2.5rem] border border-[#C5A059]/20 shadow-2xl overflow-hidden flex flex-col relative min-h-[800px]">
                  <div className="p-6 border-b border-[#C5A059]/10 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#C5A059]/10 rounded-xl">
                        <Sparkles className="w-4 h-4 text-[#C5A059]" />
                      </div>
                      <h3 className="text-lg font-serif">Live Simulation</h3>
                    </div>
                    <button 
                      onClick={() => setPreviewRevision(prev => prev + 1)}
                      className="px-4 py-2 bg-[#C5A059] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#B38D45] transition-all flex items-center gap-2 shadow-lg"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Live Preview
                    </button>
                  </div>
                  <div className="flex-1 relative bg-gray-50 overflow-hidden">
                    <InternalTemplateView 
                      key={`preview-${editingTemplate.id || 'new'}-${previewRevision}`}
                      template={editingTemplate as WeddingTemplate} 
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-[#C5A059]/20 rounded-[3rem] opacity-30">
                <Palette className="w-16 h-16 mb-4" />
                <p className="font-serif italic text-lg text-center">Select an existing preset to edit or create a new aesthetic plugin to begin building...</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}

const MOCK_MESSAGES = [
  { id: '1', name: 'John & Sarah', message: 'Wishing you a lifetime of love and happiness! Such a beautiful wedding.', timestamp: new Date().toISOString() },
  { id: '2', name: 'Michael Brown', message: 'Congratulations! The ceremony was absolutely stunning.', timestamp: new Date().toISOString() },
  { id: '3', name: 'Emma Wilson', message: 'So happy for you both! Cheers to many years of joy.', timestamp: new Date().toISOString() },
  { id: '4', name: 'David Smith', message: 'Amazing party! Thank you for letting us be part of your special day.', timestamp: new Date().toISOString() },
  { id: '5', name: 'Lisa & Tom', message: 'Best wishes for your new journey together!', timestamp: new Date().toISOString() },
  { id: '6', name: 'Grandma Betty', message: 'Beautiful couple. God bless you both.', timestamp: new Date().toISOString() },
];

function InternalTemplateView({ template }: { template: WeddingTemplate, key?: any }) {
  const isCustom = template.variant === 'custom';
  
  return (
    <div className={`w-full h-full overflow-y-auto ${template.colors?.background || 'bg-white'}`}>
      <style dangerouslySetInnerHTML={{ __html: template.css || '' }} />
      
      {isCustom ? (
        <CustomSimulator template={template} />
      ) : (
        <div className="p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {MOCK_MESSAGES.map(msg => (
              <div key={msg.id} className={`${template.colors?.card} p-8 rounded-3xl border ${template.colors?.border} shadow-sm`}>
                <h3 className={`text-xl ${template.colors?.headerText} ${template.fontSerif} mb-2`}>{msg.name}</h3>
                <p className={`${template.colors?.text} ${template.fontSans}`}>{msg.message}</p>
                <p className={`mt-4 text-[10px] ${template.colors?.subtleText} uppercase tracking-widest`}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomSimulator({ template }: { template: WeddingTemplate }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [messagesContainer, setMessagesContainer] = useState<Element | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Reset container if HTML changes
    setMessagesContainer(null);

    const findContainer = () => {
      const el = containerRef.current?.querySelector('#messages-container');
      if (el) {
        setMessagesContainer(el);
        return true;
      }
      return false;
    };

    // Immediate check
    if (!findContainer()) {
      const observer = new MutationObserver(() => {
        if (findContainer()) observer.disconnect();
      });
      observer.observe(containerRef.current, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, [template.html, template.id]);

  return (
    <div ref={containerRef} className="custom-layout-container w-full h-full min-h-screen">
      <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: template.html || '<div id="messages-container"></div>' }} />
      
      {messagesContainer && ReactDOM.createPortal(
        <div key={template.html} className="contents">
          {MOCK_MESSAGES.map((msg, index) => {
            const cardHtml = template.card_html || '<div><h3>{{name}}</h3><p>{{message}}</p></div>';
            const renderedHtml = cardHtml
              .replace(/\{\{name\}\}/g, msg.name)
              .replace(/\{\{message\}\}/g, msg.message)
              .replace(/\{\{index\}\}/g, index.toString())
              .replace(/\{\{timestamp\}\}/g, new Date(msg.timestamp).toLocaleTimeString());
              
            return (
              <div 
                key={msg.id} 
                className="custom-card-wrapper"
                style={{ '--index': index } as any}
                dangerouslySetInnerHTML={{ __html: renderedHtml }} 
              />
            );
          })}
        </div>,
        messagesContainer
      )}
    </div>
  );
}
