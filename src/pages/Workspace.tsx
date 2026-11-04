import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Save, 
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
  Share2,
  Check,
  Search,
  Key,
  Music,
  Code
} from 'lucide-react';
import { Agency, WeddingEvent, DEFAULT_TEMPLATES, TemplateId, WeddingTemplate } from '../types';
import RSVPManager from '../components/RSVPManager';
import RSVPFieldEditor from '../components/RSVPFieldEditor';
import RSVPForm from '../components/RSVPForm';
import MessageModerator from '../components/MessageModerator';
import { API_BASE } from '../lib/config';
import { authenticatedFetch, removeAuthToken } from '../lib/auth';
import { getSupabase } from '../lib/supabase';
import { useWorkspace } from '../lib/WorkspaceContext';
import { useUser } from '../lib/UserContext';
import { fetchTemplates } from '../lib/templates';
import DashboardLayout from '../layouts/DashboardLayout';
import invitationCraftImage from '../assets/images/invitation_craft_showcase_1793501242453.jpg';
import Button from '../design-system/components/Button';
import Input from '../design-system/components/Input';
import Select from '../design-system/components/Select';
import Badge from '../design-system/components/Badge';
import Tabs from '../design-system/components/Tabs';
import PageHeader from '../design-system/components/PageHeader';
import Modal from '../design-system/components/Modal';
import EmptyState from '../design-system/components/EmptyState';

