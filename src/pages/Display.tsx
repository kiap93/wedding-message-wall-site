import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Palette, QrCode, Leaf, Star, Mail, Camera, Flower } from 'lucide-react';
import { fetchMessages, Message } from '../lib/api';
import { getSupabase } from '../lib/supabase';
import { WeddingEvent, TEMPLATES, TemplateId, WeddingTemplate, Agency } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { getAgencyById } from '../lib/agency';

export default function Display() {
  const { projectId, slug } = useParams();
  const [project, setProject] = useState<WeddingEvent | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchParams] = useSearchParams();
  const [showQR, setShowQR] = useState(false);
  const [isLoading, setIsLoading] = useState(!!projectId || !!slug);
  const navigate = useNavigate();
  
  // Fallback defaults if no event loaded
  const templateIdFromUrl = (searchParams.get('template') as TemplateId) || (localStorage.getItem('selectedTemplate') as TemplateId) || 'minimal_luxury';
  
  const activeTemplateId = project?.theme_id || templateIdFromUrl;
  const template = TEMPLATES.find(t => t.id === activeTemplateId) || TEMPLATES[0];

  const groom = project?.groom_name || searchParams.get('groom') || localStorage.getItem('groomName') || 'Alex';
  const bride = project?.bride_name || searchParams.get('bride') || localStorage.getItem('brideName') || 'Sam';

  // Derive guest URL
  const guestUrl = window.location.origin + (slug ? `/${slug}/guest` : project?.slug ? `/${project.slug}/guest` : '/guest' + window.location.search);

  const loadProject = async (id?: string, slugName?: string) => {
    try {
      const supabase = getSupabase();
      let query = supabase.from('projects').select('*');
      
      if (id) {
        query = query.eq('id', id);
      } else if (slugName) {
        query = query.eq('slug', slugName);
      } else {
        return;
      }

      const { data, error } = await query.single();
      
      if (error) throw error;
      setProject(data);
      
      // Fetch Agency branding
      if (data.agency_id) {
        const agencyData = await getAgencyById(data.agency_id);
        setAgency(agencyData);
      }
    } catch (err) {
      console.error('Error loading event:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId || slug) {
      loadProject(projectId, slug);
    }
    
    // Initial fetch
    const loadInitialMessages = async () => {
      try {
        const targetId = project?.id || projectId;
        const data = await fetchMessages(targetId);
        setMessages(data);
      } catch (err) {
        console.error('Initial fetch error:', err);
      }
    };

    loadInitialMessages();

    // Subscribe to Realtime changes
    let channel: any = null;
    try {
      const supabase = getSupabase();
      const targetId = project?.id || projectId;
      channel = supabase
        .channel(`event-messages-${targetId || 'default'}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT and UPDATE
            schema: 'public',
            table: 'messages',
            filter: targetId ? `project_id=eq.${targetId}` : undefined
          },
          (payload) => {
            const newMessage = payload.new as Message;
            const eventType = payload.eventType;

            if (newMessage.status === 'approved') {
              setMessages((prev) => {
                const filtered = prev.filter(m => m.id !== newMessage.id);
                const updated = [newMessage, ...filtered];
                const unique = Array.from(new Map(updated.map(m => [m.id, m])).values());
                return unique.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
              });
            } else if (eventType === 'UPDATE') {
              // If it was approved but now it's not (rejected/pending), remove it
              setMessages((prev) => prev.filter(m => m.id !== newMessage.id));
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.error('Realtime subscription error:', err);
    }

    return () => {
      if (channel) {
        try {
          const supabase = getSupabase();
          supabase.removeChannel(channel);
        } catch (err) {
          // Ignore errors on cleanup
        }
      }
    };
  }, [projectId, slug, project?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCF0]">
        <div className="w-12 h-12 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${template.colors.background} transition-colors duration-700 relative ${template.fontSans} ${template.colors.text}`}>
      {/* Agency Branding Overlay */}
      {agency && (
        <div className="absolute top-8 left-8 z-40 flex items-center gap-3 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30">
          {agency.logo_url && <img src={agency.logo_url} alt={agency.name} className="h-6 w-auto" />}
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Hosted by {agency.name}</span>
        </div>
      )}

      {/* Back to Templates Floating UI */}
      <div className="fixed bottom-8 left-8 z-[100]">
        <button
          onClick={() => navigate('/templates')}
          className="bg-white/10 backdrop-blur-md p-4 rounded-full border border-white/20 hover:bg-white/20 transition-all group flex items-center gap-3"
        >
          <Palette className={`w-5 h-5 ${template.id === 'digital' || template.id === 'starry' ? 'text-white' : 'text-gray-800'}`} />
          <span className={`text-xs font-bold uppercase tracking-widest hidden group-hover:block ${template.id === 'digital' || template.id === 'starry' ? 'text-white' : 'text-gray-800'}`}>
            Change Theme
          </span>
        </button>
      </div>

      {/* QR Code Floating UI */}
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
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 20 }}
              className={`absolute bottom-0 right-20 p-8 rounded-[2.5rem] ${template.colors.card} border ${template.colors.border} shadow-2xl backdrop-blur-2xl w-80 text-center`}
            >
              <h3 className={`text-2xl ${template.fontSerif} ${template.colors.headerText} mb-6`}>Leave a Message</h3>
              <div className="bg-white p-4 rounded-3xl mb-6 inline-block shadow-inner ring-8 ring-white/10">
                <QRCodeSVG value={guestUrl} size={200} />
              </div>
              <p className={`text-base font-bold ${template.colors.text} mb-2`}>Scan to Send Wishes</p>
              <p className={`text-xs ${template.colors.subtleText} uppercase tracking-[0.2em]`}>Your message will appear here</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-30">
        <div className={`absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-20 blur-[100px] ${template.id === 'garden' ? 'bg-green-500' : template.id === 'romantic' ? 'bg-pink-400' : 'bg-wedding-gold'}`} />
      </div>

      {/* Theme-specific Overlays */}
      {template.id === 'garden' && <FoliageOverlay />}
      {template.id === 'starry' && <CelestialOverlay />}

      <div className="relative z-10 min-h-screen flex flex-col p-8 md:p-16">
        <header className="flex flex-col md:flex-row items-center justify-between mb-16 gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h1 className={`text-6xl md:text-7xl ${template.fontSerif} tracking-tight ${template.colors.headerText}`}>
              {groom} & {bride}
            </h1>
            <p className={`text-sm uppercase tracking-[0.4em] ${template.colors.accent} font-medium`}>
              The Wedding Wall
            </p>
          </div>
          <div className="hidden md:flex flex-col items-end">
             <div className={`flex items-center gap-2 ${template.colors.accent}`}>
               <Heart className={`w-5 h-5 fill-current animate-pulse`} />
               <span className={`${template.fontSerif} italic text-2xl`}>Forever & Always</span>
             </div>
             <p className={`text-xs ${template.colors.subtleText} mt-1 uppercase tracking-widest`}>Celebrating Our Love</p>
          </div>
        </header>

        <main className="flex-1 relative px-4 md:px-8">
          <AnimatePresence mode="wait">
            {template.variant === 'hanging' ? (
              <HangingLayout key="hanging" messages={messages} template={template} />
            ) : template.variant === 'floating' ? (
              <FloatingLayout key="floating" messages={messages} template={template} />
            ) : (
              <MasonryLayout key="masonry" messages={messages} template={template} />
            )}
          </AnimatePresence>

          {messages.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <Heart className={`w-16 h-16 ${template.colors.accent} opacity-20 mx-auto mb-4`} />
                <p className={`${template.colors.subtleText} ${template.fontSerif} italic text-xl`}>Waiting for the first wish...</p>
              </motion.div>
            </div>
          )}
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(212, 175, 55, 0.2); border-radius: 10px; }
        .polaroid-frame {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          padding-bottom: 24px !important;
        }
        .wood-texture {
          background-image: url('https://www.transparenttextures.com/patterns/wood-pattern.png');
          background-repeat: repeat;
        }
      `}} />
    </div>
  );
}

function MasonryLayout({ messages, template }: { messages: Message[], template: WeddingTemplate, key?: React.Key }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-12 space-y-12 pr-4 pb-64 pt-12 max-w-7xl mx-auto w-full"
    >
      <AnimatePresence mode="popLayout">
        {messages.map((msg) => (
          <div key={msg.id} className="break-inside-avoid block">
            <MessageCard msg={msg} template={template} />
          </div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function HangingLayout({ messages, template }: { messages: Message[], template: WeddingTemplate, key?: React.Key }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative min-h-[70vh] flex flex-wrap justify-center gap-x-12 gap-y-24 pb-64 pt-24 max-w-7xl mx-auto wood-texture rounded-3xl p-12 bg-[#F5F2EF]/50 shadow-inner"
    >
      {/* Decorative Tree Branch */}
      <div className="absolute top-0 left-0 w-full h-32 overflow-hidden opacity-20 pointer-events-none">
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="w-full h-full text-[#4E614E]">
          <path d="M0,50 Q250,10 500,50 T1000,50" stroke="currentColor" strokeWidth="8" fill="none" />
          <path d="M100,45 Q120,20 150,45" stroke="currentColor" strokeWidth="4" fill="none" />
          <path d="M300,55 Q320,80 350,55" stroke="currentColor" strokeWidth="4" fill="none" />
          <path d="M700,45 Q720,20 750,45" stroke="currentColor" strokeWidth="4" fill="none" />
        </svg>
      </div>

      {/* Visual Twine lines */}
      <div className="absolute top-48 left-0 w-full h-[2px] bg-[#A68A64]/30" />
      <div className="absolute top-[30rem] left-0 w-full h-[2px] bg-[#A68A64]/30" />

      <AnimatePresence mode="popLayout">
        {messages.map((msg, idx) => (
          <div key={msg.id} className="relative">
             {/* The "Twine" string attached to each card */}
            <div className="absolute top-[-80px] left-1/2 w-[2px] h-20 bg-[#A68A64]/40 -translate-x-1/2" />
            <MessageCard msg={msg} template={template} hanging />
          </div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function FloatingLayout({ messages, template }: { messages: Message[], template: WeddingTemplate, key?: React.Key }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative min-h-[80vh] w-full max-w-7xl mx-auto pt-12 pb-64"
    >
      <AnimatePresence mode="popLayout">
        {messages.map((msg, idx) => {
          // Semi-random positions for floating effect
          const x = (idx * 313) % 80; // 0 to 80%
          const y = (idx * 271) % 70; // 0 to 70%
          
          return (
            <motion.div
              key={msg.id}
              className="absolute"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                top: `${y}%`,
                left: `${x}%`,
              }}
              transition={{ duration: 1, delay: idx * 0.1 }}
            >
              <MessageCard msg={msg} template={template} floating />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

function MessageCard({ msg, template, hanging, floating }: { msg: Message; template: WeddingTemplate, hanging?: boolean, floating?: boolean }) {
  const seed = String(msg.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rotation = (seed % 6) - 3;
  const xOffset = (seed % 10) - 5;
  const floatDuration = 6 + (seed % 6);
  const floatDelay = (seed % 5000) / 1000;

  const Icon = template.iconType === 'leaf' ? Leaf :
               template.iconType === 'star' ? Star :
               template.iconType === 'mail' ? Mail :
               template.iconType === 'camera' ? Camera :
               template.iconType === 'flower' ? Flower : Heart;

  const cardBaseClass = template.id === 'polaroid' 
    ? 'polaroid-frame bg-white grayscale-0 rounded-none' 
    : hanging 
      ? `bg-[#FEFBF5] border-[#A68A64]/30 shadow-md rounded-lg` 
      : `${template.colors.card} border ${template.colors.border} rounded-[1.5rem]`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8, y: 30, rotate: rotation }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        x: xOffset,
        y: floating ? [0, -20, 0, 20, 0] : [0, -12, 0],
        rotate: [rotation, rotation + 2, rotation - 2, rotation] 
      }}
      exit={{ opacity: 0, scale: 0.5, y: -30 }}
      transition={{
        y: {
          duration: floating ? floatDuration * 2 : floatDuration,
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
        opacity: { duration: 0.6 },
        scale: { type: "spring", damping: 20 }
      }}
      className={`backdrop-blur-md p-6 sm:p-8 shadow-xl hover:shadow-2xl transition-all hover:z-20 group relative overflow-visible text-center ${cardBaseClass} ${floating ? 'w-64 scale-75 md:scale-100' : 'w-full'}`}
      style={{ transformOrigin: 'center center' }}
    >
      {/* Hanging "Clip" or "Pin" */}
      {hanging && (
        <div className="absolute top-[-10px] left-1/2 w-4 h-4 bg-[#8E795E] rounded-full border-2 border-[#FEFBF5] shadow-sm -translate-x-1/2 z-10" />
      )}

      <div className="flex justify-center flex-col items-center mb-4">
        <div className={`mb-3 ${template.colors.accent} transition-colors`}>
          <Icon className={`w-6 h-6 ${template.id === 'polaroid' ? 'text-gray-400' : 'fill-current opacity-20'}`} />
        </div>
        <h3 className={`text-xl ${template.fontSerif} ${template.colors.headerText} tracking-tight font-semibold`}>
          {msg.name || 'Anonymous Guest'}
        </h3>
      </div>
      <p className={`${template.colors.text} ${template.fontSans} leading-relaxed text-lg italic mb-6 px-2`}>
        "{msg.message}"
      </p>
      <div className={`flex justify-center border-t ${template.colors.border} pt-4`}>
        <span className={`text-[9px] uppercase font-bold tracking-[0.3em] ${template.colors.subtleText}`}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}

function FoliageOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Top Left Eucalyptus */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 0.6 }}
        className="absolute top-[-20px] left-[-40px] w-80 h-80 opacity-60"
      >
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-[#4E614E]">
          <path d="M100 20C100 20 80 50 80 80C80 110 100 140 100 140C100 140 120 110 120 80C120 50 100 20 100 20Z" fill="currentColor" fillOpacity="0.3" />
          <path d="M60 40C60 40 40 70 40 100C40 130 60 160 60 160C60 160 80 130 80 100C80 70 60 40 60 40Z" fill="currentColor" fillOpacity="0.2" />
          <path d="M140 60C140 60 160 90 160 120C160 150 140 180 140 180C140 180 120 150 120 120C120 90 140 60 140 60Z" fill="currentColor" fillOpacity="0.1" />
        </svg>
      </motion.div>

      {/* Bottom Right Eucalyptus */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 0.4 }}
        className="absolute bottom-[-50px] right-[-50px] w-96 h-96 scale-x-[-1] opacity-40"
      >
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-[#384638]">
           <path d="M100 20C100 20 80 50 80 80C80 110 100 140 100 140C100 140 120 110 120 80C120 50 100 20 100 20Z" fill="currentColor" fillOpacity="0.3" />
           <path d="M60 40C60 40 40 70 40 100C40 130 60 160 60 160C60 160 80 130 80 100C80 70 60 40 60 40Z" fill="currentColor" fillOpacity="0.2" />
        </svg>
      </motion.div>
    </div>
  );
}

function CelestialOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {[...Array(50)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: [0, 0.8, 0],
            scale: [0, 1, 0]
          }}
          transition={{
            duration: 2 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 5
          }}
          className="absolute bg-white rounded-full w-1 h-1"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
