import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Send, CheckCircle2, QrCode, Zap, Calendar, MapPin, Heart } from 'lucide-react';
import { postMessage } from '../lib/api';
import confetti from 'canvas-confetti';
import { WeddingEvent, WeddingTemplate, Agency, Message, WishCategory } from '../types';
import { resolveEventTheme, ResolvedEventTheme } from '../lib/eventTheme';
import { ThemeOverlay } from '../components/ThemeDecorations';
import { QRCodeSVG } from 'qrcode.react';
import { getSupabase } from '../lib/supabase';
import { getAgencyById } from '../lib/agency';
import { useWorkspace } from '../lib/WorkspaceContext';
import { fetchTemplates } from '../lib/templates';
import { isEventActive } from '../lib/packages';
import { TranslationProvider } from '../lib/i18n/TranslationContext';
import { LanguageSelector } from '../components/LanguageSelector';
import { PUBLIC_DEMO_ROOM_ID, PUBLIC_DEMO_PROJECT, PUBLIC_DEMO_AGENCY } from '../lib/demoService';
import { createGuestMessageProvider } from '../lib/guestMessageProvider';

export default function Guest() {
  const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
  const { projectId, slug } = useParams();
  const [project, setProject] = useState<WeddingEvent | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [wishCategory, setWishCategory] = useState<WishCategory>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingDemoMessages, setIsLoadingDemoMessages] = useState(false);
  const [rsvpCount, setRsvpCount] = useState(0);
  const [templates, setTemplates] = useState<WeddingTemplate[]>([]);

  const [searchParams] = useSearchParams();
  const isPreviewParam = searchParams.get('preview') === 'true';
  const isDemo =
    project?.id === PUBLIC_DEMO_ROOM_ID ||
    projectId === 'demo' ||
    slug === 'demo' ||
    searchParams.get('room') === PUBLIC_DEMO_ROOM_ID;

  useEffect(() => {
    async function load() {
      const data = await fetchTemplates();
      setTemplates(data);
    }
    load();
  }, []);

  const initDemoMode = () => {
    setProject(PUBLIC_DEMO_PROJECT);
    setAgency(PUBLIC_DEMO_AGENCY);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isLoadingWorkspace) return;
    const urlProjectId = projectId || searchParams.get('id') || searchParams.get('projectId') || searchParams.get('room');
    const normalizedProjectId = (urlProjectId && urlProjectId !== 'undefined') ? urlProjectId : undefined;

    if (normalizedProjectId === PUBLIC_DEMO_ROOM_ID || normalizedProjectId === 'demo') {
      initDemoMode();
    } else if (!normalizedProjectId && !slug && workspace) {
      loadProjectByWorkspace(workspace.id);
    } else if (normalizedProjectId || slug) {
      loadProject(normalizedProjectId, slug);
    } else {
      // Anonymous visitor on /guest: Initialize public demo automatically!
      initDemoMode();
    }
  }, [projectId, slug, searchParams, isLoadingWorkspace, workspace?.id]);

  // Load and subscribe to live demo messages when in public demo mode
  useEffect(() => {
    if (!isDemo) return;
    let isMounted = true;
    const provider = createGuestMessageProvider(PUBLIC_DEMO_ROOM_ID, true);

    setIsLoadingDemoMessages(true);
    provider
      .loadInitialMessages()
      .then((data) => {
        if (!isMounted) return;
        setMessages(data);
      })
      .catch((err) => {
        console.error('Error loading demo messages:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingDemoMessages(false);
      });

    const unsubscribe = provider.subscribe(
      (newMessage) => {
        if (!isMounted) return;
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== newMessage.id);
          return [newMessage, ...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        });
      },
      (snapshot) => {
        if (!isMounted) return;
        setMessages(snapshot);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isDemo]);

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
        const projectData = projects[0];
        if (typeof projectData.rsvp_fields === 'string') {
          try {
            projectData.rsvp_fields = JSON.parse(projectData.rsvp_fields);
          } catch (e) {
            projectData.rsvp_fields = [];
          }
        }
        setProject(projectData);
        if (!agency) setAgency(workspace);

        const { count: msgCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectData.id);
        setMessages(
          Array.from({ length: msgCount || 0 }, (_, idx) => ({
            id: `count-${idx}`,
            name: '',
            message: '',
            timestamp: 0
          }))
        );

        const { count: rsvpCountVal } = await supabase
          .from('rsvps')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectData.id);
        setRsvpCount(rsvpCountVal || 0);
      } else {
        // Fallback to public demo
        initDemoMode();
      }
    } catch (err) {
      console.error('Error loading workspace project:', err);
      initDemoMode();
    } finally {
      setIsLoading(false);
    }
  };

  const isSubscribed = isEventActive(project, agency);
  const isPreview = !isDemo && !isSubscribed && !isPreviewParam;

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
        if (workspace) query = query.eq('agency_id', workspace.id);

        let { data } = await query.maybeSingle();
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
          } catch (e) {
            projectData.rsvp_fields = [];
          }
        }
        setProject(projectData);
        if (!agency && projectData.agency_id) {
          const agencyData = await getAgencyById(projectData.agency_id);
          setAgency(agencyData);
        }

        const { count: msgCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectData.id);
        setMessages(
          Array.from({ length: msgCount || 0 }, (_, idx) => ({
            id: `count-${idx}`,
            name: '',
            message: '',
            timestamp: 0
          }))
        );

        const { count: rsvpCountVal } = await supabase
          .from('rsvps')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectData.id);
        setRsvpCount(rsvpCountVal || 0);
      }
    } catch (err) {
      console.error('Error loading event:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Resolve aesthetic: URL template preview param or project.theme_id
  const targetThemeId = (isPreviewParam && searchParams.get('template')) 
    ? searchParams.get('template') 
    : (project?.theme_id || searchParams.get('template') || 'minimal_luxury');

  const theme: ResolvedEventTheme = resolveEventTheme(targetThemeId, templates);
  const Icon = theme.IconComponent;

  const groom = project?.groom_name || searchParams.get('groom') || 'Lucas';
  const bride = project?.bride_name || searchParams.get('bride') || 'Sofia';

  const currentUrl = window.location.origin + window.location.pathname + window.location.search;

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.colors.background}`}>
        <div className={`w-8 h-8 border-2 ${theme.colors.accent} border-t-transparent rounded-full animate-spin opacity-60`} />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName) {
      setError('Please enter your name.');
      return;
    }

    if (!trimmedMessage) {
      setError('Please enter a message.');
      return;
    }

    if (!project?.id) {
      setError("Event not found. Please refresh the page.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    if (isPreview && messages.length >= 5) {
      setError("This event is in preview mode and has reached the limit of 5 messages. Please contact the host.");
      setIsSubmitting(false);
      return;
    }

    try {
      const provider = createGuestMessageProvider(project.id, isDemo);
      let designatedCategory: string | undefined = undefined;

      if (!isDemo) {
        try {
          const supabase = getSupabase();
          if (trimmedName && project.id) {
            const { data: vipRsvps } = await supabase
              .from('rsvps')
              .select('is_vip, guest_category')
              .eq('project_id', project.id)
              .ilike('name', trimmedName)
              .eq('is_vip', true)
              .limit(1);

            if (vipRsvps && vipRsvps.length > 0 && vipRsvps[0].is_vip) {
              designatedCategory = vipRsvps[0].guest_category || 'VIP';
            }
          }
        } catch {
          // Non-blocking fallback
        }
      }

      const created = await provider.submitMessage(trimmedName, trimmedMessage, {
        autoApprove: !!project?.auto_approve_messages,
        guestCategory: designatedCategory,
        wishCategory
      });

      if (isDemo && created && created.id) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== created.id);
          return [created, ...filtered];
        });
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            name: trimmedName,
            message: trimmedMessage,
            timestamp: Date.now(),
            wish_category: wishCategory
          }
        ]);
      }

      // Fire theme-specific celebratory confetti
      confetti({
        particleCount: 110,
        spread: 65,
        origin: { y: 0.6 },
        colors: theme.confettiColors
      });

      setShowSuccess(true);
      setName('');
      setMessage('');
      setWishCategory('normal');
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to post message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const rsvpUrl = (slug ? `/${slug}` : project?.slug ? `/${project.slug}` : '') + '/rsvp' + window.location.search;

  return (
    <TranslationProvider eventId={project?.id || projectId || 'demo'}>
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 ${theme.colors.background} transition-colors duration-500 relative overflow-x-hidden ${theme.fontBody} ${theme.colors.text}`}>
        {/* Background Decorative Overlay */}
        <ThemeOverlay themeId={theme.id} mode="ambient" />

      {/* Top Banner for Previews */}
      {isPreview && (
        <div className="fixed top-0 left-0 right-0 bg-[#252525] text-white py-2 px-4 shadow-sm z-50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[#8B806F]" />
            <span className="font-mono text-[11px]">
              Preview Mode: {messages.length}/5 Messages
            </span>
          </div>
          <a
            href={project?.id ? `/subscription?eventId=${project.id}` : '/subscription'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium underline hover:text-[#8B806F] transition-colors"
          >
            Activate 12-Month License
          </a>
        </div>
      )}

      {/* Unobtrusive Public Demo Indicator */}
      {isDemo && (
        <div className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#252525]/90 text-white backdrop-blur-md border border-white/10 text-xs shadow-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold tracking-wider text-[10px] uppercase font-mono">LIVE DEMO</span>
          <span className="text-white/60 text-[10px] hidden sm:inline">• Shared Room: eventframe-public-demo</span>
        </div>
      )}

      {/* Agency Branding */}
      {agency && !isDemo && (
        <div className={`fixed ${isPreview ? 'top-12' : 'top-5'} left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] backdrop-blur-md ${theme.agencyBadgeClass}`}>
          {agency.logo_url && <img src={agency.logo_url} alt={agency.name} className="h-3.5 w-auto rounded" />}
          <span className="font-medium opacity-90">{agency.name}</span>
        </div>
      )}

      {/* Main Guest Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10 my-auto pt-10 pb-8"
      >
        <div className={`${theme.card.surface} ${theme.card.border} ${theme.card.radius} ${theme.card.shadow} p-6 sm:p-8 relative overflow-hidden`}>
          {/* Cover photo if present */}
          {project?.image_url && (
            <div className="w-full h-36 rounded-xl overflow-hidden mb-6 border border-black/5 relative">
              <img
                src={project.image_url}
                alt="Couple"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
          )}

          {/* Heading */}
          <div className="text-center mb-6">
            <div className={`inline-flex p-2.5 rounded-full ${theme.colors.accent} bg-current/10 mb-3`}>
              <Icon className="w-5 h-5 fill-current" />
            </div>
            <h1 className={`text-2xl sm:text-3xl ${theme.fontHeading} ${theme.colors.headerText} tracking-tight font-normal leading-tight mb-2`}>
              {groom} & {bride}
            </h1>

            {/* Event details metadata */}
            {(project?.wedding_date || project?.location) && (
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs opacity-75 mb-2">
                {project.wedding_date && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(project.wedding_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
                {project.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {project.location}
                  </span>
                )}
              </div>
            )}

            <p className={`text-xs ${theme.colors.subtleText} max-w-xs mx-auto`}>
              Leave a heartfelt wish or message for the couple's live wedding display.
            </p>
          </div>

          {/* Message Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${theme.colors.subtleText}`}>
                Your Name
              </label>
              <input
                type="text"
                placeholder="e.g. Grandma Betty, Sophia & James"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={`w-full px-3.5 py-2.5 text-xs sm:text-sm border transition-colors outline-none ${theme.input.base} ${theme.input.radius}`}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-xs font-medium ${theme.colors.subtleText}`}>
                  Your Message
                </label>
                <span className={`text-[10px] ${theme.colors.subtleText} font-mono tabular-nums`}>
                  {message.length}/150
                </span>
              </div>
              <textarea
                required
                maxLength={150}
                placeholder="Share your warmest congratulations..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className={`w-full px-3.5 py-2.5 text-xs sm:text-sm border transition-colors outline-none resize-none ${theme.input.base} ${theme.input.radius}`}
              />
            </div>

            <div>
              <span className={`block text-[11px] font-medium mb-1.5 ${theme.colors.subtleText}`}>
                Wish Style <span className="opacity-60 font-normal">(optional)</span>
              </span>
              <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Wish style">
                {(
                  [
                    { id: 'normal', label: 'Standard' },
                    { id: 'heartfelt', label: 'Heartfelt' },
                    { id: 'family', label: 'Family' },
                    { id: 'funny', label: 'Playful' },
                  ] as const
                ).map((opt) => {
                  const selected = wishCategory === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setWishCategory(opt.id)}
                      className={`py-1.5 px-2 text-[11px] border transition-colors ${theme.input.radius} ${
                        selected ? theme.button.pillActive : theme.button.pillInactive
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="text-red-600 text-xs text-center font-medium bg-red-50 py-2 px-3 rounded-lg border border-red-100">
                {error}
              </p>
            )}

            <button
              disabled={isSubmitting}
              type="submit"
              className={`w-full py-3 px-4 text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : theme.button.primary
              }`}
            >
              <span>{isSubmitting ? 'Posting...' : 'Send Wishes'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Secondary link: RSVP or Live Display in Demo */}
          <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-xs">
            <span className={`opacity-60 text-[11px]`}>
              {isDemo ? 'See your wishes live on the display' : 'Attending the celebration?'}
            </span>
            <Link
              to={isDemo ? '/display' : rsvpUrl}
              className={`font-medium underline hover:opacity-100 opacity-80 transition-opacity`}
            >
              {isDemo ? 'View Live Display →' : 'RSVP Here →'}
            </Link>
          </div>

          {/* Success Overlay */}
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`absolute inset-0 flex flex-col items-center justify-center p-8 ${theme.card.radius} ${theme.card.surface} z-20 text-center backdrop-blur-xl`}
              >
                <CheckCircle2 className={`w-12 h-12 ${theme.colors.accent} mb-3`} />
                <h3 className={`text-2xl ${theme.fontHeading} ${theme.colors.headerText} mb-1.5`}>
                  With Gratitude
                </h3>
                <p className={`text-xs ${theme.colors.subtleText} max-w-xs mb-4 leading-relaxed`}>
                  Your message has been sent and will appear on the wedding wall.
                </p>
                <button
                  type="button"
                  onClick={() => setShowSuccess(false)}
                  className={`text-xs font-medium underline opacity-80 hover:opacity-100 ${theme.colors.text}`}
                >
                  Write Another Note
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live Demo Message Wall */}
        {isDemo && (
          <div className={`mt-5 ${theme.card.surface} ${theme.card.border} ${theme.card.radius} ${theme.card.shadow} p-5`}>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Heart className={`w-4 h-4 ${theme.colors.accent}`} />
                <h2 className={`text-base ${theme.fontHeading} ${theme.colors.headerText} font-normal`}>
                  Live Guest Wishes
                </h2>
              </div>
              <span className={`text-[11px] font-mono tabular-nums ${theme.colors.subtleText}`}>
                {messages.length} {messages.length === 1 ? 'wish' : 'wishes'}
              </span>
            </div>

            {isLoadingDemoMessages && messages.length === 0 ? (
              <div className="py-6 text-center text-xs opacity-60">Loading wedding wishes...</div>
            ) : messages.length === 0 ? (
              <div className="py-6 text-center text-xs opacity-60">
                Be the first to leave a wish for the couple.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-xs font-semibold ${theme.colors.headerText} truncate`}>
                        {item.name}
                      </span>
                      {!item.isDemoSample && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shrink-0">
                          Just posted
                        </span>
                      )}
                    </div>
                    <p className={`text-xs leading-relaxed ${theme.colors.text} opacity-90`}>
                      {item.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Subtle Footer */}
      <footer className={`text-[11px] ${theme.colors.subtleText} opacity-50 text-center pb-4`}>
        {groom} & {bride} • Wedding Celebration
      </footer>

      {/* Floating QR Code */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setShowQR(!showQR)}
          className={`p-3 rounded-full transition-transform hover:scale-105 active:scale-95 flex items-center justify-center ${theme.qrButton.buttonClass}`}
          title="Share QR Code"
        >
          <QrCode className="w-4 h-4" />
        </button>

        <AnimatePresence>
          {showQR && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              className={`absolute bottom-14 right-0 p-4 ${theme.qrButton.modalCardClass} w-56 text-center z-50`}
            >
              <div className="bg-white p-3 rounded-lg mb-2 inline-block shadow-xs">
                <QRCodeSVG value={currentUrl} size={140} />
              </div>
              <p className={`text-xs font-medium ${theme.colors.text}`}>Share Guestbook</p>
              <p className={`text-[10px] ${theme.colors.subtleText}`}>Scan to leave a note</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Language Selector */}
      <LanguageSelector variant="floating" />
    </div>
  </TranslationProvider>
  );
}
