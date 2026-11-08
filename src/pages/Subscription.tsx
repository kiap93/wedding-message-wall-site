import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Shield, 
  CreditCard, 
  ArrowRight, 
  Loader2, 
  Calendar, 
  Users, 
  Sparkles, 
  Clock, 
  AlertCircle,
  ExternalLink,
  Receipt,
  RefreshCw,
  Calculator,
  CheckCircle2
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../lib/WorkspaceContext';
import { useUser } from '../lib/UserContext';
import { WeddingEvent } from '../types';
import { authenticatedFetch } from '../lib/auth';
import DashboardLayout from '../layouts/DashboardLayout';
import Button from '../design-system/components/Button';
import PageHeader from '../design-system/components/PageHeader';
import Badge from '../design-system/components/Badge';
import { EVENT_PRICING, formatPrice, calculateEventCost } from '../config/pricing';
import { getDaysRemaining } from '../lib/packages';

interface EnrichedEvent extends WeddingEvent {
  displayStatus?: 'draft' | 'pending_payment' | 'active' | 'expired' | 'cancelled' | 'failed';
  isActive?: boolean;
  daysRemaining?: number | null;
  amountPaid?: number;
  isGrandfathered?: boolean;
}

interface BillingMetrics {
  totalEvents: number;
  activeEvents: number;
  pendingPaymentEvents: number;
  expiredEvents: number;
  totalPaidAmount: number;
}

