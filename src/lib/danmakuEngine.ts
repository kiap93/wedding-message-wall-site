import {
  ALL_DANMAKU_DIRECTIONS,
  DANMAKU_DENSITY_PRESETS,
  DANMAKU_DIRECTION_META,
  DEFAULT_MESSAGE_DISPLAY_CONFIG,
  DanmakuDirection,
  Message,
  MessageDisplayConfig,
  ResolvedMessageDisplayConfig,
  WishCategory,
  resolveDisplayConfig,
} from '../types';
import { scheduleMessageRotation } from './displayScheduler';

export type DanmakuTier = 'normal' | 'special' | 'spotlight';
export type DanmakuAxis = 'horizontal' | 'vertical';

export interface DanmakuClassificationInfo {
  tier: DanmakuTier;
  wishCategory: WishCategory;
  isSpecial: boolean;
  isSpotlightEligible: boolean;
  badgeLabel?: string;
}

export interface TrackLayout {
  trackCount: number;
  trackHeight: number;
  topPadding: number;
  bottomPadding: number;
  topOffsets: number[];
}

export interface VerticalTrackLayout {
  trackCount: number;
  trackWidth: number;
  leftPadding: number;
  rightPadding: number;
  cardMaxWidth: number;
  leftOffsets: number[];
}

export interface DanmakuDimensions {
  width: number;
  height: number;
  cardMaxWidth?: number;
}

export interface DanmakuActiveItem {
  instanceId: string;
  message: Message;
  tierInfo: DanmakuClassificationInfo;
  trackIndex: number;
  axis: DanmakuAxis;
  direction: DanmakuDirection;
  width: number;
  height: number;
  cardMaxWidth?: number;
  speed: number; // px/s
  distTraveled: number; // distance leading edge has traveled from entry edge
  x: number; // viewport left coordinate for translate3d(x, y, 0)
  y: number; // viewport top coordinate for translate3d(x, y, 0)
  launchedAt: number;
  isLiveArrival: boolean;
}

export interface SpotlightState {
  activeMessage: Message | null;
  startedAt: number;
  endsAt: number;
  durationMs: number;
}

export interface DanmakuStepResult {
  spawned: DanmakuActiveItem[];
  removedInstanceIds: string[];
  spotlightChanged: boolean;
  spotlight: SpotlightState;
}

const VALID_WISH_CATEGORIES: ReadonlySet<WishCategory> = new Set([
  'normal',
  'funny',
  'heartfelt',
  'family',
]);

export function isVerticalDirection(direction: DanmakuDirection): boolean {
  return direction === 'ttb' || direction === 'btt';
}

export function getDirectionAxis(direction: DanmakuDirection): DanmakuAxis {
  return DANMAKU_DIRECTION_META[direction]?.axis || (isVerticalDirection(direction) ? 'vertical' : 'horizontal');
}

/**
 * Strict allowlist for explicit guest wish categories.
 * Never auto-upgrades based on emojis or text length.
 */
export function normalizeWishCategory(raw?: unknown): WishCategory {
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase() as WishCategory;
    if (VALID_WISH_CATEGORIES.has(normalized)) {
      return normalized;
    }
  }
  return 'normal';
}

/**
 * Classifies a message for Danmaku rendering & priority behavior.
 * Guaranteed NOT to promote plain messages with emojis into special/featured tiers.
 */
export function classifyDanmakuMessage(msg: Message): DanmakuClassificationInfo {
  const wishCategory = normalizeWishCategory(msg.wish_category);
  const isCoupleSelected = msg.classification === 'COUPLE_SELECTED' || Boolean(msg.is_featured);
  const isSpecialGuest = msg.classification === 'SPECIAL_GUEST';
  const isAiSuggested = msg.classification === 'AI_SUGGESTED';
  const isPinned = Boolean(msg.is_pinned);
  const isExplicitCategory = wishCategory !== 'normal';

  const isSpotlightEligible = isCoupleSelected || isPinned;

  if (isCoupleSelected) {
    return {
      tier: 'spotlight',
      wishCategory,
      isSpecial: true,
      isSpotlightEligible: true,
      badgeLabel: "Couple's Pick",
    };
  }

  if (isSpecialGuest) {
    return {
      tier: 'special',
      wishCategory,
      isSpecial: true,
      isSpotlightEligible,
      badgeLabel: msg.guest_category || 'VIP Guest',
    };
  }

  if (isAiSuggested) {
    return {
      tier: 'special',
      wishCategory,
      isSpecial: true,
      isSpotlightEligible,
      badgeLabel: 'Curated Wish',
    };
  }

  if (isExplicitCategory) {
    const labelMap: Record<Exclude<WishCategory, 'normal'>, string> = {
      heartfelt: 'Heartfelt',
      family: 'Family Blessing',
      funny: 'Playful Toast',
    };
    return {
      tier: 'special',
      wishCategory,
      isSpecial: true,
      isSpotlightEligible,
      badgeLabel: labelMap[wishCategory],
    };
  }

  return {
    tier: 'normal',
    wishCategory: 'normal',
    isSpecial: false,
    isSpotlightEligible,
  };
}

/**
 * Computes responsive horizontal track count and vertical Y offsets
 * for any 16:9 LED projector, desktop monitor, or compact viewport.
 */
export function calculateTrackLayout(
  stageHeight: number,
  config: ResolvedMessageDisplayConfig
): TrackLayout {
  const safeHeight = Math.max(220, stageHeight || 720);
  const topPadding = Math.round(Math.max(16, Math.min(44, safeHeight * 0.04)));
  const bottomPadding = Math.round(Math.max(20, Math.min(56, safeHeight * 0.05)));
  const usableHeight = Math.max(150, stageHeight > 0 ? safeHeight - topPadding - bottomPadding : 150);

  const fontRowPitch: Record<ResolvedMessageDisplayConfig['danmakuFontSize'], number> = {
    sm: 58,
    md: 68,
    lg: 82,
  };
  const basePitch = fontRowPitch[config.danmakuFontSize] || 68;

  let trackCount: number;
  if (typeof config.danmakuTracks === 'number' && Number.isFinite(config.danmakuTracks)) {
    const maxFitting = Math.max(2, Math.floor(usableHeight / 44));
    trackCount = Math.max(2, Math.min(maxFitting, Math.round(config.danmakuTracks)));
  } else {
    trackCount = Math.max(3, Math.min(12, Math.floor(usableHeight / basePitch)));
  }

  const trackHeight = usableHeight / trackCount;
  const topOffsets: number[] = [];
  for (let i = 0; i < trackCount; i++) {
    topOffsets.push(Math.round(topPadding + i * trackHeight));
  }

  return {
    trackCount,
    trackHeight,
    topPadding,
    bottomPadding,
    topOffsets,
  };
}

