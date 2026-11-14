import React, { useState } from 'react';
import {
  Mail,
  Edit3,
  Send,
  ExternalLink,
  Check,
  Copy,
  Sparkles,
} from 'lucide-react';
import { WeddingEvent } from '../../types';
import { OverviewStats, parseInvitationConfig } from '../../lib/eventOverview';

interface InvitationPreviewWidgetProps {
  event: Partial<WeddingEvent>;
  stats: OverviewStats;
  invitationHref: string;
  rsvpHref: string;
  onEditInvitation: () => void;
}

export const InvitationPreviewWidget: React.FC<InvitationPreviewWidgetProps> = ({
  event,
  stats,
  invitationHref,
  rsvpHref,
  onEditInvitation,
}) => {
  const [showSendDrawer, setShowSendDrawer] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const parsed = parseInvitationConfig(event.invitation_config);
  const coupleNames =
    event.groom_name && event.bride_name
      ? `${event.groom_name} & ${event.bride_name}`
      : event.name || 'Wedding Invitation';

  const formattedDate = event.wedding_date
    ? new Date(
        /^\d{4}-\d{2}-\d{2}/.test(event.wedding_date)
          ? `${event.wedding_date.slice(0, 10)}T12:00:00`
          : event.wedding_date
      ).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Save the Date';

  const handleCopyInviteLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(invitationHref);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `You are warmly invited to the wedding of ${coupleNames}!\n\nView your invitation: ${invitationHref}\nRSVP online: ${rsvpHref}`
  )}`;

  return (
    <div className="rounded-2xl border border-[#E6E0D6] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(37,37,37,0.03)] flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EFEAE0]">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#9A7B38]" />
              <h2 className="font-serif text-lg font-normal text-[#23201C]">
                Invitation Preview
              </h2>
            </div>
            <p className="text-xs text-[#7A7368] mt-0.5">
              Digital stationery card & guest distribution
            </p>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border shrink-0 ${
              parsed.hasCustomDesign
                ? 'bg-emerald-50/80 text-emerald-800 border-emerald-200'
                : 'bg-[#FAF7F0] text-[#7A7368] border-[#E6E0D6]'
            }`}
          >
            {parsed.hasCustomDesign ? 'Customized' : 'Default Card'}
          </span>
        </div>

        {/* Invitation Card Thumbnail + Details */}
        <div className="mt-4 flex flex-col sm:flex-row gap-4 items-stretch">
          {/* Miniature Card Frame */}
          <a
            href={invitationHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative w-full sm:w-36 shrink-0 aspect-[5/7] rounded-xl border border-[#DFD8CC] bg-[#FAF7F0] overflow-hidden shadow-xs hover:border-[#C9A24D] transition-colors flex items-center justify-center"
            title="Open live guest invitation"
          >
            {parsed.hasCustomDesign ? (
              <svg
                viewBox={`0 0 ${parsed.canvasWidth} ${parsed.canvasHeight}`}
                className="w-full h-full bg-white"
                preserveAspectRatio="xMidYMid meet"
              >
                <rect
                  x={0}
                  y={0}
                  width={parsed.canvasWidth}
                  height={parsed.canvasHeight}
                  fill="#FFFDF9"
                />
                {parsed.elements.map((el) => {
                  const transform = el.rotation
                    ? `rotate(${el.rotation} ${el.x + el.width / 2} ${el.y + el.height / 2})`
                    : undefined;

                  if (el.type === 'rect') {
                    return (
                      <rect
                        key={el.id}
                        x={el.x}
                        y={el.y}
                        width={el.width}
                        height={el.height}
                        rx={el.borderRadius || 0}
                        fill={el.fill || '#EFEAE0'}
                        opacity={el.opacity ?? 1}
                        transform={transform}
                      />
                    );
                  }

                  if (el.type === 'image' && el.src) {
                    return (
                      <image
                        key={el.id}
                        href={el.src}
                        x={el.x}
                        y={el.y}
                        width={el.width}
                        height={el.height}
                        opacity={el.opacity ?? 1}
                        preserveAspectRatio="xMidYMid slice"
                        transform={transform}
                      />
                    );
                  }

                  if (el.type === 'button') {
                    return (
                      <g key={el.id} transform={transform}>
                        <rect
                          x={el.x}
                          y={el.y}
                          width={el.width}
                          height={el.height}
                          rx={el.borderRadius || 12}
                          fill={el.fill || '#23201C'}
                        />
                        <text
                          x={el.x + el.width / 2}
                          y={el.y + el.height / 2 + 12}
                          textAnchor="middle"
                          fontSize={el.fontSize || 34}
                          fill="#FFFFFF"
                        >
                          {el.text || 'RSVP'}
                        </text>
                      </g>
                    );
                  }

                  if (el.type === 'text') {
                    return (
                      <text
                        key={el.id}
                        x={el.x + el.width / 2}
                        y={el.y + (el.fontSize || 36)}
                        textAnchor="middle"
                        fontSize={el.fontSize || 36}
                        fontFamily={el.fontFamily || 'Georgia, serif'}
                        fill={el.fill || '#23201C'}
                        opacity={el.opacity ?? 1}
                        transform={transform}
                      >
                        {(el.text || '').slice(0, 26)}
                      </text>
                    );
                  }

                  return null;
                })}
              </svg>
            ) : (
              <div className="w-full h-full p-3 flex flex-col items-center justify-center text-center bg-gradient-to-b from-[#FFFDF9] to-[#F5EFE2]">
                <div className="w-full h-full border border-[#DFD2B8] rounded-lg p-2.5 flex flex-col items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C9A24D]" />
                  <span className="text-[8px] uppercase tracking-[0.2em] text-[#8B7344]">
                    Together Forever
                  </span>
                  <div className="font-serif text-xs text-[#23201C] leading-snug line-clamp-2">
                    {coupleNames}
                  </div>
                  <div className="w-6 h-px bg-[#D9C7A3]" />
                  <span className="text-[9px] text-[#6E6456]">{formattedDate}</span>
                </div>
              </div>
            )}

            <span className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-white/90 border border-[#E6E0D6] flex items-center justify-center text-[#23201C] opacity-0 group-hover:opacity-100 transition-opacity shadow-xs">
              <ExternalLink className="w-3 h-3" />
            </span>
          </a>

          {/* Status & Metadata */}
          <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#EFEAE0] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#7A7368]">Design Status</span>
                  <span className="font-medium text-[#23201C]">
                    {parsed.hasCustomDesign
                      ? `${parsed.elements.length} canvas layers`
                      : 'Ready to customize'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#7A7368]">Guest Roster</span>
                  <span className="font-medium text-[#23201C] tabular-nums">
                    {stats.totalGuests} invited · {stats.confirmedRsvp} confirmed
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#7A7368]">Pending Replies</span>
                  <span className="font-medium text-[#8B7344] tabular-nums">
                    {stats.pendingRsvp} awaiting
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onEditInvitation}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#23201C] text-white text-xs font-medium hover:bg-[#38332D] transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#D8B979]" />
                <span>Edit Invitation</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSendDrawer((v) => !v)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white text-[#23201C] border border-[#DFD8CC] text-xs font-medium hover:bg-[#FAF7F0] hover:border-[#C9A24D] transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-[#9A7B38]" />
                <span>Send Invitations</span>
              </button>
            </div>
          </div>
        </div>

        {/* Share / Send Invitations Drawer */}
        {showSendDrawer && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#FAF7F0] border border-[#E6E0D6] space-y-2.5">
            <div className="text-[11px] font-medium text-[#23201C]">
              Share Digital Invitation & RSVP Link
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={invitationHref}
                className="flex-1 h-8 px-2.5 text-[11px] font-mono bg-white border border-[#DFD8CC] rounded-lg text-[#5C554C]"
              />
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-white border border-[#DFD8CC] text-xs font-medium text-[#23201C] hover:border-[#C9A24D] shrink-0"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-[11px] font-medium hover:bg-emerald-800 transition-colors"
              >
                <span>Share via WhatsApp</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={invitationHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#DFD8CC] text-[#23201C] text-[11px] font-medium hover:bg-white/80"
              >
                <span>Open Guest Card</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#EFEAE0] flex items-center justify-between text-[11px] text-[#7A7368]">
        <span>Supports interactive RSVP button</span>
        <a
          href={invitationHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-[#8B7344] hover:text-[#23201C] transition-colors"
        >
          <span>View Live Card</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

export default InvitationPreviewWidget;
