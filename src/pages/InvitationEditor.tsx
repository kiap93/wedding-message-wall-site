import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Save, 
  Smartphone, 
  Monitor, 
  Share2,
  Undo2,
  Redo2,
  Loader2
} from 'lucide-react';
import { Sidebar } from '../editor/components/Sidebar';
import { EditorCanvas } from '../editor/components/EditorCanvas';
import { PropertiesPanel } from '../editor/components/PropertiesPanel';
import { useEditorStore } from '../editor/store';
import { getSupabase } from '../lib/supabase';
import { WeddingEvent } from '../types';

export default function InvitationEditor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<WeddingEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  
  const { elements, setElements } = useEditorStore();

  // Load design on mount
  useEffect(() => {
    async function load() {
      if (!projectId) return;
      setIsLoading(true);
      try {
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
          }
        }
      } catch (err) {
        console.error('Failed to load project:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [projectId, setElements]);

  const handleSave = async () => {
    if (!projectId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${window.location.origin}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('wedding_token') || ''}`
        },
        body: JSON.stringify({
          invitation_config: JSON.stringify({ elements })
        })
      });

      if (!response.ok) throw new Error('Failed to save');
      alert('Design saved successfully!');
    } catch (err) {
      console.error('Error saving:', err);
      alert('Failed to save design.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#FDFCF0] gap-4">
        <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
        <p className="text-[10px] uppercase tracking-widest font-black text-[#C5A059]">Initialising Canvas...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#FDFCF0] flex flex-col font-sans overflow-hidden">
      {/* Header Bar */}
      <header className="h-16 bg-white border-b border-[#C5A059]/20 flex items-center justify-between px-6 z-50 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-[#C5A059]/10 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#2D2424]" />
          </button>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-widest text-[#2D2424]">Designer v2</h1>
            <p className="text-[10px] text-[#C5A059] font-medium">{project?.groom_name} & {project?.bride_name}</p>
          </div>
        </div>

        {/* Center: Viewport Controls & Undo/Redo */}
        <div className="flex items-center gap-8">
          <div className="flex items-center bg-gray-50 rounded-2xl p-1 gap-1 border border-gray-200">
            <button 
              onClick={() => setPreviewMode('desktop')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${previewMode === 'desktop' ? 'bg-white shadow-sm text-[#C5A059]' : 'text-gray-400 opacity-60'}`}
            >
              <Monitor className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-widest">Desktop</span>
            </button>
            <button 
              onClick={() => setPreviewMode('mobile')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${previewMode === 'mobile' ? 'bg-white shadow-sm text-[#C5A059]' : 'text-gray-400 opacity-60'}`}
            >
              <Smartphone className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-widest">Mobile</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
             <button className="p-2 text-gray-300 hover:text-[#C5A059] opacity-50 cursor-not-allowed">
               <Undo2 className="w-4 h-4" />
             </button>
             <button className="p-2 text-gray-300 hover:text-[#C5A059] opacity-50 cursor-not-allowed">
               <Redo2 className="w-4 h-4" />
             </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.open(`/${project?.slug}/invitation`, '_blank')}
            className="p-2.5 text-[#C5A059] hover:bg-[#C5A059]/10 rounded-xl transition-colors"
            title="Preview Live"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#2D2424] text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-lg shadow-[#2D2424]/20 disabled:opacity-50 min-w-[140px] justify-center"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        
        {/* Responsive Canvas Container */}
        <main className="flex-1 bg-[#F0F0EE] overflow-hidden flex items-center justify-center p-8 transition-all duration-500">
           <div className={`shadow-2xl transition-all duration-500 bg-white ${
              previewMode === 'mobile' ? 'w-[375px] h-[667px]' : 'w-full h-full max-w-[1000px] max-h-[1414px]'
           }`}>
             <EditorCanvas />
           </div>
        </main>

        <PropertiesPanel />
      </div>
    </div>
  );
}