/**
 * Computes responsive vertical column track layout across viewport width
 * so top-to-bottom and bottom-to-top cards remain horizontal-text readable and non-overlapping.
 */
export function calculateVerticalTrackLayout(
  viewportWidth: number,
  _stageHeight: number,
  config: ResolvedMessageDisplayConfig
): VerticalTrackLayout {
  const safeWidth = Math.max(320, viewportWidth || 1280);
  const leftPadding = Math.round(Math.max(16, Math.min(56, safeWidth * 0.035)));
  const rightPadding = leftPadding;

  const targetMaxWidthBySize: Record<ResolvedMessageDisplayConfig['danmakuFontSize'], number> = {
    sm: 215,
    md: 248,
    lg: 286,
  };
  const desiredMaxWidth = targetMaxWidthBySize[config.danmakuFontSize] || 248;
  const cardMaxWidth = Math.min(desiredMaxWidth, Math.max(175, Math.floor(safeWidth * 0.42)));
  const usableWidth = Math.max(cardMaxWidth, safeWidth - leftPadding - rightPadding);

  const columnGap = 24;
  const maxFitting = Math.max(1, Math.floor((usableWidth + columnGap) / (cardMaxWidth + columnGap)));

  let trackCount: number;
  if (typeof config.danmakuTracks === 'number' && Number.isFinite(config.danmakuTracks)) {
    trackCount = Math.max(1, Math.min(maxFitting, Math.round(config.danmakuTracks)));
  } else {
    trackCount = Math.max(1, Math.min(7, maxFitting));
  }

  const trackWidth = usableWidth / trackCount;
  const leftOffsets: number[] = [];
  for (let i = 0; i < trackCount; i++) {
    const rawLeft = leftPadding + i * trackWidth + Math.max(0, (trackWidth - cardMaxWidth) / 2);
    const clampedLeft = Math.min(safeWidth - cardMaxWidth - 8, Math.max(8, Math.round(rawLeft)));
    leftOffsets.push(clampedLeft);
  }

  return {
    trackCount,
    trackWidth,
    leftPadding,
    rightPadding,
    cardMaxWidth,
    leftOffsets,
  };
}

function measureTextVisualUnits(text: string): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) || 0;
    if (code > 0x2e80) {
      units += 1.05;
    } else {
      units += 0.58;
    }
  }
  return units;
}

/**
 * Estimates character-aware width in pixels (handles Latin + CJK + emojis cleanly)
 * when a DOM node hasn't been measured yet (e.g., unit tests or pre-mount queueing).
 */
export function estimateDanmakuWidthPx(
  msg: Message,
  config: ResolvedMessageDisplayConfig,
  tierInfo: DanmakuClassificationInfo = classifyDanmakuMessage(msg)
): number {
  const fontScale = config.danmakuFontSize === 'sm' ? 15 : config.danmakuFontSize === 'lg' ? 22 : 18;
  const textWidth = measureTextVisualUnits(msg.message || '') * fontScale;
  const senderText = config.showSenderNames && msg.name ? ` — ${msg.name}` : '';
  const senderWidth = senderText ? measureTextVisualUnits(senderText) * fontScale * 0.85 : 0;
  const badgeWidth = tierInfo.badgeLabel
    ? measureTextVisualUnits(tierInfo.badgeLabel) * fontScale * 0.72 + 28
    : 0;
  const chromePadding = tierInfo.isSpecial ? 72 : 52;

  return Math.max(150, Math.ceil(textWidth + senderWidth + badgeWidth + chromePadding));
}

/**
 * Estimates both bounding width and height cleanly for horizontal pills and
 * horizontal-text vertical cards (`ttb` / `btt`).
 */
export function estimateDanmakuDimensions(
  msg: Message,
  config: ResolvedMessageDisplayConfig,
  tierInfo: DanmakuClassificationInfo = classifyDanmakuMessage(msg),
  direction: DanmakuDirection = config.danmakuDirection,
  verticalMaxWidth = 248
): DanmakuDimensions {
  const fontScale = config.danmakuFontSize === 'sm' ? 14 : config.danmakuFontSize === 'lg' ? 20 : 17;

  if (!isVerticalDirection(direction)) {
    const width = estimateDanmakuWidthPx(msg, config, tierInfo);
    const height =
      config.danmakuFontSize === 'sm'
        ? tierInfo.isSpecial
          ? 44
          : 38
        : config.danmakuFontSize === 'lg'
          ? tierInfo.isSpecial
            ? 60
            : 52
          : tierInfo.isSpecial
            ? 52
            : 44;
    return { width, height };
  }

  // Vertical Danmaku keeps text strictly horizontally readable inside a compact card column
  const cardMaxWidth = Math.max(175, verticalMaxWidth);
  const innerLineWidth = Math.max(130, cardMaxWidth - 36);
  const rawTextPx = measureTextVisualUnits(msg.message || '') * fontScale;
  const estimatedWidth = Math.min(cardMaxWidth, Math.max(178, Math.ceil(rawTextPx + 42)));
  const lines = Math.max(1, Math.min(8, Math.ceil(rawTextPx / innerLineWidth)));
  const lineHeightPx = fontScale * 1.42;
  const badgeHeight = tierInfo.isSpecial || tierInfo.badgeLabel ? 24 : 0;
  const senderHeight = config.showSenderNames && msg.name ? 22 : 0;
  const verticalChrome = 28;
  const height = Math.max(72, Math.ceil(verticalChrome + badgeHeight + lines * lineHeightPx + senderHeight));

  return {
    width: estimatedWidth,
    height,
    cardMaxWidth,
  };
}

/**
 * Computes controlled scrolling velocity (px/sec) respecting tier hierarchy,
 * message readability, and axis proportion (vertical travel spans shorter viewport height).
 */
export function computeItemSpeedPxPerSec(
  msg: Message,
  config: ResolvedMessageDisplayConfig,
  tierInfo: DanmakuClassificationInfo,
  jitterSeed = 0.5,
  direction: DanmakuDirection = config.danmakuDirection
): number {
  const preset = DANMAKU_DENSITY_PRESETS[config.danmakuDensity] || DANMAKU_DENSITY_PRESETS.balanced;
  const baseSpeed = config.danmakuSpeed * preset.speedMultiplier;

  const clampedSeed = Math.max(0, Math.min(1, jitterSeed));
  const varianceFactor = 0.93 + clampedSeed * 0.14;

  const tierFactor = tierInfo.tier === 'spotlight' ? 0.8 : tierInfo.isSpecial ? 0.84 : 1.0;

  const len = (msg.message || '').length;
  const lengthFactor = len > 95 ? 0.9 : len < 22 ? 1.04 : 1.0;
  const axisFactor = isVerticalDirection(direction) ? 0.76 : 1.0;

  return Math.round(
    Math.max(42, Math.min(240, baseSpeed * tierFactor * lengthFactor * varianceFactor * axisFactor))
  );
}

