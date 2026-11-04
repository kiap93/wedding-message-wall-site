import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, QrCode, Zap } from 'lucide-react';
import { fetchMessages, Message } from '../lib/api';
import { getSupabase } from '../lib/supabase';
import { WeddingEvent, WeddingTemplate, Agency } from '../types';
import { resolveEventTheme, ResolvedEventTheme } from '../lib/eventTheme';
import { ThemeOverlay } from '../components/ThemeDecorations';
import { QRCodeSVG } from 'qrcode.react';
import { getAgencyById } from '../lib/agency';
import { useWorkspace } from '../lib/WorkspaceContext';
import { fetchTemplates } from '../lib/templates';

export default function Display() {
  const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
  const { projectId, slug } = useParams();
  const [project, setProject] = useState<WeddingEvent | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchParams] = useSearchParams();
  const isSubscribed = agency?.subscription_status === 'active' || agency?.is_demo === true;
  const isCoupleLogic = agency?.user_role === 'couple';
  const isPreviewParam = searchParams.get('preview') === 'true';
  const isPreview = isCoupleLogic && !isSubscribed && !isPreviewParam;
  const [showQR, setShowQR] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<WeddingTemplate[]>([]);
  const navigate = useNavigate();

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
    } else {
      loadProject(normalizedProjectId, slug);
    }
  }, [projectId, slug, searchParams, isLoadingWorkspace, workspace]);

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
        if (!agency) {
          setAgency(workspace);
        }
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error loading workspace project:', err);
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
        theme_config: { primaryColor: '#C5A059', accentColor: '#2D2424' },
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
      setMessages([
        { id: '1', project_id: 'demo-project', name: 'James & Clara', message: 'Wishing you both a lifetime of boundless love and happiness!', timestamp: Date.now() - 3600000, status: 'approved' },
        { id: '2', project_id: 'demo-project', name: 'Emma Watson', message: 'Such an exquisitely beautiful celebration. Cheers to Lucas and Sofia!', timestamp: Date.now() - 7200000, status: 'approved' },
        { id: '3', project_id: 'demo-project', name: 'Oliver & Mia', message: 'Honored to celebrate this unforgettable day with you both!', timestamp: Date.now() - 10800000, status: 'approved' }
      ]);
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
        if (workspace) {
          query = query.eq('agency_id', workspace.id);
        }
        
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
          } catch(e) {
            projectData.rsvp_fields = [];
          }
        }
        setProject(projectData);
        if (!agency && projectData.agency_id) {
          const agencyData = await getAgencyById(projectData.agency_id);
          setAgency(agencyData);
        }
      }
    } catch (err) {
      console.error('Error loading event:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Resolve aesthetic: URL template preview override or project.theme_id
  const targetThemeId = (isPreviewParam && searchParams.get('template')) 
    ? searchParams.get('template') 
    : (project?.theme_id || searchParams.get('template') || 'minimal_luxury');

  const theme: ResolvedEventTheme = resolveEventTheme(targetThemeId, templates);
  const Icon = theme.IconComponent;

  const groom = project?.groom_name || searchParams.get('groom') || 'Alex';
  const bride = project?.bride_name || searchParams.get('bride') || 'Sam';

  const baseUrl = window.location.origin + (slug ? `/${slug}` : project?.slug ? `/${project.slug}` : '');
  const guestUrl = baseUrl + '/guest' + window.location.search;

  useEffect(() => {
    const targetId = project?.id || projectId;
    if (!targetId) return;

    const loadInitialMessages = async () => {
      try {
        const data = await fetchMessages(targetId);
        let processed = isPreview ? data.slice(0, 5) : data;
        
        if (isPreviewParam && processed.length < 5) {
          const mockData = [
            { id: 'm1', name: 'Sophia & James', message: 'Wishing you both a lifetime of deep love, joy, and adventure!', timestamp: Date.now(), status: 'approved' },
            { id: 'm2', name: 'Grandma Betty', message: 'So proud of you both. A beautiful wedding day for a truly wonderful couple.', timestamp: Date.now() - 1000, status: 'approved' },
            { id: 'm3', name: 'The Miller Family', message: 'Warmest congratulations to the newlyweds! Let the celebration begin!', timestamp: Date.now() - 2000, status: 'approved' },
            { id: 'm4', name: 'Best Man Chris', message: 'To the happiest couple in the room! Cheers to unforgettable memories!', timestamp: Date.now() - 3000, status: 'approved' },
            { id: 'm5', name: 'Aunt Sarah', message: 'May your journey together be illuminated by endless love and laughter.', timestamp: Date.now() - 4000, status: 'approved' }
          ];
          processed = [...processed, ...mockData.slice(0, 5 - processed.length)] as Message[];
        }
        
        setMessages(processed);
      } catch (err) {
        console.error('Initial fetch error:', err);
      }
    };

    loadInitialMessages();

    let channel: any = null;
    try {
      const supabase = getSupabase();
      channel = supabase
        .channel(`messages-realtime-${targetId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `project_id=eq.${targetId}`
          },
          (payload) => {
            const newMessage = payload.new as Message;
            const eventType = payload.eventType;

            if (newMessage.status === 'approved') {
              setMessages((prev) => {
                const filtered = prev.filter(m => m.id !== newMessage.id);
                const updated = [newMessage, ...filtered];
                const unique = Array.from(new Map(updated.map(m => [m.id, m])).values());
                const sorted = unique.sort((a, b) => b.timestamp - a.timestamp);
                return isPreview ? sorted.slice(0, 5) : sorted.slice(0, 50);
              });
            } else if (eventType === 'UPDATE' || eventType === 'DELETE') {
              setMessages((prev) => prev.filter(m => m.id !== (newMessage.id || payload.old.id)));
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.error('Realtime subscription error:', err);
    }
    
    return () => {
      if (channel) {
        const supabase = getSupabase();
        supabase.removeChannel(channel);
      }
    };
  }, [project?.id, projectId, isPreview, isPreviewParam]);

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.colors.background}`}>
        <div className={`w-8 h-8 border-2 ${theme.colors.accent} border-t-transparent rounded-full animate-spin opacity-60`} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.colors.background} transition-colors duration-700 relative overflow-x-hidden ${theme.fontBody} ${theme.colors.text}`}>
      {/* Background Decorative Overlay */}
      <ThemeOverlay themeId={theme.id} mode="fullscreen" />

      {/* Preview Warning Banner */}
      {isPreview && (
        <div className="fixed top-0 left-0 right-0 bg-[#252525]/95 backdrop-blur-md text-white py-2 px-6 shadow-sm z-[100] flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[#8B806F]" />
            <span className="font-mono text-[11px]">
              Preview Mode • Guestbook Limited to 5 Messages
            </span>
          </div>
          <button 
            onClick={() => window.open('/subscription', '_blank')}
            className="bg-white text-[#252525] px-3 py-1 rounded text-xs font-medium hover:bg-[#F7F7F5] transition-colors"
          >
            Upgrade to Publish
          </button>
        </div>
      )}
      
      {/* Agency Branding Overlay */}
      {agency && (
        <div className={`fixed top-8 left-8 z-40 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-[11px] backdrop-blur-md ${theme.agencyBadgeClass}`}>
          {agency.logo_url && <img src={agency.logo_url} alt={agency.name} className="h-4 w-auto rounded" />}
          <span className="font-medium opacity-85">Hosted by {agency.name}</span>
        </div>
      )}

      {/* QR Code Floating UI */}
      <div className="fixed bottom-8 right-8 z-[100]">
        <button
          onClick={() => setShowQR(!showQR)}
          className={`p-3.5 sm:p-4 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center backdrop-blur-md ${theme.qrButton.buttonClass}`}
          title="Scan to Send Wishes"
        >
          <QrCode className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <AnimatePresence>
          {showQR && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85, x: 20 }}
              className={`absolute bottom-0 right-16 sm:right-20 p-6 sm:p-8 ${theme.qrButton.modalCardClass} shadow-2xl backdrop-blur-2xl w-72 sm:w-80 text-center`}
            >
              <h3 className={`text-xl sm:text-2xl ${theme.fontHeading} ${theme.colors.headerText} mb-4`}>
                Leave a Note
              </h3>
              <div className="bg-white p-3.5 rounded-2xl mb-4 inline-block shadow-inner ring-4 ring-black/5">
                <QRCodeSVG value={guestUrl} size={180} />
              </div>
              <p className={`text-sm font-semibold ${theme.colors.text} mb-1`}>
                Scan to Send Wishes
              </p>
              <p className={`text-[11px] ${theme.colors.subtleText}`}>
                Your message appears instantly on screen
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Optional Wedding Background Photo */}
      {project?.image_url && (
        <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden">
          <motion.img 
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 0.12, scale: 1 }}
            transition={{ duration: 2.5, ease: "easeOut" }}
            src={project.image_url} 
            alt="Wedding Background" 
            className="w-full h-full object-cover filter blur-[2px] grayscale-[20%]"
          />
          <div className={`absolute inset-0 bg-gradient-to-b ${theme.colors.background} opacity-50`} />
        </div>
      )}

      {/* Main Container */}
      <div className="relative z-10 min-h-screen flex flex-col p-6 sm:p-10 md:p-16">
        <header className="flex flex-col md:flex-row items-center justify-between mb-12 md:mb-16 gap-6">
          <div className="space-y-1.5 text-center md:text-left">
            <h1 className={`text-4xl sm:text-6xl md:text-7xl ${theme.fontHeading} tracking-tight ${theme.colors.headerText}`}>
              {groom} & {bride}
            </h1>
            <p className={`text-xs sm:text-sm tracking-widest ${theme.colors.accent} font-medium`}>
              {theme.display.headerSubtitle}
            </p>
          </div>
          <div className="hidden md:flex flex-col items-end">
            <div className={`flex items-center gap-2 ${theme.colors.accent}`}>
              <Icon className="w-5 h-5 fill-current animate-pulse" />
              <span className={`${theme.fontHeading} italic text-2xl`}>Forever & Always</span>
            </div>
            <p className={`text-xs ${theme.colors.subtleText} mt-1 tracking-wider`}>Celebrating Our Love</p>
          </div>
        </header>

        <main className="flex-1 relative px-2 sm:px-4 md:px-8">
          <AnimatePresence mode="wait">
            {theme.display.layoutVariant === 'hanging' ? (
              <HangingLayout key="hanging" messages={messages} theme={theme} />
            ) : theme.display.layoutVariant === 'floating' ? (
              <FloatingLayout key="floating" messages={messages} theme={theme} />
            ) : theme.display.layoutVariant === 'custom' ? (
              <CustomLayout key="custom" messages={messages} template={theme.rawTemplate} project={project} />
            ) : theme.display.layoutVariant === 'grid' ? (
              <GridLayout key="grid" messages={messages} theme={theme} />
            ) : (
              <MasonryLayout key="masonry" messages={messages} theme={theme} />
            )}
          </AnimatePresence>

          {/* Empty State */}
          {messages.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center p-8 max-w-sm"
              >
                <Icon className={`w-14 h-14 ${theme.colors.accent} opacity-30 mx-auto mb-3 fill-current`} />
                <p className={`${theme.colors.subtleText} ${theme.fontHeading} italic text-lg sm:text-xl`}>
                  {theme.display.emptyStateText}
                </p>
                <p className={`text-xs ${theme.colors.subtleText} opacity-70 mt-2`}>
                  Scan the QR code in the bottom corner to share your congratulations.
                </p>
              </motion.div>
            </div>
          )}
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(139, 128, 111, 0.3); border-radius: 10px; }
        .polaroid-frame {
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
          padding-bottom: 28px !important;
        }
        .wood-texture {
          background-image: url('https://www.transparenttextures.com/patterns/wood-pattern.png');
          background-repeat: repeat;
        }
        .custom-card-wrapper {
          display: block !important;
          min-height: 10px;
        }
        ${theme.rawTemplate.css || ''}
      `}} />
    </div>
  );
}

