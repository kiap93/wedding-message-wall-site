import React, { useCallback, useEffect, useState } from 'react';
import { Agency, Guest, Message, SeatingTable, VenueLayout, WeddingEvent } from '../../types';
import {
  CustomEventMilestone,
  OverviewWidgetErrors,
  computeOverviewStats,
  computeWeddingCountdown,
  fetchEventOverviewBundle,
} from '../../lib/eventOverview';
import { updateMessageStatus } from '../../lib/api';
import { getSupabase } from '../../lib/supabase';
import { API_BASE } from '../../lib/config';
import { authenticatedFetch } from '../../lib/auth';
import EventOverviewHeader from './EventOverviewHeader';
import OverviewStatCards from './OverviewStatCards';
import EventTimelineWidget from './EventTimelineWidget';
import RsvpSummaryWidget from './RsvpSummaryWidget';
import FloorPlanPreviewWidget from './FloorPlanPreviewWidget';
import InvitationPreviewWidget from './InvitationPreviewWidget';
import WebsiteStatusWidget from './WebsiteStatusWidget';
import LiveWishWallWidget from './LiveWishWallWidget';
import SeatingOverviewWidget from './SeatingOverviewWidget';

export type OverviewNavigationTarget =
  | 'edit_event'
  | 'guests'
  | 'add_guest'
  | 'seating'
  | 'floor_plan'
  | 'moderation'
  | 'website_studio'
  | 'invitation_studio';

interface EventOverviewDashboardProps {
  event: Partial<WeddingEvent>;
  agency: Agency | null;
  websiteHref: string;
  invitationHref: string;
  rsvpHref: string;
  eventPin?: string;
  allowInlineModeration?: boolean;
  onNavigate: (target: OverviewNavigationTarget) => void;
  onPreviewWebsite?: () => void;
  onEventUpdated?: (updatedEvent: Partial<WeddingEvent>) => void;
}

