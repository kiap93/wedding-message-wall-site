import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Undo, Redo, Eye, Smartphone, Monitor, Check } from 'lucide-react';
import Button from '../design-system/components/Button';

export interface EditorLayoutProps {
  title?: string;
  onSave?: () => void;
  isSaving?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onPreview?: () => void;
  deviceMode?: 'desktop' | 'mobile';
  onDeviceModeChange?: (mode: 'desktop' | 'mobile') => void;
  leftPanel?: React.ReactNode;
  rightPanel?: React.ReactNode;
  children: React.ReactNode;
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({
  title = 'Wedding Stationery Suite',
  onSave,
  isSaving = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onPreview,
  deviceMode = 'desktop',
  onDeviceModeChange,
  leftPanel,
  rightPanel,
  children,
}) => {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F7F7F5] overflow-hidden select-none font-sans">
      {/* Top Professional Creative Studio Bar */}
      <header className="h-12 bg-white border-b border-[#E8E8E5] px-4 flex items-center justify-between shrink-0 z-30">
        {/* Left: Back & Title */}
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
            <span className="text-xs font-semibold text-[#252525] tracking-tight">{title}</span>
            <span className="text-[10px] text-[#777777] bg-[#FAF9F7] px-1.5 py-0.5 rounded border border-[#E8E8E5]">
              Invitation Studio
            </span>
          </div>
        </div>

        {/* Center: Device mode & Undo/Redo */}
        <div className="flex items-center gap-2">
          {onDeviceModeChange && (
            <div className="flex items-center bg-[#F2EFE9] p-0.5 rounded border border-[#E8E8E5]">
              <button
                onClick={() => onDeviceModeChange('desktop')}
                className={`p-1 rounded text-xs transition-colors ${
                  deviceMode === 'desktop' ? 'bg-white text-[#252525] shadow-subtle' : 'text-[#777777] hover:text-[#252525]'
                }`}
                title="Desktop Preview"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDeviceModeChange('mobile')}
                className={`p-1 rounded text-xs transition-colors ${
                  deviceMode === 'mobile' ? 'bg-white text-[#252525] shadow-subtle' : 'text-[#777777] hover:text-[#252525]'
                }`}
                title="Mobile Preview"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="h-4 w-px bg-[#E8E8E5]" />

          <div className="flex items-center gap-0.5">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1.5 rounded text-[#777777] hover:text-[#252525] hover:bg-[#FAF9F7] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Undo"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1.5 rounded text-[#777777] hover:text-[#252525] hover:bg-[#FAF9F7] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Redo"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {onPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPreview}
              leftIcon={<Eye className="w-3.5 h-3.5" />}
            >
              Live Preview
            </Button>
          )}

          {onSave && (
            <Button
              variant="primary"
              size="sm"
              onClick={onSave}
              isLoading={isSaving}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save Changes
            </Button>
          )}
        </div>
      </header>

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar / Layers */}
        {leftPanel && (
          <aside className="w-72 bg-white border-r border-[#E8E8E5] flex flex-col shrink-0 overflow-y-auto">
            {leftPanel}
          </aside>
        )}

        {/* Center Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-[#F7F7F5] relative">
          {children}
        </div>

        {/* Right Inspector */}
        {rightPanel && (
          <aside className="w-72 bg-white border-l border-[#E8E8E5] flex flex-col shrink-0 overflow-y-auto">
            {rightPanel}
          </aside>
        )}
      </div>
    </div>
  );
};

export default EditorLayout;
