import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Trash2,
  Loader2
} from 'lucide-react';
import { WeddingEvent, TEMPLATES, TemplateId } from '../types';
import { isEventActive, getDaysRemaining, getPackageById } from '../lib/packages';
import { EVENT_PRICING, formatPrice } from '../config/pricing';
import RSVPManager from '../components/RSVPManager';
import MessageModerator from '../components/MessageModerator';
import { getSupabase } from '../lib/supabase';
import { useWorkspace } from '../lib/WorkspaceContext';
import Button from '../design-system/components/Button';
import Tabs from '../design-system/components/Tabs';
import PageHeader from '../design-system/components/PageHeader';
import Badge from '../design-system/components/Badge';

export default function CoupleDashboard() {
  const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
  const { eventId, slug: urlSlug } = useParams<{ eventId?: string; slug?: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'aesthetic' | 'rsvp' | 'moderation' | 'invitation'>('aesthetic');

  useEffect(() => {
    if (isLoadingWorkspace) return;

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
      if (workspace) {
        query = query.eq('agency_id', workspace.id);
      }
    } else {
      setIsLoading(false);
      return;
    }

    const { data, error } = await query.single();

    if (data) {
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
    
    try {
      const response = await fetch(`${window.location.origin}/api/projects/${event.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Event-PIN': event.access_password || ''
        },
        body: JSON.stringify({ theme_id: themeId })
      });

      if (!response.ok) {
        throw new Error('Failed to update theme');
      }

      setEvent({ ...event, theme_id: themeId });
    } catch (err) {
      console.error('Error saving theme:', err);
      alert('Failed to save theme choice.');
    } finally {
      setIsSaving(false);
    }
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

      const response = await fetch(`${window.location.origin}/api/projects/${event.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Event-PIN': event.access_password || ''
        },
        body: JSON.stringify({ image_url: publicUrl, updated_at: new Date().toISOString() })
      });

      if (!response.ok) {
        throw new Error('Failed to update photo');
      }

      setEvent({ ...event, image_url: publicUrl });
    } catch (error: any) {
      console.error('Error uploading:', error);
      alert('Error uploading photo. Make sure the storage is accessible.');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!event) return;
    setIsSaving(true);
    
    try {
      const response = await fetch(`${window.location.origin}/api/projects/${event.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Event-PIN': event.access_password || ''
        },
        body: JSON.stringify({ image_url: null, updated_at: new Date().toISOString() })
      });

      if (!response.ok) {
        throw new Error('Failed to remove photo');
      }

      setEvent({ ...event, image_url: undefined });
    } catch (err) {
      console.error('Error removing photo:', err);
      alert('Failed to remove background photo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    if (event) {
      localStorage.removeItem(`wedding_auth_${event.id}`);
    }
    navigate('/couple/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#252525] animate-spin" />
      </div>
    );
  }

  if (!event) return null;

  const coupleTitle = `${event.groom_name} & ${event.bride_name}`;

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#252525] font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E8E8E5] px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-[#FAF9F7] border border-[#E8E8E5] text-[#8B806F] flex items-center justify-center">
            <Heart className="w-4 h-4 fill-current" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#252525]">{coupleTitle}</span>
            <span className="text-[11px] text-[#777777] ml-2 hidden sm:inline">Couple Dashboard</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const baseUrl = window.location.origin + '/' + event.slug;
              const guestUrl = `${baseUrl}/guest`;
              const rsvpUrl = `${baseUrl}/rsvp`;
              const text = `We're getting married! \n\nLeave us a message: ${guestUrl}\n\nRSVP here: ${rsvpUrl}`;
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            }}
            leftIcon={<Share2 className="w-3.5 h-3.5" />}
          >
            Share via WhatsApp
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto p-6 sm:p-8 space-y-6">
        {/* 12-Month License Status Banner */}
        {(() => {
          const isActive = isEventActive(event, workspace);
          const days = getDaysRemaining(event.expires_at);
          const pkg = getPackageById(event.package_id || 'standard');

          if (!isActive && !workspace?.is_demo && workspace?.subscription_status !== 'active') {
            return (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-subtle">
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>Draft Mode — License Not Yet Activated</span>
                  </div>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Your wedding is in draft preview. Activate your 12-Month License ({formatPrice(EVENT_PRICING.pricePerEvent)} one-time) to unlock full public RSVP submissions and live guest screens.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/subscription?eventId=${event.id}`)}
                >
                  Activate License ({formatPrice(EVENT_PRICING.pricePerEvent)})
                </Button>
              </div>
            );
          }

          return (
            <div className="p-3 bg-white border border-[#E8E8E5] rounded-lg flex items-center justify-between text-xs text-[#777777] shadow-subtle">
              <div className="flex items-center gap-2">
                <Badge variant="success" size="sm">12-Month License Active</Badge>
                <span className="font-medium text-[#252525]">{pkg.name} Tier ({pkg.guestLimit} Guests)</span>
                {event.expires_at && (
                  <span className="hidden sm:inline">
                    · Valid until {new Date(event.expires_at).toLocaleDateString()} {days !== null ? `(${days} days left)` : ''}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate(`/subscription?eventId=${event.id}`)}
                className="text-[11px] text-[#8B806F] hover:text-[#252525] font-medium underline"
              >
                License Details
              </button>
            </div>
          );
        })()}

        <PageHeader
          title={coupleTitle}
          description="Manage your guest responses, live message moderation, and cover photos."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/${event.slug}/display`, '_blank')}
                rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                Live Display
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/${event.slug}/guest`, '_blank')}
                rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                Guest Hub
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/${event.slug}/rsvp`, '_blank')}
                rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                RSVP
              </Button>
            </div>
          }
        />

        <Tabs
          items={[
            { id: 'aesthetic', label: 'Wedding Cover & Style' },
            { id: 'rsvp', label: 'RSVP Guest List' },
            { id: 'moderation', label: 'Live Messages' },
            { id: 'invitation', label: 'Invitation Suite' },
          ]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as any)}
        />

        <div className="pt-2">
          {activeTab === 'aesthetic' && (
            <div className="space-y-6">
              {/* Cover Photo Upload */}
              <div className="bg-white p-6 rounded-lg border border-[#E8E8E5] shadow-subtle space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#252525]">Wedding Cover Photography</h3>
                  <p className="text-xs text-[#777777]">Used on your wedding greeting page and guest hub</p>
                </div>

                {event.image_url ? (
                  <div className="relative aspect-[16/9] max-w-md rounded-lg overflow-hidden border border-[#E8E8E5]">
                    <img src={event.image_url} alt="Cover" className="w-full h-full object-cover" />
                    <button
                      onClick={removePhoto}
                      className="absolute top-3 right-3 p-1.5 bg-white/90 text-red-600 rounded shadow hover:bg-white transition-colors"
                      title="Remove Photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-[#E8E8E5] hover:border-[#8B806F] rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors max-w-md bg-[#FAF9F7]/50">
                    <Camera className="w-6 h-6 text-[#777777] mb-2" />
                    <span className="text-xs font-medium text-[#252525]">Click to upload photo</span>
                    <span className="text-[11px] text-[#777777] mt-1">JPEG or PNG under 10MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Theme Picker */}
              <div className="bg-white p-6 rounded-lg border border-[#E8E8E5] shadow-subtle space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#252525]">Visual Display Theme</h3>
                  <p className="text-xs text-[#777777]">Selected typography and color scheme for reception projectors</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {TEMPLATES.map((tpl) => {
                    const isSelected = event.theme_id === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleSaveTheme(tpl.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? 'border-[#252525] bg-[#FAF9F7] shadow-subtle' 
                            : 'border-[#E8E8E5] bg-white hover:border-[#D4D4CE]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-[#252525]">{tpl.name}</span>
                          {isSelected && <Badge variant="taupe" size="sm">Selected</Badge>}
                        </div>
                        <p className="text-[11px] text-[#777777] leading-relaxed line-clamp-2">
                          {tpl.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rsvp' && (
            <RSVPManager projectId={event.id} rsvpFields={event.rsvp_fields} />
          )}

          {activeTab === 'moderation' && (
            <MessageModerator projectId={event.id} />
          )}

          {activeTab === 'invitation' && (
            <div className="bg-white p-8 rounded-lg border border-[#E8E8E5] shadow-subtle space-y-5 max-w-xl">
              <div>
                <h3 className="text-sm font-semibold text-[#252525]">Digital Invitation Suite</h3>
                <p className="text-xs text-[#777777] mt-1 leading-relaxed">
                  Your customized e-invitation is live for your guests with full interactive RSVP details.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => window.open(`/${event.slug}/invitation`, '_blank')}
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  View Digital Invitation
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