function renderCard(cardHtml: string, msg: any, index: number) {
  const tpl = cardHtml || '<div class="p-6 bg-white rounded-2xl shadow-lg"><h3>{{name}}</h3><p>{{message}}</p></div>';
  return tpl
    .replace(/\{\{name\}\}/g, msg.name || 'Guest')
    .replace(/\{\{message\}\}/g, msg.message)
    .replace(/\{\{index\}\}/g, index.toString())
    .replace(/\{\{timestamp\}\}/g, new Date(msg.timestamp).toLocaleTimeString());
}

function CustomLayout({ messages, template, project }: { messages: Message[], template: WeddingTemplate, project: WeddingEvent | null }) {
  const finalHtml = React.useMemo(() => {
    const cardsHtml = messages.map((msg, index) => {
      const cardInner = renderCard(template.card_html || '', msg, index);
      const row = index % 5;
      const col = Math.floor(index / 5);
      return `<div class="custom-card-wrapper" style="--index: ${index}; --row: ${row}; --col: ${col}">${cardInner}</div>`;
    }).join('');
    
    let baseHtml = template.html || '<div id="messages-container"></div>';
    
    if (project) {
      baseHtml = baseHtml
        .replace(/\{\{bride\}\}/g, project.bride_name || 'Bride')
        .replace(/\{\{groom\}\}/g, project.groom_name || 'Groom')
        .replace(/\{\{date\}\}/g, project.wedding_date ? new Date(project.wedding_date).toLocaleDateString() : 'TBD');
    }

    if (baseHtml.includes('id="messages-container"')) {
      return baseHtml.replace(/(id="messages-container"[^>]*>)/, `$1${cardsHtml}`);
    } else {
      return `${baseHtml}<div id="messages-container">${cardsHtml}</div>`;
    }
  }, [template.html, template.card_html, messages, project]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="custom-layout-container w-full h-full min-h-screen relative"
      dangerouslySetInnerHTML={{ __html: finalHtml }}
    />
  );
}

