-- ============================================================================
-- EventFrame.io: Platform-Level Developer Authorization (`is_developer`)
-- ============================================================================
-- Safe, idempotent migration introducing database-backed `is_developer`
-- authorization on the existing `public.users_auth` profile/auth table
-- (and conditionally `public.users` if present).
--
-- Security guarantees:
-- 1. Existing rows are preserved and default `is_developer = FALSE`.
-- 2. Existing `role = 'super_admin'` rows are backfilled to `is_developer = TRUE`
--    so active platform admins do not rely on hardcoded runtime email checks.
-- 3. `auth.users` is NOT modified.
-- 4. RLS & column/trigger guards block `anon` and `authenticated` clients
--    from reading other users' developer flags or escalating `is_developer`.
-- 5. Platform administration tables allow `service_role` access only (no
--    overly permissive `USING (true)` policies for `anon`/`authenticated`).
-- ============================================================================

-- 1. Add `is_developer` to `public.users_auth` (primary user profile/auth table)
ALTER TABLE IF EXISTS public.users_auth
  ADD COLUMN IF NOT EXISTS is_developer BOOLEAN NOT NULL DEFAULT FALSE;

-- Safely migrate existing `super_admin` database records to `is_developer = TRUE`
-- without modifying `auth.users` or hardcoding email addresses in runtime code.
DO $$
BEGIN
  IF to_regclass('public.users_auth') IS NOT NULL THEN
    UPDATE public.users_auth
    SET is_developer = TRUE,
        updated_at = COALESCE(updated_at, now())
    WHERE role = 'super_admin'
      AND is_developer IS DISTINCT FROM TRUE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_auth_is_developer
  ON public.users_auth (is_developer)
  WHERE is_developer = TRUE;

-- If a deployment also has a separate `public.users` table, extend it safely too
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS is_developer BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE INDEX IF NOT EXISTS idx_public_users_is_developer
      ON public.users (is_developer)
      WHERE is_developer = TRUE;
  END IF;
END $$;

-- 2. Harden RLS & Column Mutation Guards on `public.users_auth`
DO $$
BEGIN
  IF to_regclass('public.users_auth') IS NOT NULL THEN
    ALTER TABLE public.users_auth ENABLE ROW LEVEL SECURITY;

    -- Remove any permissive anon/authenticated policies if present
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.users_auth;
    DROP POLICY IF EXISTS "Enable insert for all users" ON public.users_auth;
    DROP POLICY IF EXISTS "Enable update for all users" ON public.users_auth;
    DROP POLICY IF EXISTS "Public read users_auth" ON public.users_auth;
    DROP POLICY IF EXISTS "Authenticated users read own profile" ON public.users_auth;
    DROP POLICY IF EXISTS "Authenticated users update own profile" ON public.users_auth;
    DROP POLICY IF EXISTS "Service role full access users_auth" ON public.users_auth;

    -- Only backend `service_role` may read or mutate `users_auth` directly
    CREATE POLICY "Service role full access users_auth"
      ON public.users_auth
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    -- Defense-in-depth: revoke direct write & anon read privileges
    REVOKE ALL ON TABLE public.users_auth FROM anon;
    REVOKE INSERT, UPDATE, DELETE ON TABLE public.users_auth FROM authenticated;
    REVOKE SELECT ON TABLE public.users_auth FROM authenticated;
  END IF;
END $$;

-- 3. Trigger guard preventing `anon` or `authenticated` sessions from altering `is_developer`
--    even if an `authenticated` self-profile policy is ever introduced in the future.
CREATE OR REPLACE FUNCTION public.prevent_client_developer_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text;
BEGIN
  v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');

  IF v_jwt_role IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' AND NEW.is_developer IS TRUE THEN
      RAISE EXCEPTION 'Forbidden: clients cannot set is_developer on insert'
        USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.is_developer IS DISTINCT FROM OLD.is_developer THEN
      RAISE EXCEPTION 'Forbidden: clients cannot modify is_developer'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.users_auth') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_users_auth_prevent_developer_escalation ON public.users_auth;
    CREATE TRIGGER trg_users_auth_prevent_developer_escalation
      BEFORE INSERT OR UPDATE ON public.users_auth
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_client_developer_escalation();
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_users_prevent_developer_escalation ON public.users;
    CREATE TRIGGER trg_users_prevent_developer_escalation
      BEFORE INSERT OR UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_client_developer_escalation();
  END IF;
END $$;

-- 4. Re-verify `platform_activity_logs` & `platform_settings` remain strictly `service_role` only
DO $$
BEGIN
  IF to_regclass('public.platform_activity_logs') IS NOT NULL THEN
    ALTER TABLE public.platform_activity_logs ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.platform_activity_logs FROM anon, authenticated;
    DROP POLICY IF EXISTS "Service role full access platform_activity_logs" ON public.platform_activity_logs;
    CREATE POLICY "Service role full access platform_activity_logs"
      ON public.platform_activity_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF to_regclass('public.platform_settings') IS NOT NULL THEN
    ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.platform_settings FROM anon, authenticated;
    DROP POLICY IF EXISTS "Service role full access platform_settings" ON public.platform_settings;
    CREATE POLICY "Service role full access platform_settings"
      ON public.platform_settings
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
