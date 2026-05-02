import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Save, 
  LogOut,
  ExternalLink,
  Layout,
  Users,
  MessageSquare,
  Share2,
  Camera,
  Trash2
} from 'lucide-react';
import { WeddingEvent, TEMPLATES, TemplateId } from '../types';
import RSVPManager from '../components/RSVPManager';
import MessageModerator from '../components/MessageModerator';
import { getSupabase } from '../lib/supabase';
import { useWorkspace } from '../lib/WorkspaceContext';

export default function CoupleDashboard() {
  const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
  const { eventId, slug: urlSlug } = useParams<{ eventId?: string; slug?: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'aesthetic' | 'rsvp' | 'moderation'>('aesthetic');

  useEffect(() => {
    if (isLoadingWorkspace) return;

    // Check local auth - try both possible auth keys
    if (eventId) {
      const auth = localStorage.getItem(`wedding_auth_${eventId}`);
      if (!auth) {
        navigate('/couple/login');
        return;
      }

      const { authenticated, timestamp } = JSON.parse(auth);
      if (!authenticated || Date.now() - timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(`wedding_auth_${eventId}`);
        navigate('/couple/login');
        return;
      }
    }

    loadEvent();
  }, [eventId, urlSlug, isLoadingWorkspace, workspace]);

  async function loadEvent() {
    setIsLoading(true);
    const supabase = getSupabase();
    let query = supabase.from('projects').select('*');
    
    if (eventId) {
      query = query.eq('id', eventId);
    } else if (urlSlug) {
      query = query.eq('slug', urlSlug);
      // If we are on a workspace subdomain, filter by that agency to prevent collisions
      if (workspace) {
        query = query.eq('agency_id', workspace.id);
      }
    } else {
      setIsLoading(false);
      return;
    }

    const { data, error } = await query.single();

    if (data) {
      // Check auth if we used slug
      if (urlSlug) {
        const auth = localStorage.getItem(`wedding_auth_${data.id}`);
        if (!auth) {
          navigate('/couple/login');
          return;
        }
        const { authenticated, timestamp } = JSON.parse(auth);
        if (!authenticated || Date.now() - timestamp > 24 * 60 * 60 * 1000) {
          localStorage.removeItem(`wedding_auth_${data.id}`);
          navigate('/couple/login');
          return;
        }
      }

      setEvent(data);
    } else {
      navigate('/couple/login');
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !event) return;

    setIsUploading(true);
    const supabase = getSupabase();

    try {
      const fileName = `${event.id}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('wedding-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('wedding-images')
        .getPublicUrl(uploadData.path);

      const { error: updateError } = await supabase
        .from('projects')
        .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', event.id);

      if (updateError) throw updateError;

      setEvent({ ...event, image_url: publicUrl });
    } catch (error: any) {
      console.error('Error uploading:', error);
      alert('Error uploading photo. Make sure a "wedding-images" bucket exists in Supabase storage and is public.');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!event) return;
    setIsSaving(true);
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('projects')
      .update({ image_url: null, updated_at: new Date().toISOString() })
      .eq('id', event.id);

    if (!error) {
      setEvent({ ...event, image_url: undefined });
    }
    setIsSaving(false);
  };

  const handleLogout = () => {
    if (event) {
      localStorage.removeItem(`wedding_auth_${event.id}`);
    }
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

          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => {
                const guestUrl = window.location.origin + '/' + event.slug + '/guest';
                const text = `We're getting married! Check out our wedding site and RSVP here: ${guestUrl}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-[#25D366]/10 text-[#25D366] rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#25D366]/20 transition-all"
            >
              <Share2 className="w-3 h-3" />
              <span className="hidden sm:inline">Share to WhatsApp</span>
              <span className="sm:hidden">Share</span>
            </button>
            <a 
              href={`/${event.slug}/guest`} 
              target="_blank" 
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-[#C5A059]/5 text-[#C5A059] rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#C5A059]/10 transition-all"
            >
              <span className="hidden sm:inline">View Guest Site</span>
              <span className="sm:hidden">View</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button 
              onClick={handleLogout}
              className="p-2 sm:p-2.5 text-gray-400 hover:text-red-500 transition-colors"
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

                  {/* Temporary - Disabled Background Photo Section
                  <div className="bg-white p-8 rounded-[3rem] border border-[#C5A059]/10 shadow-sm mb-12">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-6">
                        <div className={`w-24 h-24 rounded-3xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center relative cursor-pointer group`}>
                          {event.image_url ? (
                            <>
                              <img src={event.image_url} alt="Wedding Background" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                              <button 
                                onClick={(e) => { e.stopPropagation(); removePhoto(); }}
                                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20"
                              >
                                <Trash2 className="w-6 h-6 text-white" />
                              </button>
                            </>
                          ) : (
                            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                              <Camera className="w-8 h-8 text-gray-300 mb-1" />
                              <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Add Photo</span>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                disabled={isUploading}
                              />
                            </label>
                          )}
                          {isUploading && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                              <div className="w-6 h-6 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="text-xl font-serif text-[#2D2424] mb-1">Background Image</h3>
                          <p className="text-xs text-gray-500 max-w-[280px]">
                            Upload a photo of you both. It will appear as a subtle background placeholder on your wedding display.
                          </p>
                        </div>
                      </div>
                      {!event.image_url && (
                        <label className="bg-[#C5A059] text-white px-8 py-4 rounded-2xl font-bold uppercase tracking-widest flex items-center gap-3 hover:bg-[#B38D45] transition-all shadow-xl active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                          <Camera className="w-5 h-5" />
                          Upload Photo
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            disabled={isUploading}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  */}
                  
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