export default function Workspace() {
  const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
  const { user } = useUser();
  const [view, setView] = useState<'list' | 'editor' | 'agency_settings' | 'calendar'>('list');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Agency
  const [agency, setAgency] = useState<Agency | null>(null);
  const [isSavingAgency, setIsSavingAgency] = useState(false);

  // Event List
  const [events, setEvents] = useState<WeddingEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Current Editor State
  const [editingEvent, setEditingEvent] = useState<Partial<WeddingEvent> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [templates, setTemplates] = useState<WeddingTemplate[]>([]);
  const [activeEditorTab, setActiveEditorTab] = useState<'aesthetic' | 'rsvp' | 'form' | 'moderation' | 'invitation'>('aesthetic');

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showRSVPPreview, setShowRSVPPreview] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await fetchTemplates();
      setTemplates(data);
    }
    load();
  }, []);

  // Sync view query param if passed
  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam === 'calendar' || viewParam === 'agency_settings' || viewParam === 'list') {
      setView(viewParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const initAdmin = async () => {
      if (isLoadingWorkspace || !user) return;

      const targetProjectId = searchParams.get('project');

      if (workspace) {
        setAgency(workspace);
        fetchEvents(workspace.id, workspace.user_role, targetProjectId);
      } else {
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
          fetchEvents(primaryWorkspace.id, primaryWorkspace.user_role, targetProjectId);
        } else {
          navigate('/onboarding');
        }
      }
    };

    initAdmin();
  }, [workspace, isLoadingWorkspace, user, navigate, searchParams]);

  const fetchEvents = async (agencyId: string, role?: string, targetProjectId?: string | null) => {
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
      const eventList = (data || []).map(event => ({
        ...event,
        rsvp_fields: typeof event.rsvp_fields === 'string' 
          ? JSON.parse(event.rsvp_fields) 
          : (Array.isArray(event.rsvp_fields) ? event.rsvp_fields : null)
      }));
      setEvents(eventList);
      
      if (targetProjectId) {
        const targetEvent = eventList.find(e => e.id === targetProjectId);
        if (targetEvent) {
          setEditingEvent(targetEvent);
          setActiveEditorTab('aesthetic');
          setView('editor');
        }
      } else if (role === 'couple' && eventList.length > 0 && view === 'list' && !editingEvent) {
        const firstEvent = eventList[0];
        setEditingEvent(firstEvent);
        setActiveEditorTab('aesthetic');
        setView('editor');
      }
    }
    setIsLoadingEvents(false);
  };

  const handleSaveAgency = async (agencyData: Partial<Agency>) => {
    if (!user) return;
    setIsSavingAgency(true);
    
    try {
      let response;
      if (agency?.id) {
        response = await authenticatedFetch(`${API_BASE}/api/agencies/${agency.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agencyData)
        });
      } else {
        response = await authenticatedFetch(`${API_BASE}/api/agencies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agencyData)
        });
      }

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save organization');
      }

      const resData = await response.json();
      if (resData.data) {
        setAgency(resData.data);
      }

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
        
        if (!isLocalhost || hostParts.length > 1) {
          window.location.replace(`${protocol}//${newSlug}.${baseDomain}/workspace${token ? `?token=${token}` : ''}`);
        } else {
          window.location.reload();
        }
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      console.error('Agency save error:', err);
      alert('Error saving organization: ' + err.message);
    } finally {
      setIsSavingAgency(false);
    }
  };

  const isSubscribed = agency?.subscription_status === 'active' || 
                      agency?.is_demo === true || 
                      user?.email === 'buildsiteasia@gmail.com';
  const isCouple = agency?.user_role === 'couple';
  const isStaff = user?.email === 'buildsiteasia@gmail.com' || user?.email?.includes('@eventframe.io');

  useEffect(() => {
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
    if (!isSubscribed && !isStaff) {
      alert('A pro subscription is required to create new events.');
      navigate('/subscription');
      return;
    }
    const newEvent: Partial<WeddingEvent> = {
      name: '',
      slug: `wedding-${Math.random().toString(36).substring(2, 7)}`,
      groom_name: '',
      bride_name: '',
      wedding_date: new Date().toISOString().split('T')[0],
      location: '',
      theme_id: 'minimal_luxury',
      agency_id: agency.id,
      access_password: Math.random().toString(36).substring(2, 8).toUpperCase(),
      auto_approve_messages: false,
      image_url: '',
      rsvp_fields: []
    };
    setEditingEvent(newEvent);
    setActiveEditorTab('aesthetic');
    setView('editor');
  };

  const handleEdit = (event: WeddingEvent) => {
    setEditingEvent({ ...event });
    setActiveEditorTab('aesthetic');
    setView('editor');
  };

  const handleSave = async () => {
    if (!editingEvent || !agency) return;
    setIsSaving(true);

    const eventData = {
      ...editingEvent,
      agency_id: agency.id,
      updated_at: new Date().toISOString()
    };
    
    delete (eventData as any).user_id;

    if (eventData.id) {
      try {
        const response = await authenticatedFetch(`${API_BASE}/api/projects/${eventData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData)
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to save event');
        }

        if (agency) await fetchEvents(agency.id, agency.user_role);
        setView('list');
      } catch (err: any) {
        console.error('Save error:', err);
        alert('Error saving event: ' + err.message);
      }
    } else {
      try {
        const response = await authenticatedFetch(`${API_BASE}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData)
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to create event');
        }

        if (agency) await fetchEvents(agency.id, agency.user_role);
        setView('list');
      } catch (err: any) {
        console.error('Create error:', err);
        alert('Error creating event: ' + err.message);
      }
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event? All guest RSVPs and records will be deleted.')) return;
    
    try {
      const response = await authenticatedFetch(`${API_BASE}/api/projects/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete event');
      }

      setEvents(events.filter(e => e.id !== id));
    } catch (err: any) {
      console.error('Delete error:', err);
      alert('Error deleting event: ' + err.message);
    }
  };

  const getEventUrl = (event: WeddingEvent, type: 'display' | 'guest' | 'rsvp' | 'couple_login' | 'invitation', themeOverride?: string) => {
    const currentHost = window.location.host;
    const currentOrigin = window.location.origin;
    const hostParts = currentHost.split('.');
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isRunApp = window.location.hostname.includes('.run.app');
    const query = themeOverride ? `?template=${themeOverride}` : '';
    
    // In preview / development / run.app environments, keep on same origin
    if (isLocalhost || isRunApp) {
      const slugVal = event?.slug || agency?.slug || 'demo';
      if (type === 'display') return `${currentOrigin}/${slugVal}/display${query}`;
      if (type === 'guest') return `${currentOrigin}/${slugVal}/guest${query}`;
      if (type === 'rsvp') return `${currentOrigin}/${slugVal}/rsvp${query}`;
      if (type === 'invitation') return `${currentOrigin}/${slugVal}/invitation`;
      return `${currentOrigin}/couple/login?slug=${slugVal}`;
    }

    let baseDomain;
    baseDomain = hostParts.length > 2 ? hostParts.slice(-2).join('.') : hostParts.join('.');
    
    if (isCouple) {
      const base = `https://${baseDomain}/${agency?.slug || event.slug}`;
      if (type === 'display') return `${base}${query}`;
      if (type === 'guest') return `${base}/guest${query}`;
      if (type === 'rsvp') return `${base}/rsvp${query}`;
      if (type === 'invitation') return `${base}/invitation`;
      return `https://${baseDomain}/couple/login?agency=${agency?.slug}`;
    }

    const base = agency?.domain ? `https://${agency.domain}` : `https://${agency?.slug}.${baseDomain}`;
    if (type === 'display') return `${base}/${event.slug}/display${query}`;
    if (type === 'guest') return `${base}/${event.slug}/guest${query}`;
    if (type === 'rsvp') return `${base}/${event.slug}/rsvp${query}`;
    if (type === 'invitation') return `${base}/${event.slug}/invitation`;
    return `${base}/couple/login?slug=${event.slug}`;
  };

  const handleShareCoupleLogin = (event: WeddingEvent) => {
    const loginUrl = getEventUrl(event, 'couple_login');
    const shareText = `Couple Dashboard Login:\nLink: ${loginUrl}\nPIN: ${event.access_password}`;
    
    navigator.clipboard.writeText(shareText).then(() => {
      setCopiedId(event.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const filteredEvents = events.filter(e => 
    (e.name && e.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.groom_name && e.groom_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.bride_name && e.bride_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.location && e.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeNavItem = view === 'calendar' ? 'calendar' : view === 'agency_settings' ? 'settings' : 'events';

  return (
    <DashboardLayout activeItem={activeNavItem} onNewEvent={handleCreateNew}>
      {view === 'agency_settings' ? (
        <div className="space-y-6 max-w-3xl">
          <PageHeader
            title={isCouple ? 'Wedding Profile Settings' : 'Agency Branding & Subdomain'}
            description={
              isCouple 
                ? 'Manage your custom URL slug and event color styling.' 
                : 'Configure your white-label studio name, custom subdomain, and default branding palette.'
            }
            breadcrumbs={[
              { label: 'Weddings', onClick: () => setView('list') },
              { label: 'Branding Settings' }
            ]}
          />

          <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#E8E8E5] shadow-subtle">
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
            }} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="name"
                  label={isCouple ? 'Couple / Wedding Title' : 'Agency Name'}
                  defaultValue={agency?.name}
                  required
                />
                <Input
                  name="slug"
                  label={isCouple ? 'Wedding Slug' : 'Subdomain Slug'}
                  defaultValue={agency?.slug}
                  required
                  hint={isCouple ? `eventframe.io/${agency?.slug || 'slug'}` : `${agency?.slug || 'agency'}.eventframe.io`}
                />
              </div>

              <Input
                name="logo_url"
                label={isCouple ? 'Wedding Monogram / Logo URL' : 'Studio Logo Image URL'}
                defaultValue={agency?.logo_url}
                placeholder="https://example.com/logo.png"
              />

              {!isCouple && (
                <Input
                  name="domain"
                  label="Custom Apex Domain (Optional)"
                  defaultValue={agency?.domain}
                  placeholder="weddings.yourbrand.com"
                  hint="Point a CNAME record to EventFrame to use your own apex domain."
                />
              )}

              <div className="p-4 bg-[#FAF9F7] rounded-md border border-[#E8E8E5] space-y-3">
                <div className="text-xs font-medium text-[#252525]">Brand Palette</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[#777777] block mb-1.5">Primary Color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" name="primaryColor" defaultValue={agency?.theme_config?.primaryColor || '#252525'} className="w-8 h-8 rounded border border-[#E8E8E5] cursor-pointer" />
                      <input type="text" defaultValue={agency?.theme_config?.primaryColor || '#252525'} className="flex-1 h-8 px-2.5 text-xs font-mono bg-white border border-[#E8E8E5] rounded" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#777777] block mb-1.5">Accent Color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" name="accentColor" defaultValue={agency?.theme_config?.accentColor || '#8B806F'} className="w-8 h-8 rounded border border-[#E8E8E5] cursor-pointer" />
                      <input type="text" defaultValue={agency?.theme_config?.accentColor || '#8B806F'} className="flex-1 h-8 px-2.5 text-xs font-mono bg-white border border-[#E8E8E5] rounded" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSavingAgency}
                >
                  Save Branding Settings
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : view === 'list' ? (
        <div className="space-y-6">
          <PageHeader
            title={isCouple ? 'Wedding Dashboard' : 'Weddings & Celebrations'}
            description={
              isCouple 
                ? 'Manage your live guest moderation, RSVP submissions, and digital stationery.' 
                : 'Centralized registry of client weddings, live display streams, and RSVP questionnaires.'
            }
            actions={
              <div className="flex items-center gap-2">
                <div className="flex bg-[#F2EFE9] p-0.5 rounded border border-[#E8E8E5]">
                  <button
                    onClick={() => setView('list')}
                    className="px-3 py-1 text-xs font-medium rounded bg-white text-[#252525] shadow-subtle transition-colors"
                  >
                    Grid View
                  </button>
                  <button
                    onClick={() => setView('calendar')}
                    className="px-3 py-1 text-xs font-medium rounded text-[#777777] hover:text-[#252525] transition-colors"
                  >
                    Calendar
                  </button>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateNew}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  {isCouple ? 'Initialize Wedding' : 'New Wedding'}
                </Button>
              </div>
            }
          />

          {/* Metric KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-[#E8E8E5] shadow-subtle">
              <div className="text-xs text-[#777777]">Total Registered Weddings</div>
              <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#252525]">
                {events.length}
              </div>
              <div className="mt-1 text-xs text-[#777777]">Across this workspace</div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E8E8E5] shadow-subtle">
              <div className="text-xs text-[#777777]">Upcoming Celebrations</div>
              <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#252525]">
                {events.filter(e => new Date(e.wedding_date) >= new Date()).length}
              </div>
              <div className="mt-1 text-xs text-[#777777]">Scheduled on calendar</div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E8E8E5] shadow-subtle">
              <div className="text-xs text-[#777777]">Workspace Status</div>
              <div className="mt-2 text-sm font-semibold text-[#252525]">
                {isSubscribed ? 'Pro License Active' : 'Starter Account'}
              </div>
              <div className="mt-1 text-xs text-[#8B806F]">
                {agency?.slug ? `${agency.slug}.eventframe.io` : 'Standard domain'}
              </div>
            </div>
          </div>

          {/* Search toolbar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search weddings by couple or venue..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs bg-white text-[#252525] placeholder:text-[#999999] border border-[#E8E8E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
              />
            </div>
          </div>

          {/* Events Grid */}
          {isLoadingEvents ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 bg-white border border-[#E8E8E5] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              icon={<Users className="w-5 h-5" />}
              title={searchTerm ? "No weddings match your search" : "No weddings created yet"}
              description={
                searchTerm 
                  ? "Try searching by a different name or location." 
                  : "Create your first wedding event to set up RSVP questionnaires, live displays, and digital invitations."
              }
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateNew}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Create Wedding Event
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.map((event) => {
                const coupleTitle = event.groom_name && event.bride_name 
                  ? `${event.groom_name} & ${event.bride_name}` 
                  : event.name || 'Untitled Wedding';

                return (
                  <div
                    key={event.id}
                    className="bg-white rounded-lg border border-[#E8E8E5] hover:border-[#D4D4CE] shadow-subtle p-5 flex flex-col justify-between transition-colors"
                  >
                    <div>
                      {/* Top Bar on Card */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <Badge variant="taupe" size="sm">
                          {templates.find(t => t.id === event.theme_id)?.name || 'Minimal Luxury'}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(event)}
                            className="p-1 text-[#777777] hover:text-[#252525] rounded transition-colors"
                            title="Edit Event Settings"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="p-1 text-[#777777] hover:text-red-600 rounded transition-colors"
                            title="Delete Event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Main Title */}
                      <h3 className="text-base font-semibold text-[#252525] leading-snug">
                        {coupleTitle}
                      </h3>

                      <div className="text-xs text-[#777777] font-mono mt-1 truncate">
                        /{event.slug}
                      </div>

                      {/* Metadata */}
                      <div className="mt-4 pt-3 border-t border-[#EFEFEA] space-y-1.5 text-xs text-[#777777]">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-3.5 h-3.5 text-[#B0ADA8]" />
                          <span className="font-mono tabular-nums">
                            {new Date(event.wedding_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-[#B0ADA8]" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                        {event.access_password && (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-[#999999]">Access PIN:</span>
                            <span className="font-mono text-xs text-[#252525] bg-[#FAF9F7] px-1.5 py-0.5 rounded border border-[#E8E8E5]">
                              {event.access_password}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Strip */}
                    <div className="mt-5 pt-3 border-t border-[#EFEFEA] flex flex-wrap gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(getEventUrl(event, 'display'), '_blank')}
                        className="flex-1 !h-7 !text-[11px]"
                      >
                        Display
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(getEventUrl(event, 'guest'), '_blank')}
                        className="flex-1 !h-7 !text-[11px]"
                      >
                        Guest
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(getEventUrl(event, 'rsvp'), '_blank')}
                        className="flex-1 !h-7 !text-[11px]"
                      >
                        RSVP
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/editor/${event.id}`)}
                        className="flex-1 !h-7 !text-[11px]"
                      >
                        Studio
                      </Button>
                      {!isCouple && (
                        <button
                          onClick={() => handleShareCoupleLogin(event)}
                          title="Copy couple login link and PIN"
                          className="px-2 h-7 bg-[#FAF9F7] text-[#777777] hover:text-[#252525] rounded border border-[#E8E8E5] transition-colors flex items-center justify-center text-xs"
                        >
                          {copiedId === event.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : view === 'calendar' ? (
        <div className="space-y-6">
          <PageHeader
            title="Event Schedule Calendar"
            description="Monthly calendar view of upcoming celebrations across your workspace."
            breadcrumbs={[
              { label: 'Weddings', onClick: () => setView('list') },
              { label: 'Calendar' }
            ]}
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView('list')}
              >
                Back to Grid View
              </Button>
            }
          />

          <div className="bg-white rounded-lg border border-[#E8E8E5] shadow-subtle overflow-hidden">
            {/* Calendar Controls */}
            <div className="p-4 border-b border-[#E8E8E5] flex items-center justify-between bg-[#FAF9F7]">
              <h3 className="text-sm font-semibold text-[#252525]">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
                  className="!px-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
                  className="!px-2"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Calendar Days */}
            <div className="p-4 overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-7 border-b border-[#E8E8E5] pb-2 text-center text-xs font-medium text-[#777777]">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d}>{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 border-l border-t border-[#E8E8E5]">
                  {(() => {
                    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
                    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
                    const days = [];

                    for (let i = 0; i < firstDayOfMonth; i++) {
                      days.push(
                        <div key={`empty-${i}`} className="min-h-[100px] bg-[#FAF9F7]/50 border-r border-b border-[#E8E8E5]" />
                      );
                    }

                    for (let day = 1; day <= daysInMonth; day++) {
                      const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayEvents = events.filter(e => e.wedding_date === dateStr);
                      const isToday = new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();

                      days.push(
                        <div
                          key={day}
                          className={`min-h-[100px] p-2 border-r border-b border-[#E8E8E5] transition-colors ${
                            dayEvents.length > 0 ? 'bg-white' : 'hover:bg-[#FAF9F7]/40'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-mono tabular-nums ${
                              isToday ? 'bg-[#252525] text-white px-1.5 py-0.5 rounded font-medium' : 'text-[#777777]'
                            }`}>
                              {day}
                            </span>
                            {dayEvents.length > 0 && (
                              <span className="text-[10px] font-mono text-[#8B806F] bg-[#FAF9F7] px-1 rounded border border-[#E8E8E5]">
                                {dayEvents.length}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            {dayEvents.map(ev => (
                              <button
                                key={ev.id}
                                onClick={() => handleEdit(ev)}
                                className="w-full text-left p-1.5 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded text-xs transition-colors"
                              >
                                <div className="font-medium text-[#252525] truncate text-[11px]">
                                  {ev.groom_name} & {ev.bride_name}
                                </div>
                                {ev.location && (
                                  <div className="text-[10px] text-[#777777] truncate">
                                    {ev.location}
                                  </div>
                                )}
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
          </div>
        </div>
      ) : (
        /* Event Configuration Editor */
        <div className="space-y-6">
          <PageHeader
            title={
              editingEvent?.groom_name && editingEvent?.bride_name
                ? `${editingEvent.groom_name} & ${editingEvent.bride_name}`
                : editingEvent?.name || 'Wedding Configuration'
            }
            description="Configure event details, RSVP fields, and live guest moderation."
            breadcrumbs={[
              { label: 'Weddings', onClick: () => setView('list') },
              { label: editingEvent?.slug || 'Event Configuration' }
            ]}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setView('list')}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  isLoading={isSaving}
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                >
                  Save Changes
                </Button>
              </div>
            }
          />

          {/* Editor Tabs */}
          <Tabs
            items={[
              { id: 'aesthetic', label: 'Event Details & Style' },
              { id: 'rsvp', label: 'RSVP Responses' },
              { id: 'form', label: 'RSVP Form Schema' },
              { id: 'moderation', label: 'Guest Messages' },
              { id: 'invitation', label: 'Invitation Studio' },
            ]}
            activeId={activeEditorTab}
            onChange={(id) => setActiveEditorTab(id as any)}
          />

          {/* Tab Content */}
          <div className="pt-2">
            {activeEditorTab === 'aesthetic' && editingEvent && (
              <div className="space-y-8 max-w-4xl">
                {/* Event Details Card */}
                <div className="bg-white p-6 rounded-lg border border-[#E8E8E5] shadow-subtle space-y-5">
                  <h3 className="text-sm font-semibold text-[#252525]">Event Information</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Groom's Name"
                      value={editingEvent.groom_name || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, groom_name: e.target.value })}
                      placeholder="e.g. Lucas"
                    />
                    <Input
                      label="Bride's Name"
                      value={editingEvent.bride_name || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, bride_name: e.target.value })}
                      placeholder="e.g. Sofia"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Event URL Slug"
                      value={editingEvent.slug || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      placeholder="lucas-sofia"
                      hint="Public slug for guest access"
                    />
                    <Input
                      label="Wedding Date"
                      type="date"
                      value={editingEvent.wedding_date || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, wedding_date: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Venue / Ceremony Location"
                      value={editingEvent.location || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                      placeholder="Villa Erba, Lake Como"
                    />
                    <Input
                      label="Couple Access PIN"
                      value={editingEvent.access_password || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, access_password: e.target.value.toUpperCase() })}
                      placeholder="ABC123"
                      hint="Used by the couple to log into their dashboard"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Background Music Audio URL"
                      value={editingEvent.music_url || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, music_url: e.target.value })}
                      placeholder="https://example.com/audio.mp3"
                    />
                    <div className="flex items-center gap-3 pt-6">
                      <label className="flex items-center gap-2 text-xs font-medium text-[#252525] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingEvent.auto_approve_messages || false}
                          onChange={(e) => setEditingEvent({ ...editingEvent, auto_approve_messages: e.target.checked })}
                          className="rounded border-[#E8E8E5] text-[#252525] focus:ring-[#8B806F]"
                        />
                        <span>Auto-approve guest messages on live display</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Theme Selection */}
                <div className="bg-white p-6 rounded-lg border border-[#E8E8E5] shadow-subtle space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#252525]">Display Art Aesthetic</h3>
                      <p className="text-xs text-[#777777]">Choose the unified visual styling and typography for RSVP, Guest, and Display screens</p>
                    </div>
                    {editingEvent.id && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(getEventUrl(editingEvent as WeddingEvent, 'display', editingEvent.theme_id), '_blank')}
                          rightIcon={<ExternalLink className="w-3 h-3" />}
                          className="!h-7 !text-[11px]"
                        >
                          Display
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(getEventUrl(editingEvent as WeddingEvent, 'guest', editingEvent.theme_id), '_blank')}
                          rightIcon={<ExternalLink className="w-3 h-3" />}
                          className="!h-7 !text-[11px]"
                        >
                          Guest
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(getEventUrl(editingEvent as WeddingEvent, 'rsvp', editingEvent.theme_id), '_blank')}
                          rightIcon={<ExternalLink className="w-3 h-3" />}
                          className="!h-7 !text-[11px]"
                        >
                          RSVP
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                    {templates.map((tpl) => {
                      const isSelected = editingEvent.theme_id === tpl.id;
                      return (
                        <div
                          key={tpl.id}
                          onClick={() => setEditingEvent({ ...editingEvent, theme_id: tpl.id })}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors text-left flex flex-col justify-between min-h-[110px] ${
                            isSelected 
                              ? 'border-[#252525] bg-[#FAF9F7] shadow-subtle ring-1 ring-[#252525]' 
                              : 'border-[#E8E8E5] bg-white hover:border-[#D4D4CE]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-[#252525]">{tpl.name}</span>
                              {isSelected && <Badge variant="taupe" size="sm">Active</Badge>}
                            </div>
                            <p className="text-[11px] text-[#777777] line-clamp-2 leading-relaxed">
                              {tpl.description || 'Editorial layout tailored for digital wedding displays'}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#EFEFEA]">
                            <span className="text-[10px] text-[#999999] font-mono capitalize">
                              {tpl.variant || 'masonry'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2.5 h-2.5 rounded-full border border-black/10 ${tpl.colors?.background || 'bg-white'}`} />
                              <div className={`w-2.5 h-2.5 rounded-full border border-black/10 ${tpl.colors?.accent ? 'bg-current ' + tpl.colors.accent : 'bg-[#8B806F]'}`} />
                              <div className={`w-2.5 h-2.5 rounded-full border border-black/10 ${tpl.colors?.headerText ? 'bg-current ' + tpl.colors.headerText : 'bg-[#252525]'}`} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeEditorTab === 'rsvp' && editingEvent?.id && (
              <RSVPManager
                projectId={editingEvent.id}
                rsvpFields={editingEvent.rsvp_fields}
              />
            )}

            {activeEditorTab === 'form' && editingEvent && (
              <div className="max-w-4xl">
                <RSVPFieldEditor
                  fields={editingEvent.rsvp_fields || []}
                  onChange={(fields) => setEditingEvent({ ...editingEvent, rsvp_fields: fields })}
                />
              </div>
            )}

            {activeEditorTab === 'moderation' && editingEvent?.id && (
              <MessageModerator projectId={editingEvent.id} />
            )}

            {activeEditorTab === 'invitation' && editingEvent?.id && (
              <div className="max-w-3xl bg-white p-8 rounded-lg border border-[#E8E8E5] shadow-subtle space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[#252525]">Digital Invitation Studio</h3>
                  <p className="text-xs text-[#777777] mt-1 leading-relaxed">
                    Access our precision drag-and-drop stationery studio. Position monogram typography, photo backdrops, wax seals, and wedding schedule elements with coordinate snapping.
                  </p>
                </div>

                <div className="aspect-[16/9] max-w-lg rounded-lg border border-[#E8E8E5] overflow-hidden bg-[#FAF9F7] relative flex items-center justify-center p-6">
                  <img
                    src={invitationCraftImage}
                    alt="Invitation Preview"
                    className="w-full h-full object-cover rounded"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => navigate(`/editor/${editingEvent.id}`)}
                    rightIcon={<Layout className="w-4 h-4" />}
                  >
                    Open Invitation Studio
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => window.open(getEventUrl(editingEvent as WeddingEvent, 'invitation'), '_blank')}
                    rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  >
                    View Guest Invitation
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