/**
 * Computes DOM X position from distance traveled from entry boundary (RTL / LTR).
 */
export function computeItemScreenX(
  distTraveled: number,
  width: number,
  viewportWidth: number,
  direction: DanmakuDirection
): number {
  if (direction === 'ltr') {
    return distTraveled - width;
  }
  return viewportWidth - distTraveled;
}

/**
 * Computes DOM Y position from distance traveled from entry boundary (TTB / BTT).
 * Vertical Danmaku keeps text horizontally oriented and moves top-to-bottom or bottom-to-top.
 */
export function computeItemScreenY(
  distTraveled: number,
  height: number,
  stageHeight: number,
  direction: DanmakuDirection
): number {
  if (direction === 'btt') {
    return stageHeight - distTraveled;
  }
  return distTraveled - height;
}

/**
 * Mathematical collision + anti-catch-up gate for launching a new horizontal item onto a track.
 */
export function canLaunchOnTrack(
  trackItems: ReadonlyArray<
    Pick<DanmakuActiveItem, 'distTraveled' | 'width' | 'speed'> & { direction?: DanmakuDirection }
  >,
  newWidth: number,
  newSpeed: number,
  viewportWidth: number,
  minGapPx: number,
  maxConcurrentPerTrack = 5,
  candidateDirection?: DanmakuDirection
): boolean {
  if (trackItems.length >= maxConcurrentPerTrack) return false;
  if (viewportWidth <= 0) return false;

  const effectiveGap = Math.max(24, Math.min(minGapPx, Math.floor(viewportWidth * 0.25)));
  const catchupGap = Math.max(20, Math.floor(effectiveGap * 0.72));

  for (const existing of trackItems) {
    // Isolate opposing horizontal directions on a track to guarantee zero head-on collisions
    if (candidateDirection && existing.direction && existing.direction !== candidateDirection) {
      return false;
    }

    const existingTailDist = existing.distTraveled - existing.width;
    if (existingTailDist < effectiveGap) {
      return false;
    }

    if (newSpeed > existing.speed) {
      const remainingDistanceToFullExit = viewportWidth + existing.width - existing.distTraveled;
      if (remainingDistanceToFullExit > 0) {
        const timeToExitSec = remainingDistanceToFullExit / Math.max(1, existing.speed);
        const newLeadAtExit = newSpeed * timeToExitSec;
        if (newLeadAtExit > viewportWidth - catchupGap) {
          return false;
        }
      }
    }
  }

  void newWidth;
  return true;
}

/**
 * Mathematical collision + anti-catch-up gate for launching a new vertical item onto a column.
 * Isolates opposing vertical directions (`ttb` vs `btt`) so opposing vertical cards never collide head-on.
 */
export function canLaunchOnVerticalTrack(
  trackItems: ReadonlyArray<
    Pick<DanmakuActiveItem, 'distTraveled' | 'height' | 'speed'> & { direction?: DanmakuDirection }
  >,
  newHeight: number,
  newSpeed: number,
  stageHeight: number,
  minVerticalGapPx: number,
  maxConcurrentPerVerticalTrack = 4,
  candidateDirection?: DanmakuDirection
): boolean {
  if (trackItems.length >= maxConcurrentPerVerticalTrack) return false;
  if (stageHeight <= 0) return false;

  const effectiveGap = Math.max(24, Math.min(minVerticalGapPx, Math.floor(stageHeight * 0.28)));
  const catchupGap = Math.max(18, Math.floor(effectiveGap * 0.72));

  for (const existing of trackItems) {
    if (candidateDirection && existing.direction && existing.direction !== candidateDirection) {
      return false;
    }

    const existingTailDist = existing.distTraveled - existing.height;
    if (existingTailDist < effectiveGap) {
      return false;
    }

    if (newSpeed > existing.speed) {
      const remainingDistanceToFullExit = stageHeight + existing.height - existing.distTraveled;
      if (remainingDistanceToFullExit > 0) {
        const timeToExitSec = remainingDistanceToFullExit / Math.max(1, existing.speed);
        const newLeadAtExit = newSpeed * timeToExitSec;
        if (newLeadAtExit > stageHeight - catchupGap) {
          return false;
        }
      }
    }
  }

  void newHeight;
  return true;
}

function solveMovingVsStaticInterval(
  posStart: number,
  sizeMoving: number,
  velocity: number,
  staticStart: number,
  staticSize: number,
  padding: number
): [number, number] | null {
  if (velocity === 0) {
    const overlaps =
      posStart + sizeMoving > staticStart - padding &&
      posStart < staticStart + staticSize + padding;
    return overlaps ? [-Infinity, Infinity] : null;
  }

  const lowBound = staticStart - padding - (posStart + sizeMoving);
  const highBound = staticStart + staticSize + padding - posStart;

  if (velocity > 0) {
    return [lowBound / velocity, highBound / velocity];
  }
  return [highBound / velocity, lowBound / velocity];
}

/**
 * Exact swept-AABB cross-axis collision predictor for Mixed Mode.
 * Computes the 1D time overlap intervals [tx0, tx1] and [ty0, ty1] over the shared remaining flight horizon.
 * Returns true if the candidate message would pass within `crossGapPx` of any perpendicular active message
 * at the exact same moment in time.
 */
