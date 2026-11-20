import React, { useEffect, useState } from 'react';
import { X, Monitor, Tablet, Smartphone, ExternalLink, Copy, Check, RefreshCw, Loader2, AlertCircle, Link2 } from 'lucide-react';
import { useWebsiteStore } from '../store/websiteStore';
import { WeddingWebsiteRenderer } from '../WeddingWebsiteRenderer';
import { DeviceMode } from '../types';

export const WebsitePreviewModal: React.FC = () => {
  const {
    config,
    project,
    previewModalOpen,
    setPreviewModalOpen,
    previewTokenExpiresAt,
    previewUrl,
    isGeneratingPreviewToken,
    previewError,
    generatePreviewToken,
  } = useWebsiteStore();
  const [previewDevice, setPreviewDevice] = useState<DeviceMode>('desktop');
  const [copiedLink, setCopiedLink] = useState(false);

  const isExpired = Boolean(
    previewTokenExpiresAt &&
      Number.isFinite(new Date(previewTokenExpiresAt).getTime()) &&
      Date.now() >= new Date(previewTokenExpiresAt).getTime()
  );

  useEffect(() => {
    if (!previewModalOpen || !project) return;
    if (!previewUrl || isExpired) {
      void generatePreviewToken({ forceRegenerate: isExpired });
    }
  }, [previewModalOpen, project?.id]);

  if (!previewModalOpen) return null;

  const fullPreviewUrl = previewUrl
    ? previewUrl.startsWith('http')
      ? previewUrl
      : `${window.location.origin}${previewUrl}`
    : '';

  const handleCopyLink = () => {
    if (!fullPreviewUrl) return;
    navigator.clipboard.writeText(fullPreviewUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const deviceWidthClass =
    previewDevice === 'mobile'
      ? 'w-[390px] min-h-[844px] shadow-2xl rounded-[36px] border-[6px] border-[#252525] my-8 overflow-hidden'
      : previewDevice === 'tablet'
        ? 'w-[768px] min-h-[1024px] shadow-xl rounded-[24px] border-[4px] border-[#333333] my-8 overflow-hidden'
        : 'w-full max-w-6xl min-h-screen shadow-lg rounded-xl my-6';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col animate-fade-in">
      {/* Top Bar */}
      <div className="min-h-14 bg-[#252525] text-white px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-stone-800">
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

        {/* Shareable Preview Token Actions & Close */}
        <div className="flex items-center gap-2">
          {isGeneratingPreviewToken ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 text-stone-300 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating secure preview link...</span>
            </span>
          ) : previewUrl && !isExpired ? (
            <>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs transition-colors"
                title="Copy private tokenized preview link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </button>
              <button
                type="button"
                onClick={() => void generatePreviewToken({ forceRegenerate: true })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs transition-colors"
                title="Generate a fresh temporary preview token"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Regenerate</span>
              </button>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Preview</span>
              </a>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void generatePreviewToken({ forceRegenerate: true })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>{isExpired ? 'Regenerate Preview Token' : 'Generate Preview Link'}</span>
            </button>
          )}

          <button
            onClick={() => setPreviewModalOpen(false)}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            <span>Exit Preview</span>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview Token Status / Error Strip */}
      {(previewError || isExpired || previewTokenExpiresAt) && (
        <div
          className={`px-6 py-2 text-xs flex items-center justify-between gap-3 border-b ${
            previewError || isExpired
              ? 'bg-red-950/90 text-red-100 border-red-800'
              : 'bg-stone-900/95 text-stone-300 border-stone-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {(previewError || isExpired) && <AlertCircle className="w-3.5 h-3.5 text-red-300 shrink-0" />}
            <span>
              {previewError
                ? previewError
                : isExpired
                  ? 'Your previous preview token expired. Regenerate a new secure link to share.'
                  : `Temporary private preview link expires ${new Date(previewTokenExpiresAt!).toLocaleString()}`}
            </span>
          </div>
          {(previewError || isExpired) && (
            <button
              type="button"
              onClick={() => void generatePreviewToken({ forceRegenerate: true })}
              className="px-2.5 py-1 rounded bg-white text-stone-900 font-medium text-[11px] hover:bg-stone-100 transition-colors shrink-0"
            >
              {previewError ? 'Retry' : 'Regenerate Token'}
            </button>
          )}
        </div>
      )}

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
