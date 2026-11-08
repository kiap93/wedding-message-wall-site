import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Monitor, 
  Tablet, 
  Smartphone, 
  Undo2, 
  Redo2, 
  Eye, 
  Save, 
  Globe, 
  Check, 
  Loader2, 
  Sparkles,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { useWebsiteStore } from '../store/websiteStore';
import Button from '../../design-system/components/Button';

interface BuilderHeaderProps {
  onSave: () => Promise<void>;
}

export const BuilderHeader: React.FC<BuilderHeaderProps> = ({ onSave }) => {
  const navigate = useNavigate();
  const { 
    project, 
    deviceMode, 
    setDeviceMode, 
    zoom, 
    setZoom,
    undo, 
    redo, 
    canUndo, 
    canRedo,
    saveStatus,
    publicationStatus,
    setPreviewModalOpen,
    setIsPublishModalOpen
  } = useWebsiteStore();

  const coupleTitle = project?.groom_name && project?.bride_name
    ? `${project.groom_name} & ${project.bride_name}`
    : project?.name || 'Wedding Website';

  return (
    <header className="h-14 bg-white border-b border-[#E8E8E5] px-4 flex items-center justify-between shrink-0 z-30 select-none shadow-xs">
      {/* Left: Branding, Return to Workspace & Event Title */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate('/workspace')}
          className="p-1.5 text-[#777777] hover:text-[#252525] hover:bg-[#FAF9F7] rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium"
          title="Return to Workspace"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Workspace</span>
        </button>

        <div className="h-4 w-px bg-[#E8E8E5]" />

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#252525] text-white flex items-center justify-center font-serif text-xs font-bold">
            EF
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[#252525] tracking-tight truncate max-w-[160px] sm:max-w-[240px]">
              {coupleTitle}
            </span>
            <span className="text-[10px] text-[#8B806F] font-mono leading-none">
              Website Studio
            </span>
          </div>
        </div>

        {/* Save Status & Publication Status Badges */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono ml-2">
          {saveStatus === 'saving' ? (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </span>
          ) : saveStatus === 'unsaved' ? (
            <span className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Unsaved draft
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Check className="w-3 h-3 text-emerald-600" /> Draft Saved
            </span>
          )}

          {publicationStatus === 'published' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> Live
            </span>
          ) : publicationStatus === 'unpublished' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
              Unpublished
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Draft Only
            </span>
          )}
        </div>
      </div>

      {/* Center: Device Mode Viewport Switcher */}
      <div className="flex items-center bg-[#FAF9F7] p-1 rounded-lg border border-[#E8E8E5]">
        <button
          onClick={() => setDeviceMode('desktop')}
          className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-all ${
            deviceMode === 'desktop' 
              ? 'bg-white text-[#252525] shadow-xs font-medium' 
              : 'text-[#777777] hover:text-[#252525]'
          }`}
          title="Desktop Widescreen View"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden lg:inline text-[11px]">Desktop</span>
        </button>

        <button
          onClick={() => setDeviceMode('tablet')}
          className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-all ${
            deviceMode === 'tablet' 
              ? 'bg-white text-[#252525] shadow-xs font-medium' 
              : 'text-[#777777] hover:text-[#252525]'
          }`}
          title="Tablet View (768px)"
        >
          <Tablet className="w-3.5 h-3.5" />
          <span className="hidden lg:inline text-[11px]">Tablet</span>
        </button>

        <button
          onClick={() => setDeviceMode('mobile')}
          className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-all ${
            deviceMode === 'mobile' 
              ? 'bg-white text-[#252525] shadow-xs font-medium' 
              : 'text-[#777777] hover:text-[#252525]'
          }`}
          title="Mobile Smartphone View (390px)"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden lg:inline text-[11px]">Mobile</span>
        </button>
      </div>

      {/* Right: History, Zoom, Preview & Actions */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="hidden sm:flex items-center gap-1 pr-1 border-r border-[#E8E8E5]">
          <button
            onClick={undo}
            disabled={!canUndo()}
            className="p-1.5 text-[#777777] hover:text-[#252525] hover:bg-[#FAF9F7] disabled:opacity-30 disabled:hover:bg-transparent rounded transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo()}
            className="p-1.5 text-[#777777] hover:text-[#252525] hover:bg-[#FAF9F7] disabled:opacity-30 disabled:hover:bg-transparent rounded transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="hidden xl:flex items-center gap-1 pr-2 border-r border-[#E8E8E5] text-xs font-mono text-[#777777]">
          <button 
            onClick={() => setZoom(zoom - 10)} 
            className="p-1 hover:text-[#252525] hover:bg-[#FAF9F7] rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="w-10 text-center tabular-nums">{zoom}%</span>
          <button 
            onClick={() => setZoom(zoom + 10)} 
            className="p-1 hover:text-[#252525] hover:bg-[#FAF9F7] rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Preview Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreviewModalOpen(true)}
          leftIcon={<Eye className="w-3.5 h-3.5" />}
          className="!h-8 !text-xs"
        >
          <span className="hidden sm:inline">Preview</span>
        </Button>

        {/* Save Draft */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          isLoading={saveStatus === 'saving'}
          leftIcon={<Save className="w-3.5 h-3.5" />}
          className="!h-8 !text-xs"
        >
          <span>Save Draft</span>
        </Button>

        {/* Publish / Update Website Action */}
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsPublishModalOpen(true)}
          leftIcon={publicationStatus === 'published' ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          className={`!h-8 !text-xs font-semibold ${
            publicationStatus === 'published'
              ? '!bg-emerald-800 hover:!bg-emerald-900 text-white'
              : '!bg-[#252525] hover:!bg-[#111111] text-white'
          }`}
        >
          <span>{publicationStatus === 'published' ? 'Update Website' : 'Publish'}</span>
        </Button>

        {/* Direct Open Live Website if published */}
        {publicationStatus === 'published' && project?.slug && (
          <a
            href={`/${project.slug}/website`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-[#E8E8E5] text-xs font-medium text-[#252525] hover:bg-[#FAF9F7] transition-colors"
            title="Open Live Guest Website in New Tab"
          >
            <Globe className="w-3.5 h-3.5 text-[#8B806F]" />
            <span className="hidden lg:inline">Live Site</span>
          </a>
        )}
      </div>
    </header>
  );
};
