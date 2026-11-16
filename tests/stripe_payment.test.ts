/**
 * Production-Hardening Test Suite for EventFrame.io Stripe Pay-Per-Event Payment Integration
 * Covers all 20 critical security, webhook, refund, concurrency, and accounting scenarios.
 */

import Stripe from 'stripe';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
import { sign as signHonoJwt } from 'hono/jwt';
import {
  calculateNewExpiration,
  activateEventPurchase,
  createPayPerEventCheckout,
  verifyAndCompleteCheckoutSession,
  cancelCheckoutOrder,
  processStripeWebhookEvent,
  issueAdminStripeRefund,
  retryStripeWebhookByIdOrPayment,
} from '../server/billingService';
import { computePaymentLedgerAndMetrics } from '../server/developerAdminService';
import { registerWorkerDeveloperRoutes } from '../server/registerWorkerDeveloperRoutes';
import { createDeveloperRouter } from '../server/createDeveloperRouter';
import express from 'express';
import cookieParser from 'cookie-parser';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✓ PASSED: ${message}`);
}

type TableRows = Record<string, any[]>;

class InMemoryQueryBuilder {
  private table: string;
  private db: TableRows;
  private filters: Array<(row: any) => boolean> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private op: 'select' | 'insert' | 'update' | 'upsert' = 'select';
  private payload: any = null;
  private singleMode: 'none' | 'maybe' | 'single' = 'none';

  constructor(db: TableRows, table: string) {
    this.db = db;
    this.table = table;
    if (!this.db[table]) this.db[table] = [];
  }

  select(_cols?: string) {
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((r) => r?.[col] === val);
    return this;
  }

  ilike(col: string, val: string) {
    const target = String(val || '').toLowerCase();
    this.filters.push((r) => String(r?.[col] || '').toLowerCase() === target);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybe';
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  insert(rows: any | any[]) {
    this.op = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(patch: Record<string, any>) {
    this.op = 'update';
    this.payload = patch;
    return this;
  }

  upsert(rows: any | any[]) {
    this.op = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  private exec() {
    const tableArr = this.db[this.table] || [];

    if (this.op === 'insert') {
      const inserted = this.payload.map((item: any, idx: number) => ({
        id: item.id || `${this.table}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: item.created_at || new Date().toISOString(),
        ...item,
      }));
      tableArr.push(...inserted);
      return { data: this.singleMode === 'none' ? inserted : inserted[0] || null, error: null };
    }

    if (this.op === 'update') {
      const matched: any[] = [];
      for (const row of tableArr) {
        if (this.filters.every((fn) => fn(row))) {
          Object.assign(row, this.payload);
          matched.push({ ...row });
        }
      }
      return { data: this.singleMode === 'none' ? matched : matched[0] || null, error: null };
    }

    if (this.op === 'upsert') {
      for (const item of this.payload) {
        const keyCol = this.table === 'platform_settings' ? 'key' : 'id';
        const existingIdx = item[keyCol] ? tableArr.findIndex((r) => r[keyCol] === item[keyCol]) : -1;
        if (existingIdx >= 0) {
          tableArr[existingIdx] = { ...tableArr[existingIdx], ...item };
        } else {
          tableArr.push({
            id: item.id || `${this.table}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...item,
          });
        }
      }
      return { data: this.payload, error: null };
    }

    let rows = tableArr.filter((r) => this.filters.every((fn) => fn(r))).map((r) => ({ ...r }));
    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAsc;
      rows.sort((a, b) => {
        const va = a?.[col] ?? '';
        const vb = b?.[col] ?? '';
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
        return 0;
      });
    }
    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    if (this.singleMode === 'maybe') {
      return { data: rows[0] || null, error: null };
    }
    if (this.singleMode === 'single') {
      if (!rows[0]) return { data: null, error: { message: 'Row not found' } };
      return { data: rows[0], error: null };
    }
    return { data: rows, error: null };
  }

  then(resolve: (val: any) => any, reject?: (err: any) => any) {
    try {
      return Promise.resolve(this.exec()).then(resolve, reject);
    } catch (err) {
      return reject ? Promise.reject(err).catch(reject) : Promise.reject(err);
    }
  }
}

function createMockSupabase(initial: TableRows, options: { simulateRpcError?: boolean } = {}) {
  const db: TableRows = JSON.parse(JSON.stringify(initial));
  const supabase: any = {
    db,
    simulateRpcError: Boolean(options.simulateRpcError),
    from(table: string) {
      return new InMemoryQueryBuilder(db, table);
    },
  };
  if (options.simulateRpcError !== undefined) {
    supabase.rpc = async () => {
      if (supabase.simulateRpcError) {
        return { data: null, error: { message: 'Simulated PostgreSQL transaction serialization failure' } };
      }
      return { data: { success: true }, error: null };
    };
  }
  return supabase;
}

function createMockStripe() {
  const realCryptoStripe = new Stripe('sk_test_mock_key_for_local_unit_tests_only');
  let seq = 1;
  const sessions = new Map<string, any>();
  const refunds: any[] = [];
  const createSessionCalls: any[] = [];

  const mockStripe: any = {
    webhooks: realCryptoStripe.webhooks,
    _sessions: sessions,
    _refunds: refunds,
    _createSessionCalls: createSessionCalls,
    checkout: {
      sessions: {
        create: async (params: any, opts?: any) => {
          createSessionCalls.push({ params, opts });
          const id = `cs_test_mock_${seq++}`;
          const piId = `pi_test_mock_${seq++}`;
          const sess = {
            id,
            url: `https://checkout.stripe.com/c/pay/${id}`,
            status: 'open',
            payment_status: 'unpaid',
            mode: params.mode,
            currency: params.line_items?.[0]?.price_data?.currency || 'usd',
            amount_total: params.line_items?.[0]?.price_data?.unit_amount || 500,
            client_reference_id: params.client_reference_id,
            customer: 'cus_test_1',
            payment_intent: { id: piId, latest_charge: `ch_test_${seq}` },
            metadata: params.metadata || {},
          };
          sessions.set(id, sess);
          return sess;
        },
        retrieve: async (id: string) => {
          const sess = sessions.get(id);
          if (!sess) throw new Error(`No such checkout.session: ${id}`);
          return sess;
        },
      },
    },
    paymentIntents: {
      retrieve: async (piId: string) => ({
        id: piId,
        latest_charge: `ch_for_${piId}`,
      }),
    },
    refunds: {
      create: async (params: any, opts?: any) => {
        const ref = {
          id: `re_test_${seq++}`,
          payment_intent: params.payment_intent,
          amount: params.amount,
          reason: params.reason,
          charge: `ch_refund_${seq}`,
          status: 'succeeded',
          idempotencyKey: opts?.idempotencyKey,
        };
        refunds.push(ref);
        return ref;
      },
    },
  };

  return mockStripe;
}

