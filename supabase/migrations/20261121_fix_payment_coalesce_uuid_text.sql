-- ============================================================================
-- EventFrame.io: Fix PostgreSQL COALESCE(text, uuid) Type Mismatch in
-- Stripe Payment Completion & Refund RPCs (complete_event_payment_order / process_stripe_refund)
-- ============================================================================
-- Root Cause Fixed:
--   In production, columns such as projects.id, projects.agency_id,
--   event_orders.id, event_payments.order_id, etc. may be PostgreSQL `uuid`,
--   whereas RPC parameters and fallback strings are `text`.
--   Expressions like:
--     COALESCE(NULLIF(p_agency_id, ''), v_project.agency_id)
--     COALESCE(order_id, $1)
--     COALESCE(v_payment.agency_id, v_order_agency_id)
--   failed with:
--     "COALESCE types text and uuid cannot be matched"
--
-- Design Principles:
--   1. Preserve all native `uuid` columns as `uuid` (never convert schema to `text`).
--   2. Explicitly normalize/cast matching types inside every COALESCE expression.
--   3. Validate text inputs against UUID regex before ANY `::uuid` cast.
--   4. Handle NULL and empty/whitespace strings safely across all ID fields.
--   5. Preserve exact $5.00 USD / 12-calendar-month transactional behavior & idempotency.
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_event_payment_order(
  p_order_id text,
  p_event_id text,
  p_agency_id text,
  p_customer_id text,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_stripe_charge_id text,
  p_amount_cents integer,
  p_currency text,
  p_provider text,
  p_webhook_event_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_uuid_regex constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_now timestamptz := now();
  v_project record;
  v_order record;
  v_has_order boolean := false;
  v_existing_payment record;

  -- Clean normalized text inputs
  v_event_id_clean text := NULLIF(btrim(COALESCE(p_event_id, '')), '');
  v_order_id_clean text := NULLIF(btrim(COALESCE(p_order_id, '')), '');
  v_agency_id_clean text := NULLIF(btrim(COALESCE(p_agency_id, '')), '');
  v_customer_id_clean text := NULLIF(btrim(COALESCE(p_customer_id, '')), '');
  v_session_clean text := NULLIF(btrim(COALESCE(p_stripe_session_id, '')), '');
  v_pi_clean text := NULLIF(btrim(COALESCE(p_stripe_payment_intent_id, '')), '');
  v_charge_clean text := NULLIF(btrim(COALESCE(p_stripe_charge_id, '')), '');
  v_webhook_clean text := NULLIF(btrim(COALESCE(p_webhook_event_id, '')), '');
  v_effective_provider text := COALESCE(NULLIF(btrim(COALESCE(p_provider, '')), ''), 'stripe');

  -- Column type inspection results (preserves native uuid vs text columns)
  v_projects_id_type text;
  v_projects_agency_type text;
  v_orders_id_type text;
  v_orders_event_type text;
  v_orders_agency_type text;
  v_orders_customer_type text;
  v_payments_order_type text;
  v_payments_event_type text;
  v_payments_agency_type text;
  v_payments_customer_type text;
  v_entitlements_order_type text;
  v_entitlements_event_type text;
  v_logs_actor_type text;
  v_logs_org_type text;
  v_logs_event_type text;

  -- Extracted text representations of record fields
  v_project_agency_id text;
  v_order_event_id text;
  v_order_agency_id text;
  v_order_customer_id text;
  v_order_session_id text;

  -- Effective resolved values
  v_effective_order_id text;
  v_effective_agency_id text;
  v_effective_customer_id text;
  v_orders_agency_param text;
  v_orders_customer_param text;
  v_payments_agency_param text;
  v_payments_customer_param text;
  v_payments_order_param text;
  v_entitlements_order_param text;
  v_logs_actor_param text;
  v_logs_org_param text;
  v_logs_event_param text;
  v_tx_id text;

  v_is_already_active boolean := false;
  v_activated_at timestamptz;
  v_expires_at timestamptz;
  v_order_type text;
  v_package_snapshot jsonb;
  v_entitlement_features jsonb;
  v_existing_tx_payment_id text;
  v_order_json jsonb := NULL;

  -- Typed SQL fragments for dynamic execution
  v_ord_id_expr text;
  v_ord_event_expr text;
  v_ord_agency_expr text;
  v_ord_customer_expr text;
  v_pay_order_expr text;
  v_pay_event_expr text;
  v_pay_agency_expr text;
  v_pay_customer_expr text;
  v_ent_event_expr text;
  v_ent_order_expr text;
  v_log_actor_expr text;
  v_log_org_expr text;
  v_log_event_expr text;
BEGIN
  -- 1. Validate required event identifier
  IF v_event_id_clean IS NULL THEN
    RAISE EXCEPTION 'INVALID_EVENT_ID: event_id is required';
  END IF;

  -- 2. Validate authoritative $5.00 USD pricing unless explicit legacy migration
  IF v_effective_provider <> 'legacy_migration' THEN
    IF p_amount_cents IS NULL OR p_amount_cents <> 500 THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT: expected 500 cents, got %', p_amount_cents;
    END IF;
    IF lower(COALESCE(p_currency, '')) <> 'usd' THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_CURRENCY: expected usd, got %', p_currency;
    END IF;
  END IF;

  -- 3. Inspect actual column types on all payment/billing tables
  SELECT data_type INTO v_projects_id_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'id';
  SELECT data_type INTO v_projects_agency_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'agency_id';

  SELECT data_type INTO v_orders_id_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_orders' AND column_name = 'id';
  SELECT data_type INTO v_orders_event_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_orders' AND column_name = 'event_id';
  SELECT data_type INTO v_orders_agency_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_orders' AND column_name = 'agency_id';
  SELECT data_type INTO v_orders_customer_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_orders' AND column_name = 'customer_id';

  SELECT data_type INTO v_payments_order_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_payments' AND column_name = 'order_id';
  SELECT data_type INTO v_payments_event_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_payments' AND column_name = 'event_id';
  SELECT data_type INTO v_payments_agency_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_payments' AND column_name = 'agency_id';
  SELECT data_type INTO v_payments_customer_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_payments' AND column_name = 'customer_id';

  SELECT data_type INTO v_entitlements_order_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_entitlements' AND column_name = 'order_id';
  SELECT data_type INTO v_entitlements_event_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_entitlements' AND column_name = 'event_id';

  SELECT data_type INTO v_logs_actor_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'platform_activity_logs' AND column_name = 'actor_id';
  SELECT data_type INTO v_logs_org_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'platform_activity_logs' AND column_name = 'organization_id';
  SELECT data_type INTO v_logs_event_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'platform_activity_logs' AND column_name = 'target_event_id';

  -- 4. Validate UUID format BEFORE any UUID casts or lookups
  IF (v_projects_id_type = 'uuid' OR v_orders_event_type = 'uuid' OR v_payments_event_type = 'uuid' OR v_entitlements_event_type = 'uuid')
     AND v_event_id_clean !~* c_uuid_regex THEN
    RAISE EXCEPTION 'INVALID_UUID_METADATA: event_id "%" is not a valid UUID', v_event_id_clean;
  END IF;

  IF v_order_id_clean IS NOT NULL
     AND (v_orders_id_type = 'uuid' OR v_payments_order_type = 'uuid' OR v_entitlements_order_type = 'uuid')
     AND v_order_id_clean !~* c_uuid_regex THEN
    RAISE EXCEPTION 'INVALID_UUID_METADATA: order_id "%" is not a valid UUID', v_order_id_clean;
  END IF;

  IF v_agency_id_clean IS NOT NULL
     AND (v_projects_agency_type = 'uuid' OR v_orders_agency_type = 'uuid' OR v_payments_agency_type = 'uuid')
     AND v_agency_id_clean !~* c_uuid_regex THEN
    RAISE EXCEPTION 'INVALID_UUID_METADATA: agency_id "%" is not a valid UUID', v_agency_id_clean;
  END IF;

  -- 5. Lock target project row FIRST in deterministic order to prevent races
  SELECT * INTO v_project
  FROM projects
  WHERE id::text = v_event_id_clean
  FOR UPDATE;

  IF NOT FOUND OR v_project.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND: %', v_event_id_clean;
  END IF;

  -- CRITICAL FIX: Cast v_project.agency_id::text so both COALESCE inputs are text!
  v_project_agency_id := NULLIF(btrim(COALESCE(v_project.agency_id::text, '')), '');
  v_effective_agency_id := COALESCE(v_agency_id_clean, v_project_agency_id);

  IF v_project_agency_id IS NOT NULL AND v_effective_agency_id IS NOT NULL AND v_project_agency_id <> v_effective_agency_id THEN
    RAISE EXCEPTION 'OWNERSHIP_MISMATCH: event agency % does not match %', v_project_agency_id, v_effective_agency_id;
  END IF;

  IF v_effective_agency_id IS NOT NULL
     AND (v_orders_agency_type = 'uuid' OR v_payments_agency_type = 'uuid')
     AND v_effective_agency_id !~* c_uuid_regex THEN
    RAISE EXCEPTION 'INVALID_UUID_METADATA: resolved agency_id "%" is not a valid UUID', v_effective_agency_id;
  END IF;

  -- 6. Lock existing order by p_order_id first, or fallback to stripe_session_id
  IF v_order_id_clean IS NOT NULL THEN
    SELECT * INTO v_order
    FROM event_orders
    WHERE id::text = v_order_id_clean
    FOR UPDATE;
    IF FOUND THEN
      v_has_order := true;
    END IF;
  END IF;

  IF NOT v_has_order AND v_session_clean IS NOT NULL THEN
    SELECT * INTO v_order
    FROM event_orders
    WHERE stripe_session_id = v_session_clean
    FOR UPDATE;
    IF FOUND THEN
      v_has_order := true;
      IF v_order_id_clean IS NOT NULL AND v_order.id::text <> v_order_id_clean THEN
        RAISE EXCEPTION 'ORDER_SESSION_MISMATCH: session % belongs to order % not %', v_session_clean, v_order.id::text, v_order_id_clean;
      END IF;
    END IF;
  END IF;

  IF v_has_order THEN
    v_order_event_id := NULLIF(btrim(COALESCE(v_order.event_id::text, '')), '');
    v_order_agency_id := NULLIF(btrim(COALESCE(v_order.agency_id::text, '')), '');
    v_order_customer_id := NULLIF(btrim(COALESCE(v_order.customer_id::text, '')), '');
    v_order_session_id := NULLIF(btrim(COALESCE(v_order.stripe_session_id, '')), '');

    IF v_order_event_id IS DISTINCT FROM v_event_id_clean THEN
      RAISE EXCEPTION 'ORDER_EVENT_MISMATCH: order % belongs to % not %', v_order.id::text, COALESCE(v_order_event_id, 'null'), v_event_id_clean;
    END IF;

    IF v_order_agency_id IS NOT NULL AND v_order_agency_id <> 'unknown' AND v_effective_agency_id IS NOT NULL AND v_order_agency_id <> v_effective_agency_id THEN
      RAISE EXCEPTION 'ORDER_AGENCY_MISMATCH: order agency % does not match %', v_order_agency_id, v_effective_agency_id;
    END IF;

    IF v_order_session_id IS NOT NULL AND v_session_clean IS NOT NULL AND v_order_session_id <> v_session_clean THEN
      RAISE EXCEPTION 'ORDER_SESSION_MISMATCH: order % is bound to session % not %', v_order.id::text, v_order_session_id, v_session_clean;
    END IF;

    v_effective_order_id := v_order.id::text;
    v_effective_agency_id := COALESCE(v_effective_agency_id, NULLIF(v_order_agency_id, 'unknown'));
  ELSE
    v_effective_order_id := COALESCE(v_order_id_clean, gen_random_uuid()::text);
  END IF;

  IF (v_orders_id_type = 'uuid' OR v_payments_order_type = 'uuid' OR v_entitlements_order_type = 'uuid')
     AND v_effective_order_id !~* c_uuid_regex THEN
    RAISE EXCEPTION 'INVALID_UUID_METADATA: effective order_id "%" is not a valid UUID', v_effective_order_id;
  END IF;

  v_tx_id := COALESCE(v_pi_clean, v_session_clean, v_effective_order_id);
  v_effective_customer_id := COALESCE(v_customer_id_clean, v_order_customer_id, 'customer');

  -- 7. Idempotency check 1: Order already completed
  IF v_has_order AND v_order.order_status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'orderId', v_effective_order_id,
      'eventId', v_event_id_clean,
      'activatedAt', COALESCE(v_project.activated_at, v_now),
      'expiresAt', v_project.expires_at,
      'isRenewal', (v_order.order_type = 'renewal'),
      'amountPaid', 5.00,
      'currency', 'USD',
      'event', row_to_json(v_project)::jsonb,
      'order', row_to_json(v_order)::jsonb
    );
  END IF;

  -- 8. Idempotency check 2: Matching settled payment already recorded
  SELECT * INTO v_existing_payment
  FROM event_payments
  WHERE (
    (v_session_clean IS NOT NULL AND stripe_checkout_session_id = v_session_clean)
    OR (v_pi_clean IS NOT NULL AND stripe_payment_intent_id = v_pi_clean)
    OR (provider_transaction_id = v_tx_id)
  )
  AND payment_status IN ('succeeded', 'refunded', 'partially_refunded')
  FOR UPDATE
  LIMIT 1;

  IF FOUND THEN
    IF NULLIF(btrim(COALESCE(v_existing_payment.event_id::text, '')), '') IS DISTINCT FROM v_event_id_clean THEN
      RAISE EXCEPTION 'PAYMENT_EVENT_MISMATCH: transaction % already belongs to event %', v_tx_id, v_existing_payment.event_id::text;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'orderId', COALESCE(NULLIF(v_existing_payment.order_id::text, ''), v_effective_order_id),
      'eventId', v_event_id_clean,
      'activatedAt', COALESCE(v_project.activated_at, v_existing_payment.paid_at, v_now),
      'expiresAt', v_project.expires_at,
      'isRenewal', false,
      'amountPaid', 5.00,
      'currency', 'USD',
      'event', row_to_json(v_project)::jsonb,
      'order', CASE WHEN v_has_order THEN row_to_json(v_order)::jsonb ELSE NULL END
    );
  END IF;

  -- 9. Compute authoritative 12 calendar months activation / renewal window
  v_is_already_active := (
    v_project.payment_status = 'paid'
    AND v_project.expires_at IS NOT NULL
    AND v_project.expires_at > v_now
  );

  IF v_is_already_active THEN
    v_activated_at := COALESCE(v_project.activated_at, v_now);
    v_expires_at := v_project.expires_at + interval '12 months';
    v_order_type := 'renewal';
  ELSE
    v_activated_at := v_now;
    v_expires_at := v_now + interval '12 months';
    v_order_type := CASE WHEN v_project.expires_at IS NOT NULL THEN 'renewal' ELSE 'purchase' END;
  END IF;

  v_package_snapshot := jsonb_build_object(
    'id', 'standard',
    'name', 'Event License',
    'price', 5.00,
    'priceInCents', 500,
    'currency', 'USD',
    'durationMonths', 12,
    'billingModel', 'PAY_PER_EVENT'
  );

  v_entitlement_features := '["12 Months Full Event Access", "Live Guest Message & Photo Moderation Wall", "Bespoke Digital Invitation & Canvas Designer", "Custom RSVP Questionnaires & Dietary Tracking", "Curated Ballroom Display Art Aesthetics", "Couple Access PIN Login Portal", "CSV Attendee Records Export & Permanent Archival"]'::jsonb;

  -- Prepare type-safe parameter expressions & values for dynamic execution
  -- (every column keeps its native PostgreSQL type: uuid or text)
  v_ord_id_expr := CASE WHEN v_orders_id_type = 'uuid' THEN '$1::uuid' ELSE '$1::text' END;
  v_ord_event_expr := CASE WHEN v_orders_event_type = 'uuid' THEN '$2::uuid' ELSE '$2::text' END;

  IF v_orders_agency_type = 'uuid' THEN
    v_ord_agency_expr := '$3::uuid';
    v_orders_agency_param := CASE WHEN v_effective_agency_id IS NOT NULL AND v_effective_agency_id ~* c_uuid_regex THEN v_effective_agency_id ELSE NULL END;
  ELSE
    v_ord_agency_expr := '$3::text';
    v_orders_agency_param := COALESCE(v_effective_agency_id, 'unknown');
  END IF;

  IF v_orders_customer_type = 'uuid' THEN
    v_ord_customer_expr := '$4::uuid';
    v_orders_customer_param := CASE
      WHEN v_customer_id_clean IS NOT NULL AND v_customer_id_clean ~* c_uuid_regex THEN v_customer_id_clean
      WHEN v_order_customer_id IS NOT NULL AND v_order_customer_id ~* c_uuid_regex THEN v_order_customer_id
      ELSE NULL
    END;
  ELSE
    v_ord_customer_expr := '$4::text';
    v_orders_customer_param := v_effective_customer_id;
  END IF;

  -- 10. Upsert completed order cleanly with strict type matching
  EXECUTE format($ord_sql$
    INSERT INTO event_orders (
      id, event_id, agency_id, customer_id, package_id, package_snapshot,
      amount, currency, order_status, order_type,
      stripe_session_id, stripe_payment_intent_id,
      completed_at, webhook_status, last_webhook_event_id,
      created_at, updated_at
    )
    VALUES (
      %1$s, %2$s, %3$s, %4$s, 'standard', $5,
      500, 'usd', 'completed', $6,
      $7, $8,
      $9, CASE WHEN $10 IS NOT NULL THEN 'processed' ELSE 'verified' END, $10,
      $9, $9
    )
    ON CONFLICT (id) DO UPDATE SET
      customer_id = COALESCE(%4$s, event_orders.customer_id),
      order_status = 'completed',
      order_type = $6,
      stripe_session_id = COALESCE($7, event_orders.stripe_session_id),
      stripe_payment_intent_id = COALESCE($8, event_orders.stripe_payment_intent_id),
      completed_at = $9,
      failure_reason = NULL,
      webhook_status = CASE WHEN $10 IS NOT NULL THEN 'processed' ELSE event_orders.webhook_status END,
      last_webhook_event_id = COALESCE($10, event_orders.last_webhook_event_id),
      updated_at = $9
    RETURNING row_to_json(event_orders)::jsonb
  $ord_sql$, v_ord_id_expr, v_ord_event_expr, v_ord_agency_expr, v_ord_customer_expr)
  INTO v_order_json
  USING
    v_effective_order_id,
    v_event_id_clean,
    v_orders_agency_param,
    v_orders_customer_param,
    v_package_snapshot,
    v_order_type,
    v_session_clean,
    v_pi_clean,
    v_now,
    v_webhook_clean;

  -- 11. Upsert event_payments ledger row cleanly
  SELECT id::text INTO v_existing_tx_payment_id
  FROM event_payments
  WHERE provider_transaction_id = v_tx_id
  FOR UPDATE
  LIMIT 1;

  IF v_payments_order_type = 'uuid' THEN
    v_pay_order_expr := '$1::uuid';
    v_payments_order_param := CASE WHEN v_effective_order_id ~* c_uuid_regex THEN v_effective_order_id ELSE NULL END;
  ELSE
    v_pay_order_expr := '$1::text';
    v_payments_order_param := v_effective_order_id;
  END IF;

  v_pay_event_expr := CASE WHEN v_payments_event_type = 'uuid' THEN '$2::uuid' ELSE '$2::text' END;

  IF v_payments_agency_type = 'uuid' THEN
    v_pay_agency_expr := '$3::uuid';
    v_payments_agency_param := CASE WHEN v_effective_agency_id IS NOT NULL AND v_effective_agency_id ~* c_uuid_regex THEN v_effective_agency_id ELSE NULL END;
  ELSE
    v_pay_agency_expr := '$3::text';
    v_payments_agency_param := v_effective_agency_id;
  END IF;

  IF v_payments_customer_type = 'uuid' THEN
    v_pay_customer_expr := '$4::uuid';
    v_payments_customer_param := CASE
      WHEN v_customer_id_clean IS NOT NULL AND v_customer_id_clean ~* c_uuid_regex THEN v_customer_id_clean
      WHEN v_order_customer_id IS NOT NULL AND v_order_customer_id ~* c_uuid_regex THEN v_order_customer_id
      ELSE NULL
    END;
  ELSE
    v_pay_customer_expr := '$4::text';
    v_payments_customer_param := v_effective_customer_id;
  END IF;

  IF v_existing_tx_payment_id IS NOT NULL THEN
    -- Both sides of COALESCE(order_id, <expr>) share exact same type (uuid or text)
    EXECUTE format($pay_upd$
      UPDATE event_payments
      SET
        order_id = COALESCE(order_id, %1$s),
        stripe_checkout_session_id = COALESCE($2, stripe_checkout_session_id),
        stripe_payment_intent_id = COALESCE($3, stripe_payment_intent_id),
        stripe_charge_id = COALESCE($4, stripe_charge_id),
        amount = 500,
        currency = 'usd',
        payment_status = CASE WHEN payment_status IN ('refunded', 'partially_refunded') THEN payment_status ELSE 'succeeded' END,
        webhook_event_id = COALESCE($5, webhook_event_id),
        webhook_status = 'processed',
        failure_code = NULL,
        failure_message = NULL,
        paid_at = COALESCE(paid_at, $6)
      WHERE id::text = $7
    $pay_upd$, v_pay_order_expr)
    USING
      v_payments_order_param,
      v_session_clean,
      v_pi_clean,
      v_charge_clean,
      v_webhook_clean,
      v_now,
      v_existing_tx_payment_id;
  ELSE
    EXECUTE format($pay_ins$
      INSERT INTO event_payments (
        order_id, event_id, agency_id, customer_id,
        provider, provider_transaction_id,
        stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id,
        amount, currency, payment_status,
        webhook_event_id, webhook_status,
        paid_at, created_at
      )
      VALUES (
        %1$s, %2$s, %3$s, %4$s,
        $5, $6,
        $7, $8, $9,
        500, 'usd', 'succeeded',
        $10, 'processed',
        $11, $11
      )
    $pay_ins$, v_pay_order_expr, v_pay_event_expr, v_pay_agency_expr, v_pay_customer_expr)
    USING
      v_payments_order_param,
      v_event_id_clean,
      v_payments_agency_param,
      v_payments_customer_param,
      v_effective_provider,
      v_tx_id,
      v_session_clean,
      v_pi_clean,
      v_charge_clean,
      v_webhook_clean,
      v_now;
  END IF;

  -- 12. Grant active 12-month event entitlement cleanly
  v_ent_event_expr := CASE WHEN v_entitlements_event_type = 'uuid' THEN '$1::uuid' ELSE '$1::text' END;
  IF v_entitlements_order_type = 'uuid' THEN
    v_ent_order_expr := '$2::uuid';
    v_entitlements_order_param := CASE WHEN v_effective_order_id ~* c_uuid_regex THEN v_effective_order_id ELSE NULL END;
  ELSE
    v_ent_order_expr := '$2::text';
    v_entitlements_order_param := v_effective_order_id;
  END IF;

  EXECUTE format($ent_ins$
    INSERT INTO event_entitlements (
      event_id, order_id, guest_limit, features,
      activated_at, expires_at, status, created_at
    )
    VALUES (
      %1$s, %2$s, 1000, $3,
      $4, $5, 'active', $6
    )
  $ent_ins$, v_ent_event_expr, v_ent_order_expr)
  USING
    v_event_id_clean,
    v_entitlements_order_param,
    v_entitlement_features,
    v_activated_at,
    v_expires_at,
    v_now;

  -- 13. Activate / extend project record cleanly
  UPDATE projects
  SET
    payment_status = 'paid',
    status = 'active',
    package_id = 'standard',
    activated_at = v_activated_at,
    expires_at = v_expires_at,
    updated_at = v_now
  WHERE id::text = v_event_id_clean
  RETURNING * INTO v_project;

  -- 14. Record immutable platform activity log cleanly (uuid or text compatible)
  IF v_logs_actor_type = 'uuid' THEN
    v_log_actor_expr := '$2::uuid';
    v_logs_actor_param := CASE WHEN v_customer_id_clean IS NOT NULL AND v_customer_id_clean ~* c_uuid_regex THEN v_customer_id_clean ELSE NULL END;
  ELSE
    v_log_actor_expr := '$2::text';
    v_logs_actor_param := COALESCE(v_customer_id_clean, 'stripe');
  END IF;

  IF v_logs_org_type = 'uuid' THEN
    v_log_org_expr := '$3::uuid';
    v_logs_org_param := CASE WHEN v_effective_agency_id IS NOT NULL AND v_effective_agency_id ~* c_uuid_regex THEN v_effective_agency_id ELSE NULL END;
  ELSE
    v_log_org_expr := '$3::text';
    v_logs_org_param := v_effective_agency_id;
  END IF;

  IF v_logs_event_type = 'uuid' THEN
    v_log_event_expr := '$4::uuid';
    v_logs_event_param := CASE WHEN v_event_id_clean ~* c_uuid_regex THEN v_event_id_clean ELSE NULL END;
  ELSE
    v_log_event_expr := '$4::text';
    v_logs_event_param := v_event_id_clean;
  END IF;

  EXECUTE format($log_ins$
    INSERT INTO platform_activity_logs (
      action, actor_id, organization_id, target_event_id, reference_id, summary, metadata, created_at
    )
    VALUES (
      $1, %1$s, %2$s, %3$s, $5, $6, $7, $8
    )
  $log_ins$, v_log_actor_expr, v_log_org_expr, v_log_event_expr)
  USING
    'PAYMENT_COMPLETED',
    v_logs_actor_param,
    v_logs_org_param,
    v_logs_event_param,
    v_tx_id,
    format('Payment completed ($5.00 USD) for event "%s"', COALESCE(v_project.name, v_event_id_clean)),
    jsonb_build_object(
      'orderId', v_effective_order_id,
      'stripeSessionId', v_session_clean,
      'stripePaymentIntentId', v_pi_clean,
      'amountCents', 500,
      'currency', 'USD',
      'isRenewal', v_is_already_active
    ),
    v_now;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'orderId', v_effective_order_id,
    'eventId', v_event_id_clean,
    'activatedAt', v_activated_at,
    'expiresAt', v_expires_at,
    'isRenewal', v_is_already_active,
    'amountPaid', 5.00,
    'currency', 'USD',
    'event', row_to_json(v_project)::jsonb,
    'order', v_order_json
  );
