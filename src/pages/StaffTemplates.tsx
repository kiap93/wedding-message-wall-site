import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Save, Trash2, Palette, ArrowLeft, Loader2, Sparkles, Code, Layout, Settings, Zap, Wand2 } from 'lucide-react';
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
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

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

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('wedding_session')}`
        },
        body: JSON.stringify({ 
          prompt: aiPrompt,
          existingContext: editingTemplate ? {
            html: editingTemplate.html,
            css: editingTemplate.css,
            card_html: editingTemplate.card_html
          } : null
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error || 'AI Generation failed');
      }

      const data = await response.json() as any;
      
      if (editingTemplate) {
        setEditingTemplate({
          ...editingTemplate,
          name: data.name,
          html: data.html,
          css: data.css,
          card_html: data.card_html,
          variant: 'custom'
        });
      }
      setShowAIModal(false);
      setAiPrompt('');
      setActiveTab('html');
    } catch (error: any) {
      console.error('AI Generation failed:', error);
      alert(`AI Generation failed: ${error.message}`);
    } finally {
      setIsGenerating(false);
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
              card_html: '<div class="p-8 bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 min-w-[350px] transform hover:scale-105 transition-transform duration-500">\n  <div class="flex items-center gap-4 mb-4">\n    <div class="w-12 h-12 bg-[#C5A059]/10 rounded-2xl flex items-center justify-center">\n      <span class="text-xl">✨</span>\n    </div>\n    <h3 class="text-xl font-serif text-gray-900">{{name}}</h3>\n  </div>\n  <p class="text-gray-600 italic text-base leading-relaxed">"{{message}}"</p>\n</div>',
              css: '.custom-display-wrapper {\n  position: relative;\n  width: 100%;\n  height: 100%;\n  overflow: hidden;\n  background: linear-gradient(to bottom, #fdfbf7, #fff);\n}\n\n#messages-container {\n  position: relative;\n  width: 100%;\n  height: 100%;\n  overflow: hidden;\n}\n\n.custom-card-wrapper {\n  position: absolute;\n  /* Each of the 3 cards gets its own distinct row (33% height each) */\n  top: calc(var(--index) * 30% + 5%);\n  left: 0%;\n  animation: danmuMove 20s linear infinite;\n  /* Wide stagger: 0s, 6s, 12s etc */\n  animation-delay: calc(var(--index) * -6s);\n  padding: 0 40px;\n  white-space: nowrap;\n  z-index: 10;\n  will-change: transform;\n}\n\n@keyframes danmuMove {\n  from { transform: translateX(100vw); }\n  to { transform: translateX(-150%); }\n}'
            })}
            className="flex items-center gap-2 px-8 py-4 bg-[#C5A059] text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl shadow-[#C5A059]/20"
          >
            <Plus className="w-4 h-4" />
            Deploy Aesthetic Plugin
          </button>
        </header>

        <div className="flex flex-col gap-12 min-h-[800px]">
          {/* List Section - Full width when no editing, narrow sidebar when editing */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold uppercase tracking-widest opacity-40 mb-6">Aesthetic Library</h2>
            <div className={`grid gap-4 transition-all duration-500 ${editingTemplate ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
              {templates.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => setEditingTemplate(t)}
                  className={`group p-6 rounded-[2rem] border transition-all cursor-pointer ${editingTemplate?.id === t.id ? 'bg-[#C5A059] text-white border-[#C5A059] shadow-xl' : 'bg-white border-[#C5A059]/10 hover:shadow-lg'}`}
                >
                  <div className="flex flex-col gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${editingTemplate?.id === t.id ? 'bg-white/20' : t.colors.background + ' ' + t.colors.border + ' border'}`}>
                      <Sparkles className={`w-6 h-6 ${editingTemplate?.id === t.id ? 'text-white' : t.colors.accent}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-base truncate">{t.name}</h3>
                      <p className={`text-[10px] uppercase tracking-wider opacity-60 ${editingTemplate?.id === t.id ? 'text-white/80' : ''}`}>{t.variant}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Editor Section */}
          <AnimatePresence mode="wait">
            {editingTemplate && (
              <motion.div 
                key={editingTemplate.id || 'new'}
                initial={{ opacity: 0, scale: 0.98, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 30 }}
                className="bg-white p-10 rounded-[3.5rem] border border-[#C5A059]/20 shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
                  <div className="flex gap-4 bg-gray-50 p-2 rounded-2xl shrink-0 w-full md:w-auto">
                    <button 
                      type="button"
                      onClick={() => setShowAIModal(true)}
                      className="flex-1 md:flex-none md:w-32 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all bg-indigo-500 text-white shadow-lg shadow-indigo-200 hover:scale-105 active:scale-95"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      AI Design
                    </button>
                    <button 
                      onClick={() => setActiveTab('settings')}
                      className={`flex-1 md:flex-none md:w-32 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-white text-[#C5A059] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Settings
                    </button>
                    <button 
                      onClick={() => setActiveTab('html')}
                      className={`flex-1 md:flex-none md:w-32 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'html' ? 'bg-white text-[#C5A059] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      Structure
                    </button>
                    <button 
                      onClick={() => setActiveTab('card')}
                      className={`flex-1 md:flex-none md:w-32 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'card' ? 'bg-white text-[#C5A059] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <Layout className="w-3.5 h-3.5" />
                      Card
                    </button>
                  </div>

                  <button 
                    type="button"
                    onClick={() => {
                      setPreviewRevision(prev => prev + 1);
                      setShowLivePreview(true);
                    }}
                    className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-[#C5A059]/10 text-[#C5A059] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#C5A059] hover:text-white transition-all border border-[#C5A059]/20 shadow-sm"
                  >
                    <Zap className="w-4 h-4" />
                    Launch Live Simulation
                  </button>
                </div>

                <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto pr-2 mb-10 min-h-[500px]">
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
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Live Preview Modal */}
      <AnimatePresence>
        {showLivePreview && editingTemplate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLivePreview(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full h-[90vh] max-w-7xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20"
            >
              <div className="p-6 border-b border-[#C5A059]/10 flex items-center justify-between bg-white relative z-10">
                <div className="flex items-center gap-3 font-serif">
                  <div className="p-2 bg-[#C5A059]/10 rounded-xl">
                    <Sparkles className="w-5 h-5 text-[#C5A059]" />
                  </div>
                  <div>
                    <h3 className="text-xl">Template Preview</h3>
                    <p className="text-[10px] font-bold font-sans uppercase tracking-[0.1em] text-gray-400">Live Simulation • {editingTemplate.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setPreviewRevision(prev => prev + 1)}
                    className="px-4 py-2 bg-[#C5A059]/10 text-[#C5A059] rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#C5A059] hover:text-white transition-all"
                  >
                    Refresh
                  </button>
                  <button 
                    onClick={() => setShowLivePreview(false)}
                    className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-2xl transition-all"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative bg-gray-100">
                <InternalTemplateView 
                  key={`preview-${editingTemplate.id || 'new'}-${previewRevision}`}
                  template={editingTemplate as WeddingTemplate} 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Assistant Modal */}
      <AnimatePresence>
        {showAIModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isGenerating && setShowAIModal(false)}
              className="absolute inset-0 bg-[#2D2424]/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden p-8 border border-indigo-100"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-serif text-[#2D2424]">AI Design Assistant</h3>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#C5A059]">Gemini 3 Flash Powered</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Describe your vision</label>
                  <textarea 
                    autoFocus
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Create a dreamy celestial theme with deep navy background, golden floating cards that glow, and elegant serif fonts..."
                    className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all min-h-[160px] resize-none"
                    disabled={isGenerating}
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowAIModal(false)}
                    disabled={isGenerating}
                    className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={generateWithAI}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-200 disabled:opacity-50 disabled:scale-100"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Design...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Generate Experience
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MOCK_MESSAGES = [
  { id: '1', name: 'John & Sarah', message: 'Wishing you a lifetime of love and happiness!', timestamp: new Date().toISOString() },
  { id: '2', name: 'Michael Brown', message: 'Congratulations! The ceremony was stunning.', timestamp: new Date().toISOString() },
  { id: '3', name: 'Emma Wilson', message: 'So happy for you both! Cheers to many years.', timestamp: new Date().toISOString() },
];

const MOCK_NAMES = ['Alex Johnson', 'Maria Garcia', 'James Wilson'];
const MOCK_TEXTS = [
  'Such a magical atmosphere tonight! ❤️',
  'Best wedding food I have ever had.',
  'Can we talk about how beautiful the bride looks? ✨',
];

function renderCard(cardHtml: string, msg: any, index: number) {
  const template = cardHtml || '<div class="p-6 bg-white rounded-3xl shadow-lg"><h3>{{name}}</h3><p>{{message}}</p></div>';
  return template
    .replace(/\{\{name\}\}/g, msg.name)
    .replace(/\{\{message\}\}/g, msg.message)
    .replace(/\{\{index\}\}/g, index.toString())
    .replace(/\{\{timestamp\}\}/g, new Date(msg.timestamp).toLocaleTimeString());
}

function InternalTemplateView({ template }: { template: WeddingTemplate, key?: React.Key }) {
  const [liveMessages] = useState([...MOCK_MESSAGES]);
  const isCustom = template.variant === 'custom';
  
  // Combine structure and cards into one single HTML string for the simulation
  const finalHtml = useMemo(() => {
    if (!isCustom) return '';
    
    const cardsHtml = liveMessages.map((msg, index) => {
      const cardInner = renderCard(template.card_html || '', msg, index);
      // Pre-calculate spacing variables for the AI to use pure CSS reliably
      const row = index % 5;
      const col = Math.floor(index / 5);
      return `<div class="custom-card-wrapper" style="--index: ${index}; --row: ${row}; --col: ${col}">${cardInner}</div>`;
    }).join('');
    
    let baseHtml = template.html || '';
    
    // Replace dynamic placeholders for the event preview
    baseHtml = baseHtml
      .replace(/\{\{bride\}\}/g, 'Sarah')
      .replace(/\{\{groom\}\}/g, 'Michael')
      .replace(/\{\{date\}\}/g, 'Oct 24, 2026');

    // Inject cards into #messages-container if it exists, otherwise append a container
    if (baseHtml.includes('id="messages-container"')) {
      return baseHtml.replace(/(id="messages-container"[^>]*>)/, `$1${cardsHtml}`);
    } else {
      return `${baseHtml}<div id="messages-container">${cardsHtml}</div>`;
    }
  }, [template.html, template.card_html, liveMessages, isCustom]);
  
  return (
    <div className={`w-full h-full overflow-hidden flex flex-col ${template.colors?.background || 'bg-white'}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        ${template.css || ''}
        .custom-card-wrapper {
          display: block !important;
          min-height: 10px;
        }
      ` }} />
      
      <div className="flex-1 relative overflow-hidden">
        {isCustom ? (
          <div className="w-full h-full relative">
            <div 
              id="template-root"
              className="w-full h-full" 
              dangerouslySetInnerHTML={{ __html: finalHtml }} 
            />
          </div>
        ) : (
          <div className="p-12 h-full overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {liveMessages.map((msg, index) => (
                template.card_html ? (
                  <div 
                    key={msg.id} 
                    className="contents"
                    dangerouslySetInnerHTML={{ __html: renderCard(template.card_html, msg, index) }} 
                  />
                ) : (
                  <div key={msg.id} className={`${template.colors?.card} p-8 rounded-3xl border ${template.colors?.border} shadow-sm`}>
                    <h3 className={`text-xl ${template.colors?.headerText} ${template.fontSerif} mb-2`}>{msg.name}</h3>
                    <p className={`${template.colors?.text} ${template.fontSans}`}>{msg.message}</p>
                    <p className={`mt-4 text-[10px] ${template.colors?.subtleText} uppercase tracking-widest`}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// CustomSimulator removed - combined logic into InternalTemplateView
