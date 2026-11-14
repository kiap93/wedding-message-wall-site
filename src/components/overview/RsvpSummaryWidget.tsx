import React from 'react';
import { CheckCircle2, XCircle, Clock, ArrowRight, Users } from 'lucide-react';
import { OverviewStats } from '../../lib/eventOverview';

interface RsvpSummaryWidgetProps {
  stats: OverviewStats;
  isLoading: boolean;
  error?: string | null;
  onManageGuests: () => void;
  onAddGuest?: () => void;
}

export const RsvpSummaryWidget: React.FC<RsvpSummaryWidgetProps> = ({
  stats,
  isLoading,
  error,
  onManageGuests,
  onAddGuest,
}) => {
  const total = stats.totalGuests;
  const confirmedPct = total > 0 ? (stats.confirmedRsvp / total) * 100 : 0;
  const declinedPct = total > 0 ? (stats.declinedRsvp / total) * 100 : 0;
  const pendingPct = total > 0 ? (stats.pendingRsvp / total) * 100 : 0;

  return (
    <div className="rounded-2xl border border-[#E6E0D6] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(37,37,37,0.03)] flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EFEAE0]">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#9A7B38]" />
              <h2 className="font-serif text-lg font-normal text-[#23201C]">
                RSVP Summary
              </h2>
            </div>
            <p className="text-xs text-[#7A7368] mt-0.5">
              Guest attendance breakdown & response completion
            </p>
          </div>

          <div className="text-right shrink-0">
            <div className="font-serif text-2xl font-normal text-[#23201C] leading-none tabular-nums">
              {stats.rsvpCompletionPct}%
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[#8A8276] mt-1">
              Responded
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 space-y-3 animate-pulse">
            <div className="h-3 w-full rounded-full bg-[#EFEAE0]" />
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="h-16 rounded-xl bg-[#FAF7F0]" />
              <div className="h-16 rounded-xl bg-[#FAF7F0]" />
              <div className="h-16 rounded-xl bg-[#FAF7F0]" />
            </div>
          </div>
        ) : error ? (
          <div className="py-6 text-xs text-rose-700 bg-rose-50/70 rounded-xl px-4 mt-4 border border-rose-200">
            {error}
          </div>
        ) : total === 0 ? (
          <div className="py-7 text-center space-y-3">
            <p className="text-xs text-[#7A7368]">
              No guests added or RSVP responses received yet.
            </p>
            <div className="flex items-center justify-center gap-2">
              {onAddGuest && (
                <button
                  type="button"
                  onClick={onAddGuest}
                  className="px-3 py-1.5 rounded-lg bg-[#23201C] text-white text-xs font-medium hover:bg-[#38332D] transition-colors"
                >
                  Add First Guest
                </button>
              )}
              <button
                type="button"
                onClick={onManageGuests}
                className="px-3 py-1.5 rounded-lg bg-[#FAF7F0] text-[#23201C] border border-[#E6E0D6] text-xs font-medium hover:border-[#C9A24D] transition-colors"
              >
                Open Guest List
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Segmented Visual Progress Bar */}
            <div>
              <div className="h-2.5 w-full rounded-full bg-[#F3EFE8] overflow-hidden flex">
                {confirmedPct > 0 && (
                  <div
                    style={{ width: `${confirmedPct}%` }}
                    className="h-full bg-emerald-600 transition-all duration-500"
                    title={`Confirmed: ${stats.confirmedRsvp}`}
                  />
                )}
                {pendingPct > 0 && (
                  <div
                    style={{ width: `${pendingPct}%` }}
                    className="h-full bg-[#C9A24D] transition-all duration-500"
                    title={`Pending: ${stats.pendingRsvp}`}
                  />
                )}
                {declinedPct > 0 && (
                  <div
                    style={{ width: `${declinedPct}%` }}
                    className="h-full bg-rose-400 transition-all duration-500"
                    title={`Declined: ${stats.declinedRsvp}`}
                  />
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#7A7368] mt-1.5">
                <span className="tabular-nums">
                  {stats.confirmedRsvp + stats.declinedRsvp} of {total} guests responded
                </span>
                <span className="tabular-nums font-medium text-[#23201C]">
                  {stats.confirmedPax} total attending pax
                </span>
              </div>
            </div>

            {/* Breakdown Tiles */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-emerald-50/55 border border-emerald-200/70">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Confirmed</span>
                </div>
                <div className="mt-1.5 font-serif text-xl text-[#23201C] tabular-nums">
                  {stats.confirmedRsvp}
                </div>
                <div className="text-[10px] text-emerald-700 tabular-nums">
                  {Math.round(confirmedPct)}% of roster
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF5EA]/80 border border-[#E8DBC0]">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8B7344]">
                  <Clock className="w-3.5 h-3.5 text-[#9A7B38] shrink-0" />
                  <span>Pending</span>
                </div>
                <div className="mt-1.5 font-serif text-xl text-[#23201C] tabular-nums">
                  {stats.pendingRsvp}
                </div>
                <div className="text-[10px] text-[#8B7344] tabular-nums">
                  {Math.round(pendingPct)}% awaiting
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/55 border border-rose-200/70">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-800">
                  <XCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                  <span>Declined</span>
                </div>
                <div className="mt-1.5 font-serif text-xl text-[#23201C] tabular-nums">
                  {stats.declinedRsvp}
                </div>
                <div className="text-[10px] text-rose-700 tabular-nums">
                  {Math.round(declinedPct)}% declined
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Link */}
      <div className="mt-5 pt-3 border-t border-[#EFEAE0] flex items-center justify-between">
        <span className="text-[11px] text-[#7A7368]">
          Live sync with public RSVP form
        </span>
        <button
          type="button"
          onClick={onManageGuests}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#8B7344] hover:text-[#23201C] transition-colors"
        >
          <span>Manage Guest List</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default RsvpSummaryWidget;
