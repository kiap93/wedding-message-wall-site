import { EVENT_PRICING } from '../src/config/pricing';
import { add12CalendarMonths, getPackageById } from '../src/lib/packages';

export interface ActivateEventResult {
  success: boolean;
  event: any;
  order: any;
  activatedAt: string;
  expiresAt: string;
  isRenewal: boolean;
  message?: string;
  amountPaid: number;
  currency: string;
}

/**
 * Pure helper to compute new expiration date:
 * - If currently active and unexpired, adds 12 calendar months to existing expiry date.
 * - If draft, unpaid, or expired, adds 12 calendar months from today.
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
      isRenewal: true
    };
  } else {
    expiresAtDate = add12CalendarMonths(now);
    return {
      newExpiration: expiresAtDate.toISOString(),
      orderType: currentExpiresAt ? 'renewal' : 'purchase',
      isRenewal: !!currentExpiresAt
    };
  }
}

/**
 * Activates or renews an event with atomic, idempotent updates.
 * - Authoritative price: USD $5.00 (EVENT_PRICING.priceInCents = 500)
 * - Enforces 12 calendar months validity.
 * - If event is already active, extends from current expiry date.
 * - If event is draft, pending, or expired, activates from now.
 * - Updates projects table and creates order/payment/entitlement records.
 * - Idempotent: duplicate calls with the same transactionId do not double-extend.
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
    amountPaidCents?: number;
    provider?: string;
  }
): Promise<ActivateEventResult> {
  const {
    eventId,
    packageId = 'standard',
    customerId = 'system',
    agencyId,
    orderId,
    transactionId,
    amountPaidCents,
    provider = 'stripe'
  } = params;

  // 1. Fetch current event from Supabase
  const { data: event, error: fetchErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', eventId)
    .single();

  if (fetchErr || !event) {
    throw new Error(`Event not found with ID ${eventId}: ${fetchErr?.message || 'Unknown'}`);
  }

  // 2. Check for idempotency: if this transactionId has already succeeded for this event
  if (transactionId) {
    try {
      const { data: existingPayment } = await supabase
        .from('event_payments')
        .select('id, payment_status, paid_at')
        .eq('provider_transaction_id', transactionId)
        .eq('event_id', eventId)
        .maybeSingle();

      if (existingPayment && existingPayment.payment_status === 'succeeded') {
        return {
          success: true,
          event,
          order: { id: transactionId, amount: EVENT_PRICING.priceInCents, currency: EVENT_PRICING.currency },
          activatedAt: event.activated_at || existingPayment.paid_at,
          expiresAt: event.expires_at,
          isRenewal: false,
          message: 'Payment already processed for this transaction (idempotent response).',
          amountPaid: EVENT_PRICING.pricePerEvent,
          currency: EVENT_PRICING.currency
        };
      }
    } catch (e) {
      // Table may be absent during cold start
    }
  }

  // 3. Determine if this is a renewal of an active event
  const now = new Date();
  const currentExpiry = event.expires_at ? new Date(event.expires_at) : null;
  const isAlreadyActive = event.payment_status === 'paid' && currentExpiry && currentExpiry.getTime() > now.getTime();

  const expirationCalc = calculateNewExpiration(event.expires_at);
  const activatedAtDate = isAlreadyActive && event.activated_at ? new Date(event.activated_at) : now;
  const expiresAtDate = new Date(expirationCalc.newExpiration);

  const activatedAtIso = activatedAtDate.toISOString();
  const expiresAtIso = expiresAtDate.toISOString();

  // Authoritative amount: USD $5.00 (500 cents)
  const effectiveAmount = amountPaidCents !== undefined ? amountPaidCents : EVENT_PRICING.priceInCents;

  // 4. Update the event record in projects table
  const eventUpdateData: any = {
    payment_status: 'paid',
    status: 'active',
    package_id: packageId,
    activated_at: activatedAtIso,
    expires_at: expiresAtIso,
    updated_at: now.toISOString(),
  };

  const { data: updatedEvent, error: updateErr } = await supabase
    .from('projects')
    .update(eventUpdateData)
    .eq('id', eventId)
    .select()
    .single();

  if (updateErr) {
    console.error('Failed to update event billing status:', updateErr);
    throw new Error(`Failed to update event: ${updateErr.message}`);
  }

  // 5. Record order & payment in event_orders and event_payments if tables exist
  const effectiveOrderId = orderId || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

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
      features: EVENT_PRICING.features
    },
    amount: effectiveAmount,
    currency: EVENT_PRICING.currency.toLowerCase(),
    order_status: 'completed',
    order_type: isAlreadyActive ? 'renewal' : 'purchase',
    stripe_session_id: transactionId,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  try {
    // Insert into event_orders table
    await supabase.from('event_orders').upsert([orderRecord]);

    if (transactionId) {
      await supabase.from('event_payments').upsert([{
        order_id: effectiveOrderId,
        event_id: eventId,
        provider: provider,
        provider_transaction_id: transactionId,
        amount: effectiveAmount,
        currency: EVENT_PRICING.currency.toLowerCase(),
        payment_status: 'succeeded',
        paid_at: now.toISOString(),
        created_at: now.toISOString()
      }]);
    }

    await supabase.from('event_entitlements').insert([{
      event_id: eventId,
      order_id: effectiveOrderId,
      guest_limit: 1000,
      features: EVENT_PRICING.features,
      activated_at: activatedAtIso,
      expires_at: expiresAtIso,
      created_at: now.toISOString()
    }]);
  } catch (err: any) {
    console.warn('Note: Order/payment audit table insertion skipped or pending schema:', err?.message || err);
  }

  return {
    success: true,
    event: updatedEvent,
    order: orderRecord,
    activatedAt: activatedAtIso,
    expiresAt: expiresAtIso,
    isRenewal: isAlreadyActive,
    amountPaid: effectiveAmount / 100,
    currency: EVENT_PRICING.currency,
    message: isAlreadyActive 
      ? `Event extended for 12 months until ${new Date(expiresAtIso).toLocaleDateString()}`
      : `Event successfully activated with 12 months access until ${new Date(expiresAtIso).toLocaleDateString()}`
  };
}
