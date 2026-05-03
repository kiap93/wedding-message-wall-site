import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Send, CheckCircle2, QrCode, Leaf, Star, Mail, Camera, Flower, Users, Zap } from 'lucide-react';
import { postMessage } from '../lib/api';
import RSVPForm from '../components/RSVPForm';
import confetti from 'canvas-confetti';
import { WeddingEvent, TEMPLATES, TemplateId, WeddingTemplate, Agency } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { getSupabase } from '../lib/supabase';
import { getAgencyById } from '../lib/agency';
import { useWorkspace } from '../lib/WorkspaceContext';

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
  const [activeTab, setActiveTab] = useState<'message' | 'rsvp'>('message');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [rsvpCount, setRsvpCount] = useState(0);
  
  const [searchParams] = useSearchParams();
  
  const templateIdFromUrl = (searchParams.get('template') as TemplateId) || (localStorage.getItem('selectedTemplate') as TemplateId) || 'minimal_luxury';
  const activeTemplateId = project?.theme_id || templateIdFromUrl;
  const template = TEMPLATES.find(t => t.id === activeTemplateId) || TEMPLATES[0];

  const groom = project?.groom_name || searchParams.get('groom') || localStorage.getItem('groomName') || 'Alex';
  const bride = project?.bride_name || searchParams.get('bride') || localStorage.getItem('brideName') || 'Sam';

  const currentUrl = window.location.origin + window.location.pathname + window.location.search;

  useEffect(() => {
    if (isLoadingWorkspace) return;
    const urlProjectId = projectId || searchParams.get('id') || searchParams.get('projectId');
    
    // If on a subdomain and no project ID/slug specified, load the first project of the workspace
    if (!urlProjectId && !slug && workspace) {
      loadProjectByWorkspace(workspace.id);
    } else if (urlProjectId || slug) {
      loadProject(urlProjectId || undefined, slug);
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
        setProject(projectData);
        if (!agency) {
          setAgency(workspace);
        }
        
        // Fetch stats
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
  const isPreview = isCoupleLogic && !isSubscribed;

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
      setMessages([{id: 1}, {id: 2}, {id: 3}]); // Mock count
      setRsvpCount(2); // Mock count
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabase();
      
      if (id || slugName) {
         let query = supabase.from('projects').select('*');
         if (id) {
           query = query.eq('id', id);
         } else if (slugName) {
           query = query.eq('slug', slugName);
           if (workspace) query = query.eq('agency_id', workspace.id);
         }

         const { data: projectData } = await query.maybeSingle();

         if (projectData) {
           setProject(projectData);
           const agencyData = await getAgencyById(projectData.agency_id);
           setAgency(agencyData);
           
           // Fetch messages count
           const { count: msgCount } = await supabase
             .from('messages')
             .select('*', { count: 'exact', head: true })
             .eq('project_id', projectData.id);
           setMessages(new Array(msgCount || 0).fill({}));

           // Fetch RSVP count
           const { count: rsvpCountVal } = await supabase
             .from('rsvps')
             .select('*', { count: 'exact', head: true })
             .eq('project_id', projectData.id);
           setRsvpCount(rsvpCountVal || 0);
         }
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
        <div className="w-12 h-12 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
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
      setMessages([...messages, { id: Date.now() }]); // Optimistic count update
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: template.id === 'digital' ? ['#00FF41', '#FFFFFF'] : template.id === 'starry' ? ['#38BDF8', '#FFFFFF'] : ['#D4AF37', '#FFB7C5', '#FFFFFF']
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
    switch(template.id) {
      case 'digital': return 'bg-[#00FF41] text-black hover:bg-[#00DD31]';
      case 'starry': return 'bg-[#38BDF8] text-white hover:bg-[#0EA5E9] shadow-[#38BDF8]/20';
      case 'garden': return 'bg-[#829D82] text-white hover:bg-[#6B856B] shadow-[#829D82]/20';
      case 'romantic': return 'bg-[#FF8585] text-white hover:bg-[#FF6B6B] shadow-[#FF8585]/20';
      case 'postal': return 'bg-[#8D6E63] text-white hover:bg-[#6D4C41] shadow-[#8D6E63]/20';
      default: return 'bg-[#C5A059] text-white hover:bg-[#B38D45] shadow-[#C5A059]/20';
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${template.colors.background} transition-colors duration-700 relative overflow-hidden ${template.fontSans} ${template.colors.text}`}>
      {isPreview && (
        <div className="absolute top-0 left-0 right-0 bg-[#2D2424] text-white py-2 px-4 shadow-2xl z-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
           <Zap className="w-3.5 h-3.5 text-[#C5A059]" />
           <span className="text-[10px] font-black uppercase tracking-[0.2em]">
             Preview Mode: {messages.length}/5 Messages • {rsvpCount}/5 RSVPs
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
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white/20 backdrop-blur-md px-6 py-2 rounded-full border border-white/30">
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
        className="w-full max-w-lg relative z-10"
      >
        <div className={`${template.colors.card} backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] border ${template.colors.border} shadow-2xl`}>
          <div className="text-center mb-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className={`inline-block p-4 rounded-full ${template.colors.accent} bg-opacity-10 mb-6`}
            >
              <Icon className={`w-10 h-10 fill-current bg-opacity-20`} />
            </motion.div>
            <h1 className={`text-5xl ${template.fontSerif} ${template.colors.headerText} mb-4 tracking-tight`}>
              {groom} & {bride}
            </h1>
            <p className={`text-base ${template.colors.subtleText} tracking-wide font-medium`}>Leave a message for the happy couple</p>
          </div>

            <div className="flex gap-4 mb-8 border-b border-white/10 pb-4">
              <button
                onClick={() => setActiveTab('message')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all text-sm uppercase tracking-widest ${
                  activeTab === 'message' 
                    ? template.colors.accent + ' bg-opacity-10 shadow-sm' 
                    : 'opacity-40 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> Message
                </div>
              </button>
              <button
                onClick={() => setActiveTab('rsvp')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all text-sm uppercase tracking-widest ${
                  activeTab === 'rsvp' 
                    ? template.colors.accent + ' bg-opacity-10 shadow-sm' 
                    : 'opacity-40 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Users className="w-4 h-4" /> Guest RSVP
                </div>
              </button>
            </div>

            {activeTab === 'message' ? (
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-3">
                  <label className={`text-xs uppercase tracking-[0.2em] font-bold ${template.colors.subtleText} ml-1`}>Your Name</label>
                  <input
                    type="text"
                    placeholder="How shall we call you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={`w-full px-6 py-4 rounded-2xl border ${template.colors.border} bg-white/5 focus:outline-none focus:ring-2 ${template.colors.accent} ring-opacity-30 transition-all font-medium ${template.colors.text} placeholder:opacity-50`}
                  />
                </div>

                <div className="space-y-3">
                  <label className={`text-xs uppercase tracking-[0.2em] font-bold ${template.colors.subtleText} ml-1`}>Your Wishes</label>
                  <textarea
                    required
                    maxLength={150}
                    placeholder="Share your heartfelt wishes..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    className={`w-full px-6 py-4 rounded-2xl border ${template.colors.border} bg-white/5 focus:outline-none focus:ring-2 ${template.colors.accent} ring-opacity-30 transition-all font-medium ${template.colors.text} placeholder:opacity-50 resize-none`}
                  />
                  <div className="text-right">
                    <span className={`text-[10px] font-bold ${template.colors.subtleText}`}>{message.length}/150</span>
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-sm text-center font-bold bg-red-500/10 py-3 rounded-xl border border-red-500/20">{error}</p>
                )}

                <button
                  disabled={isSubmitting}
                  className={`w-full py-5 rounded-2xl font-bold tracking-[0.1em] text-lg uppercase transition-all flex items-center justify-center gap-3 group shadow-xl
                    ${isSubmitting ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed shadow-none' : getButtonBg()}`}
                >
                  {isSubmitting ? 'Sending...' : 'Send Wishes'}
                  <Send className={`w-5 h-5 transition-transform ${isSubmitting ? '' : 'group-hover:translate-x-1 group-hover:-translate-y-1'}`} />
                </button>
              </form>
            ) : (
              <RSVPForm 
                projectId={project?.id || ''} 
                template={template}
                isPreview={isPreview}
                currentCount={rsvpCount}
                onSuccess={() => {
                  setRsvpCount(prev => prev + 1);
                  setShowSuccess(true);
                  setTimeout(() => {
                    setShowSuccess(false);
                    setActiveTab('message');
                  }, 5000);
                }}
              />
            )}

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
                  <h3 className={`text-4xl ${template.fontSerif} ${template.colors.headerText} mb-2`}>With Gratitude</h3>
                  <p className={`${template.colors.subtleText} font-medium tracking-wide`}>Your warmth has been noted.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      
      <div className={`absolute bottom-8 text-[12px] uppercase tracking-[0.4em] ${template.colors.subtleText} font-bold opacity-30`}>
        Our Story • {new Date().getFullYear()}
      </div>

      {/* QR Code Toggle */}
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
              <p className={`text-sm font-bold ${template.colors.text} mb-1`}>Invite a Guest</p>
              <p className={`text-[10px] ${template.colors.subtleText} uppercase tracking-widest`}>Scan to join the wall</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
