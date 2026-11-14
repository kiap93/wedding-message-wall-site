import React from 'react';
import { Armchair, ArrowRight, AlertCircle } from 'lucide-react';
import { OverviewStats } from '../../lib/eventOverview';

interface SeatingOverviewWidgetProps {
  stats: OverviewStats;
  isLoading: boolean;
  error?: string | null;
  onManageSeating: () => void;
}

export const SeatingOverviewWidget: React.FC<SeatingOverviewWidgetProps> = ({
  stats,
  isLoading,
  error,
  onManageSeating,
}) => {
  return (
    <div className="rounded-2xl border border-[#E6E0D6] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(37,37,37,0.03)] flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EFEAE0]">
          <div>
            <div className="flex items-center gap-2">
              <Armchair className="w-4 h-4 text-[#9A7B38]" />
              <h2 className="font-serif text-lg font-normal text-[#23201C]">
                Seating Overview
              </h2>
            </div>
            <p className="text-xs text-[#7A7368] mt-0.5">
              Reception table capacity & guest seat assignments
            </p>
          </div>

          <div className="text-right shrink-0">
            <div className="font-serif text-2xl font-normal text-[#23201C] leading-none tabular-nums">
              {stats.seatingOccupancyPct}%
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[#8A8276] mt-1">
              Seated
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-6 space-y-3 animate-pulse">
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 rounded-xl bg-[#FAF7F0]" />
              <div className="h-16 rounded-xl bg-[#FAF7F0]" />
              <div className="h-16 rounded-xl bg-[#FAF7F0]" />
              <div className="h-16 rounded-xl bg-[#FAF7F0]" />
            </div>
          </div>
        ) : error ? (
          <div className="mt-4 p-4 rounded-xl bg-rose-50/70 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        ) : stats.totalTables === 0 ? (
          <div className="py-7 text-center space-y-2.5">
            <p className="text-xs text-[#7A7368]">
              No reception tables created yet for this event.
            </p>
            <button
              type="button"
              onClick={onManageSeating}
              className="px-3.5 py-1.5 rounded-lg bg-[#23201C] text-white text-xs font-medium hover:bg-[#38332D] transition-colors"
            >
              Set Up Reception Tables
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Occupancy bar */}
            <div>
              <div className="h-2 w-full rounded-full bg-[#F3EFE8] overflow-hidden">
                <div
                  style={{ width: `${stats.seatingOccupancyPct}%` }}
                  className="h-full bg-[#C9A24D] rounded-full transition-all duration-500"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#7A7368] mt-1.5 tabular-nums">
                <span>
                  {stats.assignedSeating} of {stats.totalCapacity} seats filled
                </span>
                <span>
                  {Math.max(0, stats.totalCapacity - stats.assignedSeating)} open seats
                </span>
              </div>
            </div>

            {/* 4 Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#EFEAE0]">
                <div className="text-[11px] text-[#7A7368]">Total Tables</div>
                <div className="mt-1 font-serif text-xl text-[#23201C] tabular-nums">
                  {stats.totalTables}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#EFEAE0]">
                <div className="text-[11px] text-[#7A7368]">Total Capacity</div>
                <div className="mt-1 font-serif text-xl text-[#23201C] tabular-nums">
                  {stats.totalCapacity}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/55 border border-emerald-200/70">
                <div className="text-[11px] text-emerald-800">Assigned Guests</div>
                <div className="mt-1 font-serif text-xl text-[#23201C] tabular-nums">
                  {stats.assignedSeating}
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  stats.unassignedGuests > 0
                    ? 'bg-amber-50/75 border-amber-200'
                    : 'bg-[#FCFBF8] border-[#EFEAE0]'
                }`}
              >
                <div
                  className={`text-[11px] ${
                    stats.unassignedGuests > 0 ? 'text-amber-800' : 'text-[#7A7368]'
                  }`}
                >
                  Unassigned
                </div>
                <div className="mt-1 font-serif text-xl text-[#23201C] tabular-nums">
                  {stats.unassignedGuests}
                </div>
              </div>
            </div>

            {stats.unassignedGuests > 0 && (
              <div className="px-3 py-2 rounded-lg bg-amber-50/80 border border-amber-200/80 flex items-center gap-2 text-[11px] text-amber-900">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  {stats.unassignedGuests} confirmed{' '}
                  {stats.unassignedGuests === 1 ? 'guest needs' : 'guests need'} a table assignment.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#EFEAE0] flex items-center justify-between">
        <span className="text-[11px] text-[#7A7368]">
          Real-time sync with Table Assignment
        </span>
        <button
          type="button"
          onClick={onManageSeating}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#8B7344] hover:text-[#23201C] transition-colors"
        >
          <span>Manage Seating</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default SeatingOverviewWidget;
