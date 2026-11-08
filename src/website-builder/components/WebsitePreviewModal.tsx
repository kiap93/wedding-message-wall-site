import React, { useState } from 'react';
import { X, Monitor, Tablet, Smartphone } from 'lucide-react';
import { useWebsiteStore } from '../store/websiteStore';
import { WeddingWebsiteRenderer } from '../WeddingWebsiteRenderer';
import { DeviceMode } from '../types';

export const WebsitePreviewModal: React.FC = () => {
  const { config, project, previewModalOpen, setPreviewModalOpen } = useWebsiteStore();
  const [previewDevice, setPreviewDevice] = useState<DeviceMode>('desktop');

  if (!previewModalOpen) return null;

  const deviceWidthClass = 
    previewDevice === 'mobile' 
      ? 'w-[390px] min-h-[844px] shadow-2xl rounded-[36px] border-[6px] border-[#252525] my-8 overflow-hidden' 
      : previewDevice === 'tablet' 
        ? 'w-[768px] min-h-[1024px] shadow-xl rounded-[24px] border-[4px] border-[#333333] my-8 overflow-hidden' 
        : 'w-full max-w-6xl min-h-screen shadow-lg rounded-xl my-6';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col animate-fade-in">
      {/* Top Bar */}
      <div className="h-14 bg-[#252525] text-white px-6 flex items-center justify-between shrink-0 border-b border-stone-800">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-wide uppercase font-mono text-amber-300">
            Guest Experience Preview
          </span>
          <span className="text-xs text-stone-400">
            • {project?.groom_name || 'Lucas'} & {project?.bride_name || 'Sofia'}
          </span>
        </div>

        {/* Viewport Toggles */}
        <div className="flex items-center bg-stone-800 p-1 rounded-lg border border-stone-700">
          <button
            onClick={() => setPreviewDevice('desktop')}
            className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-all ${
              previewDevice === 'desktop' ? 'bg-white text-stone-900 font-semibold' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="text-[11px]">Desktop</span>
          </button>
          <button
            onClick={() => setPreviewDevice('tablet')}
            className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-all ${
              previewDevice === 'tablet' ? 'bg-white text-stone-900 font-semibold' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="text-[11px]">Tablet</span>
          </button>
          <button
            onClick={() => setPreviewDevice('mobile')}
            className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-all ${
              previewDevice === 'mobile' ? 'bg-white text-stone-900 font-semibold' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="text-[11px]">Mobile</span>
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setPreviewModalOpen(false)}
          className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <span>Exit Preview</span>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preview Viewport Scroller */}
      <div className="flex-1 overflow-y-auto flex justify-center p-4 sm:p-8 bg-stone-900/60">
        <div className={`bg-white relative transition-all duration-300 ${deviceWidthClass}`}>
          <WeddingWebsiteRenderer
            config={config}
            project={project}
            isEditor={false}
          />
        </div>
      </div>
    </div>
  );
};

