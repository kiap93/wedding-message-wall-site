import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, CheckCircle2, QrCode, Leaf, Star, Mail, Camera, Flower, Users, Zap } from 'lucide-react';
import RSVPForm from '../components/RSVPForm';
import { WeddingEvent, DEFAULT_TEMPLATES, TemplateId, WeddingTemplate, Agency } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { getSupabase } from '../lib/supabase';
import { getAgencyById } from '../lib/agency';
import { useWorkspace } from '../lib/WorkspaceContext';
import { fetchTemplates } from '../lib/templates';

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
          } catch(e) {
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
       // Demo logic similar to Guest.tsx
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
          } catch(e) {
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

  const isSubscribed = agency?.subscription_status === 'active' || agency?.is_demo === true;
  const isCoupleLogic = agency?.user_role === 'couple';
  const isPreview = isCoupleLogic && !isSubscribed && !isPreviewParam;

  const Icon = template.iconType === 'leaf' ? Leaf :
               template.iconType === 'star' ? Star :
               template.iconType === 'mail' ? Mail :
               template.iconType === 'camera' ? Camera :
               template.iconType === 'flower' ? Flower : Heart;

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${template.colors.background}`}>
        <div className="w-12 h-12 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col items-center p-4 sm:p-6 ${template.colors.background} transition-colors duration-700 relative overflow-x-hidden ${template.fontSans} ${template.colors.text}`}>
      {isPreview && (
        <div className="absolute top-0 left-0 right-0 bg-[#2D2424] text-white py-2 px-4 shadow-2xl z-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
           <Zap className="w-3.5 h-3.5 text-[#C5A059]" />
           <span className="text-[10px] font-black uppercase tracking-[0.2em]">
             Preview Mode: {rsvpCount}/5 RSVPs
           </span>
          </div>
          <button 
            onClick={() => window.open('/subscription', '_blank')}
            className="bg-[#C5A059] text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-[#C5A059]/20"
          >
            Upgrade to Publish
          </button>
        </div>
      )}
      
      {/* Agency Branding */}
      {agency && (
        <div className={`absolute ${isPreview ? 'top-14' : 'top-8'} left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white/20 backdrop-blur-md px-6 py-2 rounded-full border border-white/30 whitespace-nowrap`}>
          {agency.logo_url && <img src={agency.logo_url} alt={agency.name} className="h-4 w-auto" />}
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Created by {agency.name}</span>
        </div>
      )}

      {/* Decorative Background Elements */}
      <div className={`absolute top-[-10%] right-[-10%] w-64 h-64 rounded-full blur-3xl opacity-20 ${template.id === 'starry' ? 'bg-blue-500' : 'bg-pink-300'}`} />
      <div className={`absolute bottom-[-10%] left-[-10%] w-96 h-96 rounded-full blur-3xl opacity-10 ${template.id === 'starry' ? 'bg-indigo-500' : 'bg-yellow-200'}`} />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg relative z-10 pt-16 pb-12 sm:my-auto"
      >
        <div className={`${template.colors.card} backdrop-blur-xl p-6 xs:p-8 md:p-12 rounded-[2rem] sm:rounded-[2.5rem] border ${template.colors.border} shadow-2xl`}>
          <div className="text-center mb-8 sm:mb-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className={`inline-block p-3 sm:p-4 rounded-full ${template.colors.accent} bg-opacity-10 mb-4 sm:mb-6`}
            >
              <Users className={`w-8 h-8 sm:w-10 sm:h-10 fill-current bg-opacity-20`} />
            </motion.div>
            <h1 className={`text-3xl sm:text-5xl ${template.fontSerif} ${template.colors.headerText} mb-2 sm:mb-4 tracking-tight`}>
              {groom} & {bride}
            </h1>
            <p className={`text-sm sm:text-base ${template.colors.subtleText} tracking-wide font-medium uppercase tracking-widest`}>Wedding RSVP</p>
          </div>

          <RSVPForm 
            projectId={project?.id || ''} 
            template={template}
            isPreview={isPreview}
            currentCount={rsvpCount}
            rsvpFields={project?.rsvp_fields}
            onSuccess={() => {
              setRsvpCount(prev => prev + 1);
              setShowSuccess(true);
            }}
          />

          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className={`absolute inset-0 flex items-center justify-center rounded-[2.5rem] ${template.colors.card} backdrop-blur-2xl z-20`}
              >
                <div className="text-center p-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1 }}
                  >
                    <CheckCircle2 className={`w-20 h-20 ${template.colors.accent} mx-auto mb-6`} />
                  </motion.div>
                  <h3 className={`text-4xl ${template.fontSerif} ${template.colors.headerText} mb-2`}>Thank You</h3>
                  <p className={`${template.colors.subtleText} font-medium tracking-wide`}>Your response has been received.</p>
                  <button 
                    onClick={() => setShowSuccess(false)}
                    className="mt-8 text-xs font-bold uppercase tracking-widest opacity-60 hover:opacity-100"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      
      <div className={`absolute bottom-8 text-[12px] uppercase tracking-[0.4em] ${template.colors.subtleText} font-bold opacity-30`}>
        Our Story • {new Date().getFullYear()}
      </div>

      <div className="fixed bottom-8 right-8 z-[100]">
        <button
          onClick={() => setShowQR(!showQR)}
          className={`p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center backdrop-blur-md
            ${template.id === 'digital' ? 'bg-[#00FF41] text-black' : template.id === 'starry' ? 'bg-[#38BDF8] text-white' : 'bg-[#C5A059] text-white'}
          `}
        >
          <QrCode className="w-6 h-6" />
        </button>

        <AnimatePresence>
          {showQR && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className={`absolute bottom-20 right-0 p-6 rounded-3xl ${template.colors.card} border ${template.colors.border} shadow-2xl backdrop-blur-2xl w-64 text-center`}
            >
              <div className="bg-white p-4 rounded-2xl mb-4 inline-block">
                <QRCodeSVG value={currentUrl} size={160} />
              </div>
              <p className={`text-sm font-bold ${template.colors.text} mb-1`}>RSVP QR Code</p>
              <p className={`text-[10px] ${template.colors.subtleText} uppercase tracking-widest`}>Scan to RSVP</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
