import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Send, CheckCircle2, QrCode, Leaf, Star, Mail, Camera, Flower, Zap, Calendar, MapPin, MessageSquareHeart } from 'lucide-react';
import { postMessage } from '../lib/api';
import confetti from 'canvas-confetti';
import { WeddingEvent, DEFAULT_TEMPLATES, TemplateId, WeddingTemplate, Agency } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { getSupabase } from '../lib/supabase';
import { getAgencyById } from '../lib/agency';
import { useWorkspace } from '../lib/WorkspaceContext';
import { fetchTemplates } from '../lib/templates';

export default function Guest() {
  const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
  const { projectId, slug } = useParams();
  const [project, setProject] = useState<WeddingEvent | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
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

  const templateIdFromUrl = (searchParams.get('template') as TemplateId) || (localStorage.getItem('selectedTemplate') as TemplateId) || 'minimal_luxury';

  const activeTemplateId = isPreviewParam && searchParams.get('template')
    ? (searchParams.get('template') as TemplateId)
    : (project?.theme_id || templateIdFromUrl);

  const template = templates.find(t => t.id === activeTemplateId) || DEFAULT_TEMPLATES.find(t => t.id === activeTemplateId) || DEFAULT_TEMPLATES[0];

  const groom = project?.groom_name || searchParams.get('groom') || localStorage.getItem('groomName') || 'Alex';
  const bride = project?.bride_name || searchParams.get('bride') || localStorage.getItem('brideName') || 'Sam';

  const currentUrl = window.location.origin + window.location.pathname + window.location.search;

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

        const { count: msgCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectData.id);
        setMessages(new Array(msgCount || 0).fill({}));

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

  const isSubscribed = agency?.subscription_status === 'active' || agency?.is_demo === true;
  const isCoupleLogic = agency?.user_role === 'couple';
  const isPreview = isCoupleLogic && !isSubscribed && !isPreviewParam;

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
      setMessages([{ id: 1 }, { id: 2 }, { id: 3 }]);
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
        setMessages(new Array(msgCount || 0).fill({}));

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

  const Icon = template.iconType === 'leaf' ? Leaf :
               template.iconType === 'star' ? Star :
               template.iconType === 'mail' ? Mail :
               template.iconType === 'camera' ? Camera :
               template.iconType === 'flower' ? Flower : Heart;

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${template.colors.background}`}>
        <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

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
      await postMessage(name, message, project.id, !!project?.auto_approve_messages);
      setMessages([...messages, { id: Date.now() }]);
      confetti({
        particleCount: 120,
        spread: 60,
        origin: { y: 0.6 },
        colors: template.id === 'digital' ? ['#00FF41', '#FFFFFF'] : template.id === 'starry' ? ['#38BDF8', '#FFFFFF'] : ['#8B806F', '#E8E8E5', '#FFFFFF']
      });
      setShowSuccess(true);
      setName('');
      setMessage('');
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getButtonBg = () => {
    switch (template.id) {
      case 'digital': return 'bg-[#00FF41] text-black hover:bg-[#00DD31]';
      case 'starry': return 'bg-[#38BDF8] text-white hover:bg-[#0EA5E9]';
      case 'garden': return 'bg-[#6B856B] text-white hover:bg-[#5A725A]';
      case 'romantic': return 'bg-[#E07A7A] text-white hover:bg-[#CF6A6A]';
      case 'postal': return 'bg-[#6D4C41] text-white hover:bg-[#5D3F35]';
      default: return 'bg-[#252525] text-white hover:bg-[#111111]';
    }
  };

  const rsvpUrl = (slug ? `/${slug}` : project?.slug ? `/${project.slug}` : '') + '/rsvp' + window.location.search;

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 ${template.colors.background} transition-colors duration-500 relative overflow-x-hidden ${template.fontSans} ${template.colors.text}`}>
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
            href="/subscription"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium underline hover:text-[#8B806F] transition-colors"
          >
            Upgrade to Publish
          </a>
        </div>
      )}

      {/* Agency Branding */}
      {agency && (
        <div className={`fixed ${isPreview ? 'top-12' : 'top-5'} left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-black/5 text-[11px] text-[#252525] shadow-xs`}>
          {agency.logo_url && <img src={agency.logo_url} alt={agency.name} className="h-3.5 w-auto rounded" />}
          <span className="font-medium opacity-80">{agency.name}</span>
        </div>
      )}

      {/* Guest Card Container */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10 my-auto pt-10 pb-8"
      >
        <div className={`${template.colors.card} rounded-2xl border ${template.colors.border} shadow-lg p-6 sm:p-8 backdrop-blur-md relative overflow-hidden`}>
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
            <div className={`inline-flex p-2.5 rounded-full ${template.colors.accent} bg-current/10 mb-3`}>
              <Icon className="w-5 h-5 fill-current" />
            </div>
            <h1 className={`text-2xl sm:text-3xl ${template.fontSerif} ${template.colors.headerText} tracking-tight font-normal leading-tight mb-2`}>
              {groom} & {bride}
            </h1>

            {/* Event details */}
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

            <p className={`text-xs ${template.colors.subtleText} max-w-xs mx-auto`}>
              Leave a heartfelt wish or message for the couple's live wedding display.
            </p>
          </div>

          {/* Message Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${template.colors.subtleText}`}>
                Your Name
              </label>
              <input
                type="text"
                placeholder="e.g. Grandma Betty, Sophia & James"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={`w-full px-3.5 py-2.5 rounded-lg border ${template.colors.border} bg-white/40 focus:outline-none focus:ring-1 focus:ring-current text-sm transition-all ${template.colors.text} placeholder:opacity-40`}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-xs font-medium ${template.colors.subtleText}`}>
                  Your Message
                </label>
                <span className={`text-[10px] ${template.colors.subtleText} font-mono`}>
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
                className={`w-full px-3.5 py-2.5 rounded-lg border ${template.colors.border} bg-white/40 focus:outline-none focus:ring-1 focus:ring-current text-sm transition-all ${template.colors.text} placeholder:opacity-40 resize-none`}
              />
            </div>

            {error && (
              <p className="text-red-600 text-xs text-center font-medium bg-red-50 py-2 px-3 rounded-lg border border-red-100">
                {error}
              </p>
            )}

            <button
              disabled={isSubmitting}
              type="submit"
              className={`w-full py-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-xs ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : getButtonBg()
              }`}
            >
              {isSubmitting ? 'Posting...' : 'Send Wishes'}
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Secondary links: RSVP */}
          <div className="mt-5 pt-4 border-t border-black/5 flex items-center justify-between text-xs">
            <span className={`opacity-60 text-[11px]`}>Attending the celebration?</span>
            <Link
              to={rsvpUrl}
              className={`font-medium underline hover:opacity-100 opacity-80 transition-opacity`}
            >
              RSVP Here &rarr;
            </Link>
          </div>

          {/* Success overlay */}
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`absolute inset-0 flex flex-col items-center justify-center p-8 rounded-2xl ${template.colors.card} backdrop-blur-xl z-20 text-center`}
              >
                <CheckCircle2 className={`w-12 h-12 ${template.colors.accent} mb-3`} />
                <h3 className={`text-2xl ${template.fontSerif} ${template.colors.headerText} mb-1.5`}>
                  With Gratitude
                </h3>
                <p className={`text-xs ${template.colors.subtleText} max-w-xs mb-4`}>
                  Your message has been sent and will appear on the wedding wall.
                </p>
                <button
                  type="button"
                  onClick={() => setShowSuccess(false)}
                  className="text-xs font-medium underline opacity-70 hover:opacity-100"
                >
                  Write Another Note
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Subtle Footer */}
      <footer className={`text-[11px] ${template.colors.subtleText} opacity-50 text-center pb-4`}>
        {groom} & {bride} • Wedding Celebration
      </footer>

      {/* Floating QR Code */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setShowQR(!showQR)}
          className={`p-3 rounded-full shadow-md transition-transform hover:scale-105 active:scale-95 flex items-center justify-center backdrop-blur-sm ${
            template.id === 'digital' ? 'bg-[#00FF41] text-black' : template.id === 'starry' ? 'bg-[#38BDF8] text-white' : 'bg-[#252525] text-white'
          }`}
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
              className={`absolute bottom-14 right-0 p-4 rounded-xl ${template.colors.card} border ${template.colors.border} shadow-xl backdrop-blur-xl w-56 text-center`}
            >
              <div className="bg-white p-3 rounded-lg mb-2 inline-block shadow-xs">
                <QRCodeSVG value={currentUrl} size={140} />
              </div>
              <p className={`text-xs font-medium ${template.colors.text}`}>Share Guestbook</p>
              <p className={`text-[10px] ${template.colors.subtleText}`}>Scan to leave a note</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
