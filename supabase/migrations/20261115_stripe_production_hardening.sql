-- ============================================================================
-- EventFrame.io: Production Stripe Pay-Per-Event Hardening Migration
-- Self-contained, idempotent forward migration safe for:
--   - Fresh databases (no prior billing migrations applied)
--   - Partial production databases (e.g., event_orders missing, or legacy event_payments)
--   - Legacy uuid-based schemas (20261105_pay_per_event_billing.sql)
--   - Legacy text-based schemas (20261105_pay_per_event_5usd.sql)
-- Authoritative Model: USD $5.00 (500 cents) one-time per event, 12 months validity.
-- Never drops, truncates, or destroys existing payment/order/entitlement data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Inspect existing database schema
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_has_agencies boolean;
  v_has_projects boolean;
  v_has_packages boolean;
  v_has_orders boolean;
  v_has_payments boolean;
  v_has_entitlements boolean;
  v_has_logs boolean;
  v_has_webhooks boolean;
  v_orders_id_type text;
  v_payments_id_type text;
  v_payments_order_id_type text;
  v_entitlements_id_type text;
  v_entitlements_order_id_type text;
BEGIN
  SELECT to_regclass('public.agencies') IS NOT NULL INTO v_has_agencies;
  SELECT to_regclass('public.projects') IS NOT NULL INTO v_has_projects;
  SELECT to_regclass('public.event_packages') IS NOT NULL INTO v_has_packages;
  SELECT to_regclass('public.event_orders') IS NOT NULL INTO v_has_orders;
  SELECT to_regclass('public.event_payments') IS NOT NULL INTO v_has_payments;
  SELECT to_regclass('public.event_entitlements') IS NOT NULL INTO v_has_entitlements;
  SELECT to_regclass('public.platform_activity_logs') IS NOT NULL INTO v_has_logs;
  SELECT to_regclass('public.stripe_webhook_events') IS NOT NULL INTO v_has_webhooks;

  SELECT data_type INTO v_orders_id_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_orders' AND column_name = 'id';

  SELECT data_type INTO v_payments_id_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_payments' AND column_name = 'id';

  SELECT data_type INTO v_payments_order_id_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_payments' AND column_name = 'order_id';

  SELECT data_type INTO v_entitlements_id_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_entitlements' AND column_name = 'id';

  SELECT data_type INTO v_entitlements_order_id_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_entitlements' AND column_name = 'order_id';

  RAISE NOTICE 'EventFrame Schema Audit -> agencies: %, projects: %, event_packages: %, event_orders: % (id=%), event_payments: % (id=%, order_id=%), event_entitlements: % (id=%, order_id=%), platform_activity_logs: %, stripe_webhook_events: %',
    v_has_agencies, v_has_projects, v_has_packages,
    v_has_orders, COALESCE(v_orders_id_type, 'none'),
    v_has_payments, COALESCE(v_payments_id_type, 'none'), COALESCE(v_payments_order_id_type, 'none'),
    v_has_entitlements, COALESCE(v_entitlements_id_type, 'none'), COALESCE(v_entitlements_order_id_type, 'none'),
    v_has_logs, v_has_webhooks;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 2: Create missing base tables (matching existing ID types if present)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agencies (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  slug text UNIQUE,
  user_id text,
  user_role text DEFAULT 'agency',
  owner_email text,
  status text NOT NULL DEFAULT 'active',
  subscription_status text,
  is_demo boolean NOT NULL DEFAULT false,
  is_test boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agency_id text,
  name text NOT NULL DEFAULT 'Wedding Event',
  groom_name text,
  bride_name text,
  slug text,
  theme_id text,
  wedding_date text,
  location text,
  status text DEFAULT 'draft',
  payment_status text DEFAULT 'unpaid',
  package_id text DEFAULT 'standard',
  activated_at timestamptz,
  expires_at timestamptz,
  is_test boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_packages (
  id text PRIMARY KEY,
  name text NOT NULL,
  price integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  guest_limit integer NOT NULL DEFAULT 1000,
  duration_months integer NOT NULL DEFAULT 12,
  description text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create missing event_orders, event_payments, and event_entitlements.
-- If event_orders is missing while event_payments/event_entitlements already exist,
-- match their order_id type (uuid vs text) so we do not break existing dependencies.
DO $$
DECLARE
  v_payments_order_type text;
  v_entitlements_order_type text;
  v_target_order_id_type text := 'text';
  v_orders_id_type text;
BEGIN
  IF to_regclass('public.event_orders') IS NULL THEN
    SELECT data_type INTO v_payments_order_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'event_payments' AND column_name = 'order_id';

    SELECT data_type INTO v_entitlements_order_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'event_entitlements' AND column_name = 'order_id';

    IF v_payments_order_type = 'uuid' OR v_entitlements_order_type = 'uuid' THEN
      v_target_order_id_type := 'uuid';
    END IF;

    IF v_target_order_id_type = 'uuid' THEN
      CREATE TABLE event_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id text NOT NULL,
        agency_id text NOT NULL DEFAULT 'unknown',
        customer_id text NOT NULL DEFAULT 'customer',
        package_id text NOT NULL DEFAULT 'standard',
        package_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
        amount integer NOT NULL DEFAULT 500,
        currency text NOT NULL DEFAULT 'usd',
        order_status text NOT NULL DEFAULT 'pending',
        order_type text NOT NULL DEFAULT 'purchase',
        stripe_session_id text,
        stripe_payment_intent_id text,
        completed_at timestamptz,
        failure_reason text,
        webhook_status text DEFAULT 'pending',
        last_webhook_event_id text,
        refund_status text DEFAULT 'none',
        refund_amount integer DEFAULT 0,
        refunded_at timestamptz,
        is_test boolean DEFAULT false,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      RAISE NOTICE 'Created missing table public.event_orders with id uuid to match existing order_id columns.';
    ELSE
      CREATE TABLE event_orders (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        event_id text NOT NULL,
        agency_id text NOT NULL DEFAULT 'unknown',
        customer_id text NOT NULL DEFAULT 'customer',
        package_id text NOT NULL DEFAULT 'standard',
        package_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
        amount integer NOT NULL DEFAULT 500,
        currency text NOT NULL DEFAULT 'usd',
        order_status text NOT NULL DEFAULT 'pending',
        order_type text NOT NULL DEFAULT 'purchase',
        stripe_session_id text,
        stripe_payment_intent_id text,
        completed_at timestamptz,
        failure_reason text,
        webhook_status text DEFAULT 'pending',
        last_webhook_event_id text,
        refund_status text DEFAULT 'none',
        refund_amount integer DEFAULT 0,
        refunded_at timestamptz,
        is_test boolean DEFAULT false,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      RAISE NOTICE 'Created missing table public.event_orders with id text.';
    END IF;
  END IF;

  -- Determine effective event_orders.id type before creating missing child tables
  SELECT data_type INTO v_orders_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_orders' AND column_name = 'id';

  IF to_regclass('public.event_payments') IS NULL THEN
    IF v_orders_id_type = 'uuid' THEN
      CREATE TABLE event_payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid,
        event_id text NOT NULL,
        agency_id text,
        customer_id text,
        provider text NOT NULL DEFAULT 'stripe',
        provider_transaction_id text UNIQUE,
        stripe_checkout_session_id text,
        stripe_payment_intent_id text,
        stripe_charge_id text,
        stripe_refund_id text,
        amount integer NOT NULL DEFAULT 500,
        currency text NOT NULL DEFAULT 'usd',
        payment_status text NOT NULL DEFAULT 'pending',
        refund_status text DEFAULT 'none',
        refund_amount integer DEFAULT 0,
        refunded_at timestamptz,
        webhook_event_id text,
        webhook_status text DEFAULT 'processed',
        failure_code text,
        failure_message text,
        is_test boolean DEFAULT false,
        paid_at timestamptz DEFAULT now(),
        created_at timestamptz DEFAULT now()
      );
      RAISE NOTICE 'Created missing table public.event_payments with uuid IDs matching event_orders.';
    ELSE
      CREATE TABLE event_payments (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        order_id text,
        event_id text NOT NULL,
        agency_id text,
        customer_id text,
        provider text NOT NULL DEFAULT 'stripe',
        provider_transaction_id text UNIQUE,
        stripe_checkout_session_id text,
        stripe_payment_intent_id text,
        stripe_charge_id text,
        stripe_refund_id text,
        amount integer NOT NULL DEFAULT 500,
        currency text NOT NULL DEFAULT 'usd',
        payment_status text NOT NULL DEFAULT 'pending',
        refund_status text DEFAULT 'none',
        refund_amount integer DEFAULT 0,
        refunded_at timestamptz,
        webhook_event_id text,
        webhook_status text DEFAULT 'processed',
        failure_code text,
        failure_message text,
        is_test boolean DEFAULT false,
        paid_at timestamptz DEFAULT now(),
        created_at timestamptz DEFAULT now()
      );
      RAISE NOTICE 'Created missing table public.event_payments with text IDs matching event_orders.';
    END IF;
  END IF;

  IF to_regclass('public.event_entitlements') IS NULL THEN
    IF v_orders_id_type = 'uuid' THEN
      CREATE TABLE event_entitlements (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id text NOT NULL,
        order_id uuid,
        guest_limit integer NOT NULL DEFAULT 1000,
        features jsonb NOT NULL DEFAULT '[]'::jsonb,
        activated_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 months'),
        status text DEFAULT 'active',
        revoked_at timestamptz,
        revoked_reason text,
        created_at timestamptz DEFAULT now()
      );
      RAISE NOTICE 'Created missing table public.event_entitlements with uuid IDs matching event_orders.';
    ELSE
      CREATE TABLE event_entitlements (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        event_id text NOT NULL,
        order_id text,
        guest_limit integer NOT NULL DEFAULT 1000,
        features jsonb NOT NULL DEFAULT '[]'::jsonb,
        activated_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 months'),
        status text DEFAULT 'active',
        revoked_at timestamptz,
        revoked_reason text,
        created_at timestamptz DEFAULT now()
      );
      RAISE NOTICE 'Created missing table public.event_entitlements with text IDs matching event_orders.';
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS platform_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text,
  actor_email text,
  actor_role text,
  action text NOT NULL,
  organization_id text,
  target_user_id text,
  target_event_id text,
  reference_id text,
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- STEP 3: Reconcile existing table structures (event_packages $5 USD plan)
-- ----------------------------------------------------------------------------
ALTER TABLE event_packages
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS price integer DEFAULT 500,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS guest_limit integer DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS duration_months integer DEFAULT 12,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Deactivate any legacy multi-tier plans without deleting historical references
UPDATE event_packages
SET is_active = false
WHERE id IN ('essential', 'premium', 'luxury', 'enterprise');

-- Authoritatively enforce 'standard' = USD $5.00 (500 cents) for 12 calendar months
INSERT INTO event_packages (id, name, price, currency, guest_limit, duration_months, description, features, is_active)
VALUES (
  'standard',
  'Event License',
  500,
  'usd',
  1000,
  12,
  'One-time payment for 12 months full event access. Free agency registration. No monthly subscription.',
  '["12 Months Full Event Access", "Live Guest Message & Photo Moderation Wall", "Bespoke Digital Invitation & Canvas Designer", "Custom RSVP Questionnaires & Dietary Tracking", "Curated Ballroom Display Art Aesthetics", "Couple Access PIN Login Portal", "CSV Attendee Records Export & Permanent Archival"]'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = 500,
  currency = 'usd',
  guest_limit = 1000,
  duration_months = 12,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  is_active = true;

-- ----------------------------------------------------------------------------
-- STEP 4: Add missing columns to agencies, projects, event_orders,
--         event_payments, event_entitlements, platform_activity_logs
-- ----------------------------------------------------------------------------
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS user_role text DEFAULT 'agency',
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS agency_id text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS package_id text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE event_orders
  ADD COLUMN IF NOT EXISTS event_id text,
  ADD COLUMN IF NOT EXISTS agency_id text,
  ADD COLUMN IF NOT EXISTS customer_id text,
  ADD COLUMN IF NOT EXISTS package_id text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS package_snapshot jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS amount integer DEFAULT 500,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS order_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'purchase',
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS webhook_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_webhook_event_id text,
  ADD COLUMN IF NOT EXISTS refund_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_amount integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE event_payments
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS event_id text,
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS provider_transaction_id text,
  ADD COLUMN IF NOT EXISTS amount integer DEFAULT 500,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_charge_id text,
  ADD COLUMN IF NOT EXISTS stripe_refund_id text,
  ADD COLUMN IF NOT EXISTS refund_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_amount integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_event_id text,
  ADD COLUMN IF NOT EXISTS webhook_status text DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS failure_code text,
  ADD COLUMN IF NOT EXISTS failure_message text,
  ADD COLUMN IF NOT EXISTS customer_id text,
  ADD COLUMN IF NOT EXISTS agency_id text,
  ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;

ALTER TABLE event_entitlements
  ADD COLUMN IF NOT EXISTS event_id text,
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS guest_limit integer DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

ALTER TABLE platform_activity_logs
  ADD COLUMN IF NOT EXISTS actor_id text,
  ADD COLUMN IF NOT EXISTS actor_email text,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS target_user_id text,
  ADD COLUMN IF NOT EXISTS target_event_id text,
  ADD COLUMN IF NOT EXISTS reference_id text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Ensure safe defaults on legacy NOT NULL columns created without defaults
ALTER TABLE event_orders
  ALTER COLUMN agency_id SET DEFAULT 'unknown',
  ALTER COLUMN customer_id SET DEFAULT 'customer',
  ALTER COLUMN package_id SET DEFAULT 'standard',
  ALTER COLUMN package_snapshot SET DEFAULT '{}'::jsonb,
  ALTER COLUMN amount SET DEFAULT 500,
  ALTER COLUMN currency SET DEFAULT 'usd',
  ALTER COLUMN order_status SET DEFAULT 'pending',
  ALTER COLUMN order_type SET DEFAULT 'purchase';

ALTER TABLE event_payments
  ALTER COLUMN provider SET DEFAULT 'stripe',
  ALTER COLUMN amount SET DEFAULT 500,
  ALTER COLUMN currency SET DEFAULT 'usd',
  ALTER COLUMN payment_status SET DEFAULT 'pending',
  ALTER COLUMN paid_at SET DEFAULT now(),
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE event_entitlements
  ALTER COLUMN guest_limit SET DEFAULT 1000,
  ALTER COLUMN features SET DEFAULT '[]'::jsonb,
  ALTER COLUMN activated_at SET DEFAULT now(),
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '12 months'),
  ALTER COLUMN created_at SET DEFAULT now();

-- ----------------------------------------------------------------------------
-- STEP 5: Normalize compatible ID types (dependency-checked, lossless)
--   - Preserves matching uuid<->uuid or text<->text schemas without alteration.
--   - Ensures PK id columns have safe UUID/TEXT defaults for inserts omitting id.
--   - Only alters mismatched order_id / id types after checking pg_depend,
--     views, policies, and external FKs.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_orders_id_type text;
  v_payments_id_type text;
  v_payments_order_type text;
  v_entitlements_id_type text;
  v_entitlements_order_type text;
  v_has_orders_pk boolean;
  v_orders_id_attnum smallint;
  v_payments_order_attnum smallint;
  v_entitlements_order_attnum smallint;
  v_blocking_view_count integer := 0;
  v_blocking_policy_count integer := 0;
  v_external_fk_count integer := 0;
  v_non_uuid_pay_count integer := 0;
  v_non_uuid_ent_count integer := 0;
BEGIN
  SELECT data_type INTO v_orders_id_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_orders' AND column_name = 'id';

  SELECT data_type INTO v_payments_id_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_payments' AND column_name = 'id';

  SELECT data_type INTO v_payments_order_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_payments' AND column_name = 'order_id';

  SELECT data_type INTO v_entitlements_id_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_entitlements' AND column_name = 'id';

  SELECT data_type INTO v_entitlements_order_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_entitlements' AND column_name = 'order_id';

  -- Ensure PK id defaults exist on all three billing tables
  IF v_orders_id_type = 'uuid' THEN
    ALTER TABLE event_orders ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ELSIF v_orders_id_type = 'text' THEN
    ALTER TABLE event_orders ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  END IF;

  IF v_payments_id_type = 'uuid' THEN
    ALTER TABLE event_payments ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ELSIF v_payments_id_type = 'text' THEN
    ALTER TABLE event_payments ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  END IF;

  IF v_entitlements_id_type = 'uuid' THEN
    ALTER TABLE event_entitlements ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ELSIF v_entitlements_id_type = 'text' THEN
    ALTER TABLE event_entitlements ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  END IF;

  -- Ensure event_orders(id) has a PK or UNIQUE constraint so FKs can reference it
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'event_orders'
      AND c.contype IN ('p', 'u')
  ) INTO v_has_orders_pk;

  IF NOT v_has_orders_pk THEN
    IF NOT EXISTS (
      SELECT 1 FROM (SELECT id FROM event_orders GROUP BY id HAVING count(*) > 1 OR id IS NULL) d
    ) THEN
      ALTER TABLE event_orders ADD CONSTRAINT event_orders_pkey PRIMARY KEY (id);
    END IF;
  END IF;

  -- Check if any ID type mismatch exists between event_orders.id and child order_id columns
  IF v_payments_order_type IS DISTINCT FROM v_orders_id_type
     OR v_entitlements_order_type IS DISTINCT FROM v_orders_id_type THEN

    -- Drop known self-managed order_id FKs before inspecting remaining dependencies
    ALTER TABLE event_payments DROP CONSTRAINT IF EXISTS event_payments_order_id_fkey;
    ALTER TABLE event_entitlements DROP CONSTRAINT IF EXISTS event_entitlements_order_id_fkey;

    -- Check for views referencing these tables
    SELECT count(*) INTO v_blocking_view_count
    FROM information_schema.view_column_usage
    WHERE table_schema = 'public'
      AND table_name IN ('event_orders', 'event_payments', 'event_entitlements')
      AND column_name IN ('id', 'order_id');

    -- Check for RLS policies referencing id or order_id
    SELECT count(*) INTO v_blocking_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('event_orders', 'event_payments', 'event_entitlements')
      AND (
        COALESCE(qual, '') ~ '\m(id|order_id)\M'
        OR COALESCE(with_check, '') ~ '\m(id|order_id)\M'
      );

    -- Check for external FKs from unrelated tables referencing event_orders.id
    SELECT count(*) INTO v_external_fk_count
    FROM pg_constraint c
    JOIN pg_class ref_t ON ref_t.oid = c.confrelid
    JOIN pg_namespace ref_n ON ref_n.oid = ref_t.relnamespace
    JOIN pg_class src_t ON src_t.oid = c.conrelid
    WHERE c.contype = 'f'
      AND ref_n.nspname = 'public'
      AND ref_t.relname = 'event_orders'
      AND src_t.relname NOT IN ('event_payments', 'event_entitlements');

    IF v_orders_id_type = 'uuid' THEN
      -- Prefer preserving event_orders.id as uuid if child text order_ids contain only valid UUIDs or NULL
      IF v_payments_order_type = 'text' THEN
        SELECT count(*) INTO v_non_uuid_pay_count
        FROM event_payments
        WHERE order_id IS NOT NULL
          AND btrim(order_id) <> ''
          AND order_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
      END IF;

      IF v_entitlements_order_type = 'text' THEN
        SELECT count(*) INTO v_non_uuid_ent_count
        FROM event_entitlements
        WHERE order_id IS NOT NULL
          AND btrim(order_id) <> ''
          AND order_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
      END IF;

      IF v_blocking_view_count = 0 AND v_blocking_policy_count = 0
         AND v_non_uuid_pay_count = 0 AND v_non_uuid_ent_count = 0 THEN
        IF v_payments_order_type = 'text' THEN
          ALTER TABLE event_payments ALTER COLUMN order_id TYPE uuid USING NULLIF(btrim(order_id), '')::uuid;
        END IF;
        IF v_entitlements_order_type = 'text' THEN
          ALTER TABLE event_entitlements ALTER COLUMN order_id TYPE uuid USING NULLIF(btrim(order_id), '')::uuid;
        END IF;
        RAISE NOTICE 'Aligned child order_id columns to uuid to match event_orders.id cleanly.';
      ELSIF v_blocking_view_count = 0 AND v_blocking_policy_count = 0 AND v_external_fk_count = 0 THEN
        -- Lossless upgrade to text only when non-UUID legacy order_ids exist and no external dependencies block it
        IF v_payments_order_type = 'uuid' THEN
          ALTER TABLE event_payments ALTER COLUMN order_id TYPE text USING order_id::text;
        END IF;
        IF v_entitlements_order_type = 'uuid' THEN
          ALTER TABLE event_entitlements ALTER COLUMN order_id TYPE text USING order_id::text;
        END IF;
        ALTER TABLE event_orders ALTER COLUMN id TYPE text USING id::text;
        ALTER TABLE event_orders ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        RAISE NOTICE 'Normalized event_orders.id and child order_id columns losslessly to text.';
      ELSE
        RAISE NOTICE 'Skipped ALTER COLUMN TYPE due to existing view/policy/external FK dependencies (views=%, policies=%, fks=%). RPCs handle uuid/text dynamically.',
          v_blocking_view_count, v_blocking_policy_count, v_external_fk_count;
      END IF;
    ELSIF v_orders_id_type = 'text' THEN
      -- event_orders.id is text while one or both child order_id columns are uuid
      IF v_blocking_view_count = 0 AND v_blocking_policy_count = 0 THEN
        IF v_payments_order_type = 'uuid' THEN
          ALTER TABLE event_payments ALTER COLUMN order_id TYPE text USING order_id::text;
        END IF;
        IF v_entitlements_order_type = 'uuid' THEN
          ALTER TABLE event_entitlements ALTER COLUMN order_id TYPE text USING order_id::text;
        END IF;
        RAISE NOTICE 'Normalized child uuid order_id columns to text to match event_orders.id.';
      ELSE
        RAISE NOTICE 'Skipped child order_id type normalization due to existing view/policy dependencies (views=%, policies=%).',
          v_blocking_view_count, v_blocking_policy_count;
      END IF;
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 6: Create indexes (clean blank strings first, verify uniqueness safety)
-- ----------------------------------------------------------------------------
UPDATE event_orders
SET stripe_session_id = NULL
WHERE stripe_session_id IS NOT NULL AND btrim(stripe_session_id) = '';

UPDATE event_orders
SET stripe_payment_intent_id = NULL
WHERE stripe_payment_intent_id IS NOT NULL AND btrim(stripe_payment_intent_id) = '';

UPDATE event_payments
SET stripe_checkout_session_id = NULL
WHERE stripe_checkout_session_id IS NOT NULL AND btrim(stripe_checkout_session_id) = '';

UPDATE event_payments
SET stripe_payment_intent_id = NULL
WHERE stripe_payment_intent_id IS NOT NULL AND btrim(stripe_payment_intent_id) = '';

UPDATE event_payments
SET provider_transaction_id = NULL
WHERE provider_transaction_id IS NOT NULL AND btrim(provider_transaction_id) = '';

CREATE INDEX IF NOT EXISTS idx_agencies_user_id ON agencies(user_id);
CREATE INDEX IF NOT EXISTS idx_agencies_status ON agencies(status);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_payment_status ON projects(payment_status);
CREATE INDEX IF NOT EXISTS idx_projects_expires_at ON projects(expires_at);
CREATE INDEX IF NOT EXISTS idx_projects_agency_id ON projects(agency_id);
CREATE INDEX IF NOT EXISTS idx_projects_agency_payment ON projects(agency_id, payment_status);

CREATE INDEX IF NOT EXISTS idx_event_orders_event ON event_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_agency ON event_orders(agency_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_status ON event_orders(order_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_orders_pi ON event_orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_payments_event ON event_payments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_payments_order_id ON event_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_event_payments_provider_tx ON event_payments(provider_transaction_id);

CREATE INDEX IF NOT EXISTS idx_event_entitlements_event ON event_entitlements(event_id);
CREATE INDEX IF NOT EXISTS idx_event_entitlements_order_id ON event_entitlements(order_id);

CREATE INDEX IF NOT EXISTS idx_platform_activity_created_at ON platform_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_activity_action ON platform_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_platform_activity_org ON platform_activity_logs(organization_id);

DO $$
BEGIN
  -- Unique partial index on event_orders(stripe_session_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'event_orders' AND indexname = 'uq_event_orders_stripe_session'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM event_orders WHERE stripe_session_id IS NOT NULL GROUP BY stripe_session_id HAVING count(*) > 1
    ) THEN
      CREATE UNIQUE INDEX uq_event_orders_stripe_session ON event_orders(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
    ELSE
      CREATE INDEX IF NOT EXISTS idx_event_orders_stripe_session_lookup ON event_orders(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
      RAISE WARNING 'Legacy duplicate stripe_session_id values exist in event_orders; created non-unique lookup index instead.';
    END IF;
  END IF;

  -- Unique partial index on event_payments(stripe_checkout_session_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'event_payments' AND indexname = 'uq_event_payments_checkout_session'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM event_payments WHERE stripe_checkout_session_id IS NOT NULL GROUP BY stripe_checkout_session_id HAVING count(*) > 1
    ) THEN
      CREATE UNIQUE INDEX uq_event_payments_checkout_session ON event_payments(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
    ELSE
      CREATE INDEX IF NOT EXISTS idx_event_payments_checkout_session_lookup ON event_payments(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
      RAISE WARNING 'Legacy duplicate stripe_checkout_session_id values exist in event_payments; created non-unique lookup index instead.';
    END IF;
  END IF;

  -- Unique partial index on event_payments(stripe_payment_intent_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'event_payments' AND indexname = 'uq_event_payments_payment_intent'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM event_payments WHERE stripe_payment_intent_id IS NOT NULL GROUP BY stripe_payment_intent_id HAVING count(*) > 1
    ) THEN
      CREATE UNIQUE INDEX uq_event_payments_payment_intent ON event_payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
    ELSE
      CREATE INDEX IF NOT EXISTS idx_event_payments_payment_intent_lookup ON event_payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
      RAISE WARNING 'Legacy duplicate stripe_payment_intent_id values exist in event_payments; created non-unique lookup index instead.';
    END IF;
  END IF;

  -- Unique constraint/index on event_payments(provider_transaction_id) if not already unique
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'event_payments'
      AND ix.indisunique = true
      AND ix.indnatts = 1
      AND ix.indpred IS NULL
      AND a.attname = 'provider_transaction_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM event_payments WHERE provider_transaction_id IS NOT NULL GROUP BY provider_transaction_id HAVING count(*) > 1
    ) THEN
      CREATE UNIQUE INDEX uq_event_payments_provider_tx ON event_payments(provider_transaction_id);
    ELSE
      RAISE WARNING 'Legacy duplicate provider_transaction_id values exist in event_payments; preserving records without unique constraint.';
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 7: Rebuild foreign keys cleanly (only when types & PKs match)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_orders_id_type text;
  v_payments_order_type text;
  v_entitlements_order_type text;
  v_has_orders_pk boolean;
BEGIN
  SELECT data_type INTO v_orders_id_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_orders' AND column_name = 'id';

  SELECT data_type INTO v_payments_order_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_payments' AND column_name = 'order_id';

  SELECT data_type INTO v_entitlements_order_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_entitlements' AND column_name = 'order_id';

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'event_orders'
      AND c.contype IN ('p', 'u')
  ) INTO v_has_orders_pk;

  IF v_has_orders_pk AND v_orders_id_type IS NOT NULL THEN
    IF v_payments_order_type = v_orders_id_type THEN
      ALTER TABLE event_payments DROP CONSTRAINT IF EXISTS event_payments_order_id_fkey;
      ALTER TABLE event_payments
        ADD CONSTRAINT event_payments_order_id_fkey
        FOREIGN KEY (order_id) REFERENCES event_orders(id) ON DELETE SET NULL NOT VALID;
    END IF;

    IF v_entitlements_order_type = v_orders_id_type THEN
      ALTER TABLE event_entitlements DROP CONSTRAINT IF EXISTS event_entitlements_order_id_fkey;
      ALTER TABLE event_entitlements
        ADD CONSTRAINT event_entitlements_order_id_fkey
        FOREIGN KEY (order_id) REFERENCES event_orders(id) ON DELETE SET NULL NOT VALID;
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 8: Backfill existing Stripe transaction IDs (collision-safe)
-- ----------------------------------------------------------------------------
WITH cs_candidates AS (
  SELECT
    ctid AS row_ctid,
    provider_transaction_id,
    row_number() OVER (PARTITION BY provider_transaction_id ORDER BY created_at NULLS LAST, id::text) AS rn
  FROM event_payments ep
  WHERE ep.stripe_checkout_session_id IS NULL
    AND ep.provider_transaction_id LIKE 'cs\_%' ESCAPE '\'
    AND NOT EXISTS (
      SELECT 1 FROM event_payments existing
      WHERE existing.stripe_checkout_session_id = ep.provider_transaction_id
    )
)
UPDATE event_payments ep
SET stripe_checkout_session_id = c.provider_transaction_id
FROM cs_candidates c
WHERE ep.ctid = c.row_ctid
  AND c.rn = 1;

WITH pi_candidates AS (
  SELECT
    ctid AS row_ctid,
    provider_transaction_id,
    row_number() OVER (PARTITION BY provider_transaction_id ORDER BY created_at NULLS LAST, id::text) AS rn
  FROM event_payments ep
  WHERE ep.stripe_payment_intent_id IS NULL
    AND ep.provider_transaction_id LIKE 'pi\_%' ESCAPE '\'
    AND NOT EXISTS (
      SELECT 1 FROM event_payments existing
      WHERE existing.stripe_payment_intent_id = ep.provider_transaction_id
    )
)
UPDATE event_payments ep
SET stripe_payment_intent_id = p.provider_transaction_id
FROM pi_candidates p
WHERE ep.ctid = p.row_ctid
  AND p.rn = 1;

-- ----------------------------------------------------------------------------
-- STEP 9: Create webhook tracking table (stripe_webhook_events) & RLS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id text PRIMARY KEY, -- Stripe evt_... identifier
  event_type text NOT NULL,
  processing_status text NOT NULL DEFAULT 'processing', -- processing, processed, failed, ignored
  related_order_id text,
  related_event_id text,
  payment_intent_id text,
  checkout_session_id text,
  payload jsonb DEFAULT '{}'::jsonb,
  error_details text,
  retry_count integer NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS related_order_id text,
  ADD COLUMN IF NOT EXISTS related_event_id text,
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS checkout_session_id text,
  ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_details text,
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_status ON stripe_webhook_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_order ON stripe_webhook_events(related_order_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_received ON stripe_webhook_events(received_at DESC);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Service role full access stripe_webhook_events" ON stripe_webhook_events;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'role'
  ) THEN
    CREATE POLICY "Service role full access stripe_webhook_events"
      ON stripe_webhook_events
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE POLICY "Service role full access stripe_webhook_events"
      ON stripe_webhook_events
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 10: Create payment completion RPC (complete_event_payment_order)
--   Handles both uuid and text primary/foreign key schemas transparently,
--   locks project & order rows deterministically, enforces $5.00 USD pricing,
--   computes 12 calendar months activation/extension, and ensures idempotency.
-- ----------------------------------------------------------------------------
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
AS $$
DECLARE
  v_now timestamptz := now();
  v_project record;
  v_order record;
  v_has_order boolean := false;
  v_existing_payment record;
  v_orders_id_type text;
  v_payments_order_type text;
  v_entitlements_order_type text;
  v_effective_order_id text;
  v_effective_agency_id text;
  v_effective_customer_id text;
  v_effective_provider text;
  v_tx_id text;
  v_session_clean text;
  v_pi_clean text;
  v_charge_clean text;
  v_webhook_clean text;
  v_is_already_active boolean := false;
  v_activated_at timestamptz;
  v_expires_at timestamptz;
  v_order_type text;
  v_package_snapshot jsonb;
  v_entitlement_features jsonb;
  v_existing_tx_payment_id text;
  v_order_json jsonb := NULL;
BEGIN
  -- Validate authoritative amount & currency unless explicit legacy migration
  IF COALESCE(p_provider, 'stripe') <> 'legacy_migration' THEN
    IF p_amount_cents IS NULL OR p_amount_cents <> 500 THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT: expected 500 cents, got %', p_amount_cents;
    END IF;
    IF lower(COALESCE(p_currency, '')) <> 'usd' THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_CURRENCY: expected usd, got %', p_currency;
    END IF;
  END IF;

  -- Lock target project row FIRST in deterministic order to prevent races
  SELECT * INTO v_project
  FROM projects
  WHERE id::text = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND: %', p_event_id;
  END IF;

  v_effective_agency_id := COALESCE(NULLIF(p_agency_id, ''), v_project.agency_id);

  IF v_project.agency_id IS NOT NULL AND v_effective_agency_id IS NOT NULL AND v_project.agency_id::text <> v_effective_agency_id THEN
    RAISE EXCEPTION 'OWNERSHIP_MISMATCH: event agency % does not match %', v_project.agency_id, v_effective_agency_id;
  END IF;

  -- Inspect actual column data types so both uuid & text schemas work cleanly
  SELECT data_type INTO v_orders_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_orders' AND column_name = 'id';

  SELECT data_type INTO v_payments_order_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_payments' AND column_name = 'order_id';

  SELECT data_type INTO v_entitlements_order_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'event_entitlements' AND column_name = 'order_id';

  -- Lock existing order if provided or matched by stripe_session_id
  IF p_order_id IS NOT NULL AND btrim(p_order_id) <> '' THEN
    SELECT * INTO v_order
    FROM event_orders
    WHERE id::text = p_order_id
    FOR UPDATE;
    IF FOUND THEN
      v_has_order := true;
    END IF;
  END IF;

  IF NOT v_has_order AND p_stripe_session_id IS NOT NULL AND btrim(p_stripe_session_id) <> '' THEN
    SELECT * INTO v_order
    FROM event_orders
    WHERE stripe_session_id = p_stripe_session_id
    FOR UPDATE;
    IF FOUND THEN
      v_has_order := true;
    END IF;
  END IF;

  IF v_has_order THEN
    IF v_order.event_id <> p_event_id THEN
      RAISE EXCEPTION 'ORDER_EVENT_MISMATCH: order % belongs to % not %', v_order.id, v_order.event_id, p_event_id;
    END IF;
    IF v_order.agency_id IS NOT NULL AND v_effective_agency_id IS NOT NULL AND v_order.agency_id <> v_effective_agency_id THEN
      RAISE EXCEPTION 'ORDER_AGENCY_MISMATCH: order agency % does not match %', v_order.agency_id, v_effective_agency_id;
    END IF;
    v_effective_order_id := v_order.id::text;
  ELSE
    IF p_order_id IS NOT NULL AND btrim(p_order_id) <> '' THEN
      IF v_orders_id_type = 'uuid' AND p_order_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_effective_order_id := gen_random_uuid()::text;
      ELSE
        v_effective_order_id := p_order_id;
      END IF;
    ELSE
      v_effective_order_id := gen_random_uuid()::text;
    END IF;
  END IF;

  v_session_clean := NULLIF(btrim(COALESCE(p_stripe_session_id, '')), '');
  v_pi_clean := NULLIF(btrim(COALESCE(p_stripe_payment_intent_id, '')), '');
  v_charge_clean := NULLIF(btrim(COALESCE(p_stripe_charge_id, '')), '');
  v_webhook_clean := NULLIF(btrim(COALESCE(p_webhook_event_id, '')), '');
  v_tx_id := COALESCE(v_pi_clean, v_session_clean, v_effective_order_id);
  v_effective_customer_id := COALESCE(NULLIF(btrim(COALESCE(p_customer_id, '')), ''), 'customer');
  v_effective_provider := COALESCE(NULLIF(btrim(COALESCE(p_provider, '')), ''), 'stripe');

  -- Idempotency check 1: Order already completed
  IF v_has_order AND v_order.order_status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'orderId', v_effective_order_id,
      'eventId', p_event_id,
      'activatedAt', COALESCE(v_project.activated_at, v_now),
      'expiresAt', v_project.expires_at,
      'isRenewal', (v_order.order_type = 'renewal'),
      'amountPaid', 5.00,
      'currency', 'USD',
      'event', row_to_json(v_project)::jsonb,
      'order', row_to_json(v_order)::jsonb
    );
  END IF;

  -- Idempotency check 2: Matching payment already recorded as succeeded or refunded
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
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'orderId', v_effective_order_id,
      'eventId', p_event_id,
      'activatedAt', COALESCE(v_project.activated_at, v_existing_payment.paid_at, v_now),
      'expiresAt', v_project.expires_at,
      'isRenewal', false,
      'amountPaid', 5.00,
      'currency', 'USD',
      'event', row_to_json(v_project)::jsonb
    );
  END IF;

  -- Compute 12 calendar months expiration rules:
  -- Active & unexpired -> extend existing expires_at + 12 months
  -- Unpaid / expired / cancelled -> activate from now + 12 months
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

  -- Upsert completed order (type-safe across uuid and text schemas)
  IF v_orders_id_type = 'uuid' THEN
    EXECUTE $ord_uuid$
      INSERT INTO event_orders (
        id, event_id, agency_id, customer_id, package_id, package_snapshot,
        amount, currency, order_status, order_type,
        stripe_session_id, stripe_payment_intent_id,
        completed_at, webhook_status, last_webhook_event_id,
        created_at, updated_at
      )
      VALUES (
        $1::uuid, $2, $3, $4, 'standard', $5,
        500, 'usd', 'completed', $6,
        $7, $8,
        $9, CASE WHEN $10 IS NOT NULL THEN 'processed' ELSE 'verified' END, $10,
        $9, $9
      )
      ON CONFLICT (id) DO UPDATE SET
        customer_id = COALESCE(NULLIF($4, ''), event_orders.customer_id),
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
    $ord_uuid$
    INTO v_order_json
    USING
      v_effective_order_id,
      p_event_id,
      COALESCE(v_effective_agency_id, 'unknown'),
      v_effective_customer_id,
      v_package_snapshot,
      v_order_type,
      v_session_clean,
      v_pi_clean,
      v_now,
      v_webhook_clean;
  ELSE
    INSERT INTO event_orders (
      id, event_id, agency_id, customer_id, package_id, package_snapshot,
      amount, currency, order_status, order_type,
      stripe_session_id, stripe_payment_intent_id,
      completed_at, webhook_status, last_webhook_event_id,
      created_at, updated_at
    )
    VALUES (
      v_effective_order_id, p_event_id, COALESCE(v_effective_agency_id, 'unknown'),
      v_effective_customer_id, 'standard', v_package_snapshot,
      500, 'usd', 'completed', v_order_type,
      v_session_clean, v_pi_clean,
      v_now, CASE WHEN v_webhook_clean IS NOT NULL THEN 'processed' ELSE 'verified' END,
      v_webhook_clean,
      v_now, v_now
    )
    ON CONFLICT (id) DO UPDATE SET
      customer_id = COALESCE(NULLIF(v_effective_customer_id, ''), event_orders.customer_id),
      order_status = 'completed',
      order_type = v_order_type,
      stripe_session_id = COALESCE(v_session_clean, event_orders.stripe_session_id),
      stripe_payment_intent_id = COALESCE(v_pi_clean, event_orders.stripe_payment_intent_id),
      completed_at = v_now,
      failure_reason = NULL,
      webhook_status = CASE WHEN v_webhook_clean IS NOT NULL THEN 'processed' ELSE event_orders.webhook_status END,
      last_webhook_event_id = COALESCE(v_webhook_clean, event_orders.last_webhook_event_id),
      updated_at = v_now
    RETURNING row_to_json(event_orders)::jsonb INTO v_order_json;
  END IF;

  -- Upsert payment ledger entry cleanly (updates existing failed/pending row if provider_transaction_id matches)
  SELECT id::text INTO v_existing_tx_payment_id
  FROM event_payments
  WHERE provider_transaction_id = v_tx_id
  FOR UPDATE
  LIMIT 1;

  IF v_existing_tx_payment_id IS NOT NULL THEN
    IF v_payments_order_type = 'uuid' AND v_effective_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      EXECUTE $pay_upd_uuid$
        UPDATE event_payments
        SET
          order_id = COALESCE(order_id, $1::uuid),
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
      $pay_upd_uuid$
      USING v_effective_order_id, v_session_clean, v_pi_clean, v_charge_clean, v_webhook_clean, v_now, v_existing_tx_payment_id;
    ELSE
      EXECUTE $pay_upd_text$
        UPDATE event_payments
        SET
          order_id = COALESCE(order_id, $1),
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
      $pay_upd_text$
      USING v_effective_order_id, v_session_clean, v_pi_clean, v_charge_clean, v_webhook_clean, v_now, v_existing_tx_payment_id;
    END IF;
  ELSE
    -- Omit id so table's native DEFAULT (uuid or text) generates primary key cleanly
    IF v_payments_order_type = 'uuid' THEN
      EXECUTE $pay_ins_uuid$
        INSERT INTO event_payments (
          order_id, event_id, agency_id, customer_id,
          provider, provider_transaction_id,
          stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id,
          amount, currency, payment_status,
          webhook_event_id, webhook_status,
          paid_at, created_at
        )
        VALUES (
          CASE WHEN $1 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN $1::uuid ELSE NULL END,
          $2, $3, $4,
          $5, $6,
          $7, $8, $9,
          500, 'usd', 'succeeded',
          $10, 'processed',
          $11, $11
        )
      $pay_ins_uuid$
      USING
        v_effective_order_id, p_event_id, v_effective_agency_id, v_effective_customer_id,
        v_effective_provider, v_tx_id,
        v_session_clean, v_pi_clean, v_charge_clean,
        v_webhook_clean, v_now;
    ELSE
      INSERT INTO event_payments (
        order_id, event_id, agency_id, customer_id,
        provider, provider_transaction_id,
        stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id,
        amount, currency, payment_status,
        webhook_event_id, webhook_status,
        paid_at, created_at
      )
      VALUES (
        v_effective_order_id, p_event_id, v_effective_agency_id,
        v_effective_customer_id,
        v_effective_provider, v_tx_id,
        v_session_clean, v_pi_clean, v_charge_clean,
        500, 'usd', 'succeeded',
        v_webhook_clean, 'processed',
        v_now, v_now
      );
    END IF;
  END IF;

  -- Grant active 12-month event entitlement (omit id so native uuid/text DEFAULT applies)
  IF v_entitlements_order_type = 'uuid' THEN
    EXECUTE $ent_ins_uuid$
      INSERT INTO event_entitlements (
        event_id, order_id, guest_limit, features,
        activated_at, expires_at, status, created_at
      )
      VALUES (
        $1,
        CASE WHEN $2 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN $2::uuid ELSE NULL END,
        1000, $3,
        $4, $5, 'active', $6
      )
    $ent_ins_uuid$
    USING p_event_id, v_effective_order_id, v_entitlement_features, v_activated_at, v_expires_at, v_now;
  ELSE
    INSERT INTO event_entitlements (
      event_id, order_id, guest_limit, features,
      activated_at, expires_at, status, created_at
    )
    VALUES (
      p_event_id, v_effective_order_id, 1000,
      v_entitlement_features,
      v_activated_at, v_expires_at, 'active', v_now
    );
  END IF;

  -- Activate/extend project
  UPDATE projects
  SET
    payment_status = 'paid',
    status = 'active',
    package_id = 'standard',
    activated_at = v_activated_at,
    expires_at = v_expires_at,
    updated_at = v_now
  WHERE id::text = p_event_id
  RETURNING * INTO v_project;

  -- Record immutable platform activity log
  INSERT INTO platform_activity_logs (
    action, actor_id, organization_id, target_event_id, reference_id, summary, metadata, created_at
  )
  VALUES (
    'PAYMENT_COMPLETED',
    COALESCE(NULLIF(p_customer_id, ''), 'stripe'),
    v_effective_agency_id,
    p_event_id,
    v_tx_id,
    format('Payment completed ($5.00 USD) for event "%s"', COALESCE(v_project.name, p_event_id)),
    jsonb_build_object(
      'orderId', v_effective_order_id,
      'stripeSessionId', v_session_clean,
      'stripePaymentIntentId', v_pi_clean,
      'amountCents', 500,
      'currency', 'USD',
      'isRenewal', v_is_already_active
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'orderId', v_effective_order_id,
    'eventId', p_event_id,
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

-- ----------------------------------------------------------------------------
-- STEP 11: Create refund processing RPC (process_stripe_refund)
--   Supports full & partial refunds across uuid and text schemas,
--   idempotency by stripe_refund_id, and explicit entitlement revocation
--   + project cancellation ONLY on full refund.
-- ----------------------------------------------------------------------------
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
AS $$
DECLARE
  v_now timestamptz := now();
  v_payment record;
  v_order_agency_id text := NULL;
  v_is_full boolean;
  v_effective_total integer;
  v_new_refund_status text;
  v_new_payment_status text;
  v_refund_id_clean text := NULLIF(btrim(COALESCE(p_stripe_refund_id, '')), '');
  v_pi_clean text := NULLIF(btrim(COALESCE(p_payment_intent_id, '')), '');
  v_session_clean text := NULLIF(btrim(COALESCE(p_checkout_session_id, '')), '');
  v_charge_clean text := NULLIF(btrim(COALESCE(p_charge_id, '')), '');
  v_webhook_clean text := NULLIF(btrim(COALESCE(p_webhook_event_id, '')), '');
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
        'eventId', v_payment.event_id,
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
    RETURNING agency_id INTO v_order_agency_id;
  END IF;

  -- Explicit Business Policy:
  -- Full Refund -> Revoke event entitlement & disable paid functionality.
  -- Partial Refund -> Record adjustment while retaining active license access.
  IF v_is_full THEN
    UPDATE event_entitlements
    SET
      status = 'revoked',
      revoked_at = v_now,
      revoked_reason = COALESCE(NULLIF(p_reason, ''), 'Full Stripe refund processed')
    WHERE event_id = v_payment.event_id
      AND (v_payment.order_id IS NULL OR order_id::text = v_payment.order_id::text)
      AND status = 'active';

    UPDATE projects
    SET
      payment_status = 'refunded',
      status = 'cancelled',
      updated_at = v_now
    WHERE id::text = v_payment.event_id;
  END IF;

  INSERT INTO platform_activity_logs (
    action, actor_id, actor_email, organization_id, target_event_id, reference_id, summary, metadata, created_at
  )
  VALUES (
    CASE WHEN v_is_full THEN 'PAYMENT_REFUNDED' ELSE 'PAYMENT_PARTIALLY_REFUNDED' END,
    COALESCE(NULLIF(p_actor_id, ''), 'stripe'),
    NULLIF(p_actor_email, ''),
    COALESCE(v_payment.agency_id, v_order_agency_id),
    v_payment.event_id,
    COALESCE(v_refund_id_clean, v_pi_clean, v_payment.id::text),
    format(
      '%s refund ($%s USD) recorded for event %s',
      CASE WHEN v_is_full THEN 'Full' ELSE 'Partial' END,
      to_char(COALESCE(p_refund_amount_cents, v_effective_total)::numeric / 100.0, 'FM999990.00'),
      v_payment.event_id
    ),
    jsonb_build_object(
      'stripeRefundId', v_refund_id_clean,
      'paymentIntentId', COALESCE(v_pi_clean, v_payment.stripe_payment_intent_id),
      'refundAmountCents', COALESCE(p_refund_amount_cents, v_effective_total),
      'isFullRefund', v_is_full,
      'reason', p_reason,
      'entitlementRevoked', v_is_full
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'paymentId', v_payment.id::text,
    'eventId', v_payment.event_id,
    'refundStatus', v_new_refund_status,
    'paymentStatus', v_new_payment_status,
    'isFullRefund', v_is_full,
    'entitlementRevoked', v_is_full
  );
END;
$$;
