import Stripe from 'stripe';
import { EVENT_PRICING } from '../src/config/pricing';
import { add12CalendarMonths, isEventActive, getDaysRemaining } from '../src/lib/packages';
import { recordPlatformActivity } from './developerAdminService';

export interface ActivateEventResult {
  success: boolean;
  idempotent?: boolean;
  event: any;
  order: any;
  orderId?: string;
  activatedAt: string;
  expiresAt: string;
  isRenewal: boolean;
  message?: string;
  amountPaid: number;
  currency: string;
}

export interface BillingAuthUser {
  id: string;
  sub?: string;
  dbUserId?: string | null;
  supabaseUserId?: string | null;
  externalUserId?: string | null;
  email: string;
  name?: string;
  role?: string;
  status?: string;
  organizationId?: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANY_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value?: string | null): boolean {
  return Boolean(value && ANY_UUID_REGEX.test(String(value).trim()));
}

function isUuidSyntaxDbError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return code === '22P02' || msg.includes('invalid input syntax for type uuid');
}

function generateUuid(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // RFC4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isValidStripeKey(key?: string | null): boolean {
  return Boolean(key && (key.startsWith('sk_test_') || key.startsWith('sk_live_')));
}

function sanitizeRedirectUrl(candidate: string | undefined, fallback: string, appUrl: string): string {
  if (!candidate || typeof candidate !== 'string') return fallback;
  try {
    const allowedOrigin = new URL(appUrl).origin;
    if (candidate.startsWith('/')) {
      return `${allowedOrigin}${candidate}`;
    }
    const parsed = new URL(candidate);
    if (parsed.origin === allowedOrigin) {
      return parsed.toString();
    }
    // Also allow localhost during local development when appUrl is localhost or vice-versa only if exact host matches
    return fallback;
  } catch {
    return fallback;
  }
}

