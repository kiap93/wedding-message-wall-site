import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Save, 
  LogOut, 
  Layout, 
  Heart, 
  ArrowRight, 
  Plus, 
  ArrowLeft, 
  Settings, 
  Trash2,
  ExternalLink,
  Calendar,
  MapPin
} from 'lucide-react';
import { Project, TEMPLATES, TemplateId } from '../types';
import { API_BASE } from '../lib/config';
import { authenticatedFetch, removeAuthToken } from '../lib/auth';
import { getSupabase } from '../lib/supabase';

export default function Admin() {
  // Navigation & Auth
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'list' | 'editor'>('list');
  const navigate = useNavigate();

  // Project List
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Current Editor State
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchUserAndProjects();
  }, []);

  const fetchUserAndProjects = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/auth/me`);
      const data = await res.json();
      
      if (data.user) {
        setUser(data.user);
        await fetchProjects(data.user.sub);
      } else {
        navigate('/login');
      }
    } catch (error) {
      console.error('Auth error:', error);
      navigate('/login');
    }
  };

  const fetchProjects = async (userId: string) => {
    setIsLoadingProjects(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
    } else {
      setProjects(data || []);
    }
    setIsLoadingProjects(false);
  };

  const handleCreateNew = () => {
    const newProject: Partial<Project> = {
      name: 'New Journey',
      groom_name: 'Groom',
      bride_name: 'Bride',
      wedding_date: new Date().toISOString().split('T')[0],
      location: 'Venue Name',
      theme_id: 'minimal_luxury',
      user_id: user.sub
    };
    setEditingProject(newProject);
    setView('editor');
  };

  const handleEdit = (project: Project) => {
    setEditingProject({ ...project });
    setView('editor');
  };

  const handleSave = async () => {
    if (!editingProject || !user) return;
    setIsSaving(true);

    const supabase = getSupabase();
    const projectData = {
      ...editingProject,
      updated_at: new Date().toISOString()
    };

    let error;
    if (projectData.id) {
      // Update
      const { error: updateError } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', projectData.id);
      error = updateError;
    } else {
      // Insert
      const { error: insertError } = await supabase
        .from('projects')
        .insert([projectData]);
      error = insertError;
    }

    if (error) {
      alert('Error saving project: ' + error.message);
    } else {
      await fetchProjects(user.sub);
      setView('list');
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    
    const supabase = getSupabase();
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error deleting project');
    } else {
      setProjects(projects.filter(p => p.id !== id));
    }
  };

  const handleLogout = async () => {
    await authenticatedFetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
    removeAuthToken();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#FDFCF0] font-sans text-[#2D2424]">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-[#C5A059]/20 px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#C5A059]/10 rounded-xl">
            <Heart className="w-6 h-6 text-[#C5A059]" />
          </div>
          <h1 className="font-serif text-2xl hidden sm:block">Wedding Hub</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Authenticated as</span>
            <span className="text-sm font-medium">{user.email}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-wider"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-8">
        <AnimatePresence mode="wait">
          {view === 'list' ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-4xl font-serif mb-2 text-[#2D2424]">Your Celebrations</h2>
                  <p className="text-gray-500">Manage multiple wedding projects and landing pages.</p>
                </div>
                <button 
                  onClick={handleCreateNew}
                  className="bg-[#C5A059] text-white px-8 py-4 rounded-2xl font-bold uppercase tracking-widest flex items-center gap-3 hover:bg-[#B38D45] transition-all shadow-xl active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  New Project
                </button>
              </div>

              {isLoadingProjects ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-64 bg-white/50 animate-pulse rounded-[2rem] border border-[#C5A059]/10" />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="bg-white p-16 rounded-[3rem] border-2 border-dashed border-[#C5A059]/30 flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-[#C5A059]/10 rounded-full flex items-center justify-center mb-6">
                    <Heart className="w-10 h-10 text-[#C5A059] opacity-20" />
                  </div>
                  <h3 className="text-2xl font-serif mb-2">No projects yet</h3>
                  <p className="text-gray-400 max-w-sm mb-8">Ready to start planning? Create your first wedding project to begin customizing your page.</p>
                  <button onClick={handleCreateNew} className="text-[#C5A059] font-bold uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
                    Get Started <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {projects.map((project) => (
                    <motion.div 
                      key={project.id}
                      whileHover={{ y: -8 }}
                      className="bg-white rounded-[2.5rem] shadow-xl border border-[#C5A059]/10 overflow-hidden flex flex-col group"
                    >
                      <div className="p-8 flex-1">
                        <div className="flex items-center justify-between mb-6">
                          <span className="text-[10px] font-black uppercase tracking-widest bg-[#C5A059]/10 text-[#C5A059] px-3 py-1 rounded-full">
                            {TEMPLATES.find(t => t.id === project.theme_id)?.name || 'Classic'}
                          </span>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleEdit(project)}
                              className="p-2 hover:bg-[#C5A059]/10 rounded-lg text-gray-400 hover:text-[#C5A059] transition-colors"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(project.id)}
                              className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <h3 className="text-2xl font-serif mb-4 leading-tight">
                          {project.groom_name} <span className="text-[#C5A059]">&</span> {project.bride_name}
                        </h3>

                        <div className="space-y-2 text-sm text-gray-500 mb-8">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 opacity-50" />
                            <span>{new Date(project.wedding_date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 opacity-50" />
                            <span className="truncate">{project.location}</span>
                          </div>
                        </div>
                      </div>

                      <div className="px-8 pb-8 flex gap-3">
                        <button 
                          onClick={() => window.open(`/display/${project.id}`, '_blank')}
                          className="flex-1 bg-[#2D2424] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-colors"
                        >
                          <ArrowRight className="w-3 h-3" />
                          View Page
                        </button>
                        <button 
                          onClick={() => window.open(`/guest/${project.id}`, '_blank')}
                          className="bg-[#C5A059]/10 text-[#C5A059] p-3 rounded-xl hover:bg-[#C5A059]/20 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="editor"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12"
            >
              {/* Back Button */}
              <div className="lg:col-span-12">
                <button 
                  onClick={() => setView('list')}
                  className="flex items-center gap-2 text-gray-500 hover:text-[#C5A059] transition-colors font-bold uppercase tracking-widest text-xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to List
                </button>
              </div>

              {/* Settings Sidebar */}
              <div className="lg:col-span-4 space-y-8">
                <section className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-[#C5A059]/10">
                  <h2 className="text-2xl font-serif mb-8 flex items-center gap-3">
                    <Settings className="w-6 h-6 text-[#C5A059]" />
                    Configuration
                  </h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">Project Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Summer Wedding 2026"
                        value={editingProject?.name || ''}
                        onChange={(e) => setEditingProject({ ...editingProject!, name: e.target.value })}
                        className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">Groom</label>
                        <input 
                          type="text" 
                          value={editingProject?.groom_name || ''}
                          onChange={(e) => setEditingProject({ ...editingProject!, groom_name: e.target.value })}
                          className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">Bride</label>
                        <input 
                          type="text" 
                          value={editingProject?.bride_name || ''}
                          onChange={(e) => setEditingProject({ ...editingProject!, bride_name: e.target.value })}
                          className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">Wedding Date</label>
                      <input 
                        type="date" 
                        value={editingProject?.wedding_date || ''}
                        onChange={(e) => setEditingProject({ ...editingProject!, wedding_date: e.target.value })}
                        className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">Location</label>
                      <input 
                        type="text" 
                        value={editingProject?.location || ''}
                        onChange={(e) => setEditingProject({ ...editingProject!, location: e.target.value })}
                        className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full mt-10 bg-[#C5A059] text-white py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#B38D45] transition-all shadow-xl active:scale-95 disabled:opacity-50"
                  >
                    {isSaving ? 'Synchronizing...' : 'Save and Deploy'}
                    <Save className="w-5 h-5" />
                  </button>
                </section>
              </div>

              {/* Theme Selection */}
              <div className="lg:col-span-8">
                <div className="mb-8 flex items-center justify-between">
                  <h2 className="text-3xl font-serif">Selected Aesthetic</h2>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#C5A059] bg-[#C5A059]/10 px-4 py-2 rounded-full">
                    {TEMPLATES.length} Art Styles
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-20">
                  {TEMPLATES.map((t) => (
                    <button 
                      key={t.id}
                      onClick={() => setEditingProject({ ...editingProject!, theme_id: t.id })}
                      className={`relative overflow-hidden rounded-3xl border-2 transition-all group text-left
                        ${editingProject?.theme_id === t.id ? 'border-[#C5A059] shadow-2xl p-1' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-[1.02]'}
                      `}
                    >
                      <div className={`${t.colors.background} ${t.colors.text} p-8 rounded-[calc(1.5rem-4px)] min-h-[240px] flex flex-col justify-between`}>
                        <div>
                          <div className={`w-10 h-10 rounded-xl ${t.colors.accent} bg-opacity-10 mb-6 flex items-center justify-center`}>
                            <Heart className="w-5 h-5 fill-current opacity-30" />
                          </div>
                          <h4 className={`text-2xl font-bold mb-2 ${t.colors.headerText}`}>{t.name}</h4>
                          <p className="text-sm opacity-60 leading-relaxed max-w-[200px]">{t.description}</p>
                        </div>
                        
                        <div className="flex gap-2 mt-6">
                          <div className={`w-4 h-4 rounded-full ${t.colors.accent.split(' ')[0].replace('text-', 'bg-') || 'bg-[#C5A059]'}`} />
                          <div className={`w-4 h-4 rounded-full ${t.colors.border.split(' ')[0].replace('border-', 'bg-') || 'bg-gray-200'} opacity-50`} />
                        </div>
                      </div>

                      {editingProject?.theme_id === t.id && (
                        <div className="absolute top-6 right-6 bg-[#C5A059] text-white p-2 rounded-full shadow-lg">
                          <Save className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