export function willCrossAxesIntersect(
  candidate: {
    x: number;
    y: number;
    width: number;
    height: number;
    direction: DanmakuDirection;
    speed: number;
  },
  crossItems: ReadonlyArray<DanmakuActiveItem>,
  crossGapPx: number,
  viewportWidth: number,
  stageHeight: number
): boolean {
  if (crossItems.length === 0) return false;

  const isCandVertical = isVerticalDirection(candidate.direction);
  const candHorizon = isCandVertical
    ? (stageHeight + candidate.height + 24) / Math.max(1, candidate.speed)
    : (viewportWidth + candidate.width + 24) / Math.max(1, candidate.speed);

  for (const other of crossItems) {
    const isOtherVertical = isVerticalDirection(other.direction);
    if (isCandVertical === isOtherVertical) continue;

    const otherRemaining = isOtherVertical
      ? stageHeight + other.height + 24 - other.distTraveled
      : viewportWidth + other.width + 24 - other.distTraveled;
    if (otherRemaining <= 0) continue;

    const horizon = Math.min(candHorizon, otherRemaining / Math.max(1, other.speed));
    if (horizon <= 0) continue;

    let txInterval: [number, number] | null;
    let tyInterval: [number, number] | null;

    if (!isCandVertical && isOtherVertical) {
      // Candidate moves horizontally; `other` moves vertically
      const vx = candidate.direction === 'ltr' ? candidate.speed : -candidate.speed;
      const vy = other.direction === 'ttb' ? other.speed : -other.speed;
      txInterval = solveMovingVsStaticInterval(
        candidate.x,
        candidate.width,
        vx,
        other.x,
        other.width,
        crossGapPx
      );
      tyInterval = solveMovingVsStaticInterval(
        other.y,
        other.height,
        vy,
        candidate.y,
        candidate.height,
        crossGapPx
      );
    } else {
      // Candidate moves vertically; `other` moves horizontally
      const vx = other.direction === 'ltr' ? other.speed : -other.speed;
      const vy = candidate.direction === 'ttb' ? candidate.speed : -candidate.speed;
      txInterval = solveMovingVsStaticInterval(
        other.x,
        other.width,
        vx,
        candidate.x,
        candidate.width,
        crossGapPx
      );
      tyInterval = solveMovingVsStaticInterval(
        candidate.y,
        candidate.height,
        vy,
        other.y,
        other.height,
        crossGapPx
      );
    }

    if (!txInterval || !tyInterval) continue;

    const overlapStart = Math.max(0, txInterval[0], tyInterval[0]);
    const overlapEnd = Math.min(horizon, txInterval[1], tyInterval[1]);
    if (overlapStart <= overlapEnd) {
      return true;
    }
  }

  return false;
}

/**
 * Ranks and picks the best collision-free horizontal track.
 */
export function selectBestTrack(
  tracks: ReadonlyArray<ReadonlyArray<DanmakuActiveItem>>,
  newWidth: number,
  newSpeed: number,
  viewportWidth: number,
  minGapPx: number,
  maxConcurrentPerTrack: number,
  preferredStartTrack = 0,
  candidateDirection?: DanmakuDirection,
  extraCheck?: (trackIndex: number) => boolean
): number {
  const count = tracks.length;
  if (count === 0) return -1;

  let bestTrack = -1;
  let bestScore = -Infinity;

  for (let offset = 0; offset < count; offset++) {
    const idx = (preferredStartTrack + offset) % count;
    const lane = tracks[idx];
    if (
      !canLaunchOnTrack(
        lane,
        newWidth,
        newSpeed,
        viewportWidth,
        minGapPx,
        maxConcurrentPerTrack,
        candidateDirection
      )
    ) {
      continue;
    }
    if (extraCheck && !extraCheck(idx)) {
      continue;
    }

    if (lane.length === 0) {
      return idx;
    }

    let minTail = Infinity;
    for (const item of lane) {
      const tail = item.distTraveled - item.width;
      if (tail < minTail) minTail = tail;
    }

    const score = minTail - lane.length * 120;
    if (score > bestScore) {
      bestScore = score;
      bestTrack = idx;
    }
  }

  return bestTrack;
}

/**
 * Ranks and picks the best collision-free vertical column track.
 */
export function selectBestVerticalTrack(
  tracks: ReadonlyArray<ReadonlyArray<DanmakuActiveItem>>,
  newHeight: number,
  newSpeed: number,
  stageHeight: number,
  minVerticalGapPx: number,
  maxConcurrentPerVerticalTrack: number,
  preferredStartTrack = 0,
  candidateDirection?: DanmakuDirection,
  extraCheck?: (trackIndex: number) => boolean
): number {
  const count = tracks.length;
  if (count === 0) return -1;

  let bestTrack = -1;
  let bestScore = -Infinity;

  for (let offset = 0; offset < count; offset++) {
    const idx = (preferredStartTrack + offset) % count;
    const column = tracks[idx];
    if (
      !canLaunchOnVerticalTrack(
        column,
        newHeight,
        newSpeed,
        stageHeight,
        minVerticalGapPx,
        maxConcurrentPerVerticalTrack,
        candidateDirection
      )
    ) {
      continue;
    }
    if (extraCheck && !extraCheck(idx)) {
      continue;
    }

    if (column.length === 0) {
      return idx;
    }

    let minTail = Infinity;
    for (const item of column) {
      const tail = item.distTraveled - item.height;
      if (tail < minTail) minTail = tail;
    }

    const score = minTail - column.length * 110;
    if (score > bestScore) {
      bestScore = score;
      bestTrack = idx;
    }
  }

  return bestTrack;
}

/**
 * Core stateful Danmaku + Spotlight orchestrator supporting 4 independent directions
 * (`rtl`, `ltr`, `ttb`, `btt`) across horizontal rows and vertical columns.
 * Zero DOM dependencies—fully runnable in Node.js tests and browser RAF loops alike.
 */
export class DanmakuScheduler {
  private config: ResolvedMessageDisplayConfig;
  private viewportWidth: number;
  private stageHeight: number;
  private layout: TrackLayout;
  private verticalLayout: VerticalTrackLayout;
  private tracks: DanmakuActiveItem[][];
  private verticalTracks: DanmakuActiveItem[][];

  private pool: Message[] = [];
  private liveQueue: Message[] = [];
  private activeMessageIds = new Set<string>();
  private poolCursor = 0;
  private trackRoundRobin = 0;
  private verticalTrackRoundRobin = 0;
  private directionRoundRobin = 0;
  private lastSpawnDirection: DanmakuDirection | null = null;
  private directionLaunchCounts: Record<DanmakuDirection, number> = {
    rtl: 0,
    ltr: 0,
    ttb: 0,
    btt: 0,
  };
  private mixedBlockCount = 0;
  private spawnCooldownMs = 0;
  private instanceSeq = 0;

  // Spotlight & Pinned Cooldown management
  private spotlight: SpotlightState = {
    activeMessage: null,
    startedAt: 0,
    endsAt: 0,
    durationMs: 7000,
  };
  private spotlightQueue: Message[] = [];
  private spotlightHistory = new Map<string, number>();
  private nextSpotlightEligibleAt = 0;
  private lastSpotlightId: string | null = null;
  private simNowMs = 0;