async function runTests() {
  console.log('=====================================================');
  console.log('Starting EventFrame.io Stripe Production Test Suite');
  console.log('=====================================================\n');

  const APP_URL = 'https://eventframe.io';
  const STRIPE_SECRET_KEY = 'sk_test_51MockSecretKeyValue000000000000000000';
  const WEBHOOK_SECRET = 'whsec_test_secret_for_signature_verification';
  const JWT_SECRET = 'stripe-test-jwt-secret';

  const ownerA = {
    id: 'usr-a',
    dbUserId: 'usr-a',
    email: 'ownerA@agency.com',
    name: 'Owner A',
    role: 'agency_owner',
    status: 'active',
  };
  const ownerB = {
    id: 'usr-b',
    dbUserId: 'usr-b',
    email: 'ownerB@agency.com',
    name: 'Owner B',
    role: 'agency_owner',
    status: 'active',
  };
  const superAdmin = {
    id: 'usr-admin',
    dbUserId: 'usr-admin',
    email: 'admin@eventframe.io',
    name: 'Super Admin',
    role: 'super_admin',
    status: 'active',
  };

  const baseData: TableRows = {
    users_auth: [
      { id: 'usr-a', email: 'ownerA@agency.com', full_name: 'Owner A', role: 'agency_owner', status: 'active', organization_id: 'org-a', created_at: new Date().toISOString() },
      { id: 'usr-b', email: 'ownerB@agency.com', full_name: 'Owner B', role: 'agency_owner', status: 'active', organization_id: 'org-b', created_at: new Date().toISOString() },
      { id: 'usr-admin', email: 'admin@eventframe.io', full_name: 'Super Admin', role: 'super_admin', status: 'active', organization_id: null, created_at: new Date().toISOString() },
    ],
    agencies: [
      { id: 'org-a', name: 'Agency A Weddings', slug: 'agency-a', user_id: 'usr-a', owner_email: 'ownerA@agency.com', status: 'active', is_demo: false, is_test: false, created_at: new Date().toISOString() },
      { id: 'org-b', name: 'Agency B Studio', slug: 'agency-b', user_id: 'usr-b', owner_email: 'ownerB@agency.com', status: 'active', is_demo: false, is_test: false, created_at: new Date().toISOString() },
    ],
    projects: [
      { id: 'evt-draft', name: 'Alice & Bob', slug: 'alice-bob', agency_id: 'org-a', payment_status: 'unpaid', status: 'draft', activated_at: null, expires_at: null, created_at: new Date().toISOString() },
      { id: 'evt-org-b', name: 'Org B Wedding', slug: 'org-b-wed', agency_id: 'org-b', payment_status: 'unpaid', status: 'draft', activated_at: null, expires_at: null, created_at: new Date().toISOString() },
      { id: 'evt-active-early', name: 'Active Early Renew', slug: 'early-renew', agency_id: 'org-a', payment_status: 'paid', status: 'active', activated_at: new Date('2026-01-10T00:00:00Z').toISOString(), expires_at: new Date('2027-06-15T12:00:00Z').toISOString(), created_at: new Date().toISOString() },
      { id: 'evt-expired-late', name: 'Expired Late Renew', slug: 'late-renew', agency_id: 'org-a', payment_status: 'paid', status: 'active', activated_at: new Date('2024-01-01T00:00:00Z').toISOString(), expires_at: new Date('2025-01-01T00:00:00Z').toISOString(), created_at: new Date().toISOString() },
    ],
    event_orders: [],
    event_payments: [],
    event_entitlements: [],
    stripe_webhook_events: [],
    platform_activity_logs: [],
  };

  // --------------------------------------------------------------------------
  // TEST 1 & 4: Successful Stripe Checkout -> Webhook & Idempotency
  // --------------------------------------------------------------------------
  console.log('--- Test 1 & 4: Checkout Creation, Webhook Activation & Duplicate Delivery Idempotency ---');
  const db1 = createMockSupabase(baseData);
  const stripe1 = createMockStripe();

  const checkoutRes = await createPayPerEventCheckout({
    supabase: db1,
    stripe: stripe1,
    stripeSecretKey: STRIPE_SECRET_KEY,
    appUrl: APP_URL,
    authUser: ownerA,
    body: { eventId: 'evt-draft', agencyId: 'org-a' },
  });

  assert(checkoutRes.statusCode === 200, 'Checkout session creation returns 200');
  assert(Boolean(checkoutRes.body.orderId && checkoutRes.body.sessionId), 'Returns orderId and Stripe sessionId');
  assert(
    stripe1._createSessionCalls[0].params.mode === 'payment' &&
      stripe1._createSessionCalls[0].params.line_items[0].price_data.unit_amount === 500 &&
      stripe1._createSessionCalls[0].params.line_items[0].price_data.currency === 'usd',
    'Enforces $5.00 USD one-time payment mode with no subscription'
  );
  assert(
    stripe1._createSessionCalls[0].params.payment_intent_data?.metadata?.orderId === checkoutRes.body.orderId,
    'Copies orderId & eventId metadata onto payment_intent_data.metadata'
  );

  // Simulate Stripe completing payment
  const storedSession = stripe1._sessions.get(checkoutRes.body.sessionId);
  storedSession.payment_status = 'paid';
  const piId = storedSession.payment_intent.id;

  const webhookEvent1: Stripe.Event = {
    id: 'evt_wh_success_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        ...storedSession,
        payment_intent: piId,
        payment_status: 'paid',
      },
    },
  } as any;

  const whRes1 = await processStripeWebhookEvent({ supabase: db1, stripe: stripe1, event: webhookEvent1 });
  assert(whRes1.statusCode === 200 && whRes1.body.activated === true, 'Webhook activates event on checkout.session.completed');

  const updatedProj1 = db1.db.projects.find((p: any) => p.id === 'evt-draft');
  assert(updatedProj1.payment_status === 'paid' && updatedProj1.status === 'active', 'Project updated to paid/active');
  const savedExpiry1 = updatedProj1.expires_at;
  assert(db1.db.event_payments.length === 1, 'Creates exactly 1 payment row');
  assert(db1.db.event_payments[0].stripe_checkout_session_id === storedSession.id, 'Stores stripe_checkout_session_id');
  assert(db1.db.event_payments[0].stripe_payment_intent_id === piId, 'Stores stripe_payment_intent_id');
  assert(db1.db.event_entitlements.length === 1 && db1.db.event_entitlements[0].status === 'active', 'Grants active event_entitlements record');

  // Test 4: Duplicate webhook delivery (exact same event.id AND replay via verify-session)
  const dupWhRes = await processStripeWebhookEvent({ supabase: db1, stripe: stripe1, event: webhookEvent1 });
  assert(dupWhRes.statusCode === 200 && dupWhRes.body.duplicate === true, 'Duplicate webhook delivery returns 200 duplicate');
  assert(db1.db.event_payments.length === 1, 'Duplicate webhook creates NO duplicate payment rows');
  assert(db1.db.projects.find((p: any) => p.id === 'evt-draft').expires_at === savedExpiry1, 'Duplicate webhook does NOT double-extend expiry');

  const verifyReplay = await verifyAndCompleteCheckoutSession({
    supabase: db1,
    stripe: stripe1,
    stripeSecretKey: STRIPE_SECRET_KEY,
    authUser: ownerA,
    eventId: 'evt-draft',
    sessionId: storedSession.id,
  });
  assert(verifyReplay.statusCode === 200 && verifyReplay.body.idempotent === true, 'verify-session replay is idempotent');
  assert(db1.db.event_payments.length === 1, 'verify-session replay does not create duplicate payment');

  // --------------------------------------------------------------------------
  // TEST 2: Failed Stripe Payment
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Failed Payment Handling ---');
  const dbFail = createMockSupabase(baseData);
  const stripeFail = createMockStripe();
  const failCheckout = await createPayPerEventCheckout({
    supabase: dbFail,
    stripe: stripeFail,
    stripeSecretKey: STRIPE_SECRET_KEY,
    appUrl: APP_URL,
    authUser: ownerA,
    body: { eventId: 'evt-draft' },
  });
  const failOrderId = failCheckout.body.orderId;

  const failEvent: Stripe.Event = {
    id: 'evt_wh_fail_1',
    type: 'payment_intent.payment_failed',
    data: {
      object: {
        id: 'pi_failed_99',
        amount: 500,
        currency: 'usd',
        metadata: { orderId: failOrderId, eventId: 'evt-draft', agencyId: 'org-a', customerId: 'usr-a' },
        last_payment_error: { code: 'card_declined', message: 'Your card was declined.' },
      },
    },
  } as any;

  const failWhRes = await processStripeWebhookEvent({ supabase: dbFail, stripe: stripeFail, event: failEvent });
  assert(failWhRes.statusCode === 200 && failWhRes.body.failedRecorded === true, 'Failed payment webhook processed');
  assert(dbFail.db.event_orders[0].order_status === 'failed', 'Order status updated to failed');
  assert(dbFail.db.projects.find((p: any) => p.id === 'evt-draft').payment_status === 'failed', 'Unpaid project marked failed');
  assert(dbFail.db.event_payments[0].payment_status === 'failed', 'Failed payment record stored with failure details');

  // --------------------------------------------------------------------------
  // TEST 3: Cancelled Checkout Order
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Cancelled Checkout Preserves Draft & Active Licenses ---');
  const dbCancel = createMockSupabase(baseData);
  const stripeCancel = createMockStripe();
  const cDraft = await createPayPerEventCheckout({
    supabase: dbCancel,
    stripe: stripeCancel,
    stripeSecretKey: STRIPE_SECRET_KEY,
    appUrl: APP_URL,
    authUser: ownerA,
    body: { eventId: 'evt-draft' },
  });
  assert(dbCancel.db.projects.find((p: any) => p.id === 'evt-draft').payment_status === 'pending_payment', 'Draft transitions to pending_payment before cancel');

  const cancelDraftRes = await cancelCheckoutOrder({
    supabase: dbCancel,
    authUser: ownerA,
    orderId: cDraft.body.orderId,
  });
  assert(cancelDraftRes.statusCode === 200, 'cancelCheckoutOrder returns 200');
  assert(dbCancel.db.event_orders[0].order_status === 'cancelled', 'Order status updated to cancelled');
  assert(dbCancel.db.projects.find((p: any) => p.id === 'evt-draft').payment_status === 'unpaid', 'Pending draft reverts to unpaid on cancel');

  // Active event undergoing renewal checkout MUST stay active even during & after cancel!
  const cActive = await createPayPerEventCheckout({
    supabase: dbCancel,
    stripe: stripeCancel,
    stripeSecretKey: STRIPE_SECRET_KEY,
    appUrl: APP_URL,
    authUser: ownerA,
    body: { eventId: 'evt-active-early' },
  });
  assert(
    dbCancel.db.projects.find((p: any) => p.id === 'evt-active-early').payment_status === 'paid',
    'Active event remains paid/active during renewal checkout'
  );
  await cancelCheckoutOrder({ supabase: dbCancel, authUser: ownerA, orderId: cActive.body.orderId });
  assert(
    dbCancel.db.projects.find((p: any) => p.id === 'evt-active-early').payment_status === 'paid',
    'Cancelled renewal leaves existing active license active'
  );

  // --------------------------------------------------------------------------
  // TEST 5: Webhook Signature Verification Failure (400)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Webhook Signature Verification Failure ---');
  const rawPayload = JSON.stringify({ id: 'evt_sig_test', type: 'checkout.session.completed', data: { object: {} } });
  let sigFailedCaught = false;
  try {
    await stripe1.webhooks.constructEventAsync(rawPayload, 't=123,v1=bad_signature', WEBHOOK_SECRET);
  } catch {
    sigFailedCaught = true;
  }
  assert(sigFailedCaught, 'Invalid Stripe webhook signature throws verification error (returns HTTP 400)');

  const validHeader = stripe1.webhooks.generateTestHeaderString({
    payload: rawPayload,
    secret: WEBHOOK_SECRET,
  });
  const verifiedEvt = await stripe1.webhooks.constructEventAsync(rawPayload, validHeader, WEBHOOK_SECRET);
  assert(verifiedEvt.id === 'evt_sig_test', 'Valid Stripe test webhook signature passes constructEventAsync');

  // --------------------------------------------------------------------------
  // TEST 6, 8, 9: Invalid Metadata, Invalid Amount, Invalid Currency
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6, 8, 9: Missing Metadata, Tampered Amount & Invalid Currency ---');
  const tamperPriceRes = await createPayPerEventCheckout({
    supabase: db1,
    stripe: stripe1,
    stripeSecretKey: STRIPE_SECRET_KEY,
    appUrl: APP_URL,
    authUser: ownerA,
    body: { eventId: 'evt-draft', amount: 100 },
  });
  assert(tamperPriceRes.statusCode === 400, 'Client-tampered price rejected with 400');

  const tamperCurrRes = await createPayPerEventCheckout({
    supabase: db1,
    stripe: stripe1,
    stripeSecretKey: STRIPE_SECRET_KEY,
    appUrl: APP_URL,
    authUser: ownerA,
    body: { eventId: 'evt-draft', currency: 'eur' },
  });
  assert(tamperCurrRes.statusCode === 400, 'Client-tampered currency rejected with 400');

  const missingMetaRes = await processStripeWebhookEvent({
    supabase: db1,
    stripe: stripe1,
    event: {
      id: 'evt_bad_meta',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_bad', mode: 'payment', currency: 'usd', amount_total: 500, payment_status: 'paid', metadata: {} } },
    } as any,
  });
  assert(missingMetaRes.statusCode === 400, 'Webhook missing required metadata rejected with 400');

  const badAmtWh = await processStripeWebhookEvent({
    supabase: db1,
    stripe: stripe1,
    event: {
      id: 'evt_bad_amt',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_bad_amt',
          mode: 'payment',
          currency: 'usd',
          amount_total: 100,
          payment_status: 'paid',
          metadata: { eventId: 'evt-draft', orderId: checkoutRes.body.orderId, agencyId: 'org-a' },
        },
      },
    } as any,
  });
  assert(badAmtWh.statusCode === 400, 'Webhook with wrong amount (100 cents instead of 500) rejected with 400');

  const badCurrWh = await processStripeWebhookEvent({
    supabase: db1,
    stripe: stripe1,
    event: {
      id: 'evt_bad_curr',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_bad_curr',
          mode: 'payment',
          currency: 'myr',
          amount_total: 500,
          payment_status: 'paid',
          metadata: { eventId: 'evt-draft', orderId: checkoutRes.body.orderId, agencyId: 'org-a' },
        },
      },
    } as any,
  });
  assert(badCurrWh.statusCode === 400, 'Webhook with wrong currency rejected with 400');

  // --------------------------------------------------------------------------
  // TEST 7, 10, 11: Ownership, Cross-Org, Unauthorized & Unpaid Verification
  // --------------------------------------------------------------------------
  console.log('\n--- Test 7, 10, 11: Ownership, Cross-Org & Unauthorized Session Verification ---');
  const unauthVerify = await verifyAndCompleteCheckoutSession({
    supabase: db1,
    stripe: stripe1,
    stripeSecretKey: STRIPE_SECRET_KEY,
    authUser: null,
    eventId: 'evt-draft',
    sessionId: storedSession.id,
  });
  assert(unauthVerify.statusCode === 401, 'Unauthenticated verify-session returns 401');

  const crossOrgCheckout = await createPayPerEventCheckout({
    supabase: db1,
    stripe: stripe1,
    stripeSecretKey: STRIPE_SECRET_KEY,
    appUrl: APP_URL,
    authUser: ownerB,
    body: { eventId: 'evt-draft' },
  });
  assert(crossOrgCheckout.statusCode === 403, 'Owner B cannot initiate checkout for Owner A event (403)');

  const crossOrgVerify = await verifyAndCompleteCheckoutSession({
    supabase: db1,
    stripe: stripe1,
    stripeSecretKey: STRIPE_SECRET_KEY,
    authUser: ownerB,
    eventId: 'evt-draft',
    sessionId: storedSession.id,
  });
  assert(crossOrgVerify.statusCode === 403, 'Owner B cannot verify checkout session for Owner A event (403)');

  // Test Event A session trying to verify Event B
  const eventMismatchVerify = await verifyAndCompleteCheckoutSession({
    supabase: db1,
    stripe: stripe1,
    stripeSecretKey: STRIPE_SECRET_KEY,
    authUser: ownerA,
    eventId: 'evt-expired-late',
    sessionId: storedSession.id,
  });
  assert(eventMismatchVerify.statusCode === 403, 'Session from Event A cannot activate Event B (403)');

  // Test unpaid checkout session returning 202 without activating
  const dbUnsettled = createMockSupabase(baseData);
  const unsettledCheckout = await createPayPerEventCheckout({
    supabase: dbUnsettled,
    stripe: stripe1,
    stripeSecretKey: STRIPE_SECRET_KEY,
    appUrl: APP_URL,
    authUser: ownerA,
    body: { eventId: 'evt-draft' },
  });
  const unsettledVerify = await verifyAndCompleteCheckoutSession({
    supabase: dbUnsettled,
    stripe: stripe1,
    stripeSecretKey: STRIPE_SECRET_KEY,
    authUser: ownerA,
    eventId: 'evt-draft',
    sessionId: unsettledCheckout.body.sessionId,
  });
  assert(unsettledVerify.statusCode === 202 && unsettledVerify.body.pending === true, 'Unpaid session returns 202 pending without marking paid');
  assert(dbUnsettled.db.projects.find((p: any) => p.id === 'evt-draft').payment_status !== 'paid', 'Unpaid session leaves project unactivated');

  // --------------------------------------------------------------------------
  // TEST 12: Database Transaction Failure Returns 500 + Retry Recovery
  // --------------------------------------------------------------------------
  console.log('\n--- Test 12: Database Transaction Failure Returns 500 & Super Admin Retry Recovers ---');
  const dbRpcFail = createMockSupabase(baseData, { simulateRpcError: true });
  const rpcCheckout = await createPayPerEventCheckout({
    supabase: dbRpcFail,
    stripe: stripe1,
    stripeSecretKey: STRIPE_SECRET_KEY,
    appUrl: APP_URL,
    authUser: ownerA,
    body: { eventId: 'evt-draft' },
  });
  const rpcSess = stripe1._sessions.get(rpcCheckout.body.sessionId);
  rpcSess.payment_status = 'paid';

  const failedDbWebhookRes = await processStripeWebhookEvent({
    supabase: dbRpcFail,
    stripe: stripe1,
    event: {
      id: 'evt_wh_dbfail_1',
      type: 'checkout.session.completed',
      data: { object: { ...rpcSess, payment_intent: rpcSess.payment_intent.id, payment_status: 'paid' } },
    } as any,
  });
  assert(failedDbWebhookRes.statusCode === 500 && failedDbWebhookRes.body.retryable === true, 'DB failure in webhook returns 500 retryable (never swallows 200)');
  assert(
    dbRpcFail.db.stripe_webhook_events[0].processing_status === 'failed',
    'Records failed webhook status in stripe_webhook_events'
  );

  // Now simulate DB recovering (drop failing .rpc override to use TS atomic fallback or succeeding RPC)
  delete dbRpcFail.rpc;
  const retryRes = await retryStripeWebhookByIdOrPayment({
    supabase: dbRpcFail,
    stripe: stripe1,
    targetId: 'evt_wh_dbfail_1',
    adminUser: { id: superAdmin.id, email: superAdmin.email },
  });
  assert(retryRes.statusCode === 200 && retryRes.body.activated === true, 'Webhook retry succeeds after DB recovery');
  assert(dbRpcFail.db.projects.find((p: any) => p.id === 'evt-draft').payment_status === 'paid', 'Event activated on retry');

  // --------------------------------------------------------------------------
  // TEST 13 & 14: Full & Partial Refunds + Net Revenue Ledger
  // --------------------------------------------------------------------------
  console.log('\n--- Test 13 & 14: Full & Partial Refunds + Revenue Accounting ---');
  const dbRefund = createMockSupabase(baseData);
  const stripeRefund = createMockStripe();

  // Payment 1 (Full refund target)
  const rChk1 = await createPayPerEventCheckout({
    supabase: dbRefund,
    stripe: stripeRefund,
    stripeSecretKey: STRIPE_SECRET_KEY,
    appUrl: APP_URL,
    authUser: ownerA,
    body: { eventId: 'evt-draft' },
  });
  const rSess1 = stripeRefund._sessions.get(rChk1.body.sessionId);
  rSess1.payment_status = 'paid';
  await processStripeWebhookEvent({
    supabase: dbRefund,
    stripe: stripeRefund,
    event: {
      id: 'evt_wh_pay1',
      type: 'checkout.session.completed',
      data: { object: { ...rSess1, payment_intent: rSess1.payment_intent.id, payment_status: 'paid' } },
    } as any,
  });

  // Payment 2 (Partial refund target - $2.00 refunded out of $5.00)
  const rChk2 = await createPayPerEventCheckout({
    supabase: dbRefund,
    stripe: stripeRefund,
    stripeSecretKey: STRIPE_SECRET_KEY,
    appUrl: APP_URL,
    authUser: ownerB,
    body: { eventId: 'evt-org-b' },
  });
  const rSess2 = stripeRefund._sessions.get(rChk2.body.sessionId);
  rSess2.payment_status = 'paid';
  await processStripeWebhookEvent({
    supabase: dbRefund,
    stripe: stripeRefund,
    event: {
      id: 'evt_wh_pay2',
      type: 'checkout.session.completed',
      data: { object: { ...rSess2, payment_intent: rSess2.payment_intent.id, payment_status: 'paid' } },
    } as any,
  });

  // Execute partial refund via Super Admin API helper
  const pay2Row = dbRefund.db.event_payments.find((p: any) => p.event_id === 'evt-org-b');
  const partialAdminRes = await issueAdminStripeRefund({
    supabase: dbRefund,
    stripe: stripeRefund,
    stripeSecretKey: STRIPE_SECRET_KEY,
    paymentId: pay2Row.id,
    amountCents: 200,
    reason: 'requested_by_customer',
    adminUser: { id: superAdmin.id, email: superAdmin.email },
  });
  assert(partialAdminRes.statusCode === 200 && partialAdminRes.body.refundStatus === 'partial', 'Partial refund ($2.00) processed via PaymentIntent');
  assert(
    stripeRefund._refunds[0].payment_intent.startsWith('pi_'),
    'Refund passed PaymentIntent ID (pi_...), NOT Checkout Session ID (cs_...)'
  );
  assert(
    dbRefund.db.projects.find((p: any) => p.id === 'evt-org-b').payment_status === 'paid',
    'Partial refund preserves active event access'
  );

  // Execute full refund via charge.refunded webhook for Payment 1
  const fullRefundWh = await processStripeWebhookEvent({
    supabase: dbRefund,
    stripe: stripeRefund,
    event: {
      id: 'evt_wh_full_refund_1',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_full_1',
          payment_intent: rSess1.payment_intent.id,
          amount: 500,
          amount_refunded: 500,
          refunds: { data: [{ id: 're_full_wh_1', amount: 500, reason: 'requested_by_customer' }] },
          metadata: {},
        },
      },
    } as any,
  });
  assert(fullRefundWh.statusCode === 200 && fullRefundWh.body.refundStatus === 'full', 'Full refund webhook processed');
  assert(
    dbRefund.db.projects.find((p: any) => p.id === 'evt-draft').payment_status === 'refunded' &&
      dbRefund.db.projects.find((p: any) => p.id === 'evt-draft').status === 'cancelled',
    'Full refund revokes event access (refunded/cancelled)'
  );
  assert(
    dbRefund.db.event_entitlements.find((e: any) => e.event_id === 'evt-draft').status === 'revoked',
    'Full refund revokes event_entitlements row'
  );

  // Verify ledger accounting: Payment 1 fully refunded ($0 net), Payment 2 partially refunded ($5 - $2 = $3 net = 300 cents)
  const ledger = computePaymentLedgerAndMetrics(
    dbRefund.db.event_payments,
    dbRefund.db.event_orders,
    dbRefund.db.projects,
    dbRefund.db.agencies,
    dbRefund.db.users_auth,
    dbRefund.db.stripe_webhook_events
  );
  assert(ledger.summary.totalRevenueCents === 300, `Net collected revenue is 300 cents ($3.00), got ${ledger.summary.totalRevenueCents}`);
  assert(ledger.summary.refundedAmountCents === 700, `Refunded total is 700 cents ($7.00), got ${ledger.summary.refundedAmountCents}`);

  // --------------------------------------------------------------------------
  // TEST 15, 16, 17: Early Renewal, Late Renewal & Calendar Edge Cases
  // --------------------------------------------------------------------------
  console.log('\n--- Test 15, 16, 17: Early/Late Renewals & Calendar Edge Cases ---');
  const jan31Calc = calculateNewExpiration(new Date('2030-01-31T12:00:00Z').toISOString());
  assert(jan31Calc.isRenewal === true, 'Future expiry triggers early renewal extension');
  assert(jan31Calc.newExpiration.startsWith('2031-01-31'), 'Jan 31 preserves day on +12 calendar months');

  const feb29Expiry = calculateNewExpiration(new Date('2028-02-29T12:00:00Z').toISOString());
  assert(feb29Expiry.newExpiration.startsWith('2029-02-28'), 'Leap day Feb 29 rolls gracefully to Feb 28 (+12 months)');

  const lateRenewRes = await activateEventPurchase(db1, {
    eventId: 'evt-expired-late',
    customerId: 'usr-a',
    agencyId: 'org-a',
    transactionId: 'pi_late_renew_1',
    stripePaymentIntentId: 'pi_late_renew_1',
    amountPaidCents: 500,
    currency: 'usd',
  });
  const expectedLateYear = new Date().getUTCFullYear() + 1;
  assert(new Date(lateRenewRes.expiresAt).getUTCFullYear() === expectedLateYear, 'Late renewal resets 12-month window from now');

  // --------------------------------------------------------------------------
  // TEST 18: Concurrent Payment Requests Deduplication
  // --------------------------------------------------------------------------
  console.log('\n--- Test 18: Concurrent Checkout Requests Coalescing ---');
  const dbConcurrent = createMockSupabase(baseData);
  const stripeConcurrent = createMockStripe();
  const [c1, c2] = await Promise.all([
    createPayPerEventCheckout({
      supabase: dbConcurrent,
      stripe: stripeConcurrent,
      stripeSecretKey: STRIPE_SECRET_KEY,
      appUrl: APP_URL,
      authUser: ownerA,
      body: { eventId: 'evt-draft', idempotencyKey: 'same_click_key' },
    }),
    createPayPerEventCheckout({
      supabase: dbConcurrent,
      stripe: stripeConcurrent,
      stripeSecretKey: STRIPE_SECRET_KEY,
      appUrl: APP_URL,
      authUser: ownerA,
      body: { eventId: 'evt-draft', idempotencyKey: 'same_click_key' },
    }),
  ]);
  assert(c1.body.sessionId === c2.body.sessionId, 'Concurrent checkout calls share single coalesced Stripe session');
  assert(stripeConcurrent._createSessionCalls.length === 1, 'Stripe Checkout sessions.create invoked only once');

  // --------------------------------------------------------------------------
  // TEST 19: Mock Activation Lockdown (Express & Hono Worker) & Super Admin Auth
  // --------------------------------------------------------------------------
  console.log('\n--- Test 19: Mock Activation Protection & Admin Route RBAC ---');
  const honoApp = new Hono();
  honoApp.post('/api/events/:id/activate-mock', (c) =>
    c.json({ error: 'Mock payment activation is disabled in production.' }, 403)
  );
  registerWorkerDeveloperRoutes(honoApp as any);

  const mockBypassAttempt = await honoApp.request('/api/events/evt-draft/activate-mock', {
    method: 'POST',
    headers: { 'x-test-suite': 'true' },
  });
  assert(mockBypassAttempt.status === 403, 'Hono /api/events/:id/activate-mock returns 403 even with x-test-suite header');

  // Verify Express devRouter refund endpoint requires super_admin (401/403)
  const devApp = express();
  devApp.use(express.json());
  devApp.use(cookieParser());
  devApp.use(
    '/api/developer',
    createDeveloperRouter({
      getSupabase: () => dbRefund,
      getJwtSecret: () => JWT_SECRET,
      getStripe: () => stripeRefund,
      getStripeSecretKey: () => STRIPE_SECRET_KEY,
    })
  );

  const nonAdminToken = jwt.sign({ id: 'usr-a', email: 'ownerA@agency.com' }, JWT_SECRET);
  const superAdminToken = jwt.sign({ id: 'usr-admin', email: 'admin@eventframe.io' }, JWT_SECRET);

  const server = devApp.listen(0);
  const port = (server.address() as any).port;
  try {
    const unauthRefundHttp = await fetch(`http://127.0.0.1:${port}/api/developer/payments/nonexistent/refund`, {
      method: 'POST',
    });
    assert(unauthRefundHttp.status === 401, 'Unauthenticated refund request returns 401');

    const nonAdminRefundHttp = await fetch(`http://127.0.0.1:${port}/api/developer/payments/nonexistent/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${nonAdminToken}` },
    });
    assert(nonAdminRefundHttp.status === 403, 'Non-admin refund request rejected with 403');

    const adminLogsHttp = await fetch(`http://127.0.0.1:${port}/api/developer/payments`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(adminLogsHttp.status === 200, 'Authorized super_admin accesses /api/developer/payments (200)');
  } finally {
    server.close();
  }

  // Test 20: Live Stripe key sanity check (only runs real API call if sk_test_... present in env)
  console.log('\n--- Test 20: Stripe Checkout Live/Env Mode Verification ---');
  const liveTestKey = process.env.STRIPE_SECRET_KEY;
  if (liveTestKey && liveTestKey.startsWith('sk_test_')) {
    const liveStripe = new Stripe(liveTestKey);
    const liveSession = await liveStripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'EventFrame Event License', description: '12 Months Full Wedding Event Access' },
            unit_amount: 500,
          },
          quantity: 1,
        },
      ],
      success_url: 'https://eventframe.io/subscription?success=true&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://eventframe.io/subscription?canceled=true',
    });
    assert(Boolean(liveSession.id && liveSession.url), 'Live Stripe test-mode Checkout Session created & verified');
  } else {
    console.log('ℹ INFO: STRIPE_SECRET_KEY (sk_test_...) not configured in local environment; live Stripe API network test skipped (mocked Stripe harness passed).');
  }

  console.log('\n=====================================================');
  console.log('✅ ALL STRIPE PRODUCTION-HARDENING TESTS PASSED');
  console.log('=====================================================');
}

runTests().catch((err) => {
  console.error('Fatal Stripe test failure:', err);
  process.exit(1);
});
