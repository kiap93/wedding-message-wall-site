-- EventFrame: Pay-Per-Event Billing Database Migration
-- Converts commercial model from account-level subscription to event-level 12-month purchases

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

-- 2. Create Event Packages Table
CREATE TABLE IF NOT EXISTS event_packages (
  id text PRIMARY KEY,
  name text NOT NULL,
  price integer NOT NULL, -- in cents: e.g. 2900 for $29.00
  currency text NOT NULL DEFAULT 'usd',
  guest_limit integer NOT NULL,
  duration_months integer NOT NULL DEFAULT 12,
  description text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed Default Event Packages
INSERT INTO event_packages (id, name, price, currency, guest_limit, duration_months, description, features)
VALUES 
  ('essential', 'Essential', 2900, 'usd', 100, 12, 'Perfect for intimate ceremonies and micro-weddings.', 
   '["Up to 100 Invited Guests", "12 Months Full Event Access", "Bespoke Digital Invitation & Studio", "Online RSVP & Dietary Tracking", "Table QR Code for Guest Access", "Guest Photo & Message Uploads", "CSV Attendee Export for Caterers"]'::jsonb),
  ('standard', 'Standard', 5900, 'usd', 300, 12, 'Our most popular tier for classic wedding celebrations.', 
   '["Up to 300 Invited Guests", "12 Months Full Event Access", "All 8 Display Art Aesthetics", "Live Ballroom Projector Screen", "Real-Time Live Guest Moderation", "Conditional RSVP Questionnaires", "Dedicated Couple PIN Login Portal", "Permanent Memory Photo Archive"]'::jsonb),
  ('premium', 'Premium', 9900, 'usd', 500, 12, 'Designed for large weddings with multi-event itineraries.', 
   '["Up to 500 Invited Guests", "12 Months Full Event Access", "All Standard Features Included", "White-Label Agency Subdomain", "Custom Stationery Typography", "Unlimited Live Photo Uploads", "Priority Venue Screen Streaming", "1-Click Caterer & Planner Exports"]'::jsonb),
  ('luxury', 'Luxury', 14900, 'usd', 1000, 12, 'For grand ballroom galas and weekend destination celebrations.', 
   '["Up to 1000 Invited Guests", "12 Months Full Event Access", "All Premium Features Included", "Dedicated Event Concierge Support", "Bespoke Visual Styling Consultation", "Multi-Display Ballroom Sync", "High-Resolution Raw Photo Downloads"]'::jsonb),
  ('enterprise', 'Enterprise', 0, 'usd', 999999, 12, 'For high-profile celebrations and multi-venue festivals.', 
   '["Unlimited Guest Headcount", "12+ Months Custom Validity", "Custom Apex Domain CNAME", "Multi-Day Multi-Location Timeline", "Dedicated Engineering Support", "Custom CSS & Typography Integration"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  guest_limit = EXCLUDED.guest_limit,
  features = EXCLUDED.features;

-- 3. Create Event Orders Table
CREATE TABLE IF NOT EXISTS event_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  agency_id text NOT NULL,
  customer_id text NOT NULL,
  package_id text NOT NULL,
  package_snapshot jsonb NOT NULL,
  amount integer NOT NULL, -- in cents
  currency text NOT NULL DEFAULT 'usd',
  order_status text NOT NULL DEFAULT 'pending', -- pending, completed, failed, cancelled
  order_type text NOT NULL DEFAULT 'purchase', -- purchase, renewal, upgrade
  stripe_session_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_orders_event ON event_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_agency ON event_orders(agency_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_customer ON event_orders(customer_id);

-- 4. Create Event Payments Table
CREATE TABLE IF NOT EXISTS event_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES event_orders(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  provider text NOT NULL DEFAULT 'stripe',
  provider_transaction_id text UNIQUE,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  payment_status text NOT NULL DEFAULT 'pending', -- pending, succeeded, failed
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_payments_event ON event_payments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_payments_provider_tx ON event_payments(provider_transaction_id);

-- 5. Create Event Entitlements Table
CREATE TABLE IF NOT EXISTS event_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  order_id uuid REFERENCES event_orders(id) ON DELETE SET NULL,
  guest_limit integer NOT NULL DEFAULT 300,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  activated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_entitlements_event ON event_entitlements(event_id);

-- 6. LEGACY MIGRATION: Backfill existing events for active subscribers
-- Ensures existing paid customers NEVER lose access during migration.
DO $$
BEGIN
  -- Backfill events belonging to active agencies
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
    
  -- Mark legacy events that already expired
  UPDATE projects
  SET status = 'expired'
  WHERE expires_at IS NOT NULL AND expires_at < now() AND status = 'active';
END $$;