export const EventOverviewDashboard: React.FC<EventOverviewDashboardProps> = ({
  event,
  agency,
  websiteHref,
  invitationHref,
  rsvpHref,
  eventPin,
  allowInlineModeration = true,
  onNavigate,
  onPreviewWebsite,
  onEventUpdated,
}) => {
  const projectId = event.id;

  const [guests, setGuests] = useState<Guest[]>([]);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [layout, setLayout] = useState<VenueLayout | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [errors, setErrors] = useState<OverviewWidgetErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadBundle = useCallback(
    async (silent: boolean = false) => {
      if (!projectId) {
        setIsLoading(false);
        return;
      }
      if (!silent) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setGlobalError(null);

      try {
        const bundle = await fetchEventOverviewBundle({
          projectId,
          expectedAgencyId: agency?.id,
          projectAgencyId: event.agency_id,
          eventPin,
        });
        setGuests(bundle.guests);
        setTables(bundle.tables);
        setLayout(bundle.layout);
        setMessages(bundle.messages);
        setErrors(bundle.errors);
      } catch (err: any) {
        setGlobalError(err.message || 'Unable to load event overview');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [projectId, agency?.id, event.agency_id, eventPin]
  );

  useEffect(() => {
    loadBundle(false);
  }, [loadBundle]);

  // Real-time Wish Wall subscription scoped strictly to projectId
  useEffect(() => {
    if (!projectId) return;
    let channel: any = null;

    try {
      const supabase = getSupabase();
      channel = supabase
        .channel(`overview-messages-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `project_id=eq.${projectId}`,
          },
          (payload: any) => {
            if (payload.eventType === 'INSERT' && payload.new) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === payload.new.id)) return prev;
                return [payload.new as Message, ...prev].slice(0, 100);
              });
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              setMessages((prev) =>
                prev.map((m) => (m.id === payload.new.id ? (payload.new as Message) : m))
              );
            } else if (payload.eventType === 'DELETE' && payload.old) {
              setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
            }
          }
        )
        .subscribe();
    } catch {
      // Realtime optional fallback
    }

    return () => {
      if (channel) {
        try {
          getSupabase().removeChannel(channel);
        } catch {
          // ignore cleanup
        }
      }
    };
  }, [projectId]);

  const handleModerateMessage = async (
    messageId: string,
    status: 'approved' | 'rejected'
  ) => {
    await updateMessageStatus(messageId, status);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status } : m))
    );
  };

  const handleSaveCustomMilestones = async (
    nextMilestones: CustomEventMilestone[]
  ) => {
    if (!projectId) return;

    let currentWebsiteConfig = event.website_config;
    if (typeof currentWebsiteConfig === 'string') {
      try {
        currentWebsiteConfig = JSON.parse(currentWebsiteConfig);
      } catch {
        currentWebsiteConfig = {};
      }
    }

    const updatedWebsiteConfig = {
      ...(currentWebsiteConfig && typeof currentWebsiteConfig === 'object'
        ? currentWebsiteConfig
        : {}),
      overviewMilestones: nextMilestones,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (eventPin) {
      headers['X-Event-PIN'] = eventPin;
    }

    const res = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        website_config: updatedWebsiteConfig,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || 'Failed to save milestone');
    }

    onEventUpdated?.({
      ...event,
      website_config: updatedWebsiteConfig,
    });
  };

  const stats = computeOverviewStats(guests, tables, messages);
  const countdown = computeWeddingCountdown(event.wedding_date);

  if (globalError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 space-y-2">
        <div className="font-semibold">Unable to display event overview</div>
        <p className="text-xs">{globalError}</p>
        <button
          type="button"
          onClick={() => loadBundle(false)}
          className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-medium text-rose-900 hover:bg-rose-100"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Editorial Event Header */}
      <EventOverviewHeader
        event={event}
        agency={agency}
        countdown={countdown}
        websiteHref={websiteHref}
        invitationHref={invitationHref}
        onAddGuest={() => onNavigate('add_guest')}
        onEditEvent={() => onNavigate('edit_event')}
        onPreviewWebsite={onPreviewWebsite}
        onRefresh={() => loadBundle(true)}
        isRefreshing={isRefreshing}
      />

      {/* 2. Real-Time Statistics Cards */}
      <OverviewStatCards
        stats={stats}
        isLoading={isLoading}
        guestError={errors.guests}
        messageError={errors.messages}
        onCardClick={(target) => {
          if (target === 'seating' || target === 'unassigned') {
            onNavigate('seating');
          } else if (target === 'messages') {
            onNavigate('moderation');
          } else {
            onNavigate('guests');
          }
        }}
      />

      {/* 3. Main Two-Column Command Center Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Primary Operations Column */}
        <div className="lg:col-span-7 space-y-6">
          <FloorPlanPreviewWidget
            layout={layout}
            tables={tables}
            isLoading={isLoading}
            error={errors.layout}
            onEditFloorPlan={() => onNavigate('floor_plan')}
          />

          <SeatingOverviewWidget
            stats={stats}
            isLoading={isLoading}
            error={errors.tables || errors.guests}
            onManageSeating={() => onNavigate('seating')}
          />

          <EventTimelineWidget
            event={event}
            onSaveCustomMilestones={handleSaveCustomMilestones}
            onNavigateWebsite={() => onNavigate('website_studio')}
          />
        </div>

        {/* Secondary Communications & Publishing Column */}
        <div className="lg:col-span-5 space-y-6">
          <RsvpSummaryWidget
            stats={stats}
            isLoading={isLoading}
            error={errors.guests}
            onManageGuests={() => onNavigate('guests')}
            onAddGuest={() => onNavigate('add_guest')}
          />

          <LiveWishWallWidget
            messages={messages}
            isLoading={isLoading}
            error={errors.messages}
            allowInlineModeration={allowInlineModeration}
            onModerateMessage={handleModerateMessage}
            onOpenModerator={() => onNavigate('moderation')}
          />

          <WebsiteStatusWidget
            event={event}
            websiteHref={websiteHref}
            onEditWebsite={() => onNavigate('website_studio')}
            onPreviewDraft={onPreviewWebsite}
          />

          <InvitationPreviewWidget
            event={event}
            stats={stats}
            invitationHref={invitationHref}
            rsvpHref={rsvpHref}
            onEditInvitation={() => onNavigate('invitation_studio')}
          />
        </div>
      </div>
    </div>
  );
};

export default EventOverviewDashboard;