  constructor(
    viewportWidth = 1280,
    stageHeight = 720,
    config?: Partial<MessageDisplayConfig> | null
  ) {
    this.config = resolveDisplayConfig(config || DEFAULT_MESSAGE_DISPLAY_CONFIG);
    this.viewportWidth = Math.max(320, viewportWidth);
    this.stageHeight = Math.max(220, stageHeight);
    this.layout = calculateTrackLayout(this.stageHeight, this.config);
    this.verticalLayout = calculateVerticalTrackLayout(this.viewportWidth, this.stageHeight, this.config);
    this.tracks = Array.from({ length: this.layout.trackCount }, () => []);
    this.verticalTracks = Array.from({ length: this.verticalLayout.trackCount }, () => []);
    this.nextSpotlightEligibleAt = 9500;
  }

  getConfig(): ResolvedMessageDisplayConfig {
    return this.config;
  }

  getLayout(): TrackLayout {
    return this.layout;
  }

  getVerticalLayout(): VerticalTrackLayout {
    return this.verticalLayout;
  }

  getActiveItems(): DanmakuActiveItem[] {
    return [...this.tracks.flat(), ...this.verticalTracks.flat()];
  }

  getDirectionLaunchCounts(): Record<DanmakuDirection, number> {
    return { ...this.directionLaunchCounts };
  }

  getPoolMessages(): Message[] {
    return [...this.pool];
  }

  getSpotlightState(): SpotlightState {
    return { ...this.spotlight };
  }

  getPendingQueueLength(): number {
    return this.liveQueue.length;
  }

  updateConfig(config?: Partial<MessageDisplayConfig> | null): void {
    const prevTracks = this.layout.trackCount;
    const prevVerticalTracks = this.verticalLayout.trackCount;
    this.config = resolveDisplayConfig(config || DEFAULT_MESSAGE_DISPLAY_CONFIG);
    this.layout = calculateTrackLayout(this.stageHeight, this.config);
    this.verticalLayout = calculateVerticalTrackLayout(this.viewportWidth, this.stageHeight, this.config);
    if (this.layout.trackCount !== prevTracks) {
      this.rebalanceTracks();
    }
    if (this.verticalLayout.trackCount !== prevVerticalTracks) {
      this.rebalanceVerticalTracks();
    }
  }

  resize(viewportWidth: number, stageHeight: number): void {
    this.viewportWidth = Math.max(320, viewportWidth || 1280);
    this.stageHeight = Math.max(220, stageHeight || 720);
    const prevTracks = this.layout.trackCount;
    const prevVerticalTracks = this.verticalLayout.trackCount;

    this.layout = calculateTrackLayout(this.stageHeight, this.config);
    this.verticalLayout = calculateVerticalTrackLayout(this.viewportWidth, this.stageHeight, this.config);

    if (this.layout.trackCount !== prevTracks) {
      this.rebalanceTracks();
    } else {
      for (let i = 0; i < this.tracks.length; i++) {
        const y = this.layout.topOffsets[i] ?? 0;
        for (const item of this.tracks[i]) {
          item.y = y;
        }
      }
    }

    if (this.verticalLayout.trackCount !== prevVerticalTracks) {
      this.rebalanceVerticalTracks();
    } else {
      for (let i = 0; i < this.verticalTracks.length; i++) {
        const x = this.verticalLayout.leftOffsets[i] ?? 0;
        for (const item of this.verticalTracks[i]) {
          item.x = x;
          item.cardMaxWidth = this.verticalLayout.cardMaxWidth;
        }
      }
    }
  }

  private rebalanceTracks(): void {
    const allActive = this.tracks.flat();
    this.tracks = Array.from({ length: this.layout.trackCount }, () => []);
    for (const item of allActive) {
      const clampedTrack = Math.min(item.trackIndex, this.layout.trackCount - 1);
      item.trackIndex = clampedTrack;
      item.y = this.layout.topOffsets[clampedTrack] ?? 0;
      this.tracks[clampedTrack].push(item);
    }
  }

  private rebalanceVerticalTracks(): void {
    const allActive = this.verticalTracks.flat();
    this.verticalTracks = Array.from({ length: this.verticalLayout.trackCount }, () => []);
    for (const item of allActive) {
      const clampedTrack = Math.min(item.trackIndex, this.verticalLayout.trackCount - 1);
      item.trackIndex = clampedTrack;
      item.x = this.verticalLayout.leftOffsets[clampedTrack] ?? 0;
      item.cardMaxWidth = this.verticalLayout.cardMaxWidth;
      this.verticalTracks[clampedTrack].push(item);
    }
  }

  setMessages(messages: Message[]): void {
    const valid = messages.filter((m) => m && m.id && (!m.status || m.status === 'approved'));
    const dedupMap = new Map<string, Message>();
    for (const m of valid) {
      dedupMap.set(m.id, m);
    }
    const deduped = Array.from(dedupMap.values());
    const validIds = new Set(deduped.map((m) => m.id));

    const previousIds = new Set(this.pool.map((m) => m.id));
    this.pool = scheduleMessageRotation(deduped, this.config);
    if (this.poolCursor >= this.pool.length) {
      this.poolCursor = 0;
    }

    if (previousIds.size > 0) {
      for (const m of deduped) {
        if (!previousIds.has(m.id)) {
          this.pushLiveInternal(m);
        }
      }
    }

    this.liveQueue = this.liveQueue.filter((m) => validIds.has(m.id));
    this.spotlightQueue = this.spotlightQueue.filter((m) => validIds.has(m.id));

    const updateTrackItems = (lanes: DanmakuActiveItem[][]) => {
      for (let t = 0; t < lanes.length; t++) {
        lanes[t] = lanes[t].filter((item) => {
          const latest = dedupMap.get(item.message.id);
          if (!latest) {
            this.activeMessageIds.delete(item.message.id);
            return false;
          }
          item.message = latest;
          item.tierInfo = classifyDanmakuMessage(latest);
          return true;
        });
      }
    };

    updateTrackItems(this.tracks);
    updateTrackItems(this.verticalTracks);

    if (this.spotlight.activeMessage && !validIds.has(this.spotlight.activeMessage.id)) {
      this.spotlight = {
        activeMessage: null,
        startedAt: 0,
        endsAt: 0,
        durationMs: (this.config.spotlightDuration || 7) * 1000,
      };
    }
  }

  enqueueLiveMessage(msg: Message): boolean {
    if (!msg || !msg.id) return false;
    if (msg.status && msg.status !== 'approved') return false;

    const alreadyInPool = this.pool.some((m) => m.id === msg.id);
    if (alreadyInPool) {
      this.pool = this.pool.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
      const info = classifyDanmakuMessage(msg);
      if (info.isSpotlightEligible && !this.spotlightQueue.some((m) => m.id === msg.id)) {
        this.spotlightQueue.unshift(msg);
      }
      return false;
    }

    this.pool = scheduleMessageRotation([msg, ...this.pool], this.config);
    this.pushLiveInternal(msg);
    return true;
  }

