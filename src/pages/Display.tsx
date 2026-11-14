import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeftRight,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  QrCode,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { DanmakuPillCard, DanmakuStage } from '../components/display/DanmakuStage';
import { CoupleSpotlightOverlay } from '../components/display/CoupleSpotlightOverlay';
import { ThemeOverlay } from '../components/ThemeDecorations';
import { useWorkspace } from '../lib/WorkspaceContext';
import { getAgencyById } from '../lib/agency';
import { mergeAndDeduplicateMessages } from '../lib/danmakuEngine';
import {
  PUBLIC_DEMO_AGENCY,
  PUBLIC_DEMO_PROJECT,
  PUBLIC_DEMO_ROOM_ID,
} from '../lib/demoService';
import { ResolvedEventTheme, resolveEventTheme } from '../lib/eventTheme';
import { createGuestMessageProvider } from '../lib/guestMessageProvider';
import { TranslationProvider } from '../lib/i18n/TranslationContext';
import { isEventActive } from '../lib/packages';
import { getSupabase } from '../lib/supabase';
import { fetchTemplates } from '../lib/templates';
import {
  ALL_DANMAKU_DIRECTIONS,
  Agency,
  DANMAKU_DENSITY_PRESETS,
  DANMAKU_DIRECTION_META,
  DEFAULT_MESSAGE_DISPLAY_CONFIG,
  DanmakuDensity,
  DanmakuDirection,
  DanmakuDirectionMode,
  Message,
  MessageDisplayConfig,
  WeddingEvent,
  WeddingTemplate,
  directionToSlug,
  resolveDisplayConfig,
} from '../types';

