import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Heart, Pin, Sparkles, Star } from 'lucide-react';
import {
  DanmakuActiveItem,
  DanmakuClassificationInfo,
  DanmakuScheduler,
  classifyDanmakuMessage,
} from '../../lib/danmakuEngine';
import { ResolvedEventTheme } from '../../lib/eventTheme';
import {
  Message,
  MessageDisplayConfig,
  ResolvedMessageDisplayConfig,
  resolveDisplayConfig,
} from '../../types';

interface CelebrationBurst {
  id: string;
  leftPercent: number;
  bottomPercent: number;
  kind: 'heart' | 'sparkle';
}

interface DanmakuStageProps {
  messages: Message[];
  liveSignalCount: number;
  latestLiveMessage: Message | null;
  theme: ResolvedEventTheme;
  displayConfig: MessageDisplayConfig;
  isPaused?: boolean;
  isSpotlightActive?: boolean;
  onSpotlightChange?: (activeMsg: Message | null, startedAt: number, durationMs: number) => void;
}

/**
 * Reusable visual card/pill for both the live Danmaku stage and Moderator preview.
 * Vertical-axis wishes (`ttb` / `btt`) render as compact horizontal-text cards so
 * wording stays upright and effortlessly readable without rotation.
 */
export const DanmakuPillCard: React.FC<{
  message: Message;
  tierInfo?: DanmakuClassificationInfo;
  theme: ResolvedEventTheme;
  config: ResolvedMessageDisplayConfig;
  isLiveArrival?: boolean;
  orientation?: 'horizontal' | 'vertical';
  maxWidthPx?: number;
}> = ({
  message,
  tierInfo: providedTierInfo,
  theme,
  config,
  isLiveArrival,
  orientation = 'horizontal',
  maxWidthPx = 248,
}) => {
  const tierInfo = providedTierInfo || classifyDanmakuMessage(message);
  const isSpecial = tierInfo.isSpecial;
  const isSpotlight = tierInfo.tier === 'spotlight';
  const specialStyle = config.danmakuSpecialStyle;
  const isVerticalCard = orientation === 'vertical';

  const sizeClass = isVerticalCard
    ? config.danmakuFontSize === 'sm'
      ? isSpecial
        ? 'text-sm sm:text-base px-4 py-2.5'
        : 'text-xs sm:text-sm px-3.5 py-2'
      : config.danmakuFontSize === 'lg'
        ? isSpecial
          ? 'text-lg sm:text-xl px-5 py-3.5'
          : 'text-base sm:text-lg px-4.5 py-3'
        : isSpecial
          ? 'text-base sm:text-lg px-4.5 py-3'
          : 'text-sm sm:text-base px-4 py-2.5'
    : config.danmakuFontSize === 'sm'
      ? isSpecial
        ? 'text-base sm:text-lg px-4 py-2'
        : 'text-sm sm:text-base px-4 py-1.5'
      : config.danmakuFontSize === 'lg'
        ? isSpecial
          ? 'text-xl sm:text-2xl px-6 py-3'
          : 'text-lg sm:text-xl px-5 py-2.5'
        : isSpecial
          ? 'text-lg sm:text-xl px-5 py-2.5'
          : 'text-base sm:text-lg px-4.5 py-2';

  const pillRadiusClass = isVerticalCard
    ? theme.id === 'digital'
      ? 'rounded-md'
      : 'rounded-2xl'
    : theme.id === 'digital'
      ? 'rounded-sm'
      : theme.id === 'postal' || theme.id === 'polaroid'
        ? 'rounded-xl'
        : 'rounded-full';

  // Build luxury surface + border styling synchronized to theme.isDark and specialStyle
  let surfaceStyle = '';
  let accentIconColor = theme.colors.accent;
  let senderTextColor = theme.colors.subtleText;
  let bodyTextColor = theme.colors.text;

  if (theme.isDark) {
    if (isSpecial && specialStyle === 'champagne-gold') {
      surfaceStyle =
        'bg-[#1B1712]/88 border border-[#E5C87B]/55 shadow-[0_8px_32px_rgba(212,175,55,0.18)] backdrop-blur-xl text-[#FAF5E8]';
      accentIconColor = 'text-[#E5C87B]';
      senderTextColor = 'text-[#E5C87B]/85';
      bodyTextColor = 'text-[#FAF5E8]';
    } else if (isSpecial && specialStyle === 'theme-accent') {
      surfaceStyle =
        'bg-white/14 border border-white/35 shadow-[0_8px_30px_rgba(255,255,255,0.12)] backdrop-blur-xl text-white';
      senderTextColor = 'text-white/75';
      bodyTextColor = 'text-white';
    } else if (isSpecial) {
      surfaceStyle =
        'bg-[#16181F]/88 border border-white/30 shadow-lg backdrop-blur-xl text-white';
      senderTextColor = 'text-white/75';
      bodyTextColor = 'text-white';
    } else {
      surfaceStyle =
        'bg-[#11131B]/72 border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.3)] backdrop-blur-md text-white/95';
      senderTextColor = 'text-white/60';
      bodyTextColor = 'text-white/95';
    }
  } else {
    if (isSpecial && specialStyle === 'champagne-gold') {
      surfaceStyle =
        'bg-gradient-to-r from-[#FFFDF7]/96 via-[#FFF9EC]/96 to-[#FFFDF7]/96 border border-[#C9A24D]/55 shadow-[0_8px_28px_rgba(191,161,95,0.2)] backdrop-blur-xl text-[#2C2416]';
      accentIconColor = 'text-[#A67C2E]';
      senderTextColor = 'text-[#7B6232]';
      bodyTextColor = 'text-[#251E12]';
    } else if (isSpecial && specialStyle === 'theme-accent') {
      surfaceStyle = `${theme.card.surface} border-2 ${theme.colors.border} shadow-lg backdrop-blur-xl ${theme.colors.text}`;
    } else if (isSpecial) {
      surfaceStyle =
        'bg-white/95 border border-stone-400/50 shadow-md backdrop-blur-xl text-stone-900';
      accentIconColor = 'text-stone-700';
      senderTextColor = 'text-stone-600';
      bodyTextColor = 'text-stone-900';
    } else {
      surfaceStyle =
        'bg-white/84 border border-black/10 shadow-[0_4px_18px_rgba(20,20,20,0.06)] backdrop-blur-md text-[#1F1F1C]';
      senderTextColor = 'text-[#5A5750]';
      bodyTextColor = 'text-[#1F1F1C]';
    }
  }

  const renderLeadingIcon = () => {
    if (message.is_pinned) {
      return <Pin className={`w-3.5 h-3.5 shrink-0 ${accentIconColor}`} />;
    }
    if (isSpotlight) {
      return <Star className={`w-4 h-4 shrink-0 fill-current ${accentIconColor}`} />;
    }
    if (message.classification === 'SPECIAL_GUEST') {
      return <Crown className={`w-4 h-4 shrink-0 ${accentIconColor}`} />;
    }
    if (message.classification === 'AI_SUGGESTED') {
      return <Sparkles className={`w-4 h-4 shrink-0 ${accentIconColor}`} />;
    }
    if (tierInfo.wishCategory === 'heartfelt' || tierInfo.wishCategory === 'family') {
      return <Heart className={`w-3.5 h-3.5 shrink-0 fill-current ${accentIconColor}`} />;
    }
    if (tierInfo.wishCategory === 'funny') {
      return <Sparkles className={`w-3.5 h-3.5 shrink-0 ${accentIconColor}`} />;
    }
    if (isLiveArrival) {
      return <Heart className={`w-3.5 h-3.5 shrink-0 ${accentIconColor}`} />;
    }
    return null;
  };

  if (isVerticalCard) {
    const leadingIcon = renderLeadingIcon();
    return (
      <div
        className={`flex flex-col gap-1.5 whitespace-normal select-none ${pillRadiusClass} ${sizeClass} ${surfaceStyle} ${
          isSpecial ? theme.fontHeading : theme.fontBody
        }`}
        style={{
          opacity: isSpecial ? 1 : config.danmakuOpacity,
          maxWidth: `${maxWidthPx}px`,
          width: 'max-content',
          minWidth: '176px',
        }}
      >
        {(leadingIcon || (isSpecial && tierInfo.badgeLabel)) && (
          <div className="flex items-center gap-1.5">
            {leadingIcon}
            {isSpecial && tierInfo.badgeLabel && (
              <span
                className={`text-[10px] uppercase tracking-[0.14em] font-sans font-semibold ${accentIconColor}`}
              >
                {tierInfo.badgeLabel}
              </span>
            )}
          </div>
        )}

        <p className={`font-normal tracking-tight leading-snug break-words ${bodyTextColor}`}>
          {message.message}
        </p>

        {config.showSenderNames && message.name && (
          <span className={`text-[11px] sm:text-xs font-sans font-medium tracking-wide ${senderTextColor}`}>
            — {message.name}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-3 whitespace-nowrap select-none ${pillRadiusClass} ${sizeClass} ${surfaceStyle} ${
        isSpecial ? theme.fontHeading : theme.fontBody
      }`}
      style={{
        opacity: isSpecial ? 1 : config.danmakuOpacity,
      }}
    >
      {renderLeadingIcon()}

      {/* Optional compact tier/category kicker for special messages */}
      {isSpecial && tierInfo.badgeLabel && (
        <span
          className={`text-[10px] uppercase tracking-[0.14em] font-sans font-semibold pr-2 border-r ${
            theme.isDark ? 'border-white/20' : 'border-black/15'
          } ${accentIconColor}`}
        >
          {tierInfo.badgeLabel}
        </span>
      )}

      {/* Main Message Text */}
      <span className={`font-normal tracking-tight leading-none ${bodyTextColor}`}>
        {message.message}
      </span>

      {/* Sender Name */}
      {config.showSenderNames && message.name && (
        <span className={`text-xs sm:text-sm font-sans font-medium tracking-wide shrink-0 ${senderTextColor}`}>
          — {message.name}
        </span>
      )}
    </div>
  );
};

export const DanmakuStage: React.FC<DanmakuStageProps> = ({
  messages,
  liveSignalCount,
  latestLiveMessage,
  theme,
  displayConfig,
  isPaused = false,
  isSpotlightActive = false,
  onSpotlightChange,
}) => {
  const resolvedConfig = useMemo(() => resolveDisplayConfig(displayConfig), [displayConfig]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const schedulerRef = useRef<DanmakuScheduler | null>(null);
  const domNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevSpotlightIdRef = useRef<string | null>(null);
  const lastLiveMsgIdRef = useRef<string | null>(null);

  const [activeItems, setActiveItems] = useState<DanmakuActiveItem[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [reducedIdx, setReducedIdx] = useState(0);
  const [bursts, setBursts] = useState<CelebrationBurst[]>([]);

  // Respect prefers-reduced-motion gracefully
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Initialize scheduler lazily
  if (!schedulerRef.current) {
    schedulerRef.current = new DanmakuScheduler(1280, 640, resolvedConfig);
  }

  // Sync messages snapshot into scheduler
  useEffect(() => {
    schedulerRef.current?.setMessages(messages);
  }, [messages]);

  // Push newly arrived live message immediately + trigger delicate celebration particles
  useEffect(() => {
    if (!latestLiveMessage || !latestLiveMessage.id) return;
    if (lastLiveMsgIdRef.current === latestLiveMessage.id) return;
    lastLiveMsgIdRef.current = latestLiveMessage.id;

    schedulerRef.current?.enqueueLiveMessage(latestLiveMessage);

    if (
      !prefersReducedMotion &&
      resolvedConfig.animationIntensity !== 'subtle' &&
      liveSignalCount > 0
    ) {
      const particleCount = resolvedConfig.animationIntensity === 'lively' ? 5 : 3;
      const dir = resolvedConfig.danmakuDirection;
      const isMixed = resolvedConfig.danmakuDirectionMode === 'mixed';
      const newBursts: CelebrationBurst[] = Array.from({ length: particleCount }, (_, idx) => {
        if (!isMixed && (dir === 'ttb' || dir === 'btt')) {
          return {
            id: `burst-${latestLiveMessage.id}-${idx}-${Date.now()}`,
            leftPercent: 22 + ((idx * 21) % 60),
            bottomPercent: dir === 'ttb' ? 78 : 10,
            kind: idx % 2 === 0 ? 'heart' : 'sparkle',
          };
        }
        const entrySideBase = isMixed ? (idx % 2 === 0 ? 12 : 88) : dir === 'ltr' ? 6 : 90;
        return {
          id: `burst-${latestLiveMessage.id}-${idx}-${Date.now()}`,
          leftPercent: Math.max(4, Math.min(96, entrySideBase + (idx - 1) * 2.5)),
          bottomPercent: 14 + (idx % 3) * 22,
          kind: idx % 2 === 0 ? 'heart' : 'sparkle',
        };
      });
      setBursts((prev) => [...prev.slice(-12), ...newBursts]);
      const timer = setTimeout(() => {
        const ids = new Set(newBursts.map((b) => b.id));
        setBursts((prev) => prev.filter((b) => !ids.has(b.id)));
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [
    latestLiveMessage,
    liveSignalCount,
    prefersReducedMotion,
    resolvedConfig.animationIntensity,
    resolvedConfig.danmakuDirection,
    resolvedConfig.danmakuDirectionMode,
  ]);

  // Update scheduler config reactively
  useEffect(() => {
    schedulerRef.current?.updateConfig(resolvedConfig);
  }, [resolvedConfig]);

  // Track stage resize cleanly via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        schedulerRef.current?.resize(rect.width, rect.height);
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Gentle showcase fallback when prefers-reduced-motion is active
  useEffect(() => {
    if (!prefersReducedMotion || messages.length === 0) return;
    const timer = setInterval(() => {
      setReducedIdx((prev) => (prev + 1) % messages.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [prefersReducedMotion, messages.length]);

  // High-FPS GPU animation loop (Zero React re-renders per frame!)
  useEffect(() => {
    if (prefersReducedMotion || !resolvedConfig.danmakuEnabled) return;

    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(64, Math.max(0, now - lastTime));
      lastTime = now;

      const scheduler = schedulerRef.current;
      if (scheduler && !isPaused) {
        const stepRes = scheduler.step(dt);

        // Apply GPU transforms directly to active DOM nodes on both horizontal & vertical axes
        const items = scheduler.getActiveItems();
        for (const item of items) {
          const node = domNodesRef.current.get(item.instanceId);
          if (node) {
            node.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0)`;
          }
        }

        // Only trigger React commit when items enter or leave the DOM
        if (stepRes.spawned.length > 0 || stepRes.removedInstanceIds.length > 0) {
          setActiveItems(items);
        }

        // Notify parent whenever Spotlight transitions
        const currentSpotId = stepRes.spotlight.activeMessage?.id || null;
        if (stepRes.spotlightChanged || currentSpotId !== prevSpotlightIdRef.current) {
          prevSpotlightIdRef.current = currentSpotId;
          onSpotlightChange?.(
            stepRes.spotlight.activeMessage,
            stepRes.spotlight.startedAt,
            stepRes.spotlight.durationMs
          );
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [prefersReducedMotion, resolvedConfig.danmakuEnabled, isPaused, onSpotlightChange]);

  // Static reduced-motion showcase
  if (prefersReducedMotion || !resolvedConfig.danmakuEnabled) {
    const visible = messages.length > 0
      ? Array.from({ length: Math.min(4, messages.length) }, (_, i) => messages[(reducedIdx + i) % messages.length])
      : [];

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full flex flex-col items-center justify-center gap-4 px-6 transition-all duration-700 ${
          isSpotlightActive ? 'opacity-15 blur-[2px]' : 'opacity-100'
        }`}
      >
        {visible.map((msg) => (
          <div key={msg.id} className="transition-opacity duration-700">
            <DanmakuPillCard message={msg} theme={theme} config={resolvedConfig} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden transition-all duration-700 ${
        isSpotlightActive ? 'opacity-20 blur-[1.5px] scale-[0.99]' : 'opacity-100'
      }`}
      aria-live="polite"
    >
      {/* Active GPU-Accelerated Danmaku Pills & Horizontal-Text Vertical Cards */}
      {activeItems.map((item) => (
        <div
          key={item.instanceId}
          ref={(el) => {
            if (el) {
              const prev = domNodesRef.current.get(item.instanceId);
              domNodesRef.current.set(item.instanceId, el);
              if (!prev) {
                // Measure exact pixel width & height upon mount and synchronize transform
                const measuredWidth = el.offsetWidth;
                const measuredHeight = el.offsetHeight;
                if (measuredWidth > 0 || measuredHeight > 0) {
                  schedulerRef.current?.updateMeasuredDimensions(
                    item.instanceId,
                    measuredWidth,
                    measuredHeight
                  );
                }
                el.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0)`;
              }
            } else {
              domNodesRef.current.delete(item.instanceId);
            }
          }}
          className="absolute top-0 left-0 will-change-transform pointer-events-none"
          style={{
            transform: `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0)`,
            zIndex: item.tierInfo.isSpecial ? 20 : 10,
          }}
        >
          <DanmakuPillCard
            message={item.message}
            tierInfo={item.tierInfo}
            theme={theme}
            config={resolvedConfig}
            isLiveArrival={item.isLiveArrival}
            orientation={item.axis}
            maxWidthPx={item.cardMaxWidth}
          />
        </div>
      ))}

      {/* Subtle Floating Celebration Motifs on New Live Wishes */}
      {bursts.map((burst) => (
        <div
          key={burst.id}
          className={`absolute pointer-events-none danmaku-float-up ${
            theme.isDark ? 'text-[#E5C87B]/75' : theme.colors.accent
          }`}
          style={{
            left: `${burst.leftPercent}%`,
            bottom: `${burst.bottomPercent}%`,
          }}
        >
          {burst.kind === 'heart' ? (
            <Heart className="w-4 h-4 fill-current opacity-70" />
          ) : (
            <Sparkles className="w-4 h-4 opacity-75" />
          )}
        </div>
      ))}
    </div>
  );
};
