import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Save, 
  LogOut, 
  Heart, 
  ArrowRight, 
  Plus, 
  ArrowLeft, 
  Settings, 
  Trash2,
  ExternalLink,
  Calendar as CalendarIcon,
  MapPin,
  Users,
  MessageSquare,
  Layout,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react';
import { Agency, WeddingEvent, TEMPLATES, TemplateId } from '../types';
import RSVPManager from '../components/RSVPManager';
import MessageModerator from '../components/MessageModerator';
import { API_BASE } from '../lib/config';
import { authenticatedFetch, removeAuthToken } from '../lib/auth';
import { getSupabase } from '../lib/supabase';
import { useWorkspace } from '../lib/WorkspaceContext';
import { useUser } from '../lib/UserContext';

export default function Admin() {
  const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
  const { user } = useUser();
  const [view, setView] = useState<'list' | 'editor' | 'agency_settings' | 'calendar'>('list');
  const navigate = useNavigate();

  // Agency
  const [agency, setAgency] = useState<Agency | null>(null);
  const [isSavingAgency, setIsSavingAgency] = useState(false);

  // Event List
  const [events, setEvents] = useState<WeddingEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Current Editor State
  const [editingEvent, setEditingEvent] = useState<Partial<WeddingEvent> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState<'aesthetic' | 'rsvp' | 'moderation'>('aesthetic');

  useEffect(() => {
    const initAdmin = async () => {
      if (isLoadingWorkspace || !user) return;

      if (workspace) {
        // We have a workspace from subdomain
        setAgency(workspace);
        fetchEvents(workspace.id);
      } else {
        // Root domain (likely a couple or an agency visiting global admin)
        const supabase = getSupabase();
        const userId = user.id || user.sub;
        const { data: userAgencies, error } = await supabase
          .from('agencies')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching user agencies:', error);
          return;
        }

        if (userAgencies && userAgencies.length > 0) {
          const primaryWorkspace = userAgencies[0];
          setAgency(primaryWorkspace);
          fetchEvents(primaryWorkspace.id);
        } else {
          // No agency yet, maybe redirect to onboarding?
          navigate('/onboarding');
        }
      }
    };

    initAdmin();
  }, [workspace, isLoadingWorkspace, user, navigate]);

  const fetchEvents = async (agencyId: string) => {
    setIsLoadingEvents(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching events:', error);
    } else {
      setEvents(data || []);
    }
    setIsLoadingEvents(false);
  };

  const handleSaveAgency = async (agencyData: Partial<Agency>) => {
    if (!user) return;
    setIsSavingAgency(true);
    const supabase = getSupabase();
    
    let error;
    if (agency?.id) {
       // Update: exclude id and created_at
       const { created_at, id, ...updateData } = { ...agencyData } as any;
       const { error: err } = await supabase.from('agencies').update(updateData).eq('id', agency.id);
       error = err;
    } else {
       // Insert
       const payload = {
         ...agencyData,
         user_id: user.id || user.sub,
         created_at: new Date().toISOString()
       };
       const { data, error: err } = await supabase.from('agencies').insert([payload]).select().single();
       if (data) setAgency(data);
       error = err;
    }

    if (error) {
      alert('Error saving organization: ' + error.message);
    } else {
      // If slug changed, we need to redirect to the new subdomain URL
      const newSlug = agencyData.slug;
      if (newSlug && newSlug !== agency?.slug) {
        const protocol = window.location.protocol;
        const hostParts = window.location.host.split('.');
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        let baseDomain;
        if (isLocalhost) {
          baseDomain = window.location.host;
        } else {
          baseDomain = hostParts.length > 2 ? hostParts.slice(-2).join('.') : hostParts.join('.');
        }

        const token = localStorage.getItem('wedding_session_token');
        
        // Only redirect if not localhost or if we want to simulate subdomains
        if (!isLocalhost || hostParts.length > 1) {
          window.location.href = `${protocol}//${newSlug}.${baseDomain}/admin${token ? `?token=${token}` : ''}`;
        } else {
          window.location.reload();
        }
      } else {
        // Refresh workspace data
        window.location.reload();
      }
    }
    setIsSavingAgency(false);
  };

  const isSubscribed = agency?.subscription_status === 'active' || 
                      agency?.is_demo === true || 
                      user?.email === 'buildsiteasia@gmail.com';
  const isCouple = agency?.user_role === 'couple';

  useEffect(() => {
    if (isCouple && events.length === 1 && view === 'list' && !isLoadingEvents) {
      // For couples, if they have one event, auto-open it in editor immediately
      setEditingEvent(events[0]);
      setView('editor');
    }
    
    // If couple and 0 events, auto-trigger creation to save them a click
    if (isCouple && events.length === 0 && view === 'list' && !isLoadingEvents && isSubscribed) {
      handleCreateNew();
    }
  }, [isCouple, events, view, isLoadingEvents, isSubscribed]);

  const handleCreateNew = () => {
    if (!agency) return;
    if (isCouple && events.length >= 1) {
      alert('Individual accounts are limited to one event. Upgrade to an Agency account to manage multiple events.');
      return;
    }
    if (!isSubscribed) {
      alert('A pro subscription is required to create new events.');
      navigate('/subscription');
      return;
    }
    const newEvent: Partial<WeddingEvent> = {
      name: `${agency.name}`,
      slug: `wedding-${Math.random().toString(36).substring(2, 7)}`,
      groom_name: agency.name.split(' & ')[0] || 'Partner A',
      bride_name: agency.name.split(' & ')[1] || 'Partner B',
      wedding_date: new Date().toISOString().split('T')[0],
      location: 'Your Beautiful Venue',
      theme_id: 'minimal_luxury',
      agency_id: agency.id,
      access_password: Math.random().toString(36).substring(2, 8).toUpperCase(),
      auto_approve_messages: false,
      image_url: ''
    };
    setEditingEvent(newEvent);
    setView('editor');
  };

  const handleEdit = (event: WeddingEvent) => {
    setEditingEvent({ ...event });
    setView('editor');
  };

  const handleSave = async () => {
    if (!editingEvent || !agency) return;
    setIsSaving(true);

    const supabase = getSupabase();
    const eventData = {
      ...editingEvent,
      agency_id: agency.id,
      updated_at: new Date().toISOString()
    };
    
    // Explicitly remove user_id if it existed to avoid constraint issues if using agency legacy
    delete (eventData as any).user_id;

    let error;
    if (eventData.id) {
      // Update: exclude immutable fields
      const { id, created_at, ...updateData } = eventData as any;
      const { error: updateError } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id);
      error = updateError;
    } else {
      // Insert
      const { error: insertError } = await supabase
        .from('projects')
        .insert([eventData]);
      error = insertError;
    }

    if (error) {
      alert('Error saving event: ' + error.message);
    } else {
      if (agency) await fetchEvents(agency.id);
      setView('list');
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    
    const supabase = getSupabase();
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error deleting event');
    } else {
      setEvents(events.filter(e => e.id !== id));
    }
  };

  const getEventUrl = (event: WeddingEvent, type: 'display' | 'guest') => {
    const currentHost = window.location.host;
    const hostParts = currentHost.split('.');
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    let baseDomain;
    if (isLocalhost) {
      baseDomain = currentHost;
    } else {
      baseDomain = hostParts.length > 2 ? hostParts.slice(-2).join('.') : hostParts.join('.');
    }
    
    if (isCouple) {
      // Couples use root domain path
      const base = `https://${baseDomain}/${agency?.slug}`;
      if (type === 'display') return base;
      return `${base}/guest`;
    }

    // Agencies use subdomains
    const base = agency?.domain ? `https://${agency.domain}` : `https://${agency?.slug}.${baseDomain}`;
    if (type === 'display') return `${base}/${event.slug}/display`;
    return `${base}/${event.slug}/guest`;
  };

  const handleLogout = async () => {
    await authenticatedFetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
    removeAuthToken();
    window.location.href = '/login';
  };

  if (isLoadingWorkspace) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCF0]">
        <div className="w-8 h-8 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFCF0] font-sans text-[#2D2424]">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-[#C5A059]/20 px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          {agency?.logo_url ? (
            <img src={agency.logo_url} alt={agency.name} className="h-10 w-auto object-contain" />
          ) : (
            <div className="p-2 bg-[#C5A059]/10 rounded-xl">
              <Heart className="w-6 h-6 text-[#C5A059]" />
            </div>
          )}
          <div className="flex flex-col">
            <h1 className="font-serif text-xl leading-tight hidden sm:block">
              {isCouple ? 'My Wedding Hub' : (agency?.name || 'Wedding Hub')}
            </h1>
            {agency && (
              <span className="text-[10px] font-bold text-[#C5A059] uppercase tracking-[0.2em]">
                {isCouple ? `eventframe.io/${agency.slug}` : `${agency.slug}.eventframe.io`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/subscription')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              isSubscribed 
                ? 'bg-green-50 border-green-100 text-green-600' 
                : 'bg-[#C5A059]/10 border-[#C5A059]/20 text-[#C5A059] hover:bg-[#C5A059]/20 shadow-sm'
            }`}
          >
            {isSubscribed ? 'Pro Plan Active' : 'Upgrade to Pro'}
          </button>
          {agency && (
            <button 
              onClick={() => setView('agency_settings')}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
              title={isCouple ? "Account Settings" : "Organization Settings"}
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-wider"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-8">
        <AnimatePresence mode="wait">
          {view === 'agency_settings' ? (
             <motion.div
               key="agency_settings"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="max-w-2xl mx-auto space-y-8"
             >
                <button 
                  onClick={() => setView('list')}
                  className="flex items-center gap-2 text-gray-500 hover:text-[#C5A059] transition-colors font-bold uppercase tracking-widest text-xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Events
                </button>

                <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-[#C5A059]/10">
                   <h2 className="text-3xl font-serif mb-8">{isCouple ? 'Your Wedding Settings' : 'Agency Branding'}</h2>
                   <form onSubmit={(e) => {
                     e.preventDefault();
                     const formData = new FormData(e.currentTarget);
                     handleSaveAgency({
                       name: formData.get('name') as string,
                       slug: (formData.get('slug') as string).toLowerCase().replace(/[^a-z0-9-]/g, ''),
                       logo_url: formData.get('logo_url') as string,
                       domain: formData.get('domain') as string,
                       theme_config: {
                          primaryColor: formData.get('primaryColor') as string,
                          accentColor: formData.get('accentColor') as string,
                       }
                     });
                   }} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">
                            {isCouple ? 'Wedding Name' : 'Agency Name'}
                          </label>
                          <input name="name" defaultValue={agency?.name} className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">
                            {isCouple ? 'Personal URL Slug' : 'Subdomain Slug'}
                          </label>
                          <input name="slug" defaultValue={agency?.slug} className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 font-mono text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">
                          {isCouple ? 'Wedding Logo/Monogram URL' : 'Logo URL'}
                        </label>
                        <input name="logo_url" defaultValue={agency?.logo_url} placeholder="https://..." className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50" />
                      </div>
                      {!isCouple && (
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">Custom Domain (Optional)</label>
                          <input name="domain" defaultValue={agency?.domain} placeholder="weddings.yourbrand.com" className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50" />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-6 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">
                            {isCouple ? 'Wedding Theme Color' : 'Primary Brand Color'}
                          </label>
                          <div className="flex gap-3">
                            <input type="color" name="primaryColor" defaultValue={agency?.theme_config?.primaryColor || '#C5A059'} className="h-12 w-12 rounded-lg cursor-pointer" />
                            <input type="text" defaultValue={agency?.theme_config?.primaryColor || '#C5A059'} className="flex-1 px-4 py-2 rounded-xl border border-gray-100 bg-white font-mono text-xs" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">
                            {isCouple ? 'Secondary Color' : 'Accent Accent Color'}
                          </label>
                          <div className="flex gap-3">
                            <input type="color" name="accentColor" defaultValue={agency?.theme_config?.accentColor || '#2D2424'} className="h-12 w-12 rounded-lg cursor-pointer" />
                            <input type="text" defaultValue={agency?.theme_config?.accentColor || '#2D2424'} className="flex-1 px-4 py-2 rounded-xl border border-gray-100 bg-white font-mono text-xs" />
                          </div>
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={isSavingAgency}
                        className="w-full bg-[#2D2424] text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl disabled:opacity-50"
                      >
                        {isSavingAgency ? 'Saving Changes...' : (isCouple ? 'Update Wedding Profile' : 'Update Organization Profile')}
                      </button>
                   </form>
                </div>
             </motion.div>
          ) : view === 'list' ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-4xl font-serif mb-2 text-[#2D2424]">
                    {isCouple ? 'Your Wedding' : 'Organization Events'}
                  </h2>
                  <p className="text-gray-500">
                    {isCouple ? 'Manage your digital guestbook and event experience.' : 'Manage white-label wedding events and guest experiences.'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {!isCouple && (
                    <div className="flex p-1 bg-white rounded-2xl border border-[#C5A059]/10 shadow-sm">
                      <button 
                        onClick={() => setView('list')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                          view === 'list' ? 'bg-[#C5A059] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        List
                      </button>
                      <button 
                        onClick={() => setView('calendar')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                          view === 'calendar' ? 'bg-[#C5A059] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        Calendar
                      </button>
                    </div>
                  )}
                  {(!isCouple || events.length === 0) && (
                    <button 
                      onClick={handleCreateNew}
                      className={`px-8 py-4 rounded-2xl font-bold uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl active:scale-95 ${
                        isSubscribed 
                          ? 'bg-[#C5A059] text-white hover:bg-[#B38D45]' 
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <Plus className="w-5 h-5" />
                      {isCouple ? 'Initialize Wedding' : 'New Event'}
                    </button>
                  )}
                </div>
              </div>

              {!isSubscribed && (
                <div className="bg-[#C5A059]/5 border border-[#C5A059]/10 p-6 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#C5A059]/10 rounded-full flex items-center justify-center">
                      <Zap className="w-5 h-5 text-[#C5A059]" />
                    </div>
                    <div>
                      <p className="font-serif text-lg">{isCouple ? 'Wedding License Required' : 'Pro Subscription Required'}</p>
                      <p className="text-xs text-gray-400 font-medium">
                        {isCouple 
                          ? 'To start building your digital experience, please activate your wedding license.' 
                          : "To create and manage new events, please upgrade your organization's account."}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/subscription')}
                    className="px-6 py-3 bg-[#C5A059] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#C5A059]/20 hover:scale-105 transition-all"
                  >
                    View Pricing
                  </button>
                </div>
              )}

              {isLoadingEvents ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-64 bg-white/50 animate-pulse rounded-[2rem] border border-[#C5A059]/10" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="bg-white p-16 rounded-[3rem] border-2 border-dashed border-[#C5A059]/30 flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-[#C5A059]/10 rounded-full flex items-center justify-center mb-6">
                    <Heart className="w-10 h-10 text-[#C5A059] opacity-20" />
                  </div>
                  <h3 className="text-2xl font-serif mb-2">{isCouple ? 'Initialize your wedding' : 'No events created'}</h3>
                  <p className="text-gray-400 max-w-sm mb-8">
                    {isCouple 
                      ? 'Welcome! Let\'s set up your beautiful wedding space to start sharing with guests.' 
                      : 'Ready to start planning? Create your first branded event to begin customizing the experience.'}
                  </p>
                  <button onClick={handleCreateNew} className="text-[#C5A059] font-bold uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
                    {isCouple ? 'Start Planning' : 'Initialize Event'} <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {events.map((event) => (
                    <motion.div 
                      key={event.id}
                      whileHover={{ y: -8 }}
                      className="bg-white rounded-[2.5rem] shadow-xl border border-[#C5A059]/10 overflow-hidden flex flex-col group"
                    >
                      <div className="p-8 flex-1">
                        <div className="flex items-center justify-between mb-6">
                          <span className="text-[10px] font-black uppercase tracking-widest bg-[#C5A059]/10 text-[#C5A059] px-3 py-1 rounded-full">
                            {TEMPLATES.find(t => t.id === event.theme_id)?.name || 'Classic'}
                          </span>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleEdit(event)}
                              className="p-2 hover:bg-[#C5A059]/10 rounded-lg text-gray-400 hover:text-[#C5A059] transition-colors"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(event.id)}
                              className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <h3 className="text-2xl font-serif mb-2 leading-tight">
                          {event.groom_name} <span className="text-[#C5A059]">&</span> {event.bride_name}
                        </h3>
                        <p className="text-[10px] font-bold text-[#C5A059] uppercase tracking-widest mb-6 opacity-60">
                          {isCouple 
                            ? `eventframe.io/${agency?.slug}`
                            : (agency?.domain || `${agency?.slug}.eventframe.io / ${event.slug}`)}
                        </p>

                          <div className="space-y-3 text-sm text-gray-500 mb-8">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="w-3.5 h-3.5 opacity-50" />
                              <span>{new Date(event.wedding_date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                            </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 opacity-50" />
                            <span className="truncate">{event.location}</span>
                          </div>
                          {event.access_password && (
                            <div className="pt-2 mt-2 border-t border-gray-50 flex items-center justify-between text-[10px] font-bold">
                              <span className="text-gray-400 uppercase tracking-widest">Dashboard PIN</span>
                              <span className="bg-gray-100 px-2 py-0.5 rounded text-[#2D2424] font-mono">{event.access_password}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="px-8 pb-8 flex gap-3">
                        <button 
                          onClick={() => window.open(getEventUrl(event, 'display'), '_blank')}
                          className="flex-1 bg-[#2D2424] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Display
                        </button>
                        <button 
                          onClick={() => window.open(getEventUrl(event, 'guest'), '_blank')}
                          className="flex-1 bg-[#C5A059] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#B38D45] transition-colors"
                        >
                          <Heart className="w-3 h-3" />
                          Guest
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : view === 'calendar' ? (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-4xl font-serif mb-2 text-[#2D2424]">Event Calendar</h2>
                  <p className="text-gray-500">Monthly overview of all scheduled celebrations.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex p-1 bg-white rounded-2xl border border-[#C5A059]/10 shadow-sm">
                    <button 
                      onClick={() => setView('list')}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        view === 'list' ? 'bg-[#C5A059] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      List
                    </button>
                    <button 
                      onClick={() => setView('calendar')}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        view === 'calendar' ? 'bg-[#C5A059] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Calendar
                    </button>
                  </div>
                  <button 
                    onClick={handleCreateNew}
                    className={`px-8 py-4 rounded-2xl font-bold uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl active:scale-95 ${
                      isSubscribed 
                        ? 'bg-[#C5A059] text-white hover:bg-[#B38D45]' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                    New Event
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-[3rem] shadow-xl border border-[#C5A059]/10 overflow-hidden">
                {/* Calendar Header */}
                <div className="p-8 flex items-center justify-between border-b border-gray-100">
                  <h3 className="text-2xl font-serif">
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
                      className="p-3 hover:bg-gray-50 rounded-2xl transition-colors border border-gray-100"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setCurrentMonth(new Date())}
                      className="px-6 py-3 hover:bg-gray-50 rounded-2xl transition-colors border border-gray-100 text-[10px] font-black uppercase tracking-widest"
                    >
                      Today
                    </button>
                    <button 
                      onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
                      className="p-3 hover:bg-gray-50 rounded-2xl transition-colors border border-gray-100"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="p-8">
                  <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-3xl overflow-hidden">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="bg-gray-50 py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                        {day}
                      </div>
                    ))}
                    {(() => {
                      const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
                      const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
                      const days = [];

                      // Add empty slots for days before the 1st
                      for (let i = 0; i < firstDayOfMonth; i++) {
                        days.push(<div key={`empty-${i}`} className="bg-white/50 min-h-[140px]" />);
                      }

                      // Add actual days
                      for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayEvents = events.filter(e => e.wedding_date === dateStr);
                        const isToday = new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();
                        const hasEvents = dayEvents.length > 0;

                        days.push(
                          <div key={day} className={`bg-white min-h-[140px] p-4 group transition-colors relative ${hasEvents ? 'hover:bg-[#FDFCF0]/50' : 'hover:bg-gray-50'}`}>
                            <div className="flex items-center justify-between mb-3">
                              <span className={`text-[10px] font-black tracking-widest flex items-center justify-center ${isToday ? 'bg-[#C5A059] text-white w-6 h-6 rounded-full -ml-1 -mt-1' : 'text-gray-300 group-hover:text-[#C5A059]'}`}>
                                {day}
                              </span>
                              {hasEvents && (
                                <div className="flex gap-0.5">
                                  {dayEvents.slice(0, 3).map((_, i) => (
                                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#C5A059] shadow-sm animate-pulse" />
                                  ))}
                                  {dayEvents.length > 3 && (
                                    <span className="text-[8px] font-black text-[#C5A059] ml-0.5">+{dayEvents.length - 3}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              {dayEvents.map(event => (
                                <button
                                  key={event.id}
                                  onClick={() => handleEdit(event)}
                                  className="w-full text-left p-2 rounded-xl bg-[#C5A059]/5 border border-[#C5A059]/10 hover:bg-[#C5A059]/10 transition-all group/event"
                                >
                                  <p className="text-[10px] font-black uppercase tracking-tight text-[#C5A059] truncate">
                                    {event.groom_name} & {event.bride_name}
                                  </p>
                                  <p className="text-[8px] text-gray-400 font-bold flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-2 h-2" /> {event.location}
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return days;
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="editor"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12"
            >
              {/* Back Button */}
              <div className="lg:col-span-12">
                <button 
                  onClick={() => setView('list')}
                  className="flex items-center gap-2 text-gray-500 hover:text-[#C5A059] transition-colors font-bold uppercase tracking-widest text-xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {isCouple ? 'Back to Dashboard' : 'Back to List'}
                </button>
              </div>

              {/* Settings Sidebar */}
              <div className="lg:col-span-4">
                <div className="sticky top-24 space-y-8">
                  <section className="bg-white rounded-[2.5rem] shadow-xl border border-[#C5A059]/10 flex flex-col max-h-[calc(100vh-120px)] overflow-hidden">
                    <div className="p-8 pb-4">
                      <h2 className="text-2xl font-serif flex items-center gap-3">
                        <Settings className="w-6 h-6 text-[#C5A059]" />
                        Configuration
                      </h2>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6 custom-scrollbar">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">Event Domain Slug</label>
                        <div className="flex items-center flex-wrap">
                          <div className="bg-gray-100 px-4 py-4 rounded-l-2xl border border-r-0 border-gray-100 text-[10px] font-bold text-gray-400 select-none whitespace-nowrap">
                            {isCouple 
                              ? `${window.location.host.split('.').slice(-2).join('.')}/${agency?.slug}/`
                              : (agency?.domain || `${agency?.slug || 'agency'}.${window.location.host.split('.').slice(-2).join('.')}/`)}
                          </div>
                          {!isCouple && (
                            <input 
                              type="text" 
                              placeholder="wedding-slug"
                              value={editingEvent?.slug || ''}
                              onChange={(e) => setEditingEvent({ ...editingEvent!, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                              className="flex-1 px-5 py-4 rounded-r-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-mono text-sm min-w-[120px]"
                            />
                          )}
                          {isCouple && (
                             <div className="flex-1 px-5 py-4 rounded-r-2xl border border-gray-100 bg-gray-50 text-gray-400 font-mono text-sm">
                               Display
                             </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">Event Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Summer Wedding 2026"
                          value={editingEvent?.name || ''}
                          onChange={(e) => setEditingEvent({ ...editingEvent!, name: e.target.value })}
                          className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">Groom / Partner A</label>
                          <input 
                            type="text" 
                            value={editingEvent?.groom_name || ''}
                            onChange={(e) => setEditingEvent({ ...editingEvent!, groom_name: e.target.value })}
                            className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">Bride / Partner B</label>
                          <input 
                            type="text" 
                            value={editingEvent?.bride_name || ''}
                            onChange={(e) => setEditingEvent({ ...editingEvent!, bride_name: e.target.value })}
                            className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">Event Date</label>
                        <input 
                          type="date" 
                          value={editingEvent?.wedding_date || ''}
                          onChange={(e) => setEditingEvent({ ...editingEvent!, wedding_date: e.target.value })}
                          className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">Location</label>
                        <input 
                          type="text" 
                          value={editingEvent?.location || ''}
                          onChange={(e) => setEditingEvent({ ...editingEvent!, location: e.target.value })}
                          className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2 block ml-1">Couple Dashboard Password</label>
                        <input 
                          type="text" 
                          placeholder="Simple password for the couple"
                          value={editingEvent?.access_password || ''}
                          onChange={(e) => setEditingEvent({ ...editingEvent!, access_password: e.target.value })}
                          className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                        />
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-[#C5A059]/5 rounded-2xl border border-[#C5A059]/10">
                        <input 
                          id="auto_approve"
                          type="checkbox" 
                          checked={editingEvent?.auto_approve_messages || false}
                          onChange={(e) => setEditingEvent({ ...editingEvent!, auto_approve_messages: e.target.checked })}
                          className="w-5 h-5 rounded border-gray-300 text-[#C5A059] focus:ring-[#C5A059]"
                        />
                        <label htmlFor="auto_approve" className="text-xs font-bold text-[#2D2424] cursor-pointer">
                          Auto-approve guest messages
                          <p className="text-[10px] text-gray-400 font-normal">Messages will appear instantly on display</p>
                        </label>
                      </div>
                    </div>

                    <div className="p-8 pt-4">
                      <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-[#C5A059] text-white py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#B38D45] transition-all shadow-xl active:scale-95 disabled:opacity-50"
                      >
                        {isSaving ? 'Synchronizing...' : 'Save and Deploy'}
                        <Save className="w-5 h-5" />
                      </button>
                    </div>
                  </section>
                </div>
              </div>

              {/* Management Sections */}
              <div className="lg:col-span-8 space-y-12">
                <div className="flex flex-wrap gap-4 p-1 bg-white rounded-3xl border border-[#C5A059]/10 w-fit">
                  <button 
                    onClick={() => setActiveEditorTab('aesthetic')}
                    className={`px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                      activeEditorTab === 'aesthetic' ? 'bg-[#C5A059] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layout className="w-4 h-4" />
                      Aesthetic
                    </div>
                  </button>
                  <button 
                    onClick={() => setActiveEditorTab('rsvp')}
                    className={`px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                      activeEditorTab === 'rsvp' ? 'bg-[#C5A059] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                       <Users className="w-4 h-4" />
                       Guest Responses
                    </div>
                  </button>
                  <button 
                    onClick={() => setActiveEditorTab('moderation')}
                    className={`px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                      activeEditorTab === 'moderation' ? 'bg-[#C5A059] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                       <MessageSquare className="w-4 h-4" />
                       Moderation
                    </div>
                  </button>
                </div>

                <div className="min-h-[600px]">
                  <AnimatePresence mode="wait">
                    {activeEditorTab === 'aesthetic' && (
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
                            <p className="text-gray-500">Choose the visual style for your wedding display.</p>
                          </div>
                          <span className="text-xs font-bold uppercase tracking-widest text-[#C5A059] bg-[#C5A059]/10 px-4 py-2 rounded-full">
                            {TEMPLATES.length} Art Styles
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {TEMPLATES.map((t) => (
                            <button 
                              key={t.id}
                              onClick={() => setEditingEvent({ ...editingEvent!, theme_id: t.id })}
                              className={`relative overflow-hidden rounded-3xl border-2 transition-all group text-left
                                ${editingEvent?.theme_id === t.id ? 'border-[#C5A059] shadow-2xl p-1' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-[1.02]'}
                              `}
                            >
                              <div className={`${t.colors.background} ${t.colors.text} p-8 rounded-[calc(1.5rem-4px)] min-h-[240px] flex flex-col justify-between`}>
                                <div>
                                  <div className={`w-10 h-10 rounded-xl ${t.colors.accent} bg-opacity-10 mb-6 flex items-center justify-center`}>
                                    <Heart className="w-5 h-5 fill-current opacity-30" />
                                  </div>
                                  <h4 className={`text-2xl font-bold mb-2 ${t.colors.headerText}`}>{t.name}</h4>
                                  <p className="text-sm opacity-60 leading-relaxed max-w-[200px]">{t.description}</p>
                                </div>
                                
                                <div className="flex gap-2 mt-6">
                                  <div className={`w-4 h-4 rounded-full ${t.colors.accent.split(' ')[0].replace('text-', 'bg-') || 'bg-[#C5A059]'}`} />
                                  <div className={`w-4 h-4 rounded-full ${t.colors.border.split(' ')[0].replace('border-', 'bg-') || 'bg-gray-200'} opacity-50`} />
                                </div>
                              </div>

                              {editingEvent?.theme_id === t.id && (
                                <div className="absolute top-6 right-6 bg-[#C5A059] text-white p-2 rounded-full shadow-lg">
                                  <Save className="w-4 h-4" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {activeEditorTab === 'rsvp' && editingEvent?.id && (
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
                         <RSVPManager projectId={editingEvent.id} />
                      </motion.div>
                    )}

                    {activeEditorTab === 'moderation' && editingEvent?.id && (
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
                         <MessageModerator projectId={editingEvent.id} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