function MasonryLayout({ messages, theme }: { messages: Message[], theme: ResolvedEventTheme }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8 space-y-8 pr-4 pb-48 pt-6 max-w-7xl mx-auto w-full"
    >
      <AnimatePresence mode="popLayout">
        {messages.map((msg) => (
          <div key={msg.id} className="break-inside-avoid block">
            <MessageCard msg={msg} theme={theme} />
          </div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function GridLayout({ messages, theme }: { messages: Message[], theme: ResolvedEventTheme }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-48 pt-6 max-w-7xl mx-auto w-full"
    >
      <AnimatePresence mode="popLayout">
        {messages.map((msg) => (
          <div key={msg.id}>
            <MessageCard msg={msg} theme={theme} />
          </div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function HangingLayout({ messages, theme }: { messages: Message[], theme: ResolvedEventTheme }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative min-h-[70vh] flex flex-wrap justify-center gap-x-10 gap-y-20 pb-48 pt-20 max-w-7xl mx-auto rounded-3xl p-8 sm:p-12 shadow-inner bg-white/20 backdrop-blur-sm"
    >
      {/* Decorative Botanical Branch Wire */}
      <div className="absolute top-0 left-0 w-full h-24 overflow-hidden opacity-25 pointer-events-none">
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="w-full h-full text-[#4E614E]">
          <path d="M0,45 Q250,15 500,45 T1000,45" stroke="currentColor" strokeWidth="6" fill="none" />
          <path d="M120,40 Q140,15 170,40" stroke="currentColor" strokeWidth="3" fill="none" />
          <path d="M400,48 Q420,70 450,48" stroke="currentColor" strokeWidth="3" fill="none" />
          <path d="M720,40 Q740,18 770,40" stroke="currentColor" strokeWidth="3" fill="none" />
        </svg>
      </div>

      {/* Visual Twine line */}
      <div className="absolute top-40 left-0 w-full h-[1.5px] bg-[#829D82]/30" />
      <div className="absolute top-96 left-0 w-full h-[1.5px] bg-[#829D82]/30" />

      <AnimatePresence mode="popLayout">
        {messages.map((msg) => (
          <div key={msg.id} className="relative">
            {/* The Twine attached to card */}
            <div className="absolute top-[-60px] left-1/2 w-[2px] h-16 bg-[#829D82]/40 -translate-x-1/2" />
            <MessageCard msg={msg} theme={theme} hanging />
          </div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function FloatingLayout({ messages, theme }: { messages: Message[], theme: ResolvedEventTheme }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative min-h-[80vh] w-full max-w-7xl mx-auto pt-8 pb-48"
    >
      <AnimatePresence mode="popLayout">
        {messages.map((msg, idx) => {
          const x = (idx * 313) % 80;
          const y = (idx * 271) % 68;
          
          return (
            <motion.div
              key={msg.id}
              className="absolute"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                top: `${y}%`,
                left: `${x}%`,
              }}
              transition={{ duration: 0.8, delay: idx * 0.08 }}
            >
              <MessageCard msg={msg} theme={theme} floating />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

function MessageCard({ 
  msg, 
  theme, 
  hanging, 
  floating 
}: { 
  msg: Message; 
  theme: ResolvedEventTheme; 
  hanging?: boolean; 
  floating?: boolean; 
}) {
  const seed = String(msg.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rotation = (seed % 6) - 3;
  const xOffset = (seed % 10) - 5;
  const floatDuration = 6 + (seed % 6);
  const floatDelay = (seed % 5000) / 1000;
  const Icon = theme.IconComponent;

  const cardBaseClass = theme.id === 'polaroid' 
    ? 'polaroid-frame bg-white text-gray-900 rounded-none' 
    : hanging 
      ? `${theme.card.surface} ${theme.card.border} ${theme.card.radius} ${theme.card.shadow}`
      : `${theme.display.messageCardBase}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85, y: 24, rotate: rotation }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        x: xOffset,
        y: floating ? [0, -18, 0, 18, 0] : [0, -8, 0],
        rotate: [rotation, rotation + 1.5, rotation - 1.5, rotation] 
      }}
      exit={{ opacity: 0, scale: 0.7, y: -24 }}
      transition={{
        y: {
          duration: floating ? floatDuration * 1.8 : floatDuration,
          repeat: Infinity,
          ease: "easeInOut",
          delay: floatDelay
        },
        rotate: {
          duration: floatDuration * 1.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: floatDelay
        },
        opacity: { duration: 0.5 },
        scale: { type: "spring", damping: 20 }
      }}
      className={`p-6 sm:p-7 transition-all relative text-center ${cardBaseClass} ${
        floating ? 'w-64 scale-80 md:scale-100' : 'w-full'
      }`}
      style={{ transformOrigin: 'center center' }}
    >
      {/* Hanging Pin / Wooden Peg */}
      {hanging && (
        <div className="absolute -top-2.5 left-1/2 w-4 h-4 bg-[#829D82] rounded-full border-2 border-white shadow-xs -translate-x-1/2 z-10" />
      )}

      <div className="flex flex-col items-center justify-center mb-3">
        <div className={`mb-2.5 ${theme.colors.accent}`}>
          <Icon className="w-5 h-5 fill-current opacity-30" />
        </div>
        <h3 className={`text-lg sm:text-xl ${theme.fontHeading} ${theme.id === 'polaroid' ? 'text-gray-900' : theme.colors.headerText} tracking-tight font-semibold`}>
          {msg.name || 'Anonymous Guest'}
        </h3>
      </div>

      <p className={`leading-relaxed text-base sm:text-lg italic mb-5 px-1 ${
        theme.id === 'polaroid' ? 'text-gray-800' : theme.colors.text
      }`}>
        "{msg.message}"
      </p>

      <div className={`flex justify-center border-t ${
        theme.id === 'polaroid' ? 'border-gray-200' : theme.colors.border
      } pt-3`}>
        <span className={`text-[10px] uppercase font-mono tracking-wider tabular-nums ${
          theme.id === 'polaroid' ? 'text-gray-400' : theme.colors.subtleText
        }`}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}