  private pushLiveInternal(msg: Message): void {
    if (!this.liveQueue.some((m) => m.id === msg.id) && !this.activeMessageIds.has(msg.id)) {
      this.liveQueue.push(msg);
    }
    const info = classifyDanmakuMessage(msg);
    if (info.isSpotlightEligible && !this.spotlightQueue.some((m) => m.id === msg.id)) {
      this.spotlightQueue.unshift(msg);
    }
  }

  /**
   * Updates an active item's exact measured DOM width (and height if provided) right after mount.
   */
  updateMeasuredWidth(instanceId: string, actualWidth: number): void {
    this.updateMeasuredDimensions(instanceId, actualWidth);
  }

  updateMeasuredDimensions(instanceId: string, actualWidth?: number, actualHeight?: number): void {
    for (const lane of this.tracks) {
      const target = lane.find((i) => i.instanceId === instanceId);
      if (target) {
        if (typeof actualWidth === 'number' && Number.isFinite(actualWidth) && actualWidth > 0) {
          target.width = Math.ceil(actualWidth);
          if (target.direction === 'ltr') {
            target.x = computeItemScreenX(target.distTraveled, target.width, this.viewportWidth, 'ltr');
          }
        }
        if (typeof actualHeight === 'number' && Number.isFinite(actualHeight) && actualHeight > 0) {
          target.height = Math.ceil(actualHeight);
        }
        return;
      }
    }

    for (const column of this.verticalTracks) {
      const target = column.find((i) => i.instanceId === instanceId);
      if (target) {
        if (typeof actualWidth === 'number' && Number.isFinite(actualWidth) && actualWidth > 0) {
          target.width = Math.ceil(actualWidth);
        }
        if (typeof actualHeight === 'number' && Number.isFinite(actualHeight) && actualHeight > 0) {
          target.height = Math.ceil(actualHeight);
          if (target.direction === 'ttb') {
            target.y = computeItemScreenY(target.distTraveled, target.height, this.stageHeight, 'ttb');
          }
        }
        return;
      }
    }
  }

  dismissSpotlight(): void {
    if (!this.spotlight.activeMessage) return;
    this.spotlight = {
      activeMessage: null,
      startedAt: 0,
      endsAt: 0,
      durationMs: (this.config.spotlightDuration || 7) * 1000,
    };
    const gapBetweenSpotlightsMs = Math.max(10000, (this.config.featuredFrequency || 3) * 5000);
    this.nextSpotlightEligibleAt = this.simNowMs + gapBetweenSpotlightsMs;
  }

