import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { WeddingEvent } from '../types';
import { useWebsiteStore } from '../website-builder/store/websiteStore';
import { BuilderHeader } from '../website-builder/components/BuilderHeader';
import { BuilderSidebar } from '../website-builder/components/BuilderSidebar';
import { WebsiteCanvas } from '../website-builder/components/WebsiteCanvas';
import { PropertiesPanel } from '../website-builder/components/PropertiesPanel';
import { WebsitePreviewModal } from '../website-builder/components/WebsitePreviewModal';
import { PublishModal } from '../website-builder/components/PublishModal';

export default function WebsiteStudio() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { init, config, setSaveStatus } = useWebsiteStore();

  useEffect(() => {
    async function loadProject() {
      if (!projectId) {
        setIsLoading(false);
        setLoadError('Project ID missing');
        return;
      }

      // Demo Event Support
      if (projectId === 'demo') {
        const demoProject: WeddingEvent = {
          id: 'demo',
          agency_id: 'demo-agency',
          name: 'Lucas & Sofia Wedding',
          slug: 'demo',
          groom_name: 'Lucas',
          bride_name: 'Sofia',
          wedding_date: '2025-09-20',
          location: 'San Francisco, CA',
          theme_id: 'minimal_luxury',
          image_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1600',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        init(demoProject);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .maybeSingle();

        if (error || !data) {
          throw new Error(error?.message || 'Wedding event not found');
        }

        init(data);
      } catch (err: any) {
        console.error('Failed to load project for Website Studio:', err);
        setLoadError(err.message || 'Could not load event data');
      } finally {
        setIsLoading(false);
      }
    }

    loadProject();
  }, [projectId]);

  // Handle Save Website Draft
  const handleSave = async () => {
    if (!projectId || projectId === 'demo') {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('saving');
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('wedding_session_token') || ''}`
        },
        body: JSON.stringify({
          website_config: config
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save website draft');
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      console.error('Error saving website draft:', err);
      setSaveStatus('unsaved');
      alert('Failed to save website changes. Please verify your connection.');
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F7F7F5] gap-3">
        <Loader2 className="w-6 h-6 text-[#252525] animate-spin" />
        <p className="text-xs text-[#777777] font-mono">Loading Wedding Website Studio...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F7F7F5] gap-4 p-6 text-center">
        <div className="text-sm font-semibold text-red-600">{loadError}</div>
        <p className="text-xs text-[#777777] max-w-sm">
          We could not locate this wedding project. Please return to your workspace.
        </p>
        <button
          onClick={() => navigate('/workspace')}
          className="px-4 py-2 bg-[#252525] text-white text-xs font-medium rounded-lg"
        >
          Return to Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F7F7F5] overflow-hidden">
      {/* Top Studio Toolbar */}
      <BuilderHeader onSave={handleSave} />

      {/* Main Studio 3-Column Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Collapsible Tool Panels */}
        <BuilderSidebar />

        {/* Center: Main Responsive Website Canvas */}
        <WebsiteCanvas />

        {/* Right: Contextual Inspector */}
        <PropertiesPanel />
      </div>

      {/* Fullscreen Live Preview Modal */}
      <WebsitePreviewModal />

      {/* Publishing & Launch Modal */}
      <PublishModal />
    </div>
  );
}
