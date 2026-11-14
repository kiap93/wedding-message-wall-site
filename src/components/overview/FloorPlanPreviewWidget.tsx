import React from 'react';
import { Compass, ArrowRight, Edit3 } from 'lucide-react';
import { SeatingTable, VenueLayout } from '../../types';
import { projectFloorPlanPreview } from '../../lib/eventOverview';

interface FloorPlanPreviewWidgetProps {
  layout: VenueLayout | null;
  tables: SeatingTable[];
  isLoading: boolean;
  error?: string | null;
  onEditFloorPlan: () => void;
}

export const FloorPlanPreviewWidget: React.FC<FloorPlanPreviewWidgetProps> = ({
  layout,
  tables,
  isLoading,
  error,
  onEditFloorPlan,
}) => {
  const preview = projectFloorPlanPreview(layout, tables);
  const tableObjectsCount = preview.objects.filter((o) => o.isTable).length;

  return (
    <div className="rounded-2xl border border-[#E6E0D6] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(37,37,37,0.03)] flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EFEAE0]">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#9A7B38]" />
              <h2 className="font-serif text-lg font-normal text-[#23201C]">
                Wedding Hall Floor Plan
              </h2>
            </div>
            <p className="text-xs text-[#7A7368] mt-0.5">
              {preview.venueName} · {preview.venueWidth} × {preview.venueHeight} {preview.venueUnit}
            </p>
          </div>

          <button
            type="button"
            onClick={onEditFloorPlan}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF7F0] text-[#23201C] border border-[#E6E0D6] hover:border-[#C9A24D] text-xs font-medium transition-colors shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#9A7B38]" />
            <span>Edit Floor Plan</span>
          </button>
        </div>

        {/* Miniature Visual Canvas */}
        <div className="mt-4">
          {isLoading ? (
            <div className="aspect-[16/10] w-full rounded-xl bg-[#FAF7F0] border border-[#EFEAE0] animate-pulse" />
          ) : error ? (
            <div className="aspect-[16/10] w-full rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-center p-4 text-xs text-rose-700 text-center">
              {error}
            </div>
          ) : !preview.hasObjects ? (
            <div className="aspect-[16/10] w-full rounded-xl bg-[#FAF7F0] border border-dashed border-[#DFD8CC] flex flex-col items-center justify-center p-6 text-center space-y-2.5">
              <div className="w-10 h-10 rounded-full bg-white border border-[#E6E0D6] flex items-center justify-center text-[#9A7B38]">
                <Compass className="w-5 h-5" />
              </div>
              <div className="text-xs font-medium text-[#23201C]">
                No floor plan objects placed yet
              </div>
              <p className="text-[11px] text-[#7A7368] max-w-xs">
                Arrange banquet tables, stage, dance floor, and entrance in true-scale meters or feet.
              </p>
              <button
                type="button"
                onClick={onEditFloorPlan}
                className="px-3.5 py-1.5 rounded-lg bg-[#23201C] text-white text-xs font-medium hover:bg-[#38332D] transition-colors"
              >
                Design Hall Layout
              </button>
            </div>
          ) : (
            <div className="relative rounded-xl border border-[#E6E0D6] bg-[#FCFBF8] p-3 overflow-hidden">
              <div
                className="w-full relative mx-auto"
                style={{
                  aspectRatio: `${preview.venueWidth} / ${preview.venueHeight}`,
                  maxHeight: '260px',
                }}
              >
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="w-full h-full rounded-lg border border-[#E6E0D6] bg-[#FAF7F0]"
                  role="img"
                  aria-label="Miniature preview of the wedding hall floor plan"
                >
                  {/* Subtle architectural grid lines */}
                  <defs>
                    <pattern
                      id="miniHallGrid"
                      width="10"
                      height="10"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 10 0 L 0 0 0 10"
                        fill="none"
                        stroke="#EAE3D5"
                        strokeWidth="0.25"
                      />
                    </pattern>
                  </defs>
                  <rect width="100" height="100" fill="url(#miniHallGrid)" />

                  {preview.objects.map((obj) => {
                    const cx = obj.xPct + obj.wPct / 2;
                    const cy = obj.yPct + obj.hPct / 2;
                    const transform = obj.rotation
                      ? `rotate(${obj.rotation} ${cx} ${cy})`
                      : undefined;

                    if (obj.isTable) {
                      const isFull =
                        typeof obj.capacity === 'number' &&
                        obj.capacity > 0 &&
                        (obj.assignedCount || 0) >= obj.capacity;
                      const strokeColor = isFull ? '#059669' : '#9A7B38';
                      const fillColor =
                        obj.objectType === 'couple_table' ? '#FBF3E0' : '#FFFFFF';

                      if (obj.isRound) {
                        const r = Math.min(obj.wPct, obj.hPct) / 2;
                        return (
                          <g key={obj.id} transform={transform}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={Math.max(1.8, r)}
                              fill={fillColor}
                              stroke={strokeColor}
                              strokeWidth="0.6"
                            />
                            <text
                              x={cx}
                              y={cy + 0.9}
                              textAnchor="middle"
                              fontSize="2.7"
                              fontWeight="600"
                              fill="#23201C"
                            >
                              {obj.tableNumber ? `T${obj.tableNumber}` : obj.label.slice(0, 4)}
                            </text>
                          </g>
                        );
                      }

                      return (
                        <g key={obj.id} transform={transform}>
                          <rect
                            x={obj.xPct}
                            y={obj.yPct}
                            width={obj.wPct}
                            height={obj.hPct}
                            rx="1"
                            fill={fillColor}
                            stroke={strokeColor}
                            strokeWidth="0.6"
                          />
                          <text
                            x={cx}
                            y={cy + 0.9}
                            textAnchor="middle"
                            fontSize="2.5"
                            fontWeight="600"
                            fill="#23201C"
                          >
                            {obj.tableNumber ? `T${obj.tableNumber}` : obj.label.slice(0, 6)}
                          </text>
                        </g>
                      );
                    }

                    // Architectural zones (stage, dance_floor, entrance, bar, etc.)
                    const zoneFill =
                      obj.objectType === 'stage'
                        ? '#23201C'
                        : obj.objectType === 'dance_floor'
                        ? '#F4ECDC'
                        : obj.objectType === 'entrance'
                        ? '#8B7344'
                        : obj.objectType === 'pillar'
                        ? '#D8D0C2'
                        : '#EFEAE0';
                    const zoneTextFill =
                      obj.objectType === 'stage' || obj.objectType === 'entrance'
                        ? '#FAF8F4'
                        : '#5C554C';

                    return (
                      <g key={obj.id} transform={transform}>
                        <rect
                          x={obj.xPct}
                          y={obj.yPct}
                          width={obj.wPct}
                          height={obj.hPct}
                          rx={obj.objectType === 'pillar' ? '4' : '1.2'}
                          fill={zoneFill}
                          stroke="#C8BFA8"
                          strokeWidth="0.4"
                        />
                        {obj.wPct > 7 && obj.hPct > 4 && (
                          <text
                            x={cx}
                            y={cy + 0.9}
                            textAnchor="middle"
                            fontSize="2.3"
                            fontWeight="500"
                            fill={zoneTextFill}
                          >
                            {obj.label.slice(0, 12)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer legend & CTA */}
      <div className="mt-4 pt-3 border-t border-[#EFEAE0] flex items-center justify-between gap-2 text-[11px] text-[#7A7368]">
        <div className="flex items-center gap-3">
          <span className="tabular-nums">
            {tableObjectsCount} {tableObjectsCount === 1 ? 'table' : 'tables'} placed
          </span>
          <span>·</span>
          <span className="tabular-nums">
            {preview.objects.length} total hall elements
          </span>
        </div>

        <button
          type="button"
          onClick={onEditFloorPlan}
          className="inline-flex items-center gap-1 font-medium text-[#8B7344] hover:text-[#23201C] transition-colors"
        >
          <span>Open Planner</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default FloorPlanPreviewWidget;
