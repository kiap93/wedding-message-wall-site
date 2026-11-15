-- EventFrame: Super Admin Panel (/developer) Database Migration
-- Safely extends existing users_auth, agencies, and projects tables and adds
-- auditable platform_activity_logs and platform_settings tables.
-- Preserves all existing production data and schemas idempotently.

-- 1. Ensure users_auth exists and extend with super_admin / suspension / profile metadata
CREATE TABLE IF NOT EXISTS users_auth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS users_auth
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS auth_provider text DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS external_user_id text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_users_auth_email ON users_auth (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_auth_role ON users_auth (role);
CREATE INDEX IF NOT EXISTS idx_users_auth_status ON users_auth (status);
CREATE INDEX IF NOT EXISTS idx_users_auth_external_id ON users_auth (external_user_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_created_at ON users_auth (created_at DESC);

-- Ensure platform owner account has super_admin role if already present in users_auth
UPDATE users_auth
SET role = 'super_admin',
    status = 'active',
    is_verified = true,
    updated_at = now()
WHERE lower(email) = 'buildsiteasia@gmail.com'
  AND role IS DISTINCT FROM 'super_admin';

-- 2. Extend agencies (organizations) with status & test/deletion hygiene columns
ALTER TABLE IF EXISTS agencies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_agencies_user_id ON agencies (user_id);
CREATE INDEX IF NOT EXISTS idx_agencies_status ON agencies (status);
CREATE INDEX IF NOT EXISTS idx_agencies_created_at ON agencies (created_at DESC);

-- 3. Extend projects (events) with test/deletion hygiene columns
ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_projects_agency_id ON projects (agency_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects (created_at DESC);

-- 4. Create auditable platform_activity_logs table
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

CREATE INDEX IF NOT EXISTS idx_platform_activity_created_at ON platform_activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_activity_action ON platform_activity_logs (action);
CREATE INDEX IF NOT EXISTS idx_platform_activity_org ON platform_activity_logs (organization_id);
CREATE INDEX IF NOT EXISTS idx_platform_activity_user ON platform_activity_logs (target_user_id);

-- 5. Create platform_settings table for /developer/settings
CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (key, value, description)
VALUES
  ('platform_name', '"EventFrame.io"'::jsonb, 'Display name across platform portals'),
  ('support_email', '"support@eventframe.io"'::jsonb, 'Primary support contact for suspended accounts and billing inquiries'),
  ('allow_public_registration', 'true'::jsonb, 'Controls whether new agency and couple accounts can register'),
  ('maintenance_mode', 'false'::jsonb, 'Places public onboarding into scheduled maintenance notice mode'),
  ('default_event_price_usd', '5'::jsonb, 'Default pay-per-event activation price in USD'),
  ('default_event_duration_months', '12'::jsonb, 'Default validity duration per activated event in calendar months')
ON CONFLICT (key) DO NOTHING;

-- 6. Strict RLS: platform_activity_logs and platform_settings are strictly server/service_role only
ALTER TABLE platform_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access platform_activity_logs" ON platform_activity_logs;
CREATE POLICY "Service role full access platform_activity_logs"
  ON platform_activity_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access platform_settings" ON platform_settings;
CREATE POLICY "Service role full access platform_settings"
  ON platform_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
