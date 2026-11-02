import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Smartphone, 
  Monitor, 
  ExternalLink,
  Undo2, 
  Redo2, 
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { Sidebar } from '../editor/components/Sidebar';
import { EditorCanvas } from '../editor/components/EditorCanvas';
import { PropertiesPanel } from '../editor/components/PropertiesPanel';
import { useEditorStore } from '../editor/store';
import { getSupabase } from '../lib/supabase';
import { WeddingEvent } from '../types';
import Button from '../design-system/components/Button';

export default function InvitationEditor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<WeddingEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  
  const { elements, setElements, canvasWidth, canvasHeight, setCanvasHeight, setPan, setScale, scale } = useEditorStore();
  const { undo, redo, pastStates, futureStates } = useEditorStore.temporal.getState();
  const { clear: clearHistory } = useEditorStore.temporal.getState();

  const handleResetViewport = () => {
    const container = document.querySelector('main');
    if (container) {
      const { clientWidth, clientHeight } = container;
      const newScale = (previewMode === 'mobile' ? 375 : clientWidth - 120) / canvasWidth;
      const finalScale = Math.min(newScale, (previewMode === 'mobile' ? 667 : clientHeight - 120) / canvasHeight);
      setScale(finalScale);
      setPan({
        x: (clientWidth - canvasWidth * finalScale) / 2,
        y: (clientHeight - canvasHeight * finalScale) / 2
      });
    }
  };

  useEffect(() => {
    if (!isLoading) {
      setTimeout(handleResetViewport, 100);
    }
  }, [previewMode, isLoading]);

  useEffect(() => {
    async function load() {
      if (!projectId) return;
      setIsLoading(true);
      try {
        const supabase = getSupabase();
        const { data } = await supabase
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
            if (config.canvasHeight) setCanvasHeight(config.canvasHeight);
            
            setTimeout(() => {
              clearHistory();
            }, 200);
          }
        }
      } catch (err) {
        console.error('Failed to load project:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [projectId, setElements, setCanvasHeight]);

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
          invitation_config: JSON.stringify({ 
            elements,
            canvasWidth,
            canvasHeight
          })
        })
      });

      if (!response.ok) throw new Error('Failed to save');
      alert('Invitation design saved successfully!');
    } catch (err) {
      console.error('Error saving:', err);
      alert('Failed to save design.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F7F7F5] gap-3">
        <Loader2 className="w-6 h-6 text-[#252525] animate-spin" />
        <p className="text-xs text-[#777777]">Loading invitation studio...</p>
      </div>
    );
  }

  const coupleTitle = project?.groom_name && project?.bride_name 
    ? `${project.groom_name} & ${project.bride_name}` 
    : project?.name || 'Wedding Stationery';

  return (
    <div className="h-screen w-screen bg-[#F7F7F5] flex flex-col font-sans overflow-hidden select-none">
      {/* Studio Top Navigation Bar */}
      <header className="h-12 bg-white border-b border-[#E8E8E5] px-4 flex items-center justify-between shrink-0 z-30">
        {/* Left: Back & Project Info */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/workspace')}
            className="p-1.5 text-[#777777] hover:text-[#252525] hover:bg-[#FAF9F7] rounded transition-colors"
            title="Return to Workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="h-4 w-px bg-[#E8E8E5]" />
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#252525] tracking-tight">{coupleTitle}</span>
            <span className="text-[10px] text-[#777777] bg-[#FAF9F7] px-1.5 py-0.5 rounded border border-[#E8E8E5]">
              Invitation Studio
            </span>
          </div>
        </div>

        {/* Center: Canvas Controls & Device Mode */}
        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="flex items-center bg-[#FAF9F7] border border-[#E8E8E5] rounded p-0.5 gap-1 text-xs">
            <button
              onClick={() => setScale(s => Math.max(0.2, s / 1.15))}
              className="p-1 text-[#777777] hover:text-[#252525] rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono tabular-nums text-[#252525] w-10 text-center select-none">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(s => Math.min(3, s * 1.15))}
              className="p-1 text-[#777777] hover:text-[#252525] rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Device Preview Toggle */}
          <div className="flex items-center bg-[#F2EFE9] p-0.5 rounded border border-[#E8E8E5]">
            <button 
              onClick={() => setPreviewMode('desktop')}
              className={`p-1 px-2 rounded text-xs transition-colors flex items-center gap-1.5 ${
                previewMode === 'desktop' ? 'bg-white text-[#252525] shadow-subtle' : 'text-[#777777] hover:text-[#252525]'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">Desktop</span>
            </button>
            <button 
              onClick={() => setPreviewMode('mobile')}
              className={`p-1 px-2 rounded text-xs transition-colors flex items-center gap-1.5 ${
                previewMode === 'mobile' ? 'bg-white text-[#252525] shadow-subtle' : 'text-[#777777] hover:text-[#252525]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">Mobile</span>
            </button>
          </div>

          <div className="h-4 w-px bg-[#E8E8E5]" />

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => undo()}
              disabled={pastStates.length === 0}
              className="p-1.5 text-[#777777] hover:text-[#252525] hover:bg-[#FAF9F7] rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => redo()}
              disabled={futureStates.length === 0}
              className="p-1.5 text-[#777777] hover:text-[#252525] hover:bg-[#FAF9F7] rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {project?.slug && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/${project.slug}/invitation`, '_blank')}
              rightIcon={<ExternalLink className="w-3 h-3" />}
            >
              Preview
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            Save Design
          </Button>
        </div>
      </header>

      {/* Main Studio Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Elements & Materials Toolbar */}
        <Sidebar />
        
        {/* Center Canvas Viewport */}
        <main className="flex-1 bg-[#F7F7F5] overflow-hidden flex items-center justify-center p-6 relative">
          <div className={`transition-all duration-300 bg-white border border-[#E8E8E5] shadow-card ${
            previewMode === 'mobile' ? 'w-[375px] h-[667px] rounded-lg' : 'w-full h-full max-w-[1000px] max-h-[1414px] rounded-md'
          }`}>
            <EditorCanvas />
          </div>
        </main>

        {/* Right Properties Panel */}
        <PropertiesPanel />
      </div>
    </div>
  );
}