END;
$$;

-- ============================================================================
-- Fix COALESCE(uuid, text) and uuid/text comparisons in process_stripe_refund
-- ============================================================================
CREATE OR REPLACE FUNCTION process_stripe_refund(
  p_stripe_refund_id text,
  p_payment_intent_id text,
  p_checkout_session_id text,
  p_charge_id text,
  p_refund_amount_cents integer,
  p_total_charge_cents integer,
  p_actor_id text,
  p_actor_email text,
  p_reason text,
  p_webhook_event_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_uuid_regex constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_now timestamptz := now();
  v_payment record;
  v_order_agency_id text := NULL;
  v_effective_agency_id text := NULL;
  v_is_full boolean;
  v_effective_total integer;
  v_new_refund_status text;
  v_new_payment_status text;
  v_refund_id_clean text := NULLIF(btrim(COALESCE(p_stripe_refund_id, '')), '');
  v_pi_clean text := NULLIF(btrim(COALESCE(p_payment_intent_id, '')), '');
  v_session_clean text := NULLIF(btrim(COALESCE(p_checkout_session_id, '')), '');
  v_charge_clean text := NULLIF(btrim(COALESCE(p_charge_id, '')), '');
  v_webhook_clean text := NULLIF(btrim(COALESCE(p_webhook_event_id, '')), '');
  v_actor_clean text := NULLIF(btrim(COALESCE(p_actor_id, '')), '');
  v_logs_actor_type text;
  v_logs_org_type text;
  v_logs_event_type text;
  v_log_actor_expr text;
  v_log_org_expr text;
  v_log_event_expr text;
  v_logs_actor_param text;
  v_logs_org_param text;
  v_logs_event_param text;
BEGIN
  -- Deduplicate by stripe_refund_id
  IF v_refund_id_clean IS NOT NULL THEN
    SELECT * INTO v_payment
    FROM event_payments
    WHERE stripe_refund_id = v_refund_id_clean
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'paymentId', v_payment.id::text,
        'eventId', v_payment.event_id::text,
        'refundStatus', v_payment.refund_status,
        'paymentStatus', v_payment.payment_status
      );
    END IF;
  END IF;

  -- Locate target payment via PaymentIntent, Checkout Session, or Charge ID
  SELECT * INTO v_payment
  FROM event_payments
  WHERE (
    (v_pi_clean IS NOT NULL AND (stripe_payment_intent_id = v_pi_clean OR provider_transaction_id = v_pi_clean))
    OR (v_session_clean IS NOT NULL AND (stripe_checkout_session_id = v_session_clean OR provider_transaction_id = v_session_clean))
    OR (v_charge_clean IS NOT NULL AND stripe_charge_id = v_charge_clean)
  )
  FOR UPDATE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'notFound', true,
      'message', 'No matching event_payments record found for refund'
    );
  END IF;

  v_effective_total := COALESCE(NULLIF(v_payment.amount, 0), NULLIF(p_total_charge_cents, 0), 500);
  v_is_full := (COALESCE(p_refund_amount_cents, v_effective_total) >= v_effective_total);
  v_new_refund_status := CASE WHEN v_is_full THEN 'full' ELSE 'partial' END;
  v_new_payment_status := CASE WHEN v_is_full THEN 'refunded' ELSE 'partially_refunded' END;

  UPDATE event_payments
  SET
    payment_status = v_new_payment_status,
    refund_status = v_new_refund_status,
    refund_amount = COALESCE(p_refund_amount_cents, v_effective_total),
    refunded_at = v_now,
    stripe_refund_id = COALESCE(v_refund_id_clean, stripe_refund_id),
    stripe_charge_id = COALESCE(v_charge_clean, stripe_charge_id),
    stripe_payment_intent_id = COALESCE(v_pi_clean, stripe_payment_intent_id),
    webhook_event_id = COALESCE(v_webhook_clean, webhook_event_id)
  WHERE id::text = v_payment.id::text;

  IF v_payment.order_id IS NOT NULL THEN
    UPDATE event_orders
    SET
      refund_status = v_new_refund_status,
      refund_amount = COALESCE(p_refund_amount_cents, v_effective_total),
      refunded_at = v_now,
      order_status = CASE WHEN v_is_full THEN 'refunded' ELSE 'completed' END,
      updated_at = v_now
    WHERE id::text = v_payment.order_id::text
    RETURNING agency_id::text INTO v_order_agency_id;
  END IF;

  IF v_is_full THEN
    UPDATE event_entitlements
    SET
      status = 'revoked',
      revoked_at = v_now,
      revoked_reason = COALESCE(NULLIF(p_reason, ''), 'Full Stripe refund processed')
    WHERE event_id::text = v_payment.event_id::text
      AND (v_payment.order_id IS NULL OR order_id::text = v_payment.order_id::text)
      AND status = 'active';

    UPDATE projects
    SET
      payment_status = 'refunded',
      status = 'cancelled',
      updated_at = v_now
    WHERE id::text = v_payment.event_id::text;
  END IF;

  -- CRITICAL FIX: Cast v_payment.agency_id::text before COALESCE against text v_order_agency_id
  v_effective_agency_id := COALESCE(
    NULLIF(btrim(COALESCE(v_payment.agency_id::text, '')), ''),
    NULLIF(btrim(COALESCE(v_order_agency_id, '')), '')
  );

  SELECT data_type INTO v_logs_actor_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'platform_activity_logs' AND column_name = 'actor_id';
  SELECT data_type INTO v_logs_org_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'platform_activity_logs' AND column_name = 'organization_id';
  SELECT data_type INTO v_logs_event_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'platform_activity_logs' AND column_name = 'target_event_id';

  IF v_logs_actor_type = 'uuid' THEN
    v_log_actor_expr := '$2::uuid';
    v_logs_actor_param := CASE WHEN v_actor_clean IS NOT NULL AND v_actor_clean ~* c_uuid_regex THEN v_actor_clean ELSE NULL END;
  ELSE
    v_log_actor_expr := '$2::text';
    v_logs_actor_param := COALESCE(v_actor_clean, 'stripe');
  END IF;

  IF v_logs_org_type = 'uuid' THEN
    v_log_org_expr := '$4::uuid';
    v_logs_org_param := CASE WHEN v_effective_agency_id IS NOT NULL AND v_effective_agency_id ~* c_uuid_regex THEN v_effective_agency_id ELSE NULL END;
  ELSE
    v_log_org_expr := '$4::text';
    v_logs_org_param := v_effective_agency_id;
  END IF;

  IF v_logs_event_type = 'uuid' THEN
    v_log_event_expr := '$5::uuid';
    v_logs_event_param := CASE WHEN v_payment.event_id::text ~* c_uuid_regex THEN v_payment.event_id::text ELSE NULL END;
  ELSE
    v_log_event_expr := '$5::text';
    v_logs_event_param := v_payment.event_id::text;
  END IF;

  EXECUTE format($log_ref$
    INSERT INTO platform_activity_logs (
      action, actor_id, actor_email, organization_id, target_event_id, reference_id, summary, metadata, created_at
    )
    VALUES (
      $1, %1$s, $3, %2$s, %3$s, $6, $7, $8, $9
    )
  $log_ref$, v_log_actor_expr, v_log_org_expr, v_log_event_expr)
  USING
    CASE WHEN v_is_full THEN 'PAYMENT_REFUNDED' ELSE 'PAYMENT_PARTIALLY_REFUNDED' END,
    v_logs_actor_param,
    NULLIF(p_actor_email, ''),
    v_logs_org_param,
    v_logs_event_param,
    COALESCE(v_refund_id_clean, v_pi_clean, v_payment.id::text),
    format(
      '%s refund ($%s USD) recorded for event %s',
      CASE WHEN v_is_full THEN 'Full' ELSE 'Partial' END,
      to_char(COALESCE(p_refund_amount_cents, v_effective_total)::numeric / 100.0, 'FM999990.00'),
      v_payment.event_id::text
    ),
    jsonb_build_object(
      'stripeRefundId', v_refund_id_clean,
      'paymentIntentId', COALESCE(v_pi_clean, v_payment.stripe_payment_intent_id),
      'refundAmountCents', COALESCE(p_refund_amount_cents, v_effective_total),
      'isFullRefund', v_is_full,
      'reason', p_reason,
      'entitlementRevoked', v_is_full
    ),
    v_now;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'paymentId', v_payment.id::text,
    'eventId', v_payment.event_id::text,
    'refundStatus', v_new_refund_status,
    'paymentStatus', v_new_payment_status,
    'isFullRefund', v_is_full,
    'entitlementRevoked', v_is_full
  );
END;
$$;

REVOKE ALL ON FUNCTION complete_event_payment_order(text, text, text, text, text, text, text, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_event_payment_order(text, text, text, text, text, text, text, integer, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION process_stripe_refund(text, text, text, text, integer, integer, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_stripe_refund(text, text, text, text, integer, integer, text, text, text, text) TO service_role;
