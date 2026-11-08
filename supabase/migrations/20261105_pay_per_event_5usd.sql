-- EventFrame.io: USD $5 Pay-Per-Event Billing Database Migration
-- Enforces USD $5.00 one-time payment per event with 12 months validity.
-- Supports payment statuses: unpaid, pending_payment, paid, failed, cancelled.
-- Supports event statuses: draft, pending_payment, active, expired, cancelled.

-- 1. Extend projects table with billing fields
ALTER TABLE IF EXISTS projects 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS package_id text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Add index on event status and expiration
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_payment_status ON projects(payment_status);
CREATE INDEX IF NOT EXISTS idx_projects_expires_at ON projects(expires_at);
CREATE INDEX IF NOT EXISTS idx_projects_agency_payment ON projects(agency_id, payment_status);

-- 2. Create Event Packages Table
CREATE TABLE IF NOT EXISTS event_packages (
  id text PRIMARY KEY,
  name text NOT NULL,
  price integer NOT NULL, -- in cents: 500 for $5.00 USD
  currency text NOT NULL DEFAULT 'usd',
  guest_limit integer NOT NULL DEFAULT 1000,
  duration_months integer NOT NULL DEFAULT 12,
  description text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed USD $5 Pay-Per-Event Package
INSERT INTO event_packages (id, name, price, currency, guest_limit, duration_months, description, features)
VALUES 
  ('standard', 'Event License', 500, 'usd', 1000, 12, 'One-time payment for 12 months full event access. Free agency registration. No monthly subscription.', 
   '["12 Months Full Event Access", "Live Guest Message & Photo Moderation Wall", "Bespoke Digital Invitation & Canvas Designer", "Custom RSVP Questionnaires & Dietary Tracking", "Curated Ballroom Display Art Aesthetics", "Couple Access PIN Login Portal", "CSV Attendee Records Export & Permanent Archival"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  guest_limit = EXCLUDED.guest_limit,
  duration_months = EXCLUDED.duration_months,
  features = EXCLUDED.features;

-- 3. Create Event Orders Table
CREATE TABLE IF NOT EXISTS event_orders (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  agency_id text NOT NULL,
  customer_id text NOT NULL,
  package_id text NOT NULL DEFAULT 'standard',
  package_snapshot jsonb NOT NULL,
  amount integer NOT NULL DEFAULT 500, -- in cents ($5.00)
  currency text NOT NULL DEFAULT 'usd',
  order_status text NOT NULL DEFAULT 'completed', -- pending, completed, failed, cancelled
  order_type text NOT NULL DEFAULT 'purchase', -- purchase, renewal
  stripe_session_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_orders_event ON event_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_agency ON event_orders(agency_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_stripe_session ON event_orders(stripe_session_id);

-- 4. Create Event Payments Table
CREATE TABLE IF NOT EXISTS event_payments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id text,
  event_id text NOT NULL,
  provider text NOT NULL DEFAULT 'stripe',
  provider_transaction_id text UNIQUE,
  amount integer NOT NULL DEFAULT 500,
  currency text NOT NULL DEFAULT 'usd',
  payment_status text NOT NULL DEFAULT 'succeeded', -- pending, succeeded, failed, cancelled
  paid_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_payments_event ON event_payments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_payments_provider_tx ON event_payments(provider_transaction_id);

-- 5. Create Event Entitlements Table
CREATE TABLE IF NOT EXISTS event_entitlements (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id text NOT NULL,
  order_id text,
  guest_limit integer NOT NULL DEFAULT 1000,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  activated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_entitlements_event ON event_entitlements(event_id);

-- 6. LEGACY COMPATIBILITY: Preserve existing subscribers
DO $$
BEGIN
  -- Grandfather active legacy agencies' existing events
  UPDATE projects p
  SET 
    status = 'active',
    payment_status = 'paid',
    package_id = 'standard',
    activated_at = COALESCE(p.created_at, now()),
    expires_at = COALESCE(p.created_at, now()) + interval '12 months'
  FROM agencies a
  WHERE p.agency_id = a.id
    AND (a.subscription_status = 'active' OR a.is_demo = true)
    AND (p.payment_status IS NULL OR p.payment_status = 'unpaid');
END $$;
