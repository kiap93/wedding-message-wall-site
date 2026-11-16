import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  XCircle,
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

interface EnrichedEvent extends WeddingEvent {
  displayStatus?:
    | 'draft'
    | 'pending_payment'
    | 'active'
    | 'expired'
    | 'cancelled'
    | 'failed'
    | 'refunded';
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
    totalPaidAmount: 0,
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(false);
  const [isAwaitingWebhook, setIsAwaitingWebhook] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [calcEventsCount, setCalcEventsCount] = useState<number>(3);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const handledCancelOrderRef = useRef<string | null>(null);
  const handledVerifySessionRef = useRef<string | null>(null);

  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';
  const isFailed = searchParams.get('failed') === 'true';
  const returnEventId = searchParams.get('eventId');
  const sessionId = searchParams.get('session_id');
  const returnOrderId = searchParams.get('orderId');

  const loadBillingData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const eventsRes = await authenticatedFetch('/api/billing/events');
      if (eventsRes.status === 401) {
        navigate('/login?redirect=/subscription', { replace: true });
        return null;
      }
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        const eventList: EnrichedEvent[] = eventsData.events || [];
        setEvents(eventList);
        if (eventsData.metrics) {
          setMetrics(eventsData.metrics);
        }
        if (eventList.length > 0) {
          setSelectedEventId((prev) => {
            if (prev && eventList.some((e) => e.id === prev)) return prev;
            if (returnEventId && eventList.some((e) => e.id === returnEventId)) return returnEventId;
            const firstUnpaid = eventList.find((e) => !e.isActive);
            return firstUnpaid?.id || eventList[0].id;
          });
        }
      }

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
    return true;
  }, [navigate, returnEventId]);

  useEffect(() => {
    if (user) {
      loadBillingData();
    }
  }, [workspace?.id, user?.id, loadBillingData]);

  const handleVerifyReturn = useCallback(
    async (eventId: string, stripeSessionId: string) => {
      setIsVerifyingSession(true);
      setErrorBanner(null);
      try {
        const response = await authenticatedFetch(`/api/events/${encodeURIComponent(eventId)}/verify-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: stripeSessionId }),
        });

        if (response.status === 401) {
          navigate('/login?redirect=/subscription', { replace: true });
          return 'auth_required';
        }

        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success) {
          setIsAwaitingWebhook(false);
          setSuccessBanner(
            data.message ||
              `Payment verified! Your event now has ${EVENT_PRICING.validityMonths} months of full access.`
          );
          await loadBillingData();
          return 'verified';
        }

        if (response.status === 202 || data.pending) {
          setIsAwaitingWebhook(true);
          await loadBillingData();
          return 'pending';
        }

        setIsAwaitingWebhook(false);
        setErrorBanner(data.error || 'Payment verification failed. Contact support@eventframe.io if charged.');
        await loadBillingData();
        return 'error';
      } catch (err: any) {
        console.error('Session verification error:', err);
        setIsAwaitingWebhook(true);
        setErrorBanner('Verification check interrupted. Click Re-check Confirmation to poll latest Stripe status.');
        await loadBillingData();
        return 'pending';
      } finally {
        setIsVerifyingSession(false);
      }
    },
    [loadBillingData, navigate]
  );

  // Handle return from Stripe Checkout (?success=true, ?canceled=true, ?failed=true)
  useEffect(() => {
    if (!user) return;

    if (isSuccess && returnEventId) {
      if (sessionId && sessionId.startsWith('cs_')) {
        if (handledVerifySessionRef.current === sessionId) return;
        handledVerifySessionRef.current = sessionId;

        let cancelled = false;
        (async () => {
          const status = await handleVerifyReturn(returnEventId, sessionId);
          // Poll up to 5 times if payment confirmation is still asynchronously settling
          if (status === 'pending' && !cancelled) {
            for (let attempt = 0; attempt < 5; attempt++) {
              await new Promise((r) => setTimeout(r, 2500));
              if (cancelled) break;
              const nextStatus = await handleVerifyReturn(returnEventId, sessionId);
              if (nextStatus !== 'pending') break;
            }
          }
        })();

        return () => {
          cancelled = true;
        };
      } else {
        setErrorBanner('Missing verified Stripe session ID. Only webhook-verified transactions can activate an event.');
        loadBillingData();
      }
    } else if (isCanceled) {
      setErrorBanner('Payment was cancelled before completion. Any existing active license remains untouched.');
      if (returnOrderId && handledCancelOrderRef.current !== returnOrderId) {
        handledCancelOrderRef.current = returnOrderId;
        authenticatedFetch(`/api/billing/orders/${encodeURIComponent(returnOrderId)}/cancel`, {
          method: 'POST',
        })
          .then(() => loadBillingData())
          .catch(() => loadBillingData());
      }
    } else if (isFailed) {
      setErrorBanner('Payment did not succeed. Please retry with a valid payment method.');
    }
  }, [user, isSuccess, isCanceled, isFailed, returnEventId, sessionId, returnOrderId, handleVerifyReturn, loadBillingData]);

  const handleCheckout = async (targetEventId: string) => {
    if (isProcessingCheckout) return;
    setIsProcessingCheckout(true);
    setErrorBanner(null);
    setSuccessBanner(null);

    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const response = await authenticatedFetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: targetEventId,
          agencyId: workspace?.id,
          idempotencyKey,
          successUrl: `${window.location.origin}/subscription?success=true&eventId=${targetEventId}`,
          cancelUrl: `${window.location.origin}/subscription?canceled=true&eventId=${targetEventId}`,
        }),
      });

      if (response.status === 401) {
        navigate('/login?redirect=/subscription', { replace: true });
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      } else if (data.pending) {
        setErrorBanner(
          data.error ||
            'Payment gateway configuration pending. Order saved; event remains awaiting confirmed Stripe payment.'
        );
        loadBillingData();
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorBanner(err.message || 'Error redirecting to Stripe Checkout. Please try again.');
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

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];
  const costCalculation = calculateEventCost(calcEventsCount);

  return (
    <DashboardLayout activeItem="subscription">
      <div className="max-w-6xl mx-auto space-y-10">
        <PageHeader
          title="Event Licenses & Billing"
          description={`Pay-per-event pricing: ${formatPrice(EVENT_PRICING.pricePerEvent)} USD one-time per wedding event. Every license grants 12 calendar months of full access without recurring subscriptions.`}
          breadcrumbs={[
            { label: 'Workspace', onClick: () => navigate('/workspace') },
            { label: 'Event Billing' },
          ]}
        />

        {/* Processing / Awaiting Webhook Confirmation Banner */}
        {(isVerifyingSession || isAwaitingWebhook) && (
          <div className="p-4 bg-white border border-[#D5D5D0] rounded-lg text-[#252525] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-[#8B806F] shrink-0" />
              <span>
                {isVerifyingSession
                  ? 'Verifying Stripe Checkout session with payment server...'
                  : 'Payment processing: waiting for asynchronous Stripe webhook confirmation before activating license.'}
              </span>
            </div>
            {returnEventId && sessionId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleVerifyReturn(returnEventId, sessionId)}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Re-check Confirmation
              </Button>
            )}
          </div>
        )}

        {/* Success / Error / Cancelled Banners */}
        {successBanner && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-start justify-between gap-3">
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
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start justify-between gap-3">
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
          <div className="p-5 bg-white border border-[#E8E8E5] rounded-lg">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#777777]">Total Events</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#252525] mt-1">{metrics.totalEvents}</div>
            <p className="text-[11px] text-[#888888] mt-0.5">All registered celebrations</p>
          </div>

          <div className="p-5 bg-white border border-[#E8E8E5] rounded-lg">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-700">Active Events</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-800 mt-1">{metrics.activeEvents}</div>
            <p className="text-[11px] text-[#888888] mt-0.5">Licensed & live (12-month access)</p>
          </div>

          <div className="p-5 bg-white border border-[#E8E8E5] rounded-lg">
            <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700">Pending Payment</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-800 mt-1">{metrics.pendingPaymentEvents}</div>
            <p className="text-[11px] text-[#888888] mt-0.5">Awaiting Stripe confirmation</p>
          </div>

          <div className="p-5 bg-white border border-[#E8E8E5] rounded-lg">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#777777]">Expired Events</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#777777] mt-1">{metrics.expiredEvents}</div>
            <p className="text-[11px] text-[#888888] mt-0.5">Eligible for 12M renewal</p>
          </div>
        </div>

        {/* USD $5 Pay-Per-Event Summary */}
        <div className="bg-white border border-[#E8E8E5] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-[#E8E8E5] pb-6">
            <div className="space-y-2">
              <div className="text-xs font-semibold tracking-wider uppercase font-mono text-[#8B806F]">
                Pay-Per-Event Licensing
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif text-[#252525]">
                One Event. One Payment. {formatPrice(EVENT_PRICING.pricePerEvent)} USD.
              </h2>
              <p className="text-sm text-[#777777] max-w-xl leading-relaxed">
                Free agency registration with unlimited draft events. Only pay {formatPrice(EVENT_PRICING.pricePerEvent)}{' '}
                USD per live event—no monthly retainers or automatic recurring charges.
              </p>
            </div>

            <div className="bg-[#FAF9F7] border border-[#E8E8E5] rounded-xl p-5 flex flex-col items-center justify-center min-w-[240px] text-center">
              <div className="text-xs uppercase font-mono tracking-wider text-[#8B806F] font-semibold">
                EVENT LICENSE
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-4xl font-mono font-bold tabular-nums text-[#252525]">
                  {formatPrice(EVENT_PRICING.pricePerEvent)}
                </span>
                <span className="text-xs text-[#777777]">USD / event</span>
              </div>
              <div className="text-[11px] font-medium text-emerald-800 mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-700" />
                12 Calendar Months Validity
              </div>
              <div className="text-[11px] text-[#777777] mt-1">
                Renewal: {formatPrice(EVENT_PRICING.pricePerEvent)} USD per 12 months
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="p-4 bg-[#FAF9F7]/70 rounded-lg border border-[#EFEFEA] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#252525]">
                <Calendar className="w-4 h-4 text-[#8B806F]" />
                <span>12 Months Validity</span>
              </div>
              <p className="text-xs text-[#777777] leading-relaxed">
                Full 12 calendar months covering planning, invitations, live reception display, and downloads.
              </p>
            </div>

            <div className="p-4 bg-[#FAF9F7]/70 rounded-lg border border-[#EFEFEA] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#252525]">
                <Users className="w-4 h-4 text-[#8B806F]" />
                <span>Guestbook & Photos</span>
              </div>
              <p className="text-xs text-[#777777] leading-relaxed">
                Real-time guest uploads, digital wishes, live Danmaku wall, and high-res photo collection.
              </p>
            </div>

            <div className="p-4 bg-[#FAF9F7]/70 rounded-lg border border-[#EFEFEA] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#252525]">
                <Sparkles className="w-4 h-4 text-[#8B806F]" />
                <span>Custom Event Suite</span>
              </div>
              <p className="text-xs text-[#777777] leading-relaxed">
                Curated wedding templates, multilingual guest pages, interactive RSVP, and seating charts.
              </p>
            </div>

            <div className="p-4 bg-[#FAF9F7]/70 rounded-lg border border-[#EFEFEA] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#252525]">
                <Shield className="w-4 h-4 text-[#8B806F]" />
                <span>No Subscriptions</span>
              </div>
              <p className="text-xs text-[#777777] leading-relaxed">
                One-time Stripe Checkout per wedding. Early renewals append 12 months on top of remaining days.
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
                  <p className="text-xs text-[#777777]">Transparent linear USD pricing across events</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 5, 10].map((n) => (
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
                <span className="text-xs font-mono font-medium tabular-nums text-[#252525] min-w-[70px]">
                  {calcEventsCount} {calcEventsCount === 1 ? 'Event' : 'Events'}
                </span>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div className="text-xs text-[#777777]">
                  <span>{calcEventsCount} × {formatPrice(EVENT_PRICING.pricePerEvent)} USD = </span>
                  <strong className="text-base font-mono font-bold tabular-nums text-[#252525] ml-1">
                    {formatPrice(costCalculation)} USD
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Activate Bar */}
          {selectedEvent && (
            <div className="p-5 bg-white border border-[#D5D5D0] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs text-[#777777] font-mono uppercase tracking-wide">
                  Select Event to Activate or Renew
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="text-sm bg-[#FAF9F7] border border-[#D5D5D0] rounded-md px-3 py-1.5 text-[#252525] font-semibold focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name || `${ev.groom_name || 'Groom'} & ${ev.bride_name || 'Bride'}`} (
                        {ev.displayStatus || (ev.isActive ? 'active' : 'draft')})
                      </option>
                    ))}
                  </select>

                  {selectedEvent.isActive ? (
                    <Badge variant="success" size="sm">
                      Active ({selectedEvent.daysRemaining} days left)
                    </Badge>
                  ) : selectedEvent.displayStatus === 'refunded' ? (
                    <Badge variant="error" size="sm">Refunded (Revoked)</Badge>
                  ) : selectedEvent.displayStatus === 'failed' ? (
                    <Badge variant="error" size="sm">Payment Failed</Badge>
                  ) : selectedEvent.displayStatus === 'pending_payment' ? (
                    <Badge variant="warning" size="sm">Pending Payment</Badge>
                  ) : selectedEvent.displayStatus === 'expired' ? (
                    <Badge variant="error" size="sm">Expired</Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">Draft / Unpaid</Badge>
                  )}
                </div>
                <div className="text-xs text-[#777777]">
                  One-time fee:{' '}
                  <strong className="text-[#252525] font-mono">{formatPrice(EVENT_PRICING.pricePerEvent)} USD</strong>{' '}
                  · {selectedEvent.isActive ? 'Extends expiry by +12 months' : 'Grants 12 months access upon Stripe verification'}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button
                  variant="primary"
                  size="md"
                  isLoading={isProcessingCheckout}
                  disabled={isProcessingCheckout}
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
        <div className="bg-white border border-[#E8E8E5] rounded-xl overflow-hidden">
          <div className="p-6 border-b border-[#E8E8E5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#252525]">Your Workspace Event Licenses</h3>
              <p className="text-xs text-[#777777] mt-0.5">
                Each wedding event holds an independent 12-month license window.
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
                Create your first wedding event in your workspace as a free draft, then activate its 12-month license whenever ready.
              </p>
              <Button variant="primary" size="sm" onClick={() => navigate('/workspace')}>
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
                          <div className="text-[11px] text-[#777777] font-mono mt-0.5">/{ev.slug}</div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-mono font-medium tabular-nums text-[#252525]">
                            {formatPrice(EVENT_PRICING.pricePerEvent)} USD
                          </div>
                          <div className="text-[10px] text-[#777777]">One-time payment</div>
                        </td>

                        <td className="py-4 px-4">
                          {ev.isGrandfathered ? (
                            <Badge variant="taupe" size="sm">Legacy Pro Active</Badge>
                          ) : status === 'active' ? (
                            <div className="space-y-0.5">
                              <Badge variant="success" size="sm">Active</Badge>
                              {days !== null && days !== undefined && (
                                <div className="text-[10px] text-[#555555] tabular-nums">
                                  {days > 0 ? `${days} days remaining` : 'Expiring today'}
                                </div>
                              )}
                            </div>
                          ) : status === 'refunded' ? (
                            <Badge variant="error" size="sm">Refunded</Badge>
                          ) : status === 'failed' ? (
                            <Badge variant="error" size="sm">Failed</Badge>
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
                              <div className="text-[#252525] font-mono text-[11px] tabular-nums">
                                Expires {new Date(ev.expires_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                              </div>
                              <div className="text-[10px] text-[#777777] tabular-nums">
                                Activated {ev.activated_at ? new Date(ev.activated_at).toLocaleDateString() : 'N/A'}
                              </div>
                            </div>
                          ) : ev.isGrandfathered ? (
                            <div className="text-[11px] text-[#252525]">Active via Legacy Subscription</div>
                          ) : (
                            <div className="text-[11px] text-[#999999]">Activates on Stripe verification</div>
                          )}
                        </td>

                        <td className="py-4 px-4 text-right">
                          <Button
                            variant={isActive ? 'outline' : 'primary'}
                            size="sm"
                            disabled={isProcessingCheckout}
                            onClick={() => {
                              setSelectedEventId(ev.id);
                              handleCheckout(ev.id);
                            }}
                            leftIcon={isActive ? <RefreshCw className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                          >
                            {isActive
                              ? `Renew 12 Mos (${formatPrice(EVENT_PRICING.pricePerEvent)})`
                              : status === 'failed'
                                ? `Retry Payment (${formatPrice(EVENT_PRICING.pricePerEvent)})`
                                : `Activate Event (${formatPrice(EVENT_PRICING.pricePerEvent)})`}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Order & Payment Receipt History */}
        {orders.length > 0 && (
          <div className="bg-white border border-[#E8E8E5] rounded-xl overflow-hidden">
            <div className="p-6 border-b border-[#E8E8E5]">
              <h3 className="text-base font-semibold text-[#252525] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#8B806F]" />
                <span>Payment Receipts & Order History</span>
              </h3>
              <p className="text-xs text-[#777777] mt-0.5">
                Authoritative Stripe Checkout orders, payment IDs, and refund statuses for this workspace.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F7] text-[#777777] uppercase text-[10px] tracking-wider border-b border-[#E8E8E5]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Order / Payment ID</th>
                    <th className="py-3 px-4 font-medium">Event</th>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">License Type</th>
                    <th className="py-3 px-4 font-medium">Amount</th>
                    <th className="py-3 px-4 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E5]">
                  {orders.map((ord: any) => {
                    const ordStatus = String(ord.payment_status || ord.order_status || 'pending').toLowerCase();
                    const statusVariant =
                      ordStatus === 'succeeded' || ordStatus === 'completed'
                        ? 'success'
                        : ordStatus === 'failed' || ordStatus === 'checkout_failed' || ordStatus === 'refunded'
                          ? 'error'
                          : ordStatus === 'partially_refunded' || ordStatus === 'pending'
                            ? 'warning'
                            : 'neutral';

                    return (
                      <tr key={ord.id} className="hover:bg-[#FAF9F7]/50">
                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#252525]">
                          <div>{ord.id}</div>
                          {(ord.stripe_payment_intent_id || ord.stripe_session_id) && (
                            <div className="text-[10px] text-[#777777]">
                              {ord.stripe_payment_intent_id || ord.stripe_session_id}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#252525]">
                          {ord.event_name || ord.event_id}
                        </td>
                        <td className="py-3.5 px-4 text-[#777777] tabular-nums">
                          {new Date(ord.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-[#252525]">
                          Event License ({ord.order_type === 'renewal' ? '12M Renewal' : '12M Purchase'})
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium tabular-nums text-[#252525]">
                          ${((ord.amount || 0) / 100).toFixed(2)} {ord.currency?.toUpperCase() || 'USD'}
                          {Number(ord.refund_amount || 0) > 0 && (
                            <div className="text-[10px] text-amber-700">
                              Refunded: ${(Number(ord.refund_amount) / 100).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Badge variant={statusVariant as any} size="sm">
                            {ordStatus.replace(/_/g, ' ')}
                          </Badge>
                          {ord.failure_reason && (
                            <div className="text-[10px] text-red-700 mt-1 inline-flex items-center gap-1">
                              <XCircle className="w-3 h-3 shrink-0" />
                              <span>{ord.failure_reason}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-[#777777] pt-4">
          All payments are processed and verified server-side via Stripe Checkout. Need help? Contact support@eventframe.io.
        </div>
      </div>
    </DashboardLayout>
  );
}
