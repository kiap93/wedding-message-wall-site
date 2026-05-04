import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Save, Trash2, Palette, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

  // Security check: Only allow staff (for now, admin email or demo account)
  const isStaff = user?.email === 'buildsiteasia@gmail.com' || user?.email?.includes('@eventframe.io');

  useEffect(() => {
    if (!isStaff && user) {
      navigate('/admin');
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
    try {
      await saveTemplate(editingTemplate as any);
      await loadTemplates();
      setEditingTemplate(null);
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Failed to save template. Check if the table "templates" exists in Supabase.');
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
              onClick={() => navigate('/admin')}
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
              variant: 'masonry',
              fontSerif: 'font-serif',
              fontSans: 'font-sans',
              colors: {
                background: 'bg-white',
                card: 'bg-gray-50',
                text: 'text-black',
                accent: 'text-blue-500',
                border: 'border-gray-200',
                headerText: 'text-black',
                subtleText: 'text-gray-500'
              },
              iconType: 'heart'
            })}
            className="flex items-center gap-2 px-8 py-4 bg-[#C5A059] text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl shadow-[#C5A059]/20"
          >
            <Plus className="w-4 h-4" />
            Develop New Aesthetic
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* List Section */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold uppercase tracking-widest opacity-40 mb-6">Active Presets</h2>
            <div className="grid grid-cols-1 gap-4">
              {templates.map(t => (
                <div key={t.id} className="group bg-white p-6 rounded-3xl border border-[#C5A059]/10 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${t.colors.background} ${t.colors.border} border`}>
                      <Sparkles className={`w-6 h-6 ${t.colors.accent}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{t.name}</h3>
                      <p className="text-xs opacity-50">{t.is_custom ? 'Custom Plugin' : 'Core Preset'} • {t.variant}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {t.is_custom && (
                      <>
                        <button 
                          onClick={() => setEditingTemplate(t)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-black transition-colors"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(t.id)}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Editor Section */}
          <AnimatePresence mode="wait">
            {editingTemplate ? (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white p-8 rounded-[2.5rem] border border-[#C5A059]/20 shadow-2xl sticky top-8"
              >
                <form onSubmit={handleSave} className="space-y-6">
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
                      <div className="col-span-2">
                        <label className="block text-[10px] opacity-40 mb-1">Card Background Class</label>
                        <input 
                          type="text"
                          value={editingTemplate.colors?.card}
                          onChange={e => setEditingTemplate({
                            ...editingTemplate, 
                            colors: { ...editingTemplate.colors!, card: e.target.value } 
                          })}
                          className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-xs"
                          placeholder="bg-white/80 backdrop-blur"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button 
                      type="button"
                      onClick={() => setEditingTemplate(null)}
                      className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSaving}
                      className="flex-[2] py-4 bg-[#2D2424] text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-black transition-all flex items-center justify-center gap-2"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Deploy Aesthetic Plugin
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center p-12 border-2 border-dashed border-[#C5A059]/20 rounded-[3rem] opacity-30">
                <Palette className="w-16 h-16 mb-4" />
                <p className="font-serif italic text-lg">Select a plugin to optimize or deploy a new aesthetic...</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
