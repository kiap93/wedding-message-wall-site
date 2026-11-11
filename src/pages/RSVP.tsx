import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, QrCode, Zap, Calendar, MapPin } from 'lucide-react';
import RSVPForm from '../components/RSVPForm';
import { WeddingEvent, WeddingTemplate, Agency } from '../types';
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

export default function RSVPPage() {
  const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
  const { projectId, slug } = useParams();
  const [project, setProject] = useState<WeddingEvent | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [rsvpCount, setRsvpCount] = useState(0);
  const [templates, setTemplates] = useState<WeddingTemplate[]>([]);

  const [searchParams] = useSearchParams();
  const isPreviewParam = searchParams.get('preview') === 'true';

  useEffect(() => {
    async function load() {
      const data = await fetchTemplates();
      setTemplates(data);
    }
    load();
  }, []);

  useEffect(() => {
    if (isLoadingWorkspace) return;
    const urlProjectId = projectId || searchParams.get('id') || searchParams.get('projectId');
    const normalizedProjectId = (urlProjectId && urlProjectId !== 'undefined') ? urlProjectId : undefined;

    if (!normalizedProjectId && !slug && workspace) {
      loadProjectByWorkspace(workspace.id);
    } else if (normalizedProjectId || slug) {
      loadProject(normalizedProjectId, slug);
    } else {
      setIsLoading(false);
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

        const { count: rsvpCountVal } = await supabase
          .from('rsvps')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectData.id);
        setRsvpCount(rsvpCountVal || 0);
      }
    } catch (err) {
      console.error('Error loading workspace project:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProject = async (id?: string, slugName?: string) => {
    if (id === 'demo' || slugName === 'demo') {
      const demoAgency: Agency = {
        id: 'demo-agency',
        name: 'EventFrame Demo',
        slug: 'demo',
        user_id: 'demo-user',
        user_role: 'agency',
        subscription_status: 'active',
        is_demo: true,
        logo_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=100&h=100',
        theme_config: { primaryColor: '#8B806F', accentColor: '#252525' },
        created_at: new Date().toISOString()
      };
      const demoProject: WeddingEvent = {
        id: 'demo-project',
        agency_id: 'demo-agency',
        groom_name: 'Lucas',
        bride_name: 'Sofia',
        name: 'Lucas & Sofia Wedding',
        slug: 'demo',
        theme_id: 'garden',
        image_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80',
        wedding_date: '2025-06-15',
        location: 'San Francisco, CA',
        auto_approve_messages: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setAgency(demoAgency);
      setProject(demoProject);
      setRsvpCount(2);
      setIsLoading(false);
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
          const { data: agencyData } = await supabase.from('agencies').select('*').eq('slug', slugName).maybeSingle();
          if (agencyData) {
            setAgency(agencyData);
            const { data: events } = await supabase.from('projects').select('*').eq('agency_id', agencyData.id).order('created_at', { ascending: true }).limit(1);
            if (events && events.length > 0) projectData = events[0];
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

  // Resolve theme: URL preview param override or event's actual theme_id
  const targetThemeId = (isPreviewParam && searchParams.get('template')) 
    ? searchParams.get('template') 
    : (project?.theme_id || searchParams.get('template') || 'minimal_luxury');

  const theme: ResolvedEventTheme = resolveEventTheme(targetThemeId, templates);
  const Icon = theme.IconComponent;

  const groom = project?.groom_name || searchParams.get('groom') || 'Alex';
  const bride = project?.bride_name || searchParams.get('bride') || 'Sam';

  const currentUrl = window.location.origin + window.location.pathname + window.location.search;

  const isSubscribed = isEventActive(project, agency);
  const isPreview = !isSubscribed && !isPreviewParam;

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.colors.background}`}>
        <div className={`w-8 h-8 border-2 ${theme.colors.accent} border-t-transparent rounded-full animate-spin opacity-60`} />
      </div>
    );
  }

  const guestUrl = (slug ? `/${slug}` : project?.slug ? `/${project.slug}` : '') + '/guest' + window.location.search;

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
              Draft Preview: {rsvpCount}/5 RSVPs • 12-Month License Required
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

      {/* Agency Branding */}
      {agency && (
        <div className={`fixed ${isPreview ? 'top-12' : 'top-5'} left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] backdrop-blur-md ${theme.agencyBadgeClass}`}>
          {agency.logo_url && <img src={agency.logo_url} alt={agency.name} className="h-3.5 w-auto rounded" />}
          <span className="font-medium opacity-90">{agency.name}</span>
        </div>
      )}

      {/* Main RSVP Card */}
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

          {/* Header */}
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

            <p className={`text-xs ${theme.colors.subtleText}`}>
              Please let us know if you can attend our wedding celebration.
            </p>
          </div>

          {/* RSVP Form */}
          <RSVPForm
            projectId={project?.id || ''}
            resolvedTheme={theme}
            isPreview={isPreview}
            currentCount={rsvpCount}
            rsvpFields={project?.rsvp_fields}
            onSuccess={() => {
              setRsvpCount(prev => prev + 1);
              setShowSuccess(true);
            }}
          />

          {/* Secondary link: Guestbook */}
          <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-xs">
            <span className={`opacity-60 text-[11px]`}>Want to send congratulations?</span>
            <Link
              to={guestUrl}
              className={`font-medium underline hover:opacity-100 opacity-80 transition-opacity`}
            >
              Sign Guestbook &rarr;
            </Link>
          </div>

          {/* Success Dialog Overlay */}
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
                  Response Received
                </h3>
                <p className={`text-xs ${theme.colors.subtleText} max-w-xs mb-4 leading-relaxed`}>
                  Thank you for letting us know. We look forward to celebrating together.
                </p>
                <button
                  type="button"
                  onClick={() => setShowSuccess(false)}
                  className={`text-xs font-medium underline opacity-80 hover:opacity-100 ${theme.colors.text}`}
                >
                  Close
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Subtle Footer */}
      <footer className={`text-[11px] ${theme.colors.subtleText} opacity-50 text-center pb-4`}>
        {groom} & {bride} • RSVP Portal
      </footer>

      {/* Floating QR Code */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setShowQR(!showQR)}
          className={`p-3 rounded-full transition-transform hover:scale-105 active:scale-95 flex items-center justify-center ${theme.qrButton.buttonClass}`}
          title="Share RSVP QR Code"
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
              <p className={`text-xs font-medium ${theme.colors.text}`}>RSVP QR Code</p>
              <p className={`text-[10px] ${theme.colors.subtleText}`}>Scan to submit RSVP</p>
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
