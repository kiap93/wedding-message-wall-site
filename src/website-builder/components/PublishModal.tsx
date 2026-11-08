import React, { useState } from 'react';
import { 
  X, 
  Globe, 
  Check, 
  Copy, 
  ExternalLink, 
  AlertCircle, 
  CreditCard, 
  Lock, 
  Loader2, 
  Sparkles,
  ArrowRight,
  Eye,
  RefreshCw
} from 'lucide-react';
import { useWebsiteStore } from '../store/websiteStore';
import { isEventActive, getDaysRemaining } from '../../lib/packages';
import { EVENT_PRICING, formatPrice } from '../../config/pricing';
import Button from '../../design-system/components/Button';

export const PublishModal: React.FC = () => {
  const { 
    project, 
    config, 
    isPublishModalOpen, 
    setIsPublishModalOpen, 
    publicationStatus, 
    publishedAt,
    publishWebsite,
    unpublishWebsite 
  } = useWebsiteStore();

  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; url?: string; error?: string } | null>(null);

  if (!isPublishModalOpen || !project) return null;

  const isActive = isEventActive(project);
  const isAlreadyPublished = publicationStatus === 'published';
  const slug = project.slug || 'wedding';
  const publicUrl = `${window.location.origin}/${slug}/website`;

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishResult(null);
    try {
      const res = await publishWebsite();
      setPublishResult(res);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!window.confirm('Are you sure you want to unpublish your wedding website? Public guests will no longer be able to access it until you publish again. Your draft and design are safely preserved.')) {
      return;
    }

    setIsUnpublishing(true);
    try {
      const res = await unpublishWebsite();
      if (res.success) {
        setIsPublishModalOpen(false);
      } else {
        alert(res.error || 'Failed to unpublish website');
      }
    } finally {
      setIsUnpublishing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200">
        {/* Header */}
        <div className="h-14 px-6 border-b border-stone-200 flex items-center justify-between bg-[#FAF9F7]">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-800" />
            <h3 className="text-sm font-semibold text-stone-900 tracking-tight">
              {isAlreadyPublished ? 'Update Published Website' : 'Publish Wedding Website'}
            </h3>
          </div>
          <button
            onClick={() => {
              setIsPublishModalOpen(false);
              setPublishResult(null);
            }}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* STEP A: PAYMENT & ELIGIBILITY CHECK */}
          {!isActive && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/80 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
                    Event License Activation Required
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    To make your wedding website publicly accessible to guests, an active event license is required ({formatPrice(EVENT_PRICING.pricePerEvent)} for 12 calendar months).
                  </p>
                </div>
              </div>
              <div className="pt-1">
                <a
                  href={`/subscription?eventId=${project.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-xs"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Activate Event License ({formatPrice(EVENT_PRICING.pricePerEvent)})</span>
                </a>
              </div>
            </div>
          )}

          {/* STEP B: PUBLICATION SUCCESS SCREEN */}
          {publishResult?.success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center border border-emerald-300 shadow-sm animate-scale-in">
                <Check className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-serif font-semibold text-stone-900">
                  Your Wedding Website is Live!
                </h4>
                <p className="text-xs text-stone-600 max-w-sm mx-auto">
                  Guests can now view your custom story, wedding itinerary, photo gallery, and RSVP online.
                </p>
              </div>

              {/* Public URL Box */}
              <div className="p-3 bg-[#FAF9F7] rounded-xl border border-stone-200 flex items-center justify-between gap-3 text-left">
                <div className="truncate font-mono text-xs text-stone-800 select-all">
                  {publicUrl}
                </div>
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 hover:border-stone-900 text-xs font-medium text-stone-700 flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-xs"
                >
                  <span>Open Published Website</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPublishModalOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            /* STEP C: CONFIRMATION / PRE-PUBLISH DETAILS */
            <div className="space-y-5">
              {publishResult?.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{publishResult.error}</span>
                </div>
              )}

              {/* URL Preview */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-900 uppercase tracking-wider block">
                  Public Website URL
                </label>
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-stone-200 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-stone-800 truncate">
                    {publicUrl}
                  </span>
                  <button
                    onClick={copyToClipboard}
                    className="p-1.5 text-stone-500 hover:text-stone-900 rounded transition-colors shrink-0"
                    title="Copy URL"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-stone-500">
                  This permanent link never changes when you update website styles or sections.
                </p>
              </div>

              {/* Publication Status & Info */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">Current Status:</span>
                  <span className={`font-mono uppercase font-semibold text-[11px] px-2 py-0.5 rounded ${
                    isAlreadyPublished 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : publicationStatus === 'unpublished' 
                        ? 'bg-stone-200 text-stone-800' 
                        : 'bg-amber-100 text-amber-800'
                  }`}>
                    {publicationStatus.toUpperCase()}
                  </span>
                </div>

                {publishedAt && (
                  <div className="flex items-center justify-between text-stone-500 text-[11px]">
                    <span>Last Published:</span>
                    <span>{new Date(publishedAt).toLocaleString()}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-stone-500 text-[11px]">
                  <span>Enabled Sections:</span>
                  <span className="font-semibold text-stone-800">
                    {config.sections.filter((s) => s.enabled).length} of {config.sections.length}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2 justify-end border-t border-stone-200">
                {isAlreadyPublished && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUnpublish}
                    isLoading={isUnpublishing}
                    className="!text-xs text-red-600 hover:bg-red-50 w-full sm:w-auto"
                  >
                    Unpublish Website
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPublishModalOpen(false)}
                  className="w-full sm:w-auto !text-xs"
                >
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={!isActive}
                  isLoading={isPublishing}
                  onClick={handlePublish}
                  leftIcon={isAlreadyPublished ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                  className="w-full sm:w-auto !text-xs !bg-[#252525] hover:!bg-[#111111]"
                >
                  {isAlreadyPublished ? 'Update Live Website' : 'Publish Website Now'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
