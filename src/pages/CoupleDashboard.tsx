import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Users, 
  MessageSquare, 
  Settings, 
  Save, 
  LogOut,
  Layout,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { WeddingEvent, TEMPLATES, TemplateId } from '../types';
import RSVPManager from '../components/RSVPManager';
import MessageModerator from '../components/MessageModerator';
import { getSupabase } from '../lib/supabase';

export default function CoupleDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'aesthetic' | 'rsvp' | 'moderation'>('aesthetic');

  useEffect(() => {
    // Check local auth
    const auth = localStorage.getItem(`wedding_auth_${eventId}`);
    if (!auth) {
      navigate('/couple/login');
      return;
    }

    const { authenticated, timestamp } = JSON.parse(auth);
    // Simple 24h session check
    if (!authenticated || Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(`wedding_auth_${eventId}`);
      navigate('/couple/login');
      return;
    }

    loadEvent();
  }, [eventId]);

  async function loadEvent() {
    setIsLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', eventId)
      .single();

    if (data) {
      setEvent(data);
    }
    setIsLoading(false);
  }

  const handleSaveTheme = async (themeId: TemplateId) => {
    if (!event) return;
    setIsSaving(true);
    const supabase = getSupabase();
    const { error } = await supabase
      .from('projects')
      .update({ theme_id: themeId })
      .eq('id', event.id);

    if (!error) {
      setEvent({ ...event, theme_id: themeId });
    }
    setIsSaving(false);
  };

  const handleLogout = () => {
    localStorage.removeItem(`wedding_auth_${eventId}`);
    navigate('/couple/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <header className="bg-white border-b border-[#C5A059]/10 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-10 h-10 bg-[#C5A059]/10 rounded-xl flex items-center justify-center">
              <Heart className="w-5 h-5 text-[#C5A059] fill-current" />
            </div>
            <div>
              <h1 className="text-xl font-serif text-[#2D2424]">{event.groom_name} & {event.bride_name}</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#C5A059]">Event Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a 
              href={`/${event.slug}`} 
              target="_blank" 
              className="px-6 py-2.5 bg-[#C5A059]/5 text-[#C5A059] rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#C5A059]/10 transition-all"
            >
              View Guest Site <ExternalLink className="w-3 h-3" />
            </a>
            <button 
              onClick={handleLogout}
              className="p-2.5 text-gray-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <div className="space-y-12">
          {/* Tabs Navigation */}
          <div className="flex flex-wrap gap-4 p-1 bg-white rounded-3xl border border-[#C5A059]/10 w-fit shadow-sm">
            <button 
              onClick={() => setActiveTab('aesthetic')}
              className={`px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'aesthetic' ? 'bg-[#C5A059] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <Layout className="w-4 h-4" /> Aesthetic
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('rsvp')}
              className={`px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'rsvp' ? 'bg-[#C5A059] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                 <Users className="w-4 h-4" /> Guest Responses
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('moderation')}
              className={`px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'moderation' ? 'bg-[#C5A059] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                 <MessageSquare className="w-4 h-4" /> Moderation
              </div>
            </button>
          </div>

          <div className="min-h-[600px]">
            <AnimatePresence mode="wait">
              {activeTab === 'aesthetic' && (
                <motion.div
                  key="aesthetic"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="mb-8 flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-serif">Selected Aesthetic</h2>
                      <p className="text-gray-500">Choose the visual style for your wedding site.</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                    {TEMPLATES.map((t) => (
                      <button 
                        key={t.id}
                        onClick={() => handleSaveTheme(t.id)}
                        disabled={isSaving}
                        className={`relative overflow-hidden rounded-3xl border-2 transition-all group text-left
                          ${event.theme_id === t.id ? 'border-[#C5A059] shadow-2xl p-1' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-[1.02]'}
                        `}
                      >
                        <div className={`${t.colors.background} ${t.colors.text} p-8 rounded-[calc(1.5rem-4px)] min-h-[220px] flex flex-col justify-between`}>
                          <div>
                            <div className={`w-10 h-10 rounded-xl ${t.colors.accent} bg-opacity-10 mb-6 flex items-center justify-center`}>
                              <Heart className="w-5 h-5 fill-current opacity-30" />
                            </div>
                            <h4 className={`text-xl font-bold mb-2 ${t.colors.headerText}`}>{t.name}</h4>
                            <p className="text-xs opacity-60 leading-relaxed max-w-[180px]">{t.description}</p>
                          </div>
                          
                          <div className="flex gap-2 mt-6">
                            <div className={`w-3 h-3 rounded-full ${t.colors.accent.split(' ')[0].replace('text-', 'bg-') || 'bg-[#C5A059]'}`} />
                            <div className={`w-3 h-3 rounded-full ${t.colors.border.split(' ')[0].replace('border-', 'bg-') || 'bg-gray-200'} opacity-50`} />
                          </div>
                        </div>

                        {event.theme_id === t.id && (
                          <div className="absolute top-6 right-6 bg-[#C5A059] text-white p-1.5 rounded-full shadow-lg">
                            <Save className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'rsvp' && (
                <motion.div
                  key="rsvp"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                   <div className="mb-8">
                     <h2 className="text-3xl font-serif">Guest Responses</h2>
                     <p className="text-gray-500">Track attendances, meal choices, and dietary requirements.</p>
                   </div>
                   <RSVPManager projectId={event.id} />
                </motion.div>
              )}

              {activeTab === 'moderation' && (
                <motion.div
                  key="moderation"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                   <div className="mb-8">
                     <h2 className="text-3xl font-serif">Guest Messages</h2>
                     <p className="text-gray-500">Moderate messages before they appear on the live display.</p>
                   </div>
                   <MessageModerator projectId={event.id} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