  selectNextSpotlightCandidate(nowMs: number): Message | null {
    while (this.spotlightQueue.length > 0) {
      const next = this.spotlightQueue.shift()!;
      if (this.pool.some((m) => m.id === next.id)) {
        return next;
      }
    }

    const candidates = this.pool.filter((m) => classifyDanmakuMessage(m).isSpotlightEligible);
    if (candidates.length === 0) return null;

    const pinnedCooldownMs = Math.max(25000, (this.config.spotlightDuration || 7) * 3500);
    const regularCooldownMs = Math.max(15000, (this.config.spotlightDuration || 7) * 2000);

    const sortedCandidates = [...candidates].sort((a, b) => {
      const aLast = this.spotlightHistory.get(a.id) ?? -Infinity;
      const bLast = this.spotlightHistory.get(b.id) ?? -Infinity;

      const aPinnedReady = Boolean(a.is_pinned) && nowMs - aLast >= pinnedCooldownMs;
      const bPinnedReady = Boolean(b.is_pinned) && nowMs - bLast >= pinnedCooldownMs;

      if (aPinnedReady !== bPinnedReady) return aPinnedReady ? -1 : 1;
      if (aLast !== bLast) return aLast - bLast;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    for (const candidate of sortedCandidates) {
      const last = this.spotlightHistory.get(candidate.id) ?? -Infinity;
      const cooldown = candidate.is_pinned ? pinnedCooldownMs : regularCooldownMs;
      if (candidates.length > 1 && candidate.id === this.lastSpotlightId) {
        continue;
      }
      if (nowMs - last >= cooldown || last === -Infinity) {
        return candidate;
      }
    }

    const single = sortedCandidates[0];
    const singleLast = this.spotlightHistory.get(single.id) ?? -Infinity;
    const singleCooldown = single.is_pinned ? pinnedCooldownMs : regularCooldownMs;
    if (nowMs - singleLast >= singleCooldown) {
      return single;
    }

    return null;
  }

  /**
   * Determines candidate directions ordered for balanced distribution in Mixed mode
   * or exact selection in Single Direction mode.
   */
  private getOrderedCandidateDirections(): DanmakuDirection[] {
    if (this.config.danmakuDirectionMode !== 'mixed') {
      return [this.config.danmakuDirection];
    }

    const configured =
      this.config.danmakuDirections && this.config.danmakuDirections.length > 0
        ? this.config.danmakuDirections
        : ALL_DANMAKU_DIRECTIONS;

    // Count active items per direction so under-represented streams get priority
    const activeByDir: Record<DanmakuDirection, number> = { rtl: 0, ltr: 0, ttb: 0, btt: 0 };
    for (const lane of this.tracks) {
      for (const item of lane) activeByDir[item.direction] += 1;
    }
    for (const col of this.verticalTracks) {
      for (const item of col) activeByDir[item.direction] += 1;
    }

    const rotated = configured.map((_, idx) => configured[(this.directionRoundRobin + idx) % configured.length]);
    const sorted = [...rotated].sort((a, b) => {
      // 1. Prefer directions with fewer historical launches so all 4 directions stay balanced
      const launchDiff = this.directionLaunchCounts[a] - this.directionLaunchCounts[b];
      if (Math.abs(launchDiff) >= 1) return launchDiff;

      // 2. Prefer directions with fewer currently active items
      const activeDiff = activeByDir[a] - activeByDir[b];
      if (activeDiff !== 0) return activeDiff;

      // 3. Avoid consecutive identical direction when options exist
      if (configured.length > 1) {
        if (a === this.lastSpawnDirection && b !== this.lastSpawnDirection) return 1;
        if (b === this.lastSpawnDirection && a !== this.lastSpawnDirection) return -1;
      }
      return 0;
    });

    // Enforce bounded fairness skew so fast-clearing horizontal lanes cannot permanently starve vertical columns
    if (configured.length > 1 && this.mixedBlockCount < 10) {
      let minLaunch = Infinity;
      for (const dir of configured) {
        if (this.directionLaunchCounts[dir] < minLaunch) {
          minLaunch = this.directionLaunchCounts[dir];
        }
      }
      const bounded = sorted.filter((d) => this.directionLaunchCounts[d] <= minLaunch + 1);
      if (bounded.length > 0) {
        return bounded;
      }
    }

    return sorted;
  }

  step(
    dtMs: number,
    measureWidth?: (msg: Message, tierInfo: DanmakuClassificationInfo) => number
  ): DanmakuStepResult {
    const safeDt = Math.max(0, Math.min(dtMs, 100));
    this.simNowMs += safeDt;
    const spawned: DanmakuActiveItem[] = [];
    const removedInstanceIds: string[] = [];
    let spotlightChanged = false;

    // 1. Spotlight lifecycle
    if (this.spotlight.activeMessage) {
      if (this.simNowMs >= this.spotlight.endsAt) {
        this.dismissSpotlight();
        spotlightChanged = true;
      }
    } else if (this.simNowMs >= this.nextSpotlightEligibleAt && this.pool.length > 0) {
      const nextSpotlight = this.selectNextSpotlightCandidate(this.simNowMs);
      if (nextSpotlight) {
        const durationMs = (this.config.spotlightDuration || 7) * 1000;
        this.spotlight = {
          activeMessage: nextSpotlight,
          startedAt: this.simNowMs,
          endsAt: this.simNowMs + durationMs,
          durationMs,
        };
        this.spotlightHistory.set(nextSpotlight.id, this.simNowMs);
        this.lastSpotlightId = nextSpotlight.id;
        spotlightChanged = true;
      } else {
        this.nextSpotlightEligibleAt = this.simNowMs + 2500;
      }
    }

    // 2. Advance active horizontal & vertical items smoothly
    const spotlightPaceFactor = this.spotlight.activeMessage ? 0.35 : 1.0;
    const dtSec = (safeDt / 1000) * spotlightPaceFactor;

    for (let t = 0; t < this.tracks.length; t++) {
      const remaining: DanmakuActiveItem[] = [];
      for (const item of this.tracks[t]) {
        item.distTraveled += item.speed * dtSec;
        if (item.distTraveled >= this.viewportWidth + item.width + 24) {
          removedInstanceIds.push(item.instanceId);
          this.activeMessageIds.delete(item.message.id);
        } else {
          item.x = computeItemScreenX(item.distTraveled, item.width, this.viewportWidth, item.direction);
          remaining.push(item);
        }
      }
      this.tracks[t] = remaining;
    }

    for (let c = 0; c < this.verticalTracks.length; c++) {
      const remaining: DanmakuActiveItem[] = [];
      for (const item of this.verticalTracks[c]) {
        item.distTraveled += item.speed * dtSec;
        if (item.distTraveled >= this.stageHeight + item.height + 24) {
          removedInstanceIds.push(item.instanceId);
          this.activeMessageIds.delete(item.message.id);
        } else {
          item.y = computeItemScreenY(item.distTraveled, item.height, this.stageHeight, item.direction);
          remaining.push(item);
        }
      }
      this.verticalTracks[c] = remaining;
    }

    // 3. Spawn next message if not suppressed by spotlight & cooldown ready
    this.spawnCooldownMs = Math.max(0, this.spawnCooldownMs - safeDt);
    const preset = DANMAKU_DENSITY_PRESETS[this.config.danmakuDensity] || DANMAKU_DENSITY_PRESETS.balanced;

    if (!this.spotlight.activeMessage && this.spawnCooldownMs <= 0 && (this.liveQueue.length > 0 || this.pool.length > 0)) {
      const totalActive =
        this.tracks.reduce((sum, lane) => sum + lane.length, 0) +
        this.verticalTracks.reduce((sum, col) => sum + col.length, 0);

      // Enforce overall viewport cap smoothly so Mixed Mode stays legible & balanced per preset
      const effectiveCap = this.liveQueue.length > 0 ? preset.maxTotalActive + 2 : preset.maxTotalActive;
      const spawnedItem =
        totalActive < effectiveCap
          ? this.trySpawnNext(preset, measureWidth)
          : null;

      if (spawnedItem) {
        this.mixedBlockCount = 0;
        spawned.push(spawnedItem);
        const newTotalActive = totalActive + 1;
        const availableAxisSlots =
          this.config.danmakuDirectionMode === 'mixed'
            ? Math.min(6, this.layout.trackCount + this.verticalLayout.trackCount)
            : isVerticalDirection(this.config.danmakuDirection)
              ? this.verticalLayout.trackCount
              : this.layout.trackCount;
        const targetWarmupCount = Math.min(3, availableAxisSlots, this.pool.length);

        if (this.liveQueue.length > 0) {
          this.spawnCooldownMs = Math.min(460, preset.spawnIntervalMs * 0.45);
        } else if (newTotalActive < targetWarmupCount) {
          this.spawnCooldownMs = Math.min(440, preset.spawnIntervalMs * 0.42);
        } else {
          this.spawnCooldownMs = preset.spawnIntervalMs;
        }
      } else {
        this.mixedBlockCount += 1;
        this.spawnCooldownMs = 150;
      }
    }

    return {
      spawned,
      removedInstanceIds,
      spotlightChanged,
      spotlight: { ...this.spotlight },
    };
  }

  private trySpawnNext(
    preset: (typeof DANMAKU_DENSITY_PRESETS)[keyof typeof DANMAKU_DENSITY_PRESETS],
    measureWidth?: (msg: Message, tierInfo: DanmakuClassificationInfo) => number
  ): DanmakuActiveItem | null {
    let candidate: Message | null = null;
    let isLiveArrival = false;
    let pickedPoolIdx = -1;

    if (this.liveQueue.length > 0) {
      candidate = this.liveQueue[0];
      isLiveArrival = true;
    } else if (this.pool.length > 0) {
      for (let attempts = 0; attempts < this.pool.length; attempts++) {
        const idx = (this.poolCursor + attempts) % this.pool.length;
        const msg = this.pool[idx];
        if (!this.activeMessageIds.has(msg.id) || this.pool.length <= 3) {
          candidate = msg;
          pickedPoolIdx = idx;
          break;
        }
      }
    }

    if (!candidate) return null;

    const tierInfo = classifyDanmakuMessage(candidate);
    const seed = ((this.instanceSeq * 37) % 100) / 100;
    const candidateDirections = this.getOrderedCandidateDirections();

    const activeHorizontal = this.tracks.flat();
    const activeVertical = this.verticalTracks.flat();

    const configuredDirs =
      this.config.danmakuDirectionMode === 'mixed'
        ? this.config.danmakuDirections
        : [this.config.danmakuDirection];
    const hasHorizConfigured = configuredDirs.some((d) => !isVerticalDirection(d));
    const hasVertConfigured = configuredDirs.some((d) => isVerticalDirection(d));
    const hasDualAxes = this.config.danmakuDirectionMode === 'mixed' && hasHorizConfigured && hasVertConfigured;

    const maxPerAxis =
      this.config.danmakuDensity === 'relaxed'
        ? 2
        : this.config.danmakuDensity === 'celebration'
          ? 6
          : 4;

    for (const direction of candidateDirections) {
      const vertical = isVerticalDirection(direction);

      // Keep horizontal and vertical streams harmoniously proportioned in dual-axis Mixed Mode
      if (hasDualAxes && !isLiveArrival) {
        if (vertical && activeVertical.length >= maxPerAxis) {
          continue;
        }
        if (!vertical && activeHorizontal.length >= maxPerAxis) {
          continue;
        }
      }

      const dims = estimateDanmakuDimensions(
        candidate,
        this.config,
        tierInfo,
        direction,
        this.verticalLayout.cardMaxWidth
      );
      if (!vertical && measureWidth) {
        dims.width = Math.max(120, Math.ceil(measureWidth(candidate, tierInfo)));
      }
      const speed = computeItemSpeedPxPerSec(candidate, this.config, tierInfo, seed, direction);

      if (!vertical) {
        const trackIdx = selectBestTrack(
          this.tracks,
          dims.width,
          speed,
          this.viewportWidth,
          preset.minGapPx,
          preset.maxConcurrentPerTrack,
          this.trackRoundRobin,
          direction,
          (idx) => {
            const x = computeItemScreenX(0, dims.width, this.viewportWidth, direction);
            const y = this.layout.topOffsets[idx] ?? 0;
            return !willCrossAxesIntersect(
              { x, y, width: dims.width, height: dims.height, direction, speed },
              activeVertical,
              preset.crossGapPx,
              this.viewportWidth,
              this.stageHeight
            );
          }
        );

        if (trackIdx === -1) continue;

        if (isLiveArrival) {
          this.liveQueue.shift();
        } else if (pickedPoolIdx !== -1) {
          this.poolCursor = (pickedPoolIdx + 1) % this.pool.length;
        }

        const horizStride = this.tracks.length >= 5 ? 3 : 1;
        this.trackRoundRobin = (trackIdx + horizStride) % this.tracks.length;
        this.directionRoundRobin = (this.directionRoundRobin + 1) % Math.max(1, candidateDirections.length);
        this.lastSpawnDirection = direction;
        this.directionLaunchCounts[direction] += 1;
        this.instanceSeq += 1;

        const instanceId = `dmk-${this.instanceSeq}-${candidate.id}`;
        const y = this.layout.topOffsets[trackIdx] ?? 0;
        const x = computeItemScreenX(0, dims.width, this.viewportWidth, direction);

        const activeItem: DanmakuActiveItem = {
          instanceId,
          message: candidate,
          tierInfo,
          trackIndex: trackIdx,
          axis: 'horizontal',
          direction,
          width: dims.width,
          height: dims.height,
          speed,
          distTraveled: 0,
          x,
          y,
          launchedAt: this.simNowMs,
          isLiveArrival,
        };

        this.tracks[trackIdx].push(activeItem);
        this.activeMessageIds.add(candidate.id);
        return activeItem;
      } else {
        const colIdx = selectBestVerticalTrack(
          this.verticalTracks,
          dims.height,
          speed,
          this.stageHeight,
          preset.minVerticalGapPx,
          preset.maxConcurrentPerVerticalTrack,
          this.verticalTrackRoundRobin,
          direction,
          (idx) => {
            const x = this.verticalLayout.leftOffsets[idx] ?? 0;
            const y = computeItemScreenY(0, dims.height, this.stageHeight, direction);
            return !willCrossAxesIntersect(
              { x, y, width: dims.width, height: dims.height, direction, speed },
              activeHorizontal,
              preset.crossGapPx,
              this.viewportWidth,
              this.stageHeight
            );
          }
        );

        if (colIdx === -1) continue;

        if (isLiveArrival) {
          this.liveQueue.shift();
        } else if (pickedPoolIdx !== -1) {
          this.poolCursor = (pickedPoolIdx + 1) % this.pool.length;
        }

        this.verticalTrackRoundRobin = (colIdx + 1) % this.verticalTracks.length;
        this.directionRoundRobin = (this.directionRoundRobin + 1) % Math.max(1, candidateDirections.length);
        this.lastSpawnDirection = direction;
        this.directionLaunchCounts[direction] += 1;
        this.instanceSeq += 1;

        const instanceId = `dmk-${this.instanceSeq}-${candidate.id}`;
        const x = this.verticalLayout.leftOffsets[colIdx] ?? 0;
        const y = computeItemScreenY(0, dims.height, this.stageHeight, direction);

        const activeItem: DanmakuActiveItem = {
          instanceId,
          message: candidate,
          tierInfo,
          trackIndex: colIdx,
          axis: 'vertical',
          direction,
          width: dims.width,
          height: dims.height,
          cardMaxWidth: dims.cardMaxWidth || this.verticalLayout.cardMaxWidth,
          speed,
          distTraveled: 0,
          x,
          y,
          launchedAt: this.simNowMs,
          isLiveArrival,
        };

        this.verticalTracks[colIdx].push(activeItem);
        this.activeMessageIds.add(candidate.id);
        return activeItem;
      }
    }

    return null;
  }
}

/**
 * Deduplicates and merges live/reconnected message batches by ID while preserving
 * updated moderation flags (classification, is_featured, is_pinned, status) and timestamps.
 */
export function mergeAndDeduplicateMessages(
  existing: ReadonlyArray<Message>,
  incoming: ReadonlyArray<Message>,
  maxCount = 100,
  replaceWithSnapshot = false
): Message[] {
  const byId = new Map<string, Message>();

  if (!replaceWithSnapshot) {
    for (const msg of existing) {
      if (msg && msg.id && (!msg.status || msg.status === 'approved')) {
        byId.set(msg.id, msg);
      }
    }
  }

  for (const msg of incoming) {
    if (!msg || !msg.id) continue;
    if (msg.status && msg.status !== 'approved') {
      byId.delete(msg.id);
      continue;
    }
    const prev = byId.get(msg.id);
    byId.set(msg.id, prev ? { ...prev, ...msg } : msg);
  }

  return Array.from(byId.values())
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, maxCount);
}