export default function Subscription() {
  const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
  const { user } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const [metrics, setMetrics] = useState<BillingMetrics>({
    totalEvents: 0,
    activeEvents: 0,
    pendingPaymentEvents: 0,
    expiredEvents: 0,
    totalPaidAmount: 0
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [calcEventsCount, setCalcEventsCount] = useState<number>(3);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Check for return from checkout
  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';
  const returnEventId = searchParams.get('eventId');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    loadBillingData();
  }, [workspace, user]);

  useEffect(() => {
    if (isSuccess && returnEventId) {
      if (sessionId && sessionId.startsWith('cs_')) {
        handleVerifyReturn(returnEventId, sessionId);
      } else {
        // Returned without Stripe session confirmation
        setErrorBanner('Checkout completed, awaiting payment verification. If Stripe is in setup mode, the event remains in pending_payment status.');
        loadBillingData();
      }
    } else if (isCanceled) {
      setErrorBanner('Payment was canceled. Your event remains in draft mode and can be activated anytime.');
    }
  }, [isSuccess, returnEventId, sessionId]);

  const handleVerifyReturn = async (eventId: string, session: string) => {
    try {
      const response = await authenticatedFetch(`/api/events/${eventId}/verify-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session })
      });
      const data = await response.json();
      if (data.success) {
        setSuccessBanner(data.message || `Payment verified! Your event now has ${EVENT_PRICING.validityMonths} months of full access.`);
        loadBillingData();
      } else {
        setErrorBanner(data.error || 'Payment verification pending. Please refresh in a moment.');
        loadBillingData();
      }
    } catch (err: any) {
      console.error('Session verification error:', err);
      setErrorBanner('Verification failed. If payment was processed, your event will update once confirmed by webhook.');
      loadBillingData();
    }
  };

  const loadBillingData = async () => {
    setIsLoadingData(true);
    try {
      // 1. Fetch events with billing info and metrics
      const eventsRes = await authenticatedFetch('/api/billing/events');
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        const eventList: EnrichedEvent[] = eventsData.events || [];
        setEvents(eventList);
        if (eventsData.metrics) {
          setMetrics(eventsData.metrics);
        }
        if (eventList.length > 0 && !selectedEventId) {
          // Default selection to first unpaid or first event
          const firstUnpaid = eventList.find((e: EnrichedEvent) => !e.isActive);
          setSelectedEventId(firstUnpaid?.id || eventList[0].id);
        }
      }

      // 2. Fetch order history
      const ordersRes = await authenticatedFetch('/api/billing/history');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);
      }
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleCheckout = async (targetEventId: string) => {
    setIsProcessingCheckout(true);
    setErrorBanner(null);
    setSuccessBanner(null);

    try {
      const response = await authenticatedFetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: targetEventId,
          agencyId: workspace?.id,
          successUrl: `${window.location.origin}/subscription?success=true&eventId=${targetEventId}`,
          cancelUrl: `${window.location.origin}/subscription?canceled=true&eventId=${targetEventId}`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      } else if (data.pending) {
        // Preserved pending payment workflow without simulating paid status
        setSuccessBanner(`Event set to Pending Payment (${formatPrice(EVENT_PRICING.pricePerEvent)}). Payment gateway is currently awaiting configuration.`);
        loadBillingData();
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorBanner(err.message || 'Error redirecting to checkout. Please try again.');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  if (isLoadingWorkspace || (isLoadingData && events.length === 0)) {
    return (
      <DashboardLayout activeItem="subscription">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 text-[#252525] animate-spin" />
          <p className="text-xs text-[#777777]">Loading event licenses and billing details...</p>
        </div>
      </DashboardLayout>
    );
  }

  const selectedEvent = events.find(e => e.id === selectedEventId) || events[0];
  const isSelectedActive = selectedEvent ? (selectedEvent.isActive || selectedEvent.isGrandfathered) : false;
  const costCalculation = calculateEventCost(calcEventsCount);

  return (
    <DashboardLayout activeItem="subscription">
      <div className="max-w-6xl mx-auto space-y-10">
        <PageHeader
          title="Event Licenses & Billing"
          description={`Pay-per-event pricing: exactly ${formatPrice(EVENT_PRICING.pricePerEvent)} per wedding event. Every license includes 12 calendar months of full platform access, live display moderation, and guestbook storage.`}
          breadcrumbs={[
            { label: 'Workspace', onClick: () => navigate('/workspace') },
            { label: 'Event Billing' },
          ]}
        />

        {/* Success / Alert Banners */}
        {successBanner && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-start justify-between gap-3 shadow-subtle">
            <div className="flex items-center gap-2.5">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-sm font-medium">{successBanner}</div>
            </div>
            <button 
              onClick={() => setSuccessBanner(null)} 
              className="text-xs text-emerald-700 hover:text-emerald-900 underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorBanner && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start justify-between gap-3 shadow-subtle">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-sm">{errorBanner}</div>
            </div>
            <button 
              onClick={() => setErrorBanner(null)} 
              className="text-xs text-amber-700 hover:text-amber-900 underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Agency Event Metrics Overview Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#777777]">Total Events</div>
            <div className="text-2xl font-bold font-mono text-[#252525] mt-1">{metrics.totalEvents}</div>
            <p className="text-[11px] text-[#888888] mt-0.5">All registered celebrations</p>
          </div>

          <div className="p-5 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-700">Active Events</div>
            <div className="text-2xl font-bold font-mono text-emerald-800 mt-1">{metrics.activeEvents}</div>
            <p className="text-[11px] text-[#888888] mt-0.5">Licensed & live (12-month access)</p>
          </div>

          <div className="p-5 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle">
            <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700">Pending Payment</div>
            <div className="text-2xl font-bold font-mono text-amber-800 mt-1">{metrics.pendingPaymentEvents}</div>
            <p className="text-[11px] text-[#888888] mt-0.5">Checkout pending confirmation</p>
          </div>

          <div className="p-5 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#777777]">Expired Events</div>
            <div className="text-2xl font-bold font-mono text-[#777777] mt-1">{metrics.expiredEvents}</div>
            <p className="text-[11px] text-[#888888] mt-0.5">Eligible for 12M renewal</p>
          </div>
        </div>

        {/* USD $5 Pay-Per-Event Hero Showcase */}
        <div className="bg-white border border-[#E8E8E5] rounded-xl p-6 sm:p-8 shadow-card space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-[#E8E8E5] pb-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold tracking-wide uppercase font-mono">
                <Sparkles className="w-3.5 h-3.5" />
                Pay-Per-Event Launch Pricing
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif text-[#252525]">
                One Event. One Payment. {formatPrice(EVENT_PRICING.pricePerEvent)}.
              </h2>
              <p className="text-sm text-[#777777] max-w-xl leading-relaxed">
                No monthly retainers, no credit commitments, and no recurring subscriptions. 
                Register your agency for free and create draft events at zero cost. Only pay {formatPrice(EVENT_PRICING.pricePerEvent)} when you are ready to publish and go live.
              </p>
            </div>

            <div className="bg-[#FAF9F7] border border-[#E8E8E5] rounded-xl p-5 flex flex-col items-center justify-center min-w-[240px] text-center shadow-subtle">
              <div className="text-xs uppercase font-mono tracking-wider text-[#8B806F] font-semibold">EVENT LICENSE</div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-4xl font-mono font-bold text-[#252525]">{formatPrice(EVENT_PRICING.pricePerEvent)}</span>
                <span className="text-xs text-[#777777]">/ event</span>
              </div>
              <div className="text-[11px] font-medium text-emerald-800 bg-emerald-100/70 rounded px-2 py-0.5 mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-700" />
                12 Months Full Access Included
              </div>
              <div className="text-[11px] text-[#777777] mt-1.5">
                Renewal: {formatPrice(EVENT_PRICING.pricePerEvent)} per 12 months
              </div>
            </div>
          </div>

          {/* Key Features Included with Every $5 Event */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="p-4 bg-[#FAF9F7]/70 rounded-lg border border-[#EFEFEA] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#252525]">
                <Calendar className="w-4 h-4 text-[#8B806F]" />
                <span>12 Months Validity</span>
              </div>
              <p className="text-xs text-[#777777] leading-relaxed">
                Full 365 days of active access covering planning, invitations, live wedding day, and photo downloads.
              </p>
            </div>

            <div className="p-4 bg-[#FAF9F7]/70 rounded-lg border border-[#EFEFEA] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#252525]">
                <Users className="w-4 h-4 text-[#8B806F]" />
                <span>Guestbook & Photos</span>
              </div>
              <p className="text-xs text-[#777777] leading-relaxed">
                Real-time guest uploads, digital wishes, live moderation screen, and instant high-res photo wall.
              </p>
            </div>

            <div className="p-4 bg-[#FAF9F7]/70 rounded-lg border border-[#EFEFEA] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#252525]">
                <Sparkles className="w-4 h-4 text-[#8B806F]" />
                <span>Custom Art Aesthetic</span>
              </div>
              <p className="text-xs text-[#777777] leading-relaxed">
                Artisan wedding themes, matching RSVP typography, dynamic hero banners, and audio backdrop.
              </p>
            </div>

            <div className="p-4 bg-[#FAF9F7]/70 rounded-lg border border-[#EFEFEA] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#252525]">
                <Shield className="w-4 h-4 text-[#8B806F]" />
                <span>Zero Subscription Risk</span>
              </div>
              <p className="text-xs text-[#777777] leading-relaxed">
                Free agency account. No credit card required to register. Pay only for events that actually take place.
              </p>
            </div>
          </div>

          {/* Interactive Multi-Event Cost Calculator */}
          <div className="p-5 bg-[#FAF9F7] border border-[#E8E8E5] rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#8B806F]" />
                <div>
                  <h4 className="text-sm font-semibold text-[#252525]">Multi-Event Pricing Calculator</h4>
                  <p className="text-xs text-[#777777]">Transparent pricing with no hidden fees or tier surcharges</p>
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 5, 10].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCalcEventsCount(n)}
                    className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
                      calcEventsCount === n
                        ? 'bg-[#252525] text-white border-[#252525]'
                        : 'bg-white text-[#555555] border-[#D5D5D0] hover:bg-[#FAF9F7]'
                    }`}
                  >
                    {n} {n === 1 ? 'Event' : 'Events'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-[#E8E8E5]">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={calcEventsCount}
                  onChange={(e) => setCalcEventsCount(parseInt(e.target.value, 10) || 1)}
                  className="w-48 sm:w-64 accent-[#8B806F] cursor-pointer"
                />
                <span className="text-xs font-mono font-medium text-[#252525] min-w-[70px]">
                  {calcEventsCount} {calcEventsCount === 1 ? 'Event' : 'Events'}
                </span>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div className="text-xs text-[#777777]">
                  <span>{calcEventsCount} × {formatPrice(EVENT_PRICING.pricePerEvent)} = </span>
                  <strong className="text-base font-mono font-bold text-[#252525] ml-1">
                    {formatPrice(costCalculation)}
                  </strong>
                </div>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono">
                  12 Months Each
                </span>
              </div>
            </div>
          </div>

          {/* Quick Activate Bar */}
          {selectedEvent && (
            <div className="p-5 bg-white border border-[#252525]/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <div className="text-xs text-[#777777] font-mono uppercase tracking-wide">Select Event to Activate</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="text-sm bg-[#FAF9F7] border border-[#D5D5D0] rounded-md px-3 py-1.5 text-[#252525] font-semibold focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
                  >
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name || `${ev.groom_name || 'Groom'} & ${ev.bride_name || 'Bride'}`} ({ev.displayStatus || (ev.isActive ? 'active' : 'draft')})
                      </option>
                    ))}
                  </select>

                  {selectedEvent.isActive ? (
                    <Badge variant="success" size="sm">Active ({selectedEvent.daysRemaining} days left)</Badge>
                  ) : selectedEvent.displayStatus === 'pending_payment' ? (
                    <Badge variant="warning" size="sm">Pending Payment</Badge>
                  ) : selectedEvent.displayStatus === 'expired' ? (
                    <Badge variant="error" size="sm">Expired</Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">Draft / Unpaid</Badge>
                  )}
                </div>
                <div className="text-xs text-[#777777]">
                  One-time fee: <strong className="text-[#252525] font-mono">{formatPrice(EVENT_PRICING.pricePerEvent)}</strong> · Grants 12 months full platform access
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button
                  variant="primary"
                  size="md"
                  isLoading={isProcessingCheckout}
                  onClick={() => handleCheckout(selectedEvent.id)}
                  leftIcon={<CreditCard className="w-4 h-4" />}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {selectedEvent.isActive 
                    ? `Renew 12 Months (${formatPrice(EVENT_PRICING.pricePerEvent)})` 
                    : `Activate Event (${formatPrice(EVENT_PRICING.pricePerEvent)})`}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Workspace Event Licenses Table */}
        <div className="bg-white border border-[#E8E8E5] rounded-xl overflow-hidden shadow-subtle space-y-0">
          <div className="p-6 border-b border-[#E8E8E5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#252525]">Your Workspace Event Licenses</h3>
              <p className="text-xs text-[#777777] mt-0.5">
                Every event license is purchased individually for {formatPrice(EVENT_PRICING.pricePerEvent)} and tracked with its dedicated 12-month window.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/workspace')}
              leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
            >
              Open Studio Workspace
            </Button>
          </div>

          {events.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Calendar className="w-8 h-8 text-[#C5BDAC] mx-auto" />
              <div className="text-sm font-semibold text-[#252525]">No wedding events yet</div>
              <p className="text-xs text-[#777777] max-w-sm mx-auto">
                Create your first wedding event in your workspace for free as a draft. You can activate its 12-month license whenever you're ready to share.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/workspace')}
              >
                Create Free Draft Event
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F7] text-[#777777] uppercase text-[10px] tracking-wider border-b border-[#E8E8E5]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Event / Couple</th>
                    <th className="py-3 px-4 font-medium">License Fee</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Access Window (12 Mos)</th>
                    <th className="py-3 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E5] text-[#252525]">
                  {events.map((ev) => {
                    const isActive = ev.isActive || ev.isGrandfathered;
                    const days = ev.daysRemaining;
                    const status = ev.displayStatus || (isActive ? 'active' : ev.payment_status || 'draft');

                    return (
                      <tr key={ev.id} className="hover:bg-[#FAF9F7]/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-semibold text-[#252525]">
                            {ev.name || `${ev.groom_name} & ${ev.bride_name}`}
                          </div>
                          <div className="text-[11px] text-[#777777] font-mono mt-0.5">
                            /{ev.slug}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-mono font-medium text-[#252525]">{formatPrice(EVENT_PRICING.pricePerEvent)}</div>
                          <div className="text-[10px] text-[#777777]">One-time fee</div>
                        </td>

                        <td className="py-4 px-4">
                          {ev.isGrandfathered ? (
                            <Badge variant="taupe" size="sm">Legacy Pro Active</Badge>
                          ) : status === 'active' ? (
                            <div className="space-y-0.5">
                              <Badge variant="success" size="sm">Active</Badge>
                              {days !== null && days !== undefined && (
                                <div className="text-[10px] text-[#555555]">
                                  {days > 0 ? `${days} days remaining` : 'Expiring today'}
                                </div>
                              )}
                            </div>
                          ) : status === 'pending_payment' ? (
                            <Badge variant="warning" size="sm">Pending Payment</Badge>
                          ) : status === 'expired' ? (
                            <Badge variant="error" size="sm">Expired</Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">Draft / Unpaid</Badge>
                          )}
                        </td>

                        <td className="py-4 px-4 text-[#777777]">
                          {ev.expires_at ? (
                            <div>
                              <div className="text-[#252525] font-mono text-[11px]">
                                Until {new Date(ev.expires_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                              </div>
                              <div className="text-[10px] text-[#777777]">
                                Started {ev.activated_at ? new Date(ev.activated_at).toLocaleDateString() : 'N/A'}
                              </div>
                            </div>
                          ) : ev.isGrandfathered ? (
                            <div className="text-[11px] text-[#252525]">Active via Legacy Subscription</div>
                          ) : (
                            <div className="text-[11px] text-[#999999]">Activates on payment verification</div>
                          )}
                        </td>

                        <td className="py-4 px-4 text-right">
                          {isActive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedEventId(ev.id);
                                handleCheckout(ev.id);
                              }}
                              leftIcon={<RefreshCw className="w-3 h-3" />}
                            >
                              Renew 12 Mos ({formatPrice(EVENT_PRICING.pricePerEvent)})
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setSelectedEventId(ev.id);
                                handleCheckout(ev.id);
                              }}
                              leftIcon={<CreditCard className="w-3 h-3" />}
                            >
                              Activate Event ({formatPrice(EVENT_PRICING.pricePerEvent)})
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Order History Table */}
        {orders.length > 0 && (
          <div className="bg-white border border-[#E8E8E5] rounded-xl overflow-hidden shadow-subtle">
            <div className="p-6 border-b border-[#E8E8E5]">
              <h3 className="text-base font-semibold text-[#252525] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#8B806F]" />
                <span>Payment Receipts & Order History</span>
              </h3>
              <p className="text-xs text-[#777777] mt-0.5">
                Past transactions and one-time event activations for this workspace.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F7] text-[#777777] uppercase text-[10px] tracking-wider border-b border-[#E8E8E5]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Order ID</th>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Description</th>
                    <th className="py-3 px-4 font-medium">Amount</th>
                    <th className="py-3 px-4 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E5]">
                  {orders.map((ord: any) => (
                    <tr key={ord.id} className="hover:bg-[#FAF9F7]/50">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#252525]">
                        {ord.id}
                      </td>
                      <td className="py-3.5 px-4 text-[#777777]">
                        {new Date(ord.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#252525]">
                        Event License ({ord.order_type === 'renewal' ? '12M Renewal' : '12M Purchase'})
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-[#252525]">
                        ${((ord.amount || 0) / 100).toFixed(2)} {ord.currency?.toUpperCase() || 'USD'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Badge variant="success" size="sm">Completed</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-[#777777] pt-4">
          All transactions are processed authoritatively through Stripe with end-to-end 256-bit encryption. Need assistance? Contact support@eventframe.io.
        </div>
      </div>
    </DashboardLayout>
  );
}
