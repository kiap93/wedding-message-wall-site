import React, { useEffect, useId, useRef, useState } from 'react';
import { Compass, ArrowRight, Edit3 } from 'lucide-react';
import { SeatingTable, VenueLayout } from '../../types';
import {
  computeResponsiveFloorPlanStageSize,
  computeUniformFloorPlanTransform,
  projectFloorPlanPreview,
  projectObjectWithUniformScale,
} from '../../lib/eventOverview';

interface FloorPlanPreviewWidgetProps {
  layout: VenueLayout | null;
  tables: SeatingTable[];
  isLoading: boolean;
  error?: string | null;
  onEditFloorPlan: () => void;
  /** Optional initial container width (useful for SSR or deterministic test renders) */
  initialContainerWidth?: number;
}

export const FloorPlanPreviewWidget: React.FC<FloorPlanPreviewWidgetProps> = ({
  layout,
  tables,
  isLoading,
  error,
  onEditFloorPlan,
  initialContainerWidth = 580,
}) => {
  const preview = projectFloorPlanPreview(layout, tables);
  const tableObjectsCount = preview.objects.filter((o) => o.isTable).length;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(initialContainerWidth);
  const rawClipId = useId();
  const hallClipId = `hall-floor-clip-${rawClipId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    setMeasuredWidth(initialContainerWidth);
  }, [initialContainerWidth]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const rectWidth = el.getBoundingClientRect?.().width || el.clientWidth;
      if (rectWidth && rectWidth > 0) {
        setMeasuredWidth(Math.round(rectWidth));
      }
    };

    updateWidth();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect?.width;
          if (w && w > 0) {
            setMeasuredWidth(Math.round(w));
          }
        }
      });
      observer.observe(el);
    }

    window.addEventListener('resize', updateWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [preview.hasObjects, isLoading, error]);

  const stageSize = computeResponsiveFloorPlanStageSize(
    measuredWidth,
    preview.venueWidth,
    preview.venueHeight
  );

  const transform = computeUniformFloorPlanTransform({
    containerWidth: stageSize.width,
    containerHeight: stageSize.height,
    hallWidth: preview.venueWidth,
    hallHeight: preview.venueHeight,
  });

  // Architectural world-scaled grid intervals
  const minorStep =
    preview.venueUnit === 'ft'
      ? preview.venueWidth > 120 || preview.venueHeight > 120
        ? 10
        : 5
      : preview.venueWidth > 50 || preview.venueHeight > 50
      ? 2
      : 1;
  const majorStep = preview.venueUnit === 'ft' ? 10 : 5;

  const verticalGridLines: { pos: number; major: boolean }[] = [];
  for (let x = minorStep; x < preview.venueWidth - 0.001; x += minorStep) {
    const isMajor = Math.abs(x % majorStep) < 0.001 || Math.abs((x % majorStep) - majorStep) < 0.001;
    verticalGridLines.push({ pos: transform.offsetX + x * transform.scale, major: isMajor });
  }

  const horizontalGridLines: { pos: number; major: boolean }[] = [];
  for (let y = minorStep; y < preview.venueHeight - 0.001; y += minorStep) {
    const isMajor = Math.abs(y % majorStep) < 0.001 || Math.abs((y % majorStep) - majorStep) < 0.001;
    horizontalGridLines.push({ pos: transform.offsetY + y * transform.scale, major: isMajor });
  }

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
            <p className="text-xs text-[#7A7368] mt-0.5 tabular-nums">
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

        {/* Uniform-Scale Architectural Visual Canvas */}
        <div className="mt-4" ref={containerRef} data-testid="floor-plan-preview-container">
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
            <div className="relative rounded-xl border border-[#E6E0D6] bg-[#F7F4EE] overflow-hidden flex items-center justify-center">
              <svg
                width={stageSize.width}
                height={stageSize.height}
                viewBox={`0 0 ${stageSize.width} ${stageSize.height}`}
                preserveAspectRatio="xMidYMid meet"
                className="block w-full h-auto select-none"
                role="img"
                data-testid="floor-plan-preview-svg"
                data-scale={transform.scale.toFixed(4)}
                data-hall-aspect={(preview.venueWidth / preview.venueHeight).toFixed(4)}
                aria-label={`Architectural floor plan preview for ${preview.venueName} (${preview.venueWidth} by ${preview.venueHeight} ${preview.venueUnit})`}
              >
                <defs>
                  <clipPath id={hallClipId}>
                    <rect
                      x={transform.offsetX}
                      y={transform.offsetY}
                      width={transform.renderedWidth}
                      height={transform.renderedHeight}
                    />
                  </clipPath>
                </defs>

                {/* Top Width Dimension Callout */}
                <g aria-hidden="true" data-testid="dimension-width-callout">
                  <line
                    x1={transform.offsetX}
                    y1={transform.offsetY - 10}
                    x2={transform.offsetX + transform.renderedWidth}
                    y2={transform.offsetY - 10}
                    stroke="#B6AA96"
                    strokeWidth={0.85}
                  />
                  <line
                    x1={transform.offsetX}
                    y1={transform.offsetY - 13}
                    x2={transform.offsetX}
                    y2={transform.offsetY - 7}
                    stroke="#B6AA96"
                    strokeWidth={0.85}
                  />
                  <line
                    x1={transform.offsetX + transform.renderedWidth}
                    y1={transform.offsetY - 13}
                    x2={transform.offsetX + transform.renderedWidth}
                    y2={transform.offsetY - 7}
                    stroke="#B6AA96"
                    strokeWidth={0.85}
                  />
                  <text
                    x={transform.offsetX + transform.renderedWidth / 2}
                    y={transform.offsetY - 14}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={500}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fill="#7A7368"
                  >
                    {preview.venueWidth} {preview.venueUnit}
                  </text>
                </g>

                {/* Left Height Dimension Callout */}
                <g aria-hidden="true" data-testid="dimension-height-callout">
                  <line
                    x1={transform.offsetX - 10}
                    y1={transform.offsetY}
                    x2={transform.offsetX - 10}
                    y2={transform.offsetY + transform.renderedHeight}
                    stroke="#B6AA96"
                    strokeWidth={0.85}
                  />
                  <line
                    x1={transform.offsetX - 13}
                    y1={transform.offsetY}
                    x2={transform.offsetX - 7}
                    y2={transform.offsetY}
                    stroke="#B6AA96"
                    strokeWidth={0.85}
                  />
                  <line
                    x1={transform.offsetX - 13}
                    y1={transform.offsetY + transform.renderedHeight}
                    x2={transform.offsetX - 7}
                    y2={transform.offsetY + transform.renderedHeight}
                    stroke="#B6AA96"
                    strokeWidth={0.85}
                  />
                  <text
                    x={transform.offsetX - 15}
                    y={transform.offsetY + transform.renderedHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={9}
                    fontWeight={500}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fill="#7A7368"
                    transform={`rotate(-90 ${transform.offsetX - 15} ${
                      transform.offsetY + transform.renderedHeight / 2
                    })`}
                  >
                    {preview.venueHeight} {preview.venueUnit}
                  </text>
                </g>

                {/* True-Aspect Hall Floor Surface */}
                <rect
                  x={transform.offsetX}
                  y={transform.offsetY}
                  width={transform.renderedWidth}
                  height={transform.renderedHeight}
                  fill="#FFFFFF"
                  stroke="#23201C"
                  strokeWidth={1.25}
                  data-testid="floor-plan-hall-boundary"
                />

                {/* World-Scaled Architectural Grid */}
                <g clipPath={`url(#${hallClipId})`} aria-hidden="true">
                  {verticalGridLines.map((line, idx) => (
                    <line
                      key={`vg-${idx}`}
                      x1={line.pos}
                      y1={transform.offsetY}
                      x2={line.pos}
                      y2={transform.offsetY + transform.renderedHeight}
                      stroke={line.major ? '#E7E0D2' : '#F4F0E8'}
                      strokeWidth={line.major ? 0.75 : 0.45}
                    />
                  ))}
                  {horizontalGridLines.map((line, idx) => (
                    <line
                      key={`hg-${idx}`}
                      x1={transform.offsetX}
                      y1={line.pos}
                      x2={transform.offsetX + transform.renderedWidth}
                      y2={line.pos}
                      stroke={line.major ? '#E7E0D2' : '#F4F0E8'}
                      strokeWidth={line.major ? 0.75 : 0.45}
                    />
                  ))}
                </g>

                {/* Uniformly Scaled Venue Objects */}
                <g clipPath={`url(#${hallClipId})`}>
                  {preview.objects.map((obj) => {
                    const screen = projectObjectWithUniformScale(
                      obj,
                      transform,
                      preview.venueUnit
                    );
                    const rotationTransform = screen.rotation
                      ? `rotate(${screen.rotation} ${screen.pivotX} ${screen.pivotY})`
                      : undefined;

                    if (obj.isTable) {
                      const isFull =
                        typeof obj.capacity === 'number' &&
                        obj.capacity > 0 &&
                        (obj.assignedCount || 0) >= obj.capacity;
                      const strokeColor = obj.isCoupleTable
                        ? '#23201C'
                        : isFull
                        ? '#059669'
                        : '#9A7B38';
                      const fillColor = obj.isCoupleTable
                        ? obj.color || '#C5A059'
                        : '#FFFFFF';
                      const showLabel =
                        screen.width >= 10 && screen.height >= 10;
                      const showOccupancy =
                        !obj.isCoupleTable &&
                        typeof obj.capacity === 'number' &&
                        obj.capacity > 0 &&
                        screen.circleDiameter >= 28;
                      const labelFontSize = Math.max(
                        6.5,
                        Math.min(10.5, Math.min(screen.width, screen.height) * 0.34)
                      );

                      if (!obj.isCoupleTable && obj.isRound) {
                        const r = Math.max(2.5, screen.circleRadius);
                        return (
                          <g
                            key={obj.id}
                            transform={rotationTransform}
                            data-object-id={obj.id}
                            data-object-type={obj.objectType}
                            data-shape="round"
                          >
                            {screen.circleDiameter >= 12 &&
                              screen.chairs.map((ch, idx) => (
                                <circle
                                  key={`${obj.id}-chair-${idx}`}
                                  cx={ch.cx}
                                  cy={ch.cy}
                                  r={ch.r}
                                  fill="#FAF7F0"
                                  stroke="#8B806F"
                                  strokeWidth={0.75}
                                />
                              ))}
                            <circle
                              cx={screen.cx}
                              cy={screen.cy}
                              r={r}
                              fill={fillColor}
                              stroke={strokeColor}
                              strokeWidth={1.25}
                            />
                            {showLabel && (
                              <text
                                x={screen.cx}
                                y={showOccupancy ? screen.cy - labelFontSize * 0.28 : screen.cy}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize={labelFontSize}
                                fontWeight={600}
                                fontFamily="Inter, system-ui, sans-serif"
                                fill="#23201C"
                              >
                                {obj.tableNumber ? `T${obj.tableNumber}` : obj.label.slice(0, 5)}
                              </text>
                            )}
                            {showOccupancy && (
                              <text
                                x={screen.cx}
                                y={screen.cy + labelFontSize * 0.72}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize={Math.max(5.5, labelFontSize * 0.78)}
                                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                                fill={isFull ? '#DC2626' : '#059669'}
                              >
                                {obj.assignedCount ?? 0}/{obj.capacity}
                              </text>
                            )}
                          </g>
                        );
                      }

                      if (!obj.isCoupleTable && obj.isOval) {
                        return (
                          <g
                            key={obj.id}
                            transform={rotationTransform}
                            data-object-id={obj.id}
                            data-object-type={obj.objectType}
                            data-shape="oval"
                          >
                            {screen.circleDiameter >= 12 &&
                              screen.chairs.map((ch, idx) => (
                                <circle
                                  key={`${obj.id}-chair-${idx}`}
                                  cx={ch.cx}
                                  cy={ch.cy}
                                  r={ch.r}
                                  fill="#FAF7F0"
                                  stroke="#8B806F"
                                  strokeWidth={0.75}
                                />
                              ))}
                            <ellipse
                              cx={screen.cx}
                              cy={screen.cy}
                              rx={Math.max(2.5, screen.rx)}
                              ry={Math.max(2.5, screen.ry)}
                              fill={fillColor}
                              stroke={strokeColor}
                              strokeWidth={1.25}
                            />
                            {showLabel && (
                              <text
                                x={screen.cx}
                                y={screen.cy}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize={labelFontSize}
                                fontWeight={600}
                                fontFamily="Inter, system-ui, sans-serif"
                                fill="#23201C"
                              >
                                {obj.tableNumber ? `T${obj.tableNumber}` : obj.label.slice(0, 6)}
                              </text>
                            )}
                          </g>
                        );
                      }

                      // Rectangular / Square / Couple Table
                      return (
                        <g
                          key={obj.id}
                          transform={rotationTransform}
                          data-object-id={obj.id}
                          data-object-type={obj.objectType}
                          data-shape={obj.isCoupleTable ? 'couple_table' : obj.tableShape}
                        >
                          {!obj.isCoupleTable &&
                            screen.circleDiameter >= 10 &&
                            screen.chairs.map((ch, idx) => (
                              <circle
                                key={`${obj.id}-chair-${idx}`}
                                cx={ch.cx}
                                cy={ch.cy}
                                r={ch.r}
                                fill={ch.isHeadChair ? '#8B806F' : '#FAF7F0'}
                                stroke={ch.isHeadChair ? '#23201C' : '#8B806F'}
                                strokeWidth={0.75}
                              />
                            ))}
                          <rect
                            x={screen.x}
                            y={screen.y}
                            width={Math.max(3, screen.width)}
                            height={Math.max(3, screen.height)}
                            rx={obj.isSquare ? 2.5 : 3.5}
                            fill={fillColor}
                            stroke={strokeColor}
                            strokeWidth={1.15}
                          />
                          {showLabel && (
                            <text
                              x={screen.cx}
                              y={showOccupancy ? screen.cy - labelFontSize * 0.25 : screen.cy}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={Math.max(6, Math.min(9.5, Math.min(screen.width * 0.28, screen.height * 0.45)))}
                              fontWeight={600}
                              fontFamily="Inter, system-ui, sans-serif"
                              fill={obj.isCoupleTable ? obj.textColor || '#1A1A1A' : '#23201C'}
                            >
                              {obj.isCoupleTable
                                ? obj.label.slice(0, 14)
                                : obj.tableNumber
                                ? `T${obj.tableNumber}`
                                : obj.label.slice(0, 8)}
                            </text>
                          )}
                          {showOccupancy && (
                            <text
                              x={screen.cx}
                              y={screen.cy + labelFontSize * 0.7}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={Math.max(5.5, labelFontSize * 0.75)}
                              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                              fill={isFull ? '#DC2626' : '#059669'}
                            >
                              {obj.assignedCount ?? 0}/{obj.capacity}
                            </text>
                          )}
                        </g>
                      );
                    }

                    // Section Label element
                    if (obj.objectType === 'label') {
                      return (
                        <g
                          key={obj.id}
                          transform={rotationTransform}
                          data-object-id={obj.id}
                          data-object-type="label"
                        >
                          <rect
                            x={screen.x}
                            y={screen.y}
                            width={Math.max(3, screen.width)}
                            height={Math.max(3, screen.height)}
                            rx={3}
                            fill="rgba(255, 255, 255, 0.72)"
                            stroke="#C4BFB6"
                            strokeWidth={0.85}
                            strokeDasharray="3 2.5"
                          />
                          {screen.width >= 20 && screen.height >= 10 && (
                            <text
                              x={screen.cx}
                              y={screen.cy}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={Math.max(6, Math.min(9.5, screen.height * 0.48))}
                              fontWeight={600}
                              fontFamily="Inter, system-ui, sans-serif"
                              fill={obj.textColor || '#23201C'}
                            >
                              {obj.label.slice(0, 16)}
                            </text>
                          )}
                        </g>
                      );
                    }

                    // Architectural & Venue Zones (stage, dance_floor, entrance, buffet, bar, photo_booth, registration, pillar, wall, decor)
                    const isPillar = obj.objectType === 'pillar';
                    const isWall = obj.objectType === 'wall';
                    const zoneFill = obj.color || '#EFEAE0';
                    const zoneTextFill = obj.textColor || '#252525';
                    const rx = isPillar
                      ? Math.min(screen.width, screen.height) / 2
                      : isWall
                      ? 1
                      : 3;

                    return (
                      <g
                        key={obj.id}
                        transform={rotationTransform}
                        data-object-id={obj.id}
                        data-object-type={obj.objectType}
                      >
                        <rect
                          x={screen.x}
                          y={screen.y}
                          width={Math.max(2, screen.width)}
                          height={Math.max(2, screen.height)}
                          rx={rx}
                          fill={zoneFill}
                          stroke="#252525"
                          strokeOpacity={0.55}
                          strokeWidth={0.8}
                        />
                        {!isPillar &&
                          !isWall &&
                          screen.width >= 22 &&
                          screen.height >= 11 && (
                            <text
                              x={screen.cx}
                              y={screen.cy}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={Math.max(
                                5.5,
                                Math.min(9.5, Math.min(screen.height * 0.42, screen.width * 0.14))
                              )}
                              fontWeight={600}
                              fontFamily="Inter, system-ui, sans-serif"
                              fill={zoneTextFill}
                            >
                              {obj.label.slice(0, 18)}
                            </text>
                          )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Footer summary & CTA */}
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