export default function Display() {
  const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
  const { projectId, slug } = useParams();
  const [searchParams] = useSearchParams();

  const [project, setProject] = useState<WeddingEvent | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveSignalCount, setLiveSignalCount] = useState(0);
  const [latestLiveMessage, setLatestLiveMessage] = useState<Message | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showQuickControls, setShowQuickControls] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<WeddingTemplate[]>([]);
  const [spotlightMsg, setSpotlightMsg] = useState<Message | null>(null);
  const [spotlightDurationMs, setSpotlightDurationMs] = useState(7000);
  const [localConfigOverride, setLocalConfigOverride] = useState<Partial<MessageDisplayConfig>>({});

  const rootRef = useRef<HTMLDivElement | null>(null);

  const isDemo =
    project?.id === PUBLIC_DEMO_ROOM_ID ||
    projectId === 'demo' ||
    slug === 'demo' ||
    searchParams.get('room') === PUBLIC_DEMO_ROOM_ID;
  const isSubscribed = isEventActive(project, agency);
  const isPreviewParam = searchParams.get('preview') === 'true';
  const isPreview = !isDemo && !isSubscribed && !isPreviewParam;

  useEffect(() => {
    fetchTemplates().then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const el = rootRef.current || document.documentElement;
        await el.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // Browser blocked fullscreen without gesture or unsupported
    }
  };

  const initDemoMode = () => {
    setProject(PUBLIC_DEMO_PROJECT);
    setAgency(PUBLIC_DEMO_AGENCY);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isLoadingWorkspace) return;
    const urlProjectId =
      projectId ||
      searchParams.get('id') ||
      searchParams.get('projectId') ||
      searchParams.get('room');
    const normalizedProjectId =
      urlProjectId && urlProjectId !== 'undefined' ? urlProjectId : undefined;

    if (normalizedProjectId === PUBLIC_DEMO_ROOM_ID || normalizedProjectId === 'demo') {
      initDemoMode();
    } else if (!normalizedProjectId && !slug && workspace) {
      loadProjectByWorkspace(workspace.id);
    } else if (normalizedProjectId || slug) {
      loadProject(normalizedProjectId, slug);
    } else {
      initDemoMode();
    }
  }, [projectId, slug, searchParams, isLoadingWorkspace, workspace?.id]);

  const loadProjectByWorkspace = async (agencyId: string) => {
    try {
      const supabase = getSupabase();
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (projects && projects.length > 0) {
        const projectData = { ...projects[0] };
        if (typeof projectData.rsvp_fields === 'string') {
          try {
            projectData.rsvp_fields = JSON.parse(projectData.rsvp_fields);
          } catch {
            projectData.rsvp_fields = [];
          }
        }
        setProject(projectData);
        if (!agency) setAgency(workspace);
      } else {
        initDemoMode();
      }
    } catch (err) {
      console.error('Error loading workspace project:', err);
      initDemoMode();
    } finally {
      setIsLoading(false);
    }
  };

  const loadProject = async (id?: string, slugName?: string) => {
    if (id === 'demo' || slugName === 'demo' || id === PUBLIC_DEMO_ROOM_ID) {
      initDemoMode();
      return;
    }

    try {
      const supabase = getSupabase();
      let projectData: WeddingEvent | null = null;

      if (id) {
        const { data } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
        projectData = data;
      } else if (slugName) {
        let query = supabase.from('projects').select('*').eq('slug', slugName);
        if (workspace) {
          query = query.eq('agency_id', workspace.id);
        }
        const { data } = await query.maybeSingle();
        projectData = data;

        if (!projectData && !workspace) {
          const { data: agencyData } = await supabase
            .from('agencies')
            .select('*')
            .eq('slug', slugName)
            .maybeSingle();

          if (agencyData) {
            setAgency(agencyData);
            const { data: events } = await supabase
              .from('projects')
              .select('*')
              .eq('agency_id', agencyData.id)
              .order('created_at', { ascending: true })
              .limit(1);

            if (events && events.length > 0) {
              projectData = events[0];
            }
          }
        }
      }

      if (projectData) {
        if (typeof projectData.rsvp_fields === 'string') {
          try {
            projectData.rsvp_fields = JSON.parse(projectData.rsvp_fields);
          } catch {
            projectData.rsvp_fields = [];
          }
        }
        setProject(projectData);
        if (!agency && projectData.agency_id) {
          const agencyData = await getAgencyById(projectData.agency_id);
          setAgency(agencyData);
        }
      } else {
        initDemoMode();
      }
    } catch (err) {
      console.error('Error loading event:', err);
      initDemoMode();
    } finally {
      setIsLoading(false);
    }
  };

  // Subscribe cleanly to live messages + reconnection snapshot reconciliation
  useEffect(() => {
    const targetId = project?.id || projectId || (isDemo ? PUBLIC_DEMO_ROOM_ID : undefined);
    if (!targetId) return;

    let isMounted = true;
    const isDemoTarget = isDemo || targetId === PUBLIC_DEMO_ROOM_ID || targetId === 'demo';
    const provider = createGuestMessageProvider(targetId, isDemoTarget);
    const maxCap = isPreview ? 5 : 80;

    provider
      .loadInitialMessages()
      .then((data) => {
        if (!isMounted) return;
        setMessages(mergeAndDeduplicateMessages([], data, maxCap, true));
      })
      .catch((err) => {
        console.error('Initial fetch error:', err);
      });

    const unsubscribe = provider.subscribe(
      (incomingMsg) => {
        if (!isMounted) return;
        setMessages((prev) => {
          const isNew = !prev.some((m) => m.id === incomingMsg.id);
          if (isNew) {
            setLatestLiveMessage(incomingMsg);
            setLiveSignalCount((c) => c + 1);
          }
          return mergeAndDeduplicateMessages(prev, [incomingMsg], maxCap, false);
        });
      },
      (snapshot) => {
        if (!isMounted) return;
        setMessages((prev) => {
          const prevIds = new Set(prev.map((m) => m.id));
          const merged = mergeAndDeduplicateMessages(prev, snapshot, maxCap, true);
          const newlyAdded = merged.find((m) => !prevIds.has(m.id));
          if (newlyAdded && prev.length > 0) {
            setLatestLiveMessage(newlyAdded);
            setLiveSignalCount((c) => c + 1);
          }
          return merged;
        });
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [project?.id, projectId, isPreview, isDemo]);

  // Also subscribe to live project display_config updates in production so Studio changes apply live
  useEffect(() => {
    if (isDemo || !project?.id) return;
    let channel: any = null;
    try {
      const supabase = getSupabase();
      channel = supabase
        .channel(`project-config-${project.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'projects',
            filter: `id=eq.${project.id}`,
          },
          (payload) => {
            const updated = payload.new as Partial<WeddingEvent> | undefined;
            if (updated?.message_display_config) {
              setProject((prev) =>
                prev
                  ? {
                      ...prev,
                      message_display_config: updated.message_display_config,
                      theme_id: updated.theme_id || prev.theme_id,
                    }
                  : prev
              );
            }
          }
        )
        .subscribe();
    } catch {
      // Silent fallback if Supabase Realtime unavailable
    }

    return () => {
      if (channel) {
        try {
          getSupabase().removeChannel(channel);
        } catch {}
      }
    };
  }, [isDemo, project?.id]);

  const targetThemeId =
    isPreviewParam && searchParams.get('template')
      ? searchParams.get('template')
      : project?.theme_id || searchParams.get('template') || 'minimal_luxury';

  const theme: ResolvedEventTheme = resolveEventTheme(targetThemeId, templates);
  const Icon = theme.IconComponent;

  const groom = project?.groom_name || searchParams.get('groom') || 'Lucas';
  const bride = project?.bride_name || searchParams.get('bride') || 'Sofia';

  const baseUrl =
    window.location.origin +
    (slug ? `/${slug}` : project?.slug && !isDemo ? `/${project.slug}` : '');
  const guestUrl = isDemo
    ? `${window.location.origin}/guest`
    : `${baseUrl}/guest${window.location.search}`;

  const displayConfig = useMemo(() => {
    return resolveDisplayConfig({
      ...DEFAULT_MESSAGE_DISPLAY_CONFIG,
      ...(project?.message_display_config || {}),
      ...localConfigOverride,
    });
  }, [project?.message_display_config, localConfigOverride]);

  const handleSpotlightChange = useCallback(
    (activeMsg: Message | null, _startedAt: number, durationMs: number) => {
      setSpotlightMsg(activeMsg);
      setSpotlightDurationMs(durationMs || 7000);
    },
    []
  );

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.colors.background}`}>
        <div
          className={`w-8 h-8 border-2 ${theme.colors.accent} border-t-transparent rounded-full animate-spin opacity-60`}
        />
      </div>
    );
  }

  return (
    <TranslationProvider eventId={project?.id || projectId || 'demo'}>
      <div
        ref={rootRef}
        className={`h-screen w-screen overflow-hidden flex flex-col relative ${theme.colors.background} ${theme.fontBody} ${theme.colors.text} transition-colors duration-700`}
      >
        {/* Background Aesthetic Layer */}
        <ThemeOverlay themeId={theme.id} mode="fullscreen" />

        {/* Subtle Hero Photo Wash when configured */}
        {project?.image_url && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <img
              src={project.image_url}
              alt={`${groom} & ${bride}`}
              className="w-full h-full object-cover opacity-[0.1] filter blur-[3px] scale-105"
            />
            <div className={`absolute inset-0 ${theme.colors.background} opacity-55`} />
          </div>
        )}

        {/* Draft Preview Notice Bar */}
        {isPreview && (
          <div className="relative z-50 bg-[#1B1B19]/95 text-white py-2 px-6 flex items-center justify-between gap-4 text-xs border-b border-white/10">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="font-mono text-[11px]">
                Draft Preview · Activate License for Unlimited Wedding Wall Wishes
              </span>
            </div>
            <a
              href={project?.id ? `/subscription?eventId=${project.id}` : '/subscription'}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[#1A1A1A] px-3 py-1 rounded text-xs font-medium hover:bg-[#F3F1EC] transition-colors"
            >
              Activate 12-Month License
            </a>
          </div>
        )}

        {/* Top Luxury Ballroom Header */}
        <header className="relative z-30 flex items-center justify-between gap-4 px-6 sm:px-10 md:px-14 pt-6 sm:pt-8 pb-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.22em] opacity-70 font-sans mb-1">
              {isDemo ? (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Sparkles className={`w-3 h-3 ${theme.colors.accent}`} />
                  Public Demo Room
                </span>
              ) : agency ? (
                <span className="inline-flex items-center gap-2">
                  {agency.logo_url && (
                    <img src={agency.logo_url} alt={agency.name} className="h-3.5 w-auto rounded-xs" />
                  )}
                  <span>{agency.name}</span>
                </span>
              ) : (
                <span>{theme.display.headerSubtitle}</span>
              )}
              {project?.location && (
                <>
                  <span>·</span>
                  <span className="truncate max-w-[220px] sm:max-w-xs">{project.location}</span>
                </>
              )}
            </div>

            <h1
              className={`text-3xl sm:text-5xl md:text-6xl ${theme.fontHeading} ${theme.colors.headerText} tracking-tight leading-none font-normal truncate`}
            >
              {groom} <span className={`${theme.colors.accent} italic font-light`}>&amp;</span> {bride}
            </h1>
          </div>

          {/* Right Presentation Controls & Live Stats */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {displayConfig.showActivityStats && (
              <div
                className={`hidden sm:flex items-center gap-3 px-4 py-2 rounded-full border backdrop-blur-md text-xs ${
                  theme.isDark
                    ? 'bg-white/10 border-white/15 text-white/90'
                    : 'bg-white/75 border-black/10 text-[#252525]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 fill-current ${theme.colors.accent}`} />
                <span className="font-mono tabular-nums font-semibold">
                  {messages.length}
                </span>
                <span className="opacity-70 text-[11px] tracking-wide">
                  {messages.length === 1 ? 'Wish Shared' : 'Wishes Shared'}
                </span>
              </div>
            )}

            {/* Quick Stage Controls Toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowQuickControls((v) => !v)}
                className={`p-2.5 rounded-full border backdrop-blur-md transition-colors ${
                  theme.isDark
                    ? 'bg-white/10 border-white/15 text-white hover:bg-white/20'
                    : 'bg-white/80 border-black/10 text-[#252525] hover:bg-white'
                }`}
                title="Display Flow Controls"
                aria-label="Display Flow Controls"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {showQuickControls && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className={`absolute right-0 top-12 w-64 rounded-2xl p-4 border shadow-2xl backdrop-blur-xl z-50 space-y-3 text-xs ${
                      theme.isDark
                        ? 'bg-[#12141E]/95 border-white/15 text-white'
                        : 'bg-white/95 border-black/10 text-[#1F1F1C]'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-current/10">
                      <span className="font-semibold tracking-wide">Live Stage Controls</span>
                      <button
                        type="button"
                        onClick={() => setIsPaused((p) => !p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-current/15 text-[11px] font-medium hover:bg-current/5"
                      >
                        {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                        {isPaused ? 'Resume' : 'Pause'}
                      </button>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] uppercase tracking-widest opacity-60 block">
                        Direction Mode
                      </span>
                      <div className="grid grid-cols-2 gap-1">
                        {(['single', 'mixed'] as DanmakuDirectionMode[]).map((mode) => {
                          const active = displayConfig.danmakuDirectionMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                const nextDirections =
                                  mode === 'mixed'
                                    ? ALL_DANMAKU_DIRECTIONS
                                    : [displayConfig.danmakuDirection];
                                setLocalConfigOverride((prev) => ({
                                  ...prev,
                                  danmakuDirectionMode: mode,
                                  danmakuDirections: nextDirections,
                                  danmaku: {
                                    directionMode: mode,
                                    directions: nextDirections.map(directionToSlug),
                                    preset: displayConfig.danmakuDensity,
                                  },
                                }));
                              }}
                              className={`py-1.5 px-2 rounded-lg text-[10px] font-medium border transition-colors ${
                                active
                                  ? theme.isDark
                                    ? 'bg-white text-black border-white'
                                    : 'bg-[#1F1F1C] text-white border-[#1F1F1C]'
                                  : 'border-current/15 opacity-75 hover:opacity-100'
                              }`}
                            >
                              {mode === 'single' ? 'Single Direction' : 'Mixed 4-Way'}
                            </button>
                          );
                        })}
                      </div>

                      {displayConfig.danmakuDirectionMode === 'single' ? (
                        <div className="grid grid-cols-2 gap-1 pt-0.5">
                          {ALL_DANMAKU_DIRECTIONS.map((dir: DanmakuDirection) => {
                            const meta = DANMAKU_DIRECTION_META[dir];
                            const active = displayConfig.danmakuDirection === dir;
                            return (
                              <button
                                key={dir}
                                type="button"
                                onClick={() =>
                                  setLocalConfigOverride((prev) => ({
                                    ...prev,
                                    danmakuDirectionMode: 'single',
                                    danmakuDirection: dir,
                                    danmakuDirections: [dir],
                                    danmaku: {
                                      directionMode: 'single',
                                      directions: [meta.slug],
                                      preset: displayConfig.danmakuDensity,
                                    },
                                  }))
                                }
                                className={`py-1.5 px-2 rounded-lg text-[10px] font-medium border transition-colors flex items-center justify-between ${
                                  active
                                    ? theme.isDark
                                      ? 'bg-white text-black border-white'
                                      : 'bg-[#1F1F1C] text-white border-[#1F1F1C]'
                                    : 'border-current/15 opacity-75 hover:opacity-100'
                                }`}
                              >
                                <span className="truncate">{meta.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] opacity-70 leading-snug pt-0.5 flex items-center gap-1.5">
                          <ArrowLeftRight className="w-3 h-3 shrink-0" />
                          Balancing horizontal &amp; vertical wishes with collision protection
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase tracking-widest opacity-60">
                        Stream Density
                      </span>
                      <div className="grid grid-cols-3 gap-1">
                        {(['relaxed', 'balanced', 'celebration'] as DanmakuDensity[]).map((preset) => {
                          const active = displayConfig.danmakuDensity === preset;
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() =>
                                setLocalConfigOverride((prev) => ({
                                  ...prev,
                                  danmakuDensity: preset,
                                  danmaku: {
                                    directionMode: displayConfig.danmakuDirectionMode,
                                    directions: displayConfig.danmakuDirections.map(directionToSlug),
                                    preset,
                                  },
                                }))
                              }
                              className={`py-1.5 px-1.5 rounded-lg text-[10px] font-medium border transition-colors ${
                                active
                                  ? theme.isDark
                                    ? 'bg-white text-black border-white'
                                    : 'bg-[#1F1F1C] text-white border-[#1F1F1C]'
                                  : 'border-current/15 opacity-75 hover:opacity-100'
                              }`}
                            >
                              {DANMAKU_DENSITY_PRESETS[preset].label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Fullscreen Button for 16:9 LED Wedding Hall Projectors */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className={`p-2.5 rounded-full border backdrop-blur-md transition-colors ${
                theme.isDark
                  ? 'bg-white/10 border-white/15 text-white hover:bg-white/20'
                  : 'bg-white/80 border-black/10 text-[#252525] hover:bg-white'
              }`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (16:9 LED Wall)'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Main Danmaku Stage (75-80% Viewport Presence) */}
        <main className="relative z-20 flex-1 min-h-0 w-full">
          {messages.length === 0 ? (
            <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
              <Icon className={`w-14 h-14 ${theme.colors.accent} opacity-35 mb-4 fill-current`} />
              <p className={`${theme.colors.subtleText} ${theme.fontHeading} italic text-xl sm:text-2xl max-w-md`}>
                {theme.display.emptyStateText}
              </p>
              <p className={`text-xs ${theme.colors.subtleText} opacity-70 mt-2`}>
                Scan the QR code in the corner to send the first live wish onto the wall.
              </p>
            </div>
          ) : !displayConfig.danmakuEnabled ? (
            /* Optional Calm Grid Mode when an organizer disables Danmaku scrolling */
            <div className="h-full overflow-y-auto px-6 sm:px-12 py-8 max-w-7xl mx-auto flex flex-wrap items-start justify-center gap-4">
              {messages.slice(0, 16).map((msg) => (
                <div key={msg.id} className="max-w-full">
                  <DanmakuPillCard message={msg} theme={theme} config={displayConfig} />
                </div>
              ))}
            </div>
          ) : (
            <DanmakuStage
              messages={messages}
              liveSignalCount={liveSignalCount}
              latestLiveMessage={latestLiveMessage}
              theme={theme}
              displayConfig={displayConfig}
              isPaused={isPaused}
              isSpotlightActive={Boolean(spotlightMsg)}
              onSpotlightChange={handleSpotlightChange}
            />
          )}
        </main>

        {/* Couple's Spotlight Centered Interruption Overlay */}
        <CoupleSpotlightOverlay
          message={spotlightMsg}
          theme={theme}
          displayConfig={displayConfig}
          durationMs={spotlightDurationMs}
        />

        {/* Subtle Bottom Footer + Guest QR Code */}
        <footer className="relative z-30 flex items-center justify-between px-6 sm:px-10 md:px-14 pb-5 sm:pb-7 pt-2 shrink-0 pointer-events-none">
          <div className="text-[11px] sm:text-xs opacity-60 tracking-wide font-sans pointer-events-auto">
            {isDemo
              ? 'Open /guest on your phone to send a wish in real time'
              : `Forever & Always · ${groom} & ${bride}`}
          </div>

          <div className="relative pointer-events-auto">
            <button
              type="button"
              onClick={() => setShowQR((v) => !v)}
              className={`px-4 py-2.5 rounded-full shadow-xl transition-transform hover:scale-[1.03] active:scale-[0.98] flex items-center gap-2 text-xs font-medium backdrop-blur-md ${theme.qrButton.buttonClass}`}
              title="Scan to Send Wishes"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">Send a Wish</span>
            </button>

            <AnimatePresence>
              {showQR && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 12 }}
                  className={`absolute bottom-14 right-0 p-6 ${theme.qrButton.modalCardClass} shadow-2xl backdrop-blur-2xl w-72 text-center z-50`}
                >
                  <h3 className={`text-xl ${theme.fontHeading} ${theme.colors.headerText} mb-3`}>
                    Share Your Blessing
                  </h3>
                  <div className="bg-white p-3 rounded-xl mb-3 inline-block shadow-inner ring-1 ring-black/5">
                    <QRCodeSVG value={guestUrl} size={168} />
                  </div>
                  <p className={`text-xs font-semibold ${theme.colors.text} mb-1`}>
                    Scan with your camera
                  </p>
                  <p className={`text-[11px] ${theme.colors.subtleText}`}>
                    Your wish floats live across the reception wall
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </footer>

        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes danmakuFloatUp {
                0% {
                  opacity: 0;
                  transform: translate3d(0, 18px, 0) scale(0.75);
                }
                20% {
                  opacity: 0.85;
                  transform: translate3d(0, 0px, 0) scale(1);
                }
                100% {
                  opacity: 0;
                  transform: translate3d(0, -110px, 0) scale(0.9);
                }
              }
              .danmaku-float-up {
                animation: danmakuFloatUp 2.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                will-change: transform, opacity;
              }
              @media (prefers-reduced-motion: reduce) {
                .danmaku-float-up {
                  animation: none !important;
                  opacity: 0 !important;
                }
              }
              ${theme.rawTemplate.css || ''}
            `,
          }}
        />
      </div>
    </TranslationProvider>
  );
}