function appendQueryParam(url: string, key: string, rawValue: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${key}=${rawValue}`;
}

function isIgnorableMissingTableError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
}

/**
 * Pure helper to compute new expiration date:
 * - If currently active and unexpired, adds 12 calendar months to existing expiry date.
 * - If draft, unpaid, expired, or cancelled, adds 12 calendar months from today.
 */
export function calculateNewExpiration(currentExpiresAt: string | null | undefined): {
  newExpiration: string;
  orderType: 'purchase' | 'renewal';
  isRenewal: boolean;
} {
  const now = new Date();
  const currentExpiry = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const isAlreadyActive = currentExpiry && currentExpiry.getTime() > now.getTime();

  let expiresAtDate: Date;
  if (isAlreadyActive && currentExpiry) {
    expiresAtDate = add12CalendarMonths(currentExpiry);
    return {
      newExpiration: expiresAtDate.toISOString(),
      orderType: 'renewal',
      isRenewal: true,
    };
  } else {
    expiresAtDate = add12CalendarMonths(now);
    return {
      newExpiration: expiresAtDate.toISOString(),
      orderType: currentExpiresAt ? 'renewal' : 'purchase',
      isRenewal: !!currentExpiresAt,
    };
  }
}

/**
 * Resolves all organization (agency) records authorized for a given authenticated user.
 */
export async function resolveUserOrganizations(supabase: any, authUser: BillingAuthUser): Promise<any[]> {
  if (!supabase) return [];
  const { data: agencies, error } = await supabase.from('agencies').select('*');
  if (error) {
    throw new Error(`Failed to resolve user organizations: ${error.message}`);
  }

  const candidateIds = new Set(
    [
      authUser.id,
      authUser.sub,
      authUser.dbUserId,
      authUser.supabaseUserId,
      authUser.externalUserId,
    ]
      .filter(Boolean)
      .map((v) => String(v))
  );
  const emailLower = (authUser.email || '').trim().toLowerCase();

  return (agencies || []).filter((a: any) => {
    if (!a || a.deleted_at) return false;
    if (a.user_id && candidateIds.has(String(a.user_id))) return true;
    if (a.owner_email && emailLower && String(a.owner_email).trim().toLowerCase() === emailLower) return true;
    if (authUser.organizationId && String(a.id) === String(authUser.organizationId)) return true;
    return false;
  });
}

/**
 * Verifies authenticated user owns (or is a member of) the organization owning the target event.
 */
export async function verifyUserEventOwnership(
  supabase: any,
  authUser: BillingAuthUser | null | undefined,
  eventId: string,
  requestedAgencyId?: string | null
): Promise<
  | { ok: true; event: any; agency: any | null; authorizedAgencyIds: string[] }
  | { ok: false; statusCode: number; error: string; code: string }
> {
  if (!authUser || (!authUser.id && !authUser.sub && !authUser.email)) {
    return { ok: false, statusCode: 401, error: 'Authentication required', code: 'UNAUTHENTICATED' };
  }

  if (authUser.status === 'suspended') {
    return {
      ok: false,
      statusCode: 403,
      error: 'Account suspended. Contact support.',
      code: 'ACCOUNT_SUSPENDED',
    };
  }

  const normalizedEventId = String(eventId || '').trim();
  if (!normalizedEventId) {
    return { ok: false, statusCode: 400, error: 'eventId is required', code: 'INVALID_EVENT_ID' };
  }

  const { data: event, error: eventErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', normalizedEventId)
    .maybeSingle();

  if (eventErr) {
    if (isUuidSyntaxDbError(eventErr)) {
      return {
        ok: false,
        statusCode: 400,
        error: `Invalid eventId UUID format: ${normalizedEventId}`,
        code: 'INVALID_UUID_METADATA',
      };
    }
    return { ok: false, statusCode: 500, error: eventErr.message || 'Failed to look up event', code: 'DB_ERROR' };
  }

  if (!event || event.deleted_at) {
    return { ok: false, statusCode: 404, error: `Event not found: ${eventId}`, code: 'EVENT_NOT_FOUND' };
  }

  const userOrgs = await resolveUserOrganizations(supabase, authUser);
  const authorizedAgencyIds = userOrgs.map((a) => String(a.id));

  if (authUser.role !== 'super_admin') {
    if (!event.agency_id || !authorizedAgencyIds.includes(String(event.agency_id))) {
      return {
        ok: false,
        statusCode: 403,
        error: 'Forbidden: You cannot access or pay for an event belonging to another organization.',
        code: 'FORBIDDEN_EVENT_OWNERSHIP',
      };
    }

    if (requestedAgencyId && String(requestedAgencyId) !== String(event.agency_id)) {
      return {
        ok: false,
        statusCode: 403,
        error: 'Forbidden: Cross-organization billing request rejected.',
        code: 'FORBIDDEN_CROSS_ORG',
      };
    }
  } else if (requestedAgencyId && event.agency_id && String(requestedAgencyId) !== String(event.agency_id)) {
    return {
      ok: false,
      statusCode: 403,
      error: 'Forbidden: Target agencyId does not match event organization.',
      code: 'FORBIDDEN_CROSS_ORG',
    };
  }

  const matchedAgency = userOrgs.find((a) => String(a.id) === String(event.agency_id)) || null;
  return { ok: true, event, agency: matchedAgency, authorizedAgencyIds };
}

/**
 * Atomic event purchase/renewal activation.
 * Uses PostgreSQL RPC `complete_event_payment_order` in production when available,
 * and falls back to strict transactional TypeScript logic for in-memory mock databases in automated tests.
 */
export async function activateEventPurchase(
  supabase: any,
  params: {
    eventId: string;
    packageId?: string;
    customerId?: string;
    agencyId?: string;
    orderId?: string;
    transactionId?: string;
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    stripeChargeId?: string;
    amountPaidCents?: number;
    currency?: string;
    provider?: string;
    webhookEventId?: string | null;
  }
): Promise<ActivateEventResult> {
  const {
    eventId,
    packageId = 'standard',
    customerId = 'customer',
    agencyId,
    orderId,
    transactionId,
    stripeSessionId,
    stripePaymentIntentId,
    stripeChargeId,
    amountPaidCents,
    currency = 'usd',
    provider = 'stripe',
    webhookEventId = null,
  } = params;

  const effectiveAmount =
    amountPaidCents !== undefined ? Number(amountPaidCents) : EVENT_PRICING.priceInCents;
  const effectiveCurrency = String(currency || 'usd').toLowerCase();
  const cleanEventId = String(eventId || '').trim();
  const cleanAgencyId = agencyId ? String(agencyId).trim() || null : null;
  const cleanOrderId = orderId ? String(orderId).trim() || null : null;
  const cleanCustomerId = customerId ? String(customerId).trim() || 'customer' : 'customer';
  const effectiveSessionId = (stripeSessionId || (transactionId?.startsWith('cs_') ? transactionId : undefined))?.trim() || undefined;
  const effectivePiId = (stripePaymentIntentId || (transactionId?.startsWith('pi_') ? transactionId : undefined))?.trim() || undefined;
  const effectiveTxId = effectivePiId || effectiveSessionId || transactionId?.trim() || cleanOrderId || undefined;

  if (!cleanEventId) {
    throw new Error('Invalid eventId: eventId is required for payment activation');
  }

  if (cleanOrderId && !isValidUuid(cleanOrderId)) {
    throw new Error(`Invalid UUID metadata: orderId "${cleanOrderId}" is not a valid UUID`);
  }

  // Enforce authoritative $5.00 USD pricing unless explicit legacy migration
  if (provider !== 'legacy_migration') {
    if (effectiveAmount !== EVENT_PRICING.priceInCents) {
      throw new Error(
        `Invalid payment amount: expected ${EVENT_PRICING.priceInCents} cents ($5.00 USD), received ${effectiveAmount}`
      );
    }
    if (effectiveCurrency !== EVENT_PRICING.currency.toLowerCase()) {
      throw new Error(`Invalid payment currency: expected usd, received ${effectiveCurrency}`);
    }
  }

  // Authoritative PostgreSQL atomic RPC execution path
  if (supabase && typeof supabase.rpc === 'function') {
    const { data: rpcData, error: rpcError } = await supabase.rpc('complete_event_payment_order', {
      p_order_id: cleanOrderId,
      p_event_id: cleanEventId,
      p_agency_id: cleanAgencyId,
      p_customer_id: cleanCustomerId,
      p_stripe_session_id: effectiveSessionId || null,
      p_stripe_payment_intent_id: effectivePiId || null,
      p_stripe_charge_id: stripeChargeId?.trim() || null,
      p_amount_cents: effectiveAmount,
      p_currency: effectiveCurrency,
      p_provider: provider,
      p_webhook_event_id: webhookEventId || null,
    });

    if (rpcError) {
      throw new Error(`Atomic payment completion failed: ${rpcError.message || 'RPC error'}`);
    }

    if (!rpcData || rpcData.success !== true) {
      throw new Error(rpcData?.error || 'Atomic payment completion returned unsuccessful state');
    }

    const activatedAtIso = rpcData.activatedAt || rpcData.event?.activated_at || new Date().toISOString();
    const expiresAtIso = rpcData.expiresAt || rpcData.event?.expires_at || '';

    return {
      success: true,
      idempotent: Boolean(rpcData.idempotent),
      event: rpcData.event,
      order: rpcData.order || {
        id: rpcData.orderId || orderId,
        amount: effectiveAmount,
        currency: EVENT_PRICING.currency,
      },
      orderId: rpcData.orderId || orderId,
      activatedAt: activatedAtIso,
      expiresAt: expiresAtIso,
      isRenewal: Boolean(rpcData.isRenewal),
      amountPaid: effectiveAmount / 100,
      currency: EVENT_PRICING.currency,
      message: rpcData.idempotent
        ? 'Payment already processed (idempotent response).'
        : rpcData.isRenewal
          ? `Event extended for 12 months until ${new Date(expiresAtIso).toLocaleDateString()}`
          : `Event successfully activated with 12 months access until ${new Date(expiresAtIso).toLocaleDateString()}`,
    };
  }

  // Fallback atomic simulation path strictly for unit tests where Supabase mock omits .rpc
  const { data: event, error: fetchErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();

  if (fetchErr || !event) {
    throw new Error(`Event not found with ID ${eventId}: ${fetchErr?.message || 'Not found'}`);
  }

  if (agencyId && event.agency_id && String(event.agency_id) !== String(agencyId)) {
    throw new Error(`Ownership mismatch: event agency ${event.agency_id} does not match ${agencyId}`);
  }

  // Verify existing order if orderId supplied
  let existingOrder: any = null;
  if (orderId) {
    const { data: ordData, error: ordFetchErr } = await supabase
      .from('event_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (ordFetchErr && !isIgnorableMissingTableError(ordFetchErr)) {
      throw new Error(`Order lookup failed: ${ordFetchErr.message}`);
    }
    if (ordData) {
      if (String(ordData.event_id) !== String(eventId)) {
        throw new Error(`Order ${orderId} does not belong to event ${eventId}`);
      }
      if (agencyId && ordData.agency_id && String(ordData.agency_id) !== 'unknown' && String(ordData.agency_id) !== String(agencyId)) {
        throw new Error(`Order ${orderId} does not belong to organization ${agencyId}`);
      }
      if (ordData.stripe_session_id && effectiveSessionId && ordData.stripe_session_id !== effectiveSessionId) {
        throw new Error(`Order ${orderId} is bound to a different Stripe session`);
      }
      existingOrder = ordData;
      if (ordData.order_status === 'completed') {
        return {
          success: true,
          idempotent: true,
          event,
          order: ordData,
          orderId,
          activatedAt: event.activated_at || ordData.completed_at || ordData.updated_at,
          expiresAt: event.expires_at,
          isRenewal: ordData.order_type === 'renewal',
          message: 'Payment already completed for this order (idempotent response).',
          amountPaid: EVENT_PRICING.pricePerEvent,
          currency: EVENT_PRICING.currency,
        };
      }
    }
  }

  // Idempotency by payment transaction / session / PaymentIntent
  const { data: allPayments, error: payLookupErr } = await supabase.from('event_payments').select('*');
  if (payLookupErr && !isIgnorableMissingTableError(payLookupErr)) {
    throw new Error(`Payment idempotency check failed: ${payLookupErr.message}`);
  }
  const matchedPayment = (allPayments || []).find(
    (p: any) =>
      p &&
      ['succeeded', 'refunded', 'partially_refunded'].includes(String(p.payment_status || '').toLowerCase()) &&
      ((effectiveSessionId &&
        (p.stripe_checkout_session_id === effectiveSessionId || p.provider_transaction_id === effectiveSessionId)) ||
        (effectivePiId &&
          (p.stripe_payment_intent_id === effectivePiId || p.provider_transaction_id === effectivePiId)) ||
        (effectiveTxId && p.provider_transaction_id === effectiveTxId))
  );

  if (matchedPayment) {
    return {
      success: true,
      idempotent: true,
      event,
      order: existingOrder || { id: matchedPayment.order_id || effectiveTxId, amount: effectiveAmount, currency: 'USD' },
      orderId: matchedPayment.order_id || orderId,
      activatedAt: event.activated_at || matchedPayment.paid_at,
      expiresAt: event.expires_at,
      isRenewal: false,
      message: 'Payment already processed for this transaction (idempotent response).',
      amountPaid: EVENT_PRICING.pricePerEvent,
      currency: EVENT_PRICING.currency,
    };
  }

  const now = new Date();
  const currentExpiry = event.expires_at ? new Date(event.expires_at) : null;
  const isAlreadyActive =
    event.payment_status === 'paid' && currentExpiry !== null && currentExpiry.getTime() > now.getTime();

  const expirationCalc = calculateNewExpiration(event.expires_at);
  const activatedAtDate = isAlreadyActive && event.activated_at ? new Date(event.activated_at) : now;
  const activatedAtIso = activatedAtDate.toISOString();
  const expiresAtIso = new Date(expirationCalc.newExpiration).toISOString();
  const effectiveOrderId = existingOrder?.id || (orderId && UUID_REGEX.test(orderId) ? orderId : orderId || generateUuid());

  const orderRecord = {
    id: effectiveOrderId,
    event_id: eventId,
    agency_id: agencyId || event.agency_id || 'unknown',
    customer_id: customerId,
    package_id: packageId,
    package_snapshot: {
      id: packageId,
      name: EVENT_PRICING.name,
      price: EVENT_PRICING.pricePerEvent,
      priceInCents: EVENT_PRICING.priceInCents,
      currency: EVENT_PRICING.currency,
      durationMonths: EVENT_PRICING.validityMonths,
      billingModel: EVENT_PRICING.billingModel,
      features: EVENT_PRICING.features,
    },
    amount: effectiveAmount,
    currency: effectiveCurrency,
    order_status: 'completed',
    order_type: isAlreadyActive ? 'renewal' : event.expires_at ? 'renewal' : 'purchase',
    stripe_session_id: effectiveSessionId || existingOrder?.stripe_session_id || null,
    stripe_payment_intent_id: effectivePiId || existingOrder?.stripe_payment_intent_id || null,
    completed_at: now.toISOString(),
    webhook_status: webhookEventId ? 'processed' : existingOrder?.webhook_status || 'verified',
    last_webhook_event_id: webhookEventId || existingOrder?.last_webhook_event_id || null,
    created_at: existingOrder?.created_at || now.toISOString(),
    updated_at: now.toISOString(),
  };

  const { error: orderErr } = await supabase.from('event_orders').upsert([orderRecord]);
  if (orderErr) {
    throw new Error(`Failed to persist completed order: ${orderErr.message}`);
  }

  const { error: paymentErr } = await supabase.from('event_payments').insert([
    {
      id: generateUuid(),
      order_id: effectiveOrderId,
      event_id: eventId,
      agency_id: agencyId || event.agency_id || null,
      customer_id: customerId,
      provider,
      provider_transaction_id: effectiveTxId || effectiveOrderId,
      stripe_checkout_session_id: effectiveSessionId || null,
      stripe_payment_intent_id: effectivePiId || null,
      stripe_charge_id: stripeChargeId || null,
      amount: effectiveAmount,
      currency: effectiveCurrency,
      payment_status: 'succeeded',
      webhook_event_id: webhookEventId || null,
      webhook_status: 'processed',
      paid_at: now.toISOString(),
      created_at: now.toISOString(),
    },
  ]);
  if (paymentErr) {
    throw new Error(`Failed to persist payment record: ${paymentErr.message}`);
  }

  const { error: entErr } = await supabase.from('event_entitlements').insert([
    {
      id: generateUuid(),
      event_id: eventId,
      order_id: effectiveOrderId,
      guest_limit: 1000,
      features: EVENT_PRICING.features,
      activated_at: activatedAtIso,
      expires_at: expiresAtIso,
      status: 'active',
      created_at: now.toISOString(),
    },
  ]);
  if (entErr) {
    throw new Error(`Failed to persist event entitlement: ${entErr.message}`);
  }

  const { data: updatedEvent, error: updateErr } = await supabase
    .from('projects')
    .update({
      payment_status: 'paid',
      status: 'active',
      package_id: packageId,
      activated_at: activatedAtIso,
      expires_at: expiresAtIso,
      updated_at: now.toISOString(),
    })
    .eq('id', eventId)
    .select()
    .single();

  if (updateErr) {
    throw new Error(`Failed to activate event project: ${updateErr.message}`);
  }

  await recordPlatformActivity(supabase, {
    actorId: customerId,
    action: 'PAYMENT_COMPLETED',
    organizationId: agencyId || event.agency_id || null,
    targetEventId: eventId,
    referenceId: effectiveTxId || effectiveOrderId,
    summary: `Payment completed ($${(effectiveAmount / 100).toFixed(2)} ${EVENT_PRICING.currency}) for event "${event.name || eventId}"`,
    metadata: {
      orderId: effectiveOrderId,
      stripeSessionId: effectiveSessionId || null,
      stripePaymentIntentId: effectivePiId || null,
      amountCents: effectiveAmount,
      currency: EVENT_PRICING.currency,
      provider,
      isRenewal: isAlreadyActive,
    },
  });

  return {
    success: true,
    idempotent: false,
    event: updatedEvent,
    order: orderRecord,
    orderId: effectiveOrderId,
    activatedAt: activatedAtIso,
    expiresAt: expiresAtIso,
    isRenewal: isAlreadyActive,
    amountPaid: effectiveAmount / 100,
    currency: EVENT_PRICING.currency,
    message: isAlreadyActive
      ? `Event extended for 12 months until ${new Date(expiresAtIso).toLocaleDateString()}`
      : `Event successfully activated with 12 months access until ${new Date(expiresAtIso).toLocaleDateString()}`,
  };
}

// In-memory concurrency coalescing for rapid double-click checkout protection
const inFlightCheckoutPromises = new Map<string, Promise<any>>();

/**
 * Phase 3 & 4: Authoritative order creation + Stripe Checkout Session initialization.
 */
export async function createPayPerEventCheckout(params: {
  supabase: any;
  stripe: Stripe | null;
  stripeSecretKey?: string;
  appUrl: string;
  authUser: BillingAuthUser | null;
  body: {
    eventId?: string;
    agencyId?: string;
    packageId?: string;
    amount?: number;
    price?: number;
    priceInCents?: number;
    currency?: string;
    successUrl?: string;
    cancelUrl?: string;
    idempotencyKey?: string;
  };
}): Promise<{ statusCode: number; body: Record<string, any> }> {
  const { supabase, stripe, stripeSecretKey, appUrl, authUser, body } = params;
  const { eventId, agencyId, successUrl, cancelUrl } = body || {};

  if (!eventId) {
    return { statusCode: 400, body: { error: 'eventId is required to create a pay-per-event checkout session' } };
  }

  // Reject client-supplied pricing overrides explicitly
  if (
    (body.amount !== undefined && Number(body.amount) !== EVENT_PRICING.priceInCents && Number(body.amount) !== EVENT_PRICING.pricePerEvent) ||
    (body.price !== undefined && Number(body.price) !== EVENT_PRICING.pricePerEvent) ||
    (body.priceInCents !== undefined && Number(body.priceInCents) !== EVENT_PRICING.priceInCents) ||
    (body.currency !== undefined && String(body.currency).toLowerCase() !== 'usd')
  ) {
    return {
      statusCode: 400,
      body: {
        error: 'Client-supplied price or currency cannot override authoritative $5.00 USD billing.',
        code: 'INVALID_CLIENT_PRICING',
      },
    };
  }

  const ownership = await verifyUserEventOwnership(supabase, authUser, eventId, agencyId);
  if (ownership.ok === false) {
    return {
      statusCode: ownership.statusCode,
      body: { error: ownership.error, code: ownership.code },
    };
  }

  const event = ownership.event;
  const resolvedAgencyId = String(event.agency_id || agencyId || '');
  const customerId = String(authUser!.dbUserId || authUser!.id || authUser!.sub || authUser!.email);

  const concurrencyKey = `${customerId}:${eventId}:${body.idempotencyKey || 'default'}`;
  const existingFlight = inFlightCheckoutPromises.get(concurrencyKey);
  if (existingFlight) {
    return existingFlight;
  }

  const execPromise = (async (): Promise<{ statusCode: number; body: Record<string, any> }> => {
    const nowIso = new Date().toISOString();
    const isAlreadyActive =
      event.payment_status === 'paid' &&
      event.expires_at &&
      new Date(event.expires_at).getTime() > Date.now();
    const orderType: 'purchase' | 'renewal' = isAlreadyActive
      ? 'renewal'
      : event.expires_at
        ? 'renewal'
        : 'purchase';

    // Check if an identical pending order with an active Stripe session was created within the last 15 seconds (handles double-clicks across worker isolates)
    if (isValidStripeKey(stripeSecretKey) && stripe) {
      try {
        const { data: recentOrders } = await supabase
          .from('event_orders')
          .select('*')
          .eq('event_id', eventId)
          .eq('order_status', 'pending')
          .order('created_at', { ascending: false });

        const recentOpen = (recentOrders || []).find((o: any) => {
          if (!o || !o.stripe_session_id) return false;
          const ageMs = Date.now() - new Date(o.created_at).getTime();
          return ageMs >= 0 && ageMs < 15000 && String(o.customer_id) === customerId;
        });

        if (recentOpen?.stripe_session_id) {
          const existingSession = await stripe.checkout.sessions.retrieve(recentOpen.stripe_session_id);
          if (existingSession && existingSession.status === 'open' && existingSession.url) {
            return {
              statusCode: 200,
              body: {
                url: existingSession.url,
                sessionId: existingSession.id,
                orderId: recentOpen.id,
                status: 'pending_payment',
                deduplicated: true,
              },
            };
          }
        }
      } catch {
        // Proceed with fresh order creation if deduplication check fails
      }
    }

    // 1. Pre-create authoritative UUID order in event_orders BEFORE calling Stripe
    const orderId = generateUuid();
    const orderPayload = {
      id: orderId,
      event_id: eventId,
      agency_id: resolvedAgencyId || 'unknown',
      customer_id: customerId,
      package_id: 'standard',
      package_snapshot: {
        id: 'standard',
        name: EVENT_PRICING.name,
        price: EVENT_PRICING.pricePerEvent,
        priceInCents: EVENT_PRICING.priceInCents,
        currency: EVENT_PRICING.currency,
        durationMonths: EVENT_PRICING.validityMonths,
        billingModel: EVENT_PRICING.billingModel,
        features: EVENT_PRICING.features,
      },
      amount: EVENT_PRICING.priceInCents,
      currency: EVENT_PRICING.currency.toLowerCase(),
      order_status: 'pending',
      order_type: orderType,
      stripe_session_id: null,
      stripe_payment_intent_id: null,
      webhook_status: 'pending',
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { error: insertOrderErr } = await supabase.from('event_orders').insert([orderPayload]);
    if (insertOrderErr) {
      return {
        statusCode: 500,
        body: { error: `Failed to initialize order record: ${insertOrderErr.message}` },
      };
    }

    // Only transition unpaid/draft/failed/cancelled projects to pending_payment; never downgrade an active paid license undergoing renewal!
    if (event.payment_status !== 'paid') {
      await supabase
        .from('projects')
        .update({
          payment_status: 'pending_payment',
          status: 'pending_payment',
          updated_at: nowIso,
        })
        .eq('id', eventId);
    }

    const defaultSuccess = `${appUrl}/subscription?success=true&eventId=${encodeURIComponent(eventId)}`;
    const defaultCancel = `${appUrl}/subscription?canceled=true&eventId=${encodeURIComponent(eventId)}`;
    const baseSuccessUrl = sanitizeRedirectUrl(successUrl, defaultSuccess, appUrl);
    const baseCancelUrl = sanitizeRedirectUrl(cancelUrl, defaultCancel, appUrl);

    const effectiveSuccessUrl = appendQueryParam(
      appendQueryParam(
        baseSuccessUrl.includes('{CHECKOUT_SESSION_ID}')
          ? baseSuccessUrl
          : appendQueryParam(baseSuccessUrl, 'session_id', '{CHECKOUT_SESSION_ID}'),
        'orderId',
        encodeURIComponent(orderId)
      ),
      'eventId',
      encodeURIComponent(eventId)
    );
    const effectiveCancelUrl = appendQueryParam(baseCancelUrl, 'orderId', encodeURIComponent(orderId));

    // 2. Check Stripe configuration without simulating paid activation
    if (!stripe || !isValidStripeKey(stripeSecretKey)) {
      await supabase
        .from('event_orders')
        .update({
          order_status: 'checkout_failed',
          failure_reason: 'Stripe secret key is not configured on server',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      return {
        statusCode: 503,
        body: {
          status: 'pending_payment',
          pending: true,
          recoverable: true,
          orderId,
          eventId,
          amount: EVENT_PRICING.pricePerEvent,
          currency: EVENT_PRICING.currency,
          error: 'Payment gateway is not configured with a Stripe secret key. Order saved for retry once configured.',
        },
      };
    }

    // 3. Create authoritative one-time Stripe Checkout Session ($5.00 USD) with idempotencyKey
    try {
      const metadataPayload = {
        orderId,
        eventId: String(eventId),
        agencyId: resolvedAgencyId,
        organizationId: resolvedAgencyId,
        customerId,
        packageId: 'standard',
        amount: String(EVENT_PRICING.priceInCents),
        currency: 'usd',
        billingModel: EVENT_PRICING.billingModel,
      };

      const stripeIdempotencyKey = body.idempotencyKey
        ? `checkout_${customerId}_${eventId}_${body.idempotencyKey}`.slice(0, 250)
        : `checkout_order_${orderId}`;

      const session = await stripe.checkout.sessions.create(
        {
          payment_method_types: ['card'],
          customer_email: authUser?.email || undefined,
          client_reference_id: orderId,
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: 'EventFrame Event License',
                  description: '12 Months Full Wedding Event Access',
                },
                unit_amount: EVENT_PRICING.priceInCents, // 500 cents ($5.00 USD)
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: effectiveSuccessUrl,
          cancel_url: effectiveCancelUrl,
          metadata: metadataPayload,
          payment_intent_data: {
            metadata: metadataPayload,
          },
        },
        { idempotencyKey: stripeIdempotencyKey }
      );

      const sessionPaymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || null;

      await supabase
        .from('event_orders')
        .update({
          stripe_session_id: session.id,
          stripe_payment_intent_id: sessionPaymentIntentId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      await recordPlatformActivity(supabase, {
        actorId: customerId,
        actorEmail: authUser?.email || null,
        action: 'CHECKOUT_SESSION_CREATED',
        organizationId: resolvedAgencyId || null,
        targetEventId: eventId,
        referenceId: session.id,
        summary: `Created $5.00 USD Stripe checkout order ${orderId} for event "${event.name || eventId}"`,
        metadata: {
          orderId,
          stripeSessionId: session.id,
          orderType,
        },
      });

      return {
        statusCode: 200,
        body: {
          url: session.url,
          sessionId: session.id,
          orderId,
          status: 'pending_payment',
        },
      };
    } catch (stripeErr: any) {
      // Preserve recoverable order state so user/admin can inspect failure and retry safely
      await supabase
        .from('event_orders')
        .update({
          order_status: 'checkout_failed',
          failure_reason: stripeErr?.message || 'Stripe Checkout Session creation failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      return {
        statusCode: 502,
        body: {
          error: stripeErr?.message || 'Failed to initialize Stripe checkout session',
          orderId,
          recoverable: true,
        },
      };
    }
  })();

  inFlightCheckoutPromises.set(concurrencyKey, execPromise);
  try {
    return await execPromise;
  } finally {
    inFlightCheckoutPromises.delete(concurrencyKey);
  }
}

/**
 * Phase 2 #6: Authenticated, strict Checkout Session verification on redirect return.
 * Never trusts URL parameters directly — verifies directly with Stripe API & checks ownership, amount, currency, mode.
 */
export async function verifyAndCompleteCheckoutSession(params: {
  supabase: any;
  stripe: Stripe | null;
  stripeSecretKey?: string;
  authUser: BillingAuthUser | null;
  eventId: string;
  sessionId?: string;
}): Promise<{ statusCode: number; body: Record<string, any> }> {
  const { supabase, stripe, stripeSecretKey, authUser, eventId, sessionId } = params;

  const ownership = await verifyUserEventOwnership(supabase, authUser, eventId);
  if (ownership.ok === false) {
    return {
      statusCode: ownership.statusCode,
      body: { success: false, error: ownership.error, code: ownership.code },
    };
  }

  if (!sessionId || !sessionId.startsWith('cs_')) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: 'Valid Stripe Checkout Session ID is required for verification.',
      },
    };
  }

  if (!stripe || !isValidStripeKey(stripeSecretKey)) {
    return {
      statusCode: 503,
      body: {
        success: false,
        status: 'pending_payment',
        error: 'Stripe payment gateway is not configured on the server.',
      },
    };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
  } catch (err: any) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: `Unable to verify Stripe Checkout session: ${err?.message || 'Unknown error'}`,
      },
    };
  }

  // Validate checkout mode, status & metadata
  if (session.mode !== 'payment') {
    return {
      statusCode: 400,
      body: { success: false, error: `Invalid Stripe checkout mode: ${session.mode}` },
    };
  }

  if (session.metadata?.eventId !== eventId) {
    return {
      statusCode: 403,
      body: {
        success: false,
        error: 'Security violation: Payment session does not belong to this event.',
      },
    };
  }

  const sessionAgencyId = session.metadata?.agencyId || session.metadata?.organizationId;
  if (
    ownership.event.agency_id &&
    sessionAgencyId &&
    String(sessionAgencyId) !== String(ownership.event.agency_id)
  ) {
    return {
      statusCode: 403,
      body: {
        success: false,
        error: 'Security violation: Cross-organization checkout session mismatch.',
      },
    };
  }

  // Check currency and exact amount
  const sessionCurrency = String(session.currency || '').toLowerCase();
  if (sessionCurrency !== 'usd') {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: `Invalid payment currency: expected USD, received ${sessionCurrency.toUpperCase()}`,
      },
    };
  }

  if (session.amount_total !== EVENT_PRICING.priceInCents) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: `Payment amount mismatch: expected 500 cents ($5.00 USD), received ${session.amount_total}`,
      },
    };
  }

  const sessionOrderId = session.metadata?.orderId || session.client_reference_id || undefined;
  if (!sessionOrderId) {
    return {
      statusCode: 400,
      body: {
        success: false,
        code: 'MISSING_ORDER_METADATA',
        error: 'Missing required orderId in Stripe Checkout session metadata.',
      },
    };
  }

  if (!isValidUuid(sessionOrderId)) {
    return {
      statusCode: 400,
      body: {
        success: false,
        code: 'INVALID_UUID_METADATA',
        error: `Invalid orderId UUID format in Stripe session metadata: ${sessionOrderId}`,
      },
    };
  }

  const { data: orderRow, error: ordErr } = await supabase
    .from('event_orders')
    .select('id, event_id, agency_id, stripe_session_id, order_status')
    .eq('id', sessionOrderId)
    .maybeSingle();

  if (ordErr) {
    return {
      statusCode: isUuidSyntaxDbError(ordErr) ? 400 : 500,
      body: {
        success: false,
        error: `Order lookup failed: ${ordErr.message}`,
      },
    };
  }

  if (!orderRow) {
    return {
      statusCode: 404,
      body: {
        success: false,
        code: 'ORDER_NOT_FOUND',
        error: `Order '${sessionOrderId}' not found for Stripe Checkout session verification.`,
      },
    };
  }

  if (String(orderRow.event_id) !== String(eventId)) {
    return {
      statusCode: 403,
      body: { success: false, error: 'Security violation: Order event mismatch.' },
    };
  }

  if (
    ownership.event.agency_id &&
    orderRow.agency_id &&
    String(orderRow.agency_id) !== 'unknown' &&
    String(orderRow.agency_id) !== String(ownership.event.agency_id)
  ) {
    return {
      statusCode: 403,
      body: { success: false, error: 'Security violation: Order organization mismatch.' },
    };
  }

  if (orderRow.stripe_session_id && orderRow.stripe_session_id !== session.id) {
    return {
      statusCode: 403,
      body: {
        success: false,
        error: 'Security violation: Stripe Checkout session ID does not match order record.',
      },
    };
  }

  if (session.status === 'expired' && session.payment_status !== 'paid') {
    return {
      statusCode: 400,
      body: {
        success: false,
        expired: true,
        status: 'cancelled',
        orderId: sessionOrderId,
        error: 'Stripe Checkout session expired without payment completion. Please start a new checkout.',
      },
    };
  }

  if (session.payment_status !== 'paid') {
    return {
      statusCode: 202,
      body: {
        success: false,
        pending: true,
        status: 'pending_payment',
        paymentStatus: session.payment_status,
        orderId: sessionOrderId,
        error: `Payment not yet settled (Stripe status: ${session.payment_status}). Waiting for webhook confirmation.`,
      },
    };
  }

  const paymentIntentObj =
    session.payment_intent && typeof session.payment_intent !== 'string'
      ? (session.payment_intent as Stripe.PaymentIntent)
      : null;
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : paymentIntentObj?.id || undefined;
  const latestChargeId =
    paymentIntentObj && typeof paymentIntentObj.latest_charge === 'string'
      ? paymentIntentObj.latest_charge
      : paymentIntentObj && paymentIntentObj.latest_charge && typeof paymentIntentObj.latest_charge === 'object'
        ? (paymentIntentObj.latest_charge as Stripe.Charge).id
        : undefined;

  const result = await activateEventPurchase(supabase, {
    eventId,
    packageId: 'standard',
    customerId: String(authUser!.dbUserId || authUser!.id || session.customer || 'customer'),
    agencyId: String(ownership.event.agency_id || sessionAgencyId || ''),
    orderId: sessionOrderId,
    transactionId: paymentIntentId || session.id,
    stripeSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: latestChargeId,
    amountPaidCents: session.amount_total,
    currency: sessionCurrency,
    provider: 'stripe',
  });

  return { statusCode: 200, body: result };
}

/**
 * Cancels an uncompleted pending order cleanly when user cancels Checkout.
 */
export async function cancelCheckoutOrder(params: {
  supabase: any;
  authUser: BillingAuthUser | null;
  orderId: string;
}): Promise<{ statusCode: number; body: Record<string, any> }> {
  const { supabase, authUser, orderId } = params;
  if (!authUser) {
    return { statusCode: 401, body: { error: 'Authentication required' } };
  }

  if (!orderId || !isValidUuid(orderId)) {
    return { statusCode: 400, body: { error: 'Invalid orderId UUID format' } };
  }

  const { data: order, error: fetchErr } = await supabase
    .from('event_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (fetchErr) {
    return { statusCode: isUuidSyntaxDbError(fetchErr) ? 400 : 500, body: { error: fetchErr.message } };
  }
  if (!order) {
    return { statusCode: 404, body: { error: 'Order not found' } };
  }

  const ownership = await verifyUserEventOwnership(supabase, authUser, order.event_id, order.agency_id);
  if (ownership.ok === false) {
    return { statusCode: ownership.statusCode, body: { error: ownership.error } };
  }

  if (order.order_status !== 'pending' && order.order_status !== 'checkout_failed') {
    return {
      statusCode: 200,
      body: { success: true, order, message: `Order already in status ${order.order_status}` },
    };
  }

  const nowIso = new Date().toISOString();
  const { data: updatedOrder } = await supabase
    .from('event_orders')
    .update({
      order_status: 'cancelled',
      failure_reason: 'Checkout cancelled by user',
      updated_at: nowIso,
    })
    .eq('id', orderId)
    .select()
    .maybeSingle();

  // Only revert unpaid pending_payment project back to draft; never alter an active paid license
  if (ownership.event.payment_status === 'pending_payment') {
    await supabase
      .from('projects')
      .update({
        payment_status: 'unpaid',
        status: 'draft',
        updated_at: nowIso,
      })
      .eq('id', order.event_id);
  }

  await recordPlatformActivity(supabase, {
    actorId: authUser.dbUserId || authUser.id,
    actorEmail: authUser.email,
    action: 'CHECKOUT_CANCELLED',
    organizationId: order.agency_id,
    targetEventId: order.event_id,
    referenceId: orderId,
    summary: `Checkout cancelled by user for order ${orderId}`,
    metadata: { orderId, stripeSessionId: order.stripe_session_id },
  });

  return { statusCode: 200, body: { success: true, order: updatedOrder || order } };
}

/**
 * Atomic refund recording & policy enforcement.
 * Full refund -> revokes event entitlement & cancels event access.
 * Partial refund -> records partial refund & logs audit trail while keeping active access.
 */
export async function applyRefundToDatabase(params: {
  supabase: any;
  stripeRefundId: string;
  paymentIntentId?: string | null;
  checkoutSessionId?: string | null;
  chargeId?: string | null;
  refundAmountCents: number;
  totalChargeCents?: number | null;
  actorId?: string | null;
  actorEmail?: string | null;
  reason?: string | null;
  webhookEventId?: string | null;
}): Promise<{
  success: boolean;
  idempotent?: boolean;
  notFound?: boolean;
  paymentId?: string;
  eventId?: string;
  refundStatus?: 'full' | 'partial';
  paymentStatus?: string;
  isFullRefund?: boolean;
  entitlementRevoked?: boolean;
}> {
  const {
    supabase,
    stripeRefundId,
    paymentIntentId,
    checkoutSessionId,
    chargeId,
    refundAmountCents,
    totalChargeCents,
    actorId,
    actorEmail,
    reason,
    webhookEventId,
  } = params;

  if (supabase && typeof supabase.rpc === 'function') {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('process_stripe_refund', {
      p_stripe_refund_id: stripeRefundId,
      p_payment_intent_id: paymentIntentId || null,
      p_checkout_session_id: checkoutSessionId || null,
      p_charge_id: chargeId || null,
      p_refund_amount_cents: refundAmountCents,
      p_total_charge_cents: totalChargeCents || null,
      p_actor_id: actorId || 'stripe',
      p_actor_email: actorEmail || null,
      p_reason: reason || null,
      p_webhook_event_id: webhookEventId || null,
    });

    if (rpcErr) {
      throw new Error(`Atomic refund processing failed: ${rpcErr.message}`);
    }
    return rpcData;
  }

  // Pure JS fallback strictly for mock DB unit testing without RPC
  const { data: allPayments, error: pErr } = await supabase.from('event_payments').select('*');
  if (pErr) throw new Error(pErr.message);

  if (stripeRefundId) {
    const already = (allPayments || []).find((p: any) => p.stripe_refund_id === stripeRefundId);
    if (already) {
      return {
        success: true,
        idempotent: true,
        paymentId: already.id,
        eventId: already.event_id,
        refundStatus: already.refund_status,
        paymentStatus: already.payment_status,
      };
    }
  }

  const target = (allPayments || []).find(
    (p: any) =>
      (paymentIntentId &&
        (p.stripe_payment_intent_id === paymentIntentId || p.provider_transaction_id === paymentIntentId)) ||
      (checkoutSessionId &&
        (p.stripe_checkout_session_id === checkoutSessionId || p.provider_transaction_id === checkoutSessionId)) ||
      (chargeId && p.stripe_charge_id === chargeId)
  );

  if (!target) {
    return { success: false, notFound: true };
  }

  const effectiveTotal = Number(target.amount || totalChargeCents || EVENT_PRICING.priceInCents);
  const isFullRefund = refundAmountCents >= effectiveTotal;
  const newRefundStatus: 'full' | 'partial' = isFullRefund ? 'full' : 'partial';
  const newPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';
  const nowIso = new Date().toISOString();

  const { error: updPayErr } = await supabase
    .from('event_payments')
    .update({
      payment_status: newPaymentStatus,
      refund_status: newRefundStatus,
      refund_amount: refundAmountCents,
      refunded_at: nowIso,
      stripe_refund_id: stripeRefundId || target.stripe_refund_id || null,
      stripe_charge_id: chargeId || target.stripe_charge_id || null,
      stripe_payment_intent_id: paymentIntentId || target.stripe_payment_intent_id || null,
      webhook_event_id: webhookEventId || target.webhook_event_id || null,
    })
    .eq('id', target.id);

  if (updPayErr) throw new Error(updPayErr.message);

  if (target.order_id) {
    await supabase
      .from('event_orders')
      .update({
        refund_status: newRefundStatus,
        refund_amount: refundAmountCents,
        refunded_at: nowIso,
        order_status: isFullRefund ? 'refunded' : 'completed',
        updated_at: nowIso,
      })
      .eq('id', target.order_id);
  }

  if (isFullRefund) {
    const { data: ents } = await supabase.from('event_entitlements').select('*').eq('event_id', target.event_id);
    for (const ent of ents || []) {
      if (!target.order_id || String(ent.order_id) === String(target.order_id)) {
        await supabase
          .from('event_entitlements')
          .update({
            status: 'revoked',
            revoked_at: nowIso,
            revoked_reason: reason || 'Full Stripe refund processed',
          })
          .eq('id', ent.id);
      }
    }

    const { error: projErr } = await supabase
      .from('projects')
      .update({
        payment_status: 'refunded',
        status: 'cancelled',
        updated_at: nowIso,
      })
      .eq('id', target.event_id);
    if (projErr) throw new Error(projErr.message);
  }

  await recordPlatformActivity(supabase, {
    actorId: actorId || 'stripe',
    actorEmail: actorEmail || null,
    action: isFullRefund ? 'PAYMENT_REFUNDED' : 'PAYMENT_PARTIALLY_REFUNDED',
    organizationId: target.agency_id || null,
    targetEventId: target.event_id,
    referenceId: stripeRefundId || paymentIntentId || target.id,
    summary: `${isFullRefund ? 'Full' : 'Partial'} refund ($${(refundAmountCents / 100).toFixed(2)} USD) recorded for event ${target.event_id}`,
    metadata: {
      stripeRefundId,
      paymentIntentId: paymentIntentId || target.stripe_payment_intent_id,
      refundAmountCents,
      isFullRefund,
      reason: reason || null,
      entitlementRevoked: isFullRefund,
    },
  });

  return {
    success: true,
    idempotent: false,
    paymentId: target.id,
    eventId: target.event_id,
    refundStatus: newRefundStatus,
    paymentStatus: newPaymentStatus,
    isFullRefund,
    entitlementRevoked: isFullRefund,
  };
}

/**
 * Super Admin manual refund execution via official Stripe Refunds API.
 * Strictly resolves PaymentIntent ID cleanly (never passes Checkout Session ID to Stripe refunds API).
 */
export async function issueAdminStripeRefund(params: {
  supabase: any;
  stripe: Stripe | null;
  stripeSecretKey?: string;
  paymentId: string;
  amountCents?: number;
  reason?: string;
  adminUser: { id: string; email: string };
}): Promise<{ statusCode: number; body: Record<string, any> }> {
  const { supabase, stripe, stripeSecretKey, paymentId, amountCents, reason, adminUser } = params;

  if (!stripe || !isValidStripeKey(stripeSecretKey)) {
    return { statusCode: 503, body: { error: 'Stripe secret key is not configured on the server.' } };
  }

  const { data: payments, error: payErr } = await supabase.from('event_payments').select('*');
  if (payErr) {
    return { statusCode: 500, body: { error: payErr.message } };
  }

  const payment = (payments || []).find(
    (p: any) => String(p.id) === String(paymentId) || String(p.provider_transaction_id) === String(paymentId)
  );
  if (!payment) {
    return { statusCode: 404, body: { error: 'Payment record not found' } };
  }

  if (payment.payment_status === 'refunded' || payment.refund_status === 'full') {
    return { statusCode: 400, body: { error: 'This payment has already been fully refunded.' } };
  }

  if (!['succeeded', 'partially_refunded'].includes(String(payment.payment_status || '').toLowerCase())) {
    return {
      statusCode: 400,
      body: { error: `Cannot refund payment in status '${payment.payment_status}'.` },
    };
  }

  const totalPaidCents = Number(payment.amount || EVENT_PRICING.priceInCents);
  const alreadyRefundedCents = Number(payment.refund_amount || 0);
  const remainingRefundableCents = totalPaidCents - alreadyRefundedCents;
  const requestedRefundCents = amountCents !== undefined ? Math.round(Number(amountCents)) : remainingRefundableCents;

  if (!Number.isFinite(requestedRefundCents) || requestedRefundCents <= 0 || requestedRefundCents > remainingRefundableCents) {
    return {
      statusCode: 400,
      body: {
        error: `Invalid refund amount: must be between 1 and ${remainingRefundableCents} cents.`,
      },
    };
  }

  // Strictly obtain PaymentIntent ID (never confuse cs_... with pi_...)
  let paymentIntentId: string | null = payment.stripe_payment_intent_id || null;
  if (!paymentIntentId && payment.provider_transaction_id?.startsWith('pi_')) {
    paymentIntentId = payment.provider_transaction_id;
  }
  const sessionId =
    payment.stripe_checkout_session_id ||
    (payment.provider_transaction_id?.startsWith('cs_') ? payment.provider_transaction_id : null);

  if (!paymentIntentId && sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id || null;
  }

  if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
    return {
      statusCode: 400,
      body: { error: 'Cannot execute Stripe refund: No valid PaymentIntent ID (pi_...) associated with this payment.' },
    };
  }

  const stripeReason =
    reason === 'duplicate' || reason === 'fraudulent' || reason === 'requested_by_customer'
      ? reason
      : 'requested_by_customer';

  const refundObj = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      amount: requestedRefundCents,
      reason: stripeReason,
      metadata: {
        paymentId: String(payment.id),
        orderId: String(payment.order_id || ''),
        eventId: String(payment.event_id || ''),
        adminEmail: adminUser.email,
        auditNote: String(reason || 'Super Admin refund'),
      },
    },
    { idempotencyKey: `refund_${payment.id}_${alreadyRefundedCents + requestedRefundCents}` }
  );

  const cumulativeRefundedCents = alreadyRefundedCents + requestedRefundCents;
  const dbRes = await applyRefundToDatabase({
    supabase,
    stripeRefundId: refundObj.id,
    paymentIntentId,
    checkoutSessionId: sessionId,
    chargeId: typeof refundObj.charge === 'string' ? refundObj.charge : refundObj.charge?.id || null,
    refundAmountCents: cumulativeRefundedCents,
    totalChargeCents: totalPaidCents,
    actorId: adminUser.id,
    actorEmail: adminUser.email,
    reason: reason || 'Admin refund via Developer Console',
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      refundId: refundObj.id,
      amountRefundedCents: requestedRefundCents,
      cumulativeRefundedCents,
      refundStatus: dbRes.refundStatus,
      entitlementRevoked: dbRes.entitlementRevoked,
    },
  };
}

/**
 * Phase 5: Idempotent, strictly validated Stripe Webhook processor.
 * Never swallows DB errors — returns 500 retryable HTTP errors on DB/activation failure.
 */
export async function processStripeWebhookEvent(params: {
  supabase: any;
  stripe: Stripe | null;
  event: Stripe.Event;
  isRetry?: boolean;
}): Promise<{ statusCode: number; body: Record<string, any> }> {
  const { supabase, stripe, event, isRetry = false } = params;
  const nowIso = new Date().toISOString();

  // Extract identifiers for logging up front
  const obj = event.data?.object as any;
  const meta = obj?.metadata || {};
  let relatedOrderId: string | null = meta.orderId || obj?.client_reference_id || null;
  let relatedEventId: string | null = meta.eventId || null;
  let checkoutSessionId: string | null =
    event.type.startsWith('checkout.session.') ? obj?.id || null : null;
  let paymentIntentId: string | null =
    event.type.startsWith('payment_intent.')
      ? obj?.id || null
      : typeof obj?.payment_intent === 'string'
        ? obj.payment_intent
        : obj?.payment_intent?.id || null;

  // 1. Check webhook idempotency in stripe_webhook_events
  let existingWebhookRow: any = null;
  const { data: whRow, error: whReadErr } = await supabase
    .from('stripe_webhook_events')
    .select('*')
    .eq('id', event.id)
    .maybeSingle();

  if (whReadErr && !isIgnorableMissingTableError(whReadErr)) {
    return {
      statusCode: 500,
      body: { error: `Failed to check webhook idempotency: ${whReadErr.message}`, retryable: true },
    };
  }
  existingWebhookRow = whRow;

  if (!isRetry && existingWebhookRow && existingWebhookRow.processing_status === 'processed') {
    return {
      statusCode: 200,
      body: { received: true, duplicate: true, eventId: event.id, status: 'already_processed' },
    };
  }

  // Record processing attempt
  const nextRetryCount = existingWebhookRow ? Number(existingWebhookRow.retry_count || 0) + (isRetry ? 1 : 0) : 0;
  const { error: whUpsertErr } = await supabase.from('stripe_webhook_events').upsert([
    {
      id: event.id,
      event_type: event.type,
      processing_status: 'processing',
      related_order_id: relatedOrderId,
      related_event_id: relatedEventId,
      payment_intent_id: paymentIntentId,
      checkout_session_id: checkoutSessionId,
      payload: event as any,
      error_details: null,
      retry_count: nextRetryCount,
      received_at: existingWebhookRow?.received_at || nowIso,
      updated_at: nowIso,
    },
  ]);

  if (whUpsertErr && !isIgnorableMissingTableError(whUpsertErr)) {
    return {
      statusCode: 500,
      body: { error: `Failed to record webhook receipt: ${whUpsertErr.message}`, retryable: true },
    };
  }

  const markWebhookResult = async (
    status: 'processed' | 'failed' | 'ignored',
    errorDetails?: string | null
  ) => {
    await supabase
      .from('stripe_webhook_events')
      .update({
        processing_status: status,
        related_order_id: relatedOrderId,
        related_event_id: relatedEventId,
        payment_intent_id: paymentIntentId,
        checkout_session_id: checkoutSessionId,
        error_details: errorDetails || null,
        processed_at: status === 'processed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id);
  };

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        checkoutSessionId = session.id;
        paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || null;

        // Validate Checkout Mode
        if (session.mode !== 'payment') {
          const msg = `Invalid checkout mode '${session.mode}'; recurring subscriptions are disabled.`;
          await markWebhookResult('failed', msg);
          return { statusCode: 400, body: { error: msg } };
        }

        // Validate Metadata
        const eventId = session.metadata?.eventId;
        const orderId = session.metadata?.orderId || session.client_reference_id;
        const agencyId = session.metadata?.agencyId || session.metadata?.organizationId;
        if (!eventId || !orderId || !agencyId) {
          const msg = 'Missing required checkout metadata (eventId, orderId, or agencyId).';
          await markWebhookResult('failed', msg);
          return { statusCode: 400, body: { error: msg } };
        }
        if (!isValidUuid(orderId)) {
          const msg = `Invalid orderId UUID format in webhook metadata: '${orderId}'.`;
          await markWebhookResult('failed', msg);
          return { statusCode: 400, body: { error: msg, code: 'INVALID_UUID_METADATA' } };
        }
        relatedEventId = eventId;
        relatedOrderId = orderId;

        // Validate Exact Amount & Currency
        const currency = String(session.currency || '').toLowerCase();
        if (currency !== 'usd') {
          const msg = `Invalid currency '${currency}'; expected 'usd'.`;
          await markWebhookResult('failed', msg);
          return { statusCode: 400, body: { error: msg } };
        }
        if (session.amount_total !== EVENT_PRICING.priceInCents) {
          const msg = `Invalid payment amount ${session.amount_total}; expected ${EVENT_PRICING.priceInCents} cents ($5.00 USD).`;
          await markWebhookResult('failed', msg);
          return { statusCode: 400, body: { error: msg } };
        }

        // Validate order & event ownership in DB
        const { data: orderRow, error: ordErr } = await supabase
          .from('event_orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle();

        if (ordErr) {
          if (isUuidSyntaxDbError(ordErr)) {
            const msg = `Invalid UUID metadata while fetching order '${orderId}': ${ordErr.message}`;
            await markWebhookResult('failed', msg);
            return { statusCode: 400, body: { error: msg, code: 'INVALID_UUID_METADATA' } };
          }
          throw new Error(`Order lookup DB error: ${ordErr.message}`);
        }
        if (!orderRow) {
          const msg = `Order '${orderId}' not found for Stripe webhook verification.`;
          await markWebhookResult('failed', msg);
          return { statusCode: 400, body: { error: msg } };
        }
        if (
          String(orderRow.event_id) !== String(eventId) ||
          (orderRow.agency_id && String(orderRow.agency_id) !== 'unknown' && String(orderRow.agency_id) !== String(agencyId))
        ) {
          const msg = `Order ownership validation failed for order '${orderId}'.`;
          await markWebhookResult('failed', msg);
          return { statusCode: 400, body: { error: msg } };
        }
        if (orderRow.stripe_session_id && orderRow.stripe_session_id !== session.id) {
          const msg = `Checkout session ID '${session.id}' does not match expected order session '${orderRow.stripe_session_id}'.`;
          await markWebhookResult('failed', msg);
          return { statusCode: 400, body: { error: msg } };
        }

        const { data: projectRow, error: projErr } = await supabase
          .from('projects')
          .select('id, agency_id')
          .eq('id', eventId)
          .maybeSingle();

        if (projErr) {
          throw new Error(`Event lookup DB error: ${projErr.message}`);
        }
        if (!projectRow) {
          const msg = `Event '${eventId}' not found in database.`;
          await markWebhookResult('failed', msg);
          return { statusCode: 400, body: { error: msg } };
        }
        if (String(projectRow.agency_id) !== String(agencyId)) {
          const msg = `Event ownership mismatch: event belongs to '${projectRow.agency_id}', webhook has '${agencyId}'.`;
          await markWebhookResult('failed', msg);
          return { statusCode: 400, body: { error: msg } };
        }

        // If async payment is still unsettled during checkout.session.completed, do NOT activate yet
        if (session.payment_status !== 'paid') {
          await supabase
            .from('event_orders')
            .update({
              stripe_session_id: session.id,
              stripe_payment_intent_id: paymentIntentId,
              webhook_status: 'awaiting_async_payment',
              last_webhook_event_id: event.id,
              updated_at: nowIso,
            })
            .eq('id', orderId);
          await markWebhookResult('processed');
          return { statusCode: 200, body: { received: true, awaitingAsyncPayment: true } };
        }

        // Retrieve latest_charge ID if PaymentIntent exists & stripe client available
        let chargeId: string | undefined;
        if (paymentIntentId && stripe) {
          try {
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
            chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
          } catch {
            // Non-blocking: charge_id is optional enrichment
          }
        }

        // Atomic Activation
        await activateEventPurchase(supabase, {
          eventId,
          packageId: 'standard',
          customerId: String(orderRow.customer_id || session.customer || 'customer'),
          agencyId,
          orderId,
          transactionId: paymentIntentId || session.id,
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId || undefined,
          stripeChargeId: chargeId,
          amountPaidCents: session.amount_total,
          currency,
          provider: 'stripe',
          webhookEventId: event.id,
        });

        await markWebhookResult('processed');
        return { statusCode: 200, body: { received: true, activated: true, orderId, eventId } };
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId || session.client_reference_id;
        const eventId = session.metadata?.eventId;
        relatedOrderId = orderId || null;
        relatedEventId = eventId || null;

        if (orderId && isValidUuid(orderId)) {
          await supabase
            .from('event_orders')
            .update({
              order_status: 'failed',
              failure_reason: 'Stripe async payment failed',
              webhook_status: 'processed',
              last_webhook_event_id: event.id,
              updated_at: nowIso,
            })
            .eq('id', orderId);
        }
        if (eventId) {
          const { data: ev } = await supabase.from('projects').select('payment_status').eq('id', eventId).maybeSingle();
          if (ev && ev.payment_status !== 'paid') {
            await supabase
              .from('projects')
              .update({ payment_status: 'failed', status: 'draft', updated_at: nowIso })
              .eq('id', eventId);
          }
        }
        await recordPlatformActivity(supabase, {
          action: 'PAYMENT_FAILED',
          organizationId: session.metadata?.agencyId || null,
          targetEventId: eventId || null,
          referenceId: session.id,
          summary: `Async Stripe payment failed for session ${session.id}`,
          metadata: { orderId, eventId, webhookEventId: event.id },
        });
        await markWebhookResult('processed');
        return { statusCode: 200, body: { received: true, failedRecorded: true } };
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        paymentIntentId = pi.id;
        const orderId = pi.metadata?.orderId || null;
        const eventId = pi.metadata?.eventId || null;
        const agencyId = pi.metadata?.agencyId || pi.metadata?.organizationId || null;
        relatedOrderId = orderId;
        relatedEventId = eventId;

        const failReason = pi.last_payment_error?.message || 'Card payment failed';
        const failCode = pi.last_payment_error?.code || 'payment_failed';

        let matchedOrder: any = null;
        if (orderId && isValidUuid(orderId)) {
          const { data: ord } = await supabase.from('event_orders').select('*').eq('id', orderId).maybeSingle();
          matchedOrder = ord;
        } else {
          const { data: ordByPi } = await supabase
            .from('event_orders')
            .select('*')
            .eq('stripe_payment_intent_id', pi.id)
            .maybeSingle();
          matchedOrder = ordByPi;
        }

        const resolvedOrderId = matchedOrder?.id || orderId;
        const resolvedEventId = matchedOrder?.event_id || eventId;
        const resolvedAgencyId = matchedOrder?.agency_id || agencyId;

        if (resolvedOrderId) {
          await supabase
            .from('event_orders')
            .update({
              order_status: 'failed',
              stripe_payment_intent_id: pi.id,
              failure_reason: failReason,
              webhook_status: 'processed',
              last_webhook_event_id: event.id,
              updated_at: nowIso,
            })
            .eq('id', resolvedOrderId);
        }

        if (resolvedEventId) {
          await supabase.from('event_payments').upsert([
            {
              order_id: resolvedOrderId || null,
              event_id: resolvedEventId,
              agency_id: resolvedAgencyId,
              customer_id: matchedOrder?.customer_id || pi.metadata?.customerId || null,
              provider: 'stripe',
              provider_transaction_id: pi.id,
              stripe_payment_intent_id: pi.id,
              stripe_checkout_session_id: matchedOrder?.stripe_session_id || null,
              amount: pi.amount || EVENT_PRICING.priceInCents,
              currency: String(pi.currency || 'usd').toLowerCase(),
              payment_status: 'failed',
              failure_code: failCode,
              failure_message: failReason,
              webhook_event_id: event.id,
              webhook_status: 'processed',
              created_at: nowIso,
            },
          ]);

          const { data: ev } = await supabase
            .from('projects')
            .select('payment_status')
            .eq('id', resolvedEventId)
            .maybeSingle();
          if (ev && ev.payment_status !== 'paid') {
            await supabase
              .from('projects')
              .update({ payment_status: 'failed', status: 'draft', updated_at: nowIso })
              .eq('id', resolvedEventId);
          }
        }

        await recordPlatformActivity(supabase, {
          action: 'PAYMENT_FAILED',
          organizationId: resolvedAgencyId,
          targetEventId: resolvedEventId,
          referenceId: pi.id,
          summary: `Payment failed (${failCode}): ${failReason}`,
          metadata: { orderId: resolvedOrderId, paymentIntentId: pi.id, failCode },
        });
        await markWebhookResult('processed');
        return { statusCode: 200, body: { received: true, failedRecorded: true } };
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        paymentIntentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id || null;

        const latestRefund = charge.refunds?.data?.[0];
        const refundId =
          latestRefund?.id || `re_chg_${charge.id}_${charge.amount_refunded || charge.amount || 0}`;
        const refundAmountCents = Number(charge.amount_refunded ?? latestRefund?.amount ?? charge.amount ?? 0);

        const refundRes = await applyRefundToDatabase({
          supabase,
          stripeRefundId: refundId,
          paymentIntentId,
          chargeId: charge.id,
          refundAmountCents,
          totalChargeCents: charge.amount || EVENT_PRICING.priceInCents,
          actorId: 'stripe_webhook',
          reason: latestRefund?.reason || charge.metadata?.reason || 'Stripe charge.refunded webhook',
          webhookEventId: event.id,
        });

        relatedEventId = refundRes.eventId || relatedEventId;
        await markWebhookResult('processed');
        return { statusCode: 200, body: { received: true, ...refundRes } };
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        paymentIntentId =
          typeof dispute.payment_intent === 'string'
            ? dispute.payment_intent
            : dispute.payment_intent?.id || null;

        if (paymentIntentId) {
          const { data: pay } = await supabase
            .from('event_payments')
            .select('id, event_id, agency_id, order_id')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .maybeSingle();

          if (pay) {
            relatedEventId = pay.event_id;
            relatedOrderId = pay.order_id;
            await supabase
              .from('event_payments')
              .update({
                failure_code: `dispute:${dispute.reason || 'created'}`,
                failure_message: `Chargeback dispute opened ($${((dispute.amount || 0) / 100).toFixed(2)} USD)`,
                webhook_event_id: event.id,
              })
              .eq('id', pay.id);

            await recordPlatformActivity(supabase, {
              action: 'PAYMENT_DISPUTED',
              organizationId: pay.agency_id || null,
              targetEventId: pay.event_id,
              referenceId: dispute.id,
              summary: `Stripe dispute opened (${dispute.reason || 'unknown'}) for PaymentIntent ${paymentIntentId}`,
              metadata: {
                disputeId: dispute.id,
                paymentIntentId,
                amountCents: dispute.amount,
                status: dispute.status,
              },
            });
          }
        }
        await markWebhookResult('processed');
        return { statusCode: 200, body: { received: true, disputeRecorded: true } };
      }

      default: {
        await markWebhookResult('ignored');
        return { statusCode: 200, body: { received: true, ignored: true, type: event.type } };
      }
    }
  } catch (err: any) {
    const errMsg = err?.message || 'Database processing error during webhook execution';
    console.error(`[Stripe Webhook Error] (${event.type} / ${event.id}):`, errMsg);
    try {
      await markWebhookResult('failed', errMsg);
      if (relatedOrderId) {
        await supabase
          .from('event_orders')
          .update({
            webhook_status: 'failed',
            failure_reason: errMsg,
            last_webhook_event_id: event.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', relatedOrderId);
      }
    } catch {
      // Preserve primary 500 response
    }
    return {
      statusCode: 500,
      body: { error: errMsg, retryable: true, webhookEventId: event.id },
    };
  }
}

/**
 * Allows Super Admin to manually retry a failed/pending Stripe webhook event by
 * webhook event ID, payment ID, or order ID.
 */
export async function retryStripeWebhookByIdOrPayment(params: {
  supabase: any;
  stripe: Stripe | null;
  targetId: string;
  adminUser: { id: string; email: string };
}): Promise<{ statusCode: number; body: Record<string, any> }> {
  const { supabase, stripe, targetId, adminUser } = params;

  const { data: webhooks, error: whErr } = await supabase
    .from('stripe_webhook_events')
    .select('*')
    .order('received_at', { ascending: false });

  if (whErr) {
    return { statusCode: 500, body: { error: `Failed to read webhook store: ${whErr.message}` } };
  }

  let targetWebhook = (webhooks || []).find(
    (w: any) =>
      String(w.id) === String(targetId) ||
      String(w.related_order_id || '') === String(targetId)
  );

  // If targetId is an event_payments or event_orders ID, resolve linked webhook_event_id
  if (!targetWebhook) {
    const { data: paymentRow } = await supabase
      .from('event_payments')
      .select('id, order_id, webhook_event_id, stripe_payment_intent_id, stripe_checkout_session_id')
      .eq('id', targetId)
      .maybeSingle();

    if (paymentRow) {
      targetWebhook = (webhooks || []).find(
        (w: any) =>
          (paymentRow.webhook_event_id && String(w.id) === String(paymentRow.webhook_event_id)) ||
          (paymentRow.order_id && String(w.related_order_id || '') === String(paymentRow.order_id)) ||
          (paymentRow.stripe_payment_intent_id && String(w.payment_intent_id || '') === String(paymentRow.stripe_payment_intent_id)) ||
          (paymentRow.stripe_checkout_session_id && String(w.checkout_session_id || '') === String(paymentRow.stripe_checkout_session_id))
      );
    }
  }

  if (!targetWebhook || !targetWebhook.payload) {
    return {
      statusCode: 404,
      body: { error: 'No stored Stripe webhook payload found for this transaction to retry.' },
    };
  }

  const result = await processStripeWebhookEvent({
    supabase,
    stripe,
    event: targetWebhook.payload as Stripe.Event,
    isRetry: true,
  });

  await recordPlatformActivity(supabase, {
    actorId: adminUser.id,
    actorEmail: adminUser.email,
    actorRole: 'super_admin',
    action: 'WEBHOOK_RETRIED',
    targetEventId: targetWebhook.related_event_id || null,
    referenceId: targetWebhook.id,
    summary: `Retried Stripe webhook ${targetWebhook.id} (${targetWebhook.event_type}) -> HTTP ${result.statusCode}`,
    metadata: {
      webhookEventId: targetWebhook.id,
      eventType: targetWebhook.event_type,
      resultStatusCode: result.statusCode,
    },
  });

  return {
    statusCode: result.statusCode,
    body: {
      ...result.body,
      retriedWebhookId: targetWebhook.id,
      eventType: targetWebhook.event_type,
    },
  };
}

/**
 * Shared agency billing events + metrics endpoint payload builder.
 */
export async function getBillingEventsForUser(supabase: any, authUser: BillingAuthUser) {
  const userOrgs = await resolveUserOrganizations(supabase, authUser);
  if (userOrgs.length === 0) {
    return {
      events: [],
      agency: null,
      metrics: {
        totalEvents: 0,
        activeEvents: 0,
        pendingPaymentEvents: 0,
        expiredEvents: 0,
        totalPaidAmount: 0,
      },
      pricing: EVENT_PRICING,
    };
  }

  const primaryAgency = userOrgs[0];
  const agencyIds = new Set(userOrgs.map((a) => String(a.id)));

  const { data: allProjects, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const projects = (allProjects || []).filter(
    (p: any) => !p.deleted_at && p.agency_id && agencyIds.has(String(p.agency_id))
  );

  const now = Date.now();
  const enrichedEvents = projects.map((project: any) => {
    const ownerAgency = userOrgs.find((a) => String(a.id) === String(project.agency_id)) || primaryAgency;
    const active = isEventActive(project, ownerAgency);
    const daysRemaining = getDaysRemaining(project.expires_at);
    const isExpired = Boolean(project.expires_at && new Date(project.expires_at).getTime() <= now);

    let displayStatus = 'draft';
    if (project.payment_status === 'refunded') {
      displayStatus = 'refunded';
    } else if (active) {
      displayStatus = 'active';
    } else if (isExpired && project.payment_status === 'paid') {
      displayStatus = 'expired';
    } else if (project.payment_status === 'pending_payment') {
      displayStatus = 'pending_payment';
    } else if (project.payment_status === 'cancelled') {
      displayStatus = 'cancelled';
    } else if (project.payment_status === 'failed') {
      displayStatus = 'failed';
    }

    return {
      ...project,
      displayStatus,
      isActive: active,
      daysRemaining,
      amountPaid: project.payment_status === 'paid' ? EVENT_PRICING.pricePerEvent : 0,
      pricePerEvent: EVENT_PRICING.pricePerEvent,
      currency: EVENT_PRICING.currency,
      validityMonths: EVENT_PRICING.validityMonths,
      isGrandfathered: ownerAgency.is_demo === true || ownerAgency.subscription_status === 'active',
    };
  });

  const metrics = {
    totalEvents: enrichedEvents.length,
    activeEvents: enrichedEvents.filter((e: any) => e.isActive).length,
    pendingPaymentEvents: enrichedEvents.filter((e: any) => e.displayStatus === 'pending_payment').length,
    expiredEvents: enrichedEvents.filter((e: any) => e.displayStatus === 'expired').length,
    totalPaidAmount: enrichedEvents.reduce((acc: number, e: any) => acc + (e.amountPaid || 0), 0),
  };

  return { events: enrichedEvents, agency: primaryAgency, metrics, pricing: EVENT_PRICING };
}

/**
 * Shared agency billing order & transaction history payload builder.
 */
export async function getBillingHistoryForUser(supabase: any, authUser: BillingAuthUser) {
  const userOrgs = await resolveUserOrganizations(supabase, authUser);
  if (userOrgs.length === 0) return { orders: [], payments: [] };

  const agencyIds = new Set(userOrgs.map((a) => String(a.id)));

  const [{ data: orders, error: ordErr }, { data: payments }, { data: projects }] = await Promise.all([
    supabase.from('event_orders').select('*').order('created_at', { ascending: false }),
    supabase.from('event_payments').select('*').order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name, slug'),
  ]);

  if (ordErr && isIgnorableMissingTableError(ordErr)) {
    return { orders: [], payments: [] };
  }

  const projectMap = new Map<string, any>();
  for (const p of projects || []) {
    projectMap.set(String(p.id), p);
  }

  const paymentByOrderId = new Map<string, any>();
  for (const pay of payments || []) {
    if (pay.order_id && !paymentByOrderId.has(String(pay.order_id))) {
      paymentByOrderId.set(String(pay.order_id), pay);
    }
  }

  const scopedOrders = (orders || [])
    .filter((o: any) => o && agencyIds.has(String(o.agency_id)))
    .map((o: any) => {
      const proj = projectMap.get(String(o.event_id));
      const linkedPay = paymentByOrderId.get(String(o.id));
      return {
        ...o,
        event_name: proj?.name || `Event ${String(o.event_id || '').slice(0, 8)}`,
        event_slug: proj?.slug || null,
        payment_status: linkedPay?.payment_status || o.order_status,
        refund_status: linkedPay?.refund_status || o.refund_status || 'none',
        refund_amount: linkedPay?.refund_amount ?? o.refund_amount ?? 0,
        stripe_payment_intent_id: linkedPay?.stripe_payment_intent_id || o.stripe_payment_intent_id || null,
      };
    });

  return { orders: scopedOrders };
}
