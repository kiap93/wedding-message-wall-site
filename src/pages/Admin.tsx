import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Save, LogOut, Layout, Heart, ArrowRight } from 'lucide-react';
import { TEMPLATES, TemplateId } from '../types';
import { API_BASE } from '../lib/config';

export default function Admin() {
  const [groomName, setGroomName] = useState(localStorage.getItem('groomName') || 'Alex');
  const [brideName, setBrideName] = useState(localStorage.getItem('brideName') || 'Sam');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>((localStorage.getItem('selectedTemplate') as TemplateId) || 'minimal_luxury');
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
        }
      });
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    // For now, persist to localStorage for immediate effect across pages
    localStorage.setItem('groomName', groomName);
    localStorage.setItem('brideName', brideName);
    localStorage.setItem('selectedTemplate', selectedTemplate);
    
    setTimeout(() => {
      setIsSaving(false);
    }, 1000);
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#FDFCF0] font-sans text-[#2D2424]">
      {/* Sidebar / Header */}
      <nav className="bg-white border-b border-[#C5A059]/20 px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#C5A059]/10 rounded-xl">
            <Heart className="w-6 h-6 text-[#C5A059]" />
          </div>
          <h1 className="font-serif text-2xl">Wedding Admin</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden md:block">{user?.email}</span>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-wider"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Settings */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white p-8 rounded-[2rem] shadow-xl border border-[#C5A059]/10">
            <h2 className="text-xl font-serif mb-6 flex items-center gap-2">
              <Layout className="w-5 h-5 text-[#C5A059]" />
              Project Settings
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2 block ml-1">Groom's Name</label>
                <input 
                  type="text" 
                  value={groomName}
                  onChange={(e) => setGroomName(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2 block ml-1">Bride's Name</label>
                <input 
                  type="text" 
                  value={brideName}
                  onChange={(e) => setBrideName(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                />
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full mt-10 bg-[#C5A059] text-white py-4 rounded-2xl font-bold uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#B38D45] transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {isSaving ? 'Updating...' : 'Save Settings'}
              <Save className="w-5 h-5" />
            </button>
          </section>

          <section className="bg-[#2D2424] p-8 rounded-[2rem] text-white">
            <h3 className="font-serif text-lg mb-2">Live Preview</h3>
            <p className="text-white/60 text-sm mb-6">Open these links to see your celebration in person.</p>
            <div className="space-y-4">
              <button 
                onClick={() => window.open(`/display?template=${selectedTemplate}&groom=${groomName}&bride=${brideName}`, '_blank')}
                className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-xl flex items-center justify-between transition-colors text-sm"
              >
                <span>Wedding Wall Display</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => window.open(`/guest?template=${selectedTemplate}&groom=${groomName}&bride=${brideName}`, '_blank')}
                className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-xl flex items-center justify-between transition-colors text-sm"
              >
                <span>Guest Message Page</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Theme Selection */}
        <div className="lg:col-span-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-serif">Pick Your Theme</h2>
            <span className="text-sm text-gray-500">{TEMPLATES.length} Designs Available</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {TEMPLATES.map((t) => (
              <button 
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`relative overflow-hidden rounded-3xl border-2 transition-all group text-left
                  ${selectedTemplate === t.id ? 'border-[#C5A059] shadow-2xl p-1' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-[1.02]'}
                `}
              >
                <div className={`${t.colors.background} ${t.colors.text} p-6 rounded-[calc(1.5rem-4px)] min-h-[220px] flex flex-col justify-between`}>
                  <div>
                    <div className={`w-8 h-8 rounded-lg ${t.colors.accent} bg-opacity-10 mb-4 flex items-center justify-center`}>
                      <Heart className="w-4 h-4 fill-current opacity-20" />
                    </div>
                    <h4 className={`text-xl font-bold mb-1 ${t.colors.headerText}`}>{t.name}</h4>
                    <p className="text-xs opacity-60 leading-relaxed line-clamp-2">{t.description}</p>
                  </div>
                  
                  <div className="flex gap-1.5 mt-4">
                    <div className={`w-3 h-3 rounded-full ${t.colors.accent.replace('text-', 'bg-') || 'bg-[#C5A059]'}`} />
                    <div className={`w-3 h-3 rounded-full ${t.colors.border.replace('border-', 'bg-') || 'bg-gray-200'} opacity-50`} />
                    <div className={`w-3 h-3 rounded-full ${t.colors.background.replace('bg-', 'bg-') || 'bg-white'} border border-gray-100`} />
                  </div>
                </div>

                {selectedTemplate === t.id && (
                  <div className="absolute top-4 right-4 bg-[#C5A059] text-white p-1 rounded-full shadow-lg">
                    <Save className="w-3 h-3" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
