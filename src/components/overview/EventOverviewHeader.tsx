import React from 'react';
import {
  Calendar,
  MapPin,
  ExternalLink,
  UserPlus,
  Edit3,
  Mail,
  Globe,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Agency, WeddingEvent } from '../../types';
import { CountdownInfo } from '../../lib/eventOverview';
import { isEventActive, getDaysRemaining } from '../../lib/packages';

interface EventOverviewHeaderProps {
  event: Partial<WeddingEvent>;
  agency: Agency | null;
  countdown: CountdownInfo;
  websiteHref: string;
  invitationHref: string;
  onAddGuest?: () => void;
  onEditEvent: () => void;
  onPreviewWebsite?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const EventOverviewHeader: React.FC<EventOverviewHeaderProps> = ({
  event,
  agency,
  countdown,
  websiteHref,
  invitationHref,
  onAddGuest,
  onEditEvent,
  onPreviewWebsite,
  onRefresh,
  isRefreshing = false,
}) => {
  const coupleNames =
    event.groom_name && event.bride_name
      ? `${event.groom_name} & ${event.bride_name}`
      : event.name || 'Untitled Celebration';

  const eventTitle =
    event.name &&
    event.groom_name &&
    event.bride_name &&
    event.name.toLowerCase() !== `${event.groom_name} & ${event.bride_name}`.toLowerCase()
      ? event.name
      : 'Wedding Command Center';

  const formattedDate = event.wedding_date
    ? new Date(
        /^\d{4}-\d{2}-\d{2}/.test(event.wedding_date)
          ? `${event.wedding_date.slice(0, 10)}T12:00:00`
          : event.wedding_date
      ).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Wedding date not yet scheduled';

  const activeLicense = event.id ? isEventActive(event as WeddingEvent, agency) : false;
  const licenseDays = getDaysRemaining(event.expires_at);

  let statusLabel = 'Draft Event';
  let statusClasses = 'bg-[#F3EFE8] text-[#6E6456] border-[#DFD8CC]';

  if (agency?.subscription_status === 'active' || agency?.is_demo) {
    statusLabel = 'Studio Active';
    statusClasses = 'bg-emerald-50/90 text-emerald-800 border-emerald-200/80';
  } else if (activeLicense) {
    statusLabel =
      licenseDays !== null ? `Active · ${licenseDays}d license` : 'Active Event';
    statusClasses = 'bg-emerald-50/90 text-emerald-800 border-emerald-200/80';
  } else if (event.payment_status === 'pending_payment') {
    statusLabel = 'Pending Payment';
    statusClasses = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (
    event.expires_at &&
    new Date(event.expires_at) < new Date() &&
    event.payment_status === 'paid'
  ) {
    statusLabel = 'Expired';
    statusClasses = 'bg-rose-50 text-rose-800 border-rose-200';
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#E6E0D6] bg-gradient-to-br from-[#FFFDF9] via-[#FAF7F0] to-[#F4EFE4] p-6 sm:p-7 shadow-[0_1px_3px_rgba(37,37,37,0.04)]">
      {/* Subtle champagne hairline accent */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#C9A24D]/40 via-[#C9A24D] to-[#C9A24D]/40" />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Left: Couple Identity, Date & Status */}
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B7344]">
              {eventTitle}
            </span>
            <span className="text-[#D4CBB9]">·</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusClasses}`}
            >
              {statusLabel}
            </span>
            {event.slug && (
              <span className="text-[11px] font-mono text-[#8B806F] bg-white/80 px-2 py-0.5 rounded-md border border-[#E6E0D6]">
                /{event.slug}
              </span>
            )}
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-[#23201C] leading-tight">
            {coupleNames}
          </h1>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#645E55]">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#A68A4C] shrink-0" />
              <span>{formattedDate}</span>
            </span>

            {event.location && (
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-[#A68A4C] shrink-0" />
                <span className="truncate max-w-xs sm:max-w-md">{event.location}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Countdown + Quick Actions */}
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center lg:items-end xl:items-center gap-4 shrink-0">
          {/* Countdown Medallion */}
          <div className="px-4 py-3 rounded-xl bg-white/90 border border-[#E6E0D6] flex items-center gap-3 shadow-[0_1px_2px_rgba(37,37,37,0.03)]">
            <div className="w-9 h-9 rounded-lg bg-[#FAF5EA] border border-[#E9DEC7] flex items-center justify-center text-[#9A7B38] shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="font-serif text-lg font-medium text-[#23201C] leading-none tabular-nums">
                {countdown.headline}
              </div>
              <div className="text-[11px] text-[#7A7368] mt-1">
                {countdown.sublabel}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {event.website_status === 'published' ? (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#23201C] text-[#FAF8F4] text-xs font-medium hover:bg-[#38332D] transition-colors shadow-xs"
              >
                <Globe className="w-3.5 h-3.5 text-[#D8B979]" />
                <span>Preview Wedding Website</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            ) : onPreviewWebsite ? (
              <button
                type="button"
                onClick={onPreviewWebsite}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#23201C] text-[#FAF8F4] text-xs font-medium hover:bg-[#38332D] transition-colors shadow-xs"
              >
                <Globe className="w-3.5 h-3.5 text-[#D8B979]" />
                <span>Preview Wedding Website</span>
              </button>
            ) : null}

            {onAddGuest && (
              <button
                type="button"
                onClick={onAddGuest}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-white text-[#23201C] border border-[#DFD8CC] text-xs font-medium hover:bg-[#FAF7F0] hover:border-[#C9A24D] transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#9A7B38]" />
                <span>Add Guest</span>
              </button>
            )}

            <button
              type="button"
              onClick={onEditEvent}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white text-[#23201C] border border-[#DFD8CC] text-xs font-medium hover:bg-[#FAF7F0] transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#7A7368]" />
              <span>Edit Event</span>
            </button>

            <a
              href={invitationHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white text-[#23201C] border border-[#DFD8CC] text-xs font-medium hover:bg-[#FAF7F0] transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-[#7A7368]" />
              <span>View Guest Invitation</span>
              <ExternalLink className="w-3 h-3 text-[#8B806F]" />
            </a>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                title="Refresh event metrics"
                aria-label="Refresh event metrics"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white text-[#7A7368] border border-[#DFD8CC] hover:text-[#23201C] hover:bg-[#FAF7F0] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default EventOverviewHeader;
