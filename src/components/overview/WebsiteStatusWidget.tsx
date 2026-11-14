import React, { useState } from 'react';
import {
  Globe,
  ExternalLink,
  Edit3,
  Copy,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { WeddingEvent } from '../../types';

interface WebsiteStatusWidgetProps {
  event: Partial<WeddingEvent>;
  websiteHref: string;
  onEditWebsite: () => void;
  onPreviewDraft?: () => Promise<void> | void;
}

export const WebsiteStatusWidget: React.FC<WebsiteStatusWidgetProps> = ({
  event,
  websiteHref,
  onEditWebsite,
  onPreviewDraft,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);

  const status = event.website_status || 'draft';
  const isPublished = status === 'published';
  const isUnpublished = status === 'unpublished';

  let sectionsCount = 0;
  let wc = event.website_config;
  if (typeof wc === 'string') {
    try {
      wc = JSON.parse(wc);
    } catch {
      wc = null;
    }
  }
  if (Array.isArray(wc?.sections)) {
    sectionsCount = wc.sections.filter((s: any) => s?.enabled !== false).length;
  }

  const handleCopyUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(websiteHref);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <div className="rounded-2xl border border-[#E6E0D6] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(37,37,37,0.03)] flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EFEAE0]">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#9A7B38]" />
              <h2 className="font-serif text-lg font-normal text-[#23201C]">
                Wedding Website Status
              </h2>
            </div>
            <p className="text-xs text-[#7A7368] mt-0.5">
              Public wedding portal, URL & publication state
            </p>
          </div>

          {isPublished ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
              <Eye className="w-3 h-3 text-emerald-700" />
              <span>Published</span>
            </span>
          ) : isUnpublished ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
              <EyeOff className="w-3 h-3 text-amber-700" />
              <span>Unpublished</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FAF7F0] text-[#7A7368] border border-[#E6E0D6] shrink-0">
              <span>Draft</span>
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3.5">
          {/* Public Website URL bar */}
          <div className="p-3.5 rounded-xl bg-[#FAF7F0] border border-[#EFEAE0] space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[#7A7368]">
              <span className="uppercase tracking-wider font-medium">Public URL</span>
              {event.website_published_at && isPublished && (
                <span>
                  Live since{' '}
                  {new Date(event.website_published_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white border border-[#E6E0D6] text-xs font-mono text-[#23201C] truncate">
                {event.slug ? `/${event.slug}/website` : 'Assign slug in Event Details'}
              </div>
              {event.slug && (
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  title="Copy public website URL"
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-white border border-[#DFD8CC] text-xs font-medium text-[#23201C] hover:border-[#C9A24D] transition-colors shrink-0"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#7A7368]" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl border border-[#EFEAE0] bg-[#FCFBF8]">
              <div className="text-[11px] text-[#7A7368]">Configured Sections</div>
              <div className="mt-1 font-serif text-lg text-[#23201C] tabular-nums">
                {sectionsCount > 0 ? `${sectionsCount} active` : 'Standard suite'}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-[#EFEAE0] bg-[#FCFBF8]">
              <div className="text-[11px] text-[#7A7368]">Guest Access</div>
              <div className="mt-1 font-serif text-lg text-[#23201C]">
                {isPublished ? 'Open to Guests' : 'Private Draft'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 pt-3 border-t border-[#EFEAE0] flex flex-wrap items-center justify-between gap-2">
        {isPublished ? (
          <a
            href={websiteHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-[#DFD8CC] text-xs font-medium text-[#23201C] hover:bg-[#FAF7F0] hover:border-[#C9A24D] transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#9A7B38]" />
            <span>Preview Website</span>
            <ExternalLink className="w-3 h-3 text-[#8A8276]" />
          </a>
        ) : onPreviewDraft ? (
          <button
            type="button"
            onClick={onPreviewDraft}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-[#DFD8CC] text-xs font-medium text-[#23201C] hover:bg-[#FAF7F0] hover:border-[#C9A24D] transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#9A7B38]" />
            <span>Preview Website</span>
          </button>
        ) : (
          <span className="text-[11px] text-[#7A7368]">Publish in Website Studio</span>
        )}

        <button
          type="button"
          onClick={onEditWebsite}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-[#23201C] text-white text-xs font-medium hover:bg-[#38332D] transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5 text-[#D8B979]" />
          <span>Edit Website</span>
        </button>
      </div>
    </div>
  );
};

export default WebsiteStatusWidget;
