-- ============================================================================
-- EventFrame.io: Agency Membership (`agency_members`) & Authorization Hardening
-- ============================================================================
-- Safely introduces a dedicated canonical `public.agency_members` join table
-- linked to `public.users_auth(id)` so team members and multi-agency users
-- can be authorized cleanly without relying on a single scalar column.
-- Preserves all existing agencies, users_auth.organization_id, and RLS safety.
-- ============================================================================

-- 1. Create canonical agency_members join table
CREATE TABLE IF NOT EXISTS public.agency_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users_auth(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_agency_members_agency_user UNIQUE (agency_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_members_user_active
  ON public.agency_members (user_id, agency_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_agency_members_agency_active
  ON public.agency_members (agency_id, status);

-- 2. Idempotent backfill from existing agencies owners & users_auth.organization_id
DO $$
BEGIN
  IF to_regclass('public.users_auth') IS NOT NULL
     AND to_regclass('public.agencies') IS NOT NULL
     AND to_regclass('public.agency_members') IS NOT NULL THEN

    -- 2a. Backfill agency owners matched via user_id / provider / external / email -> users_auth.id
    INSERT INTO public.agency_members (agency_id, user_id, role, status, created_at, updated_at)
    SELECT DISTINCT
      a.id::text AS agency_id,
      ua.id AS user_id,
      'owner' AS role,
      'active' AS status,
      COALESCE(a.created_at, now()),
      now()
    FROM public.agencies a
    JOIN public.users_auth ua
      ON ua.deleted_at IS NULL
     AND (
       a.user_id = ua.id::text
       OR (ua.supabase_user_id IS NOT NULL AND a.user_id = ua.supabase_user_id::text)
       OR (ua.external_user_id IS NOT NULL AND a.user_id = ua.external_user_id)
       OR (ua.provider_user_id IS NOT NULL AND a.user_id = ua.provider_user_id)
       OR (a.owner_email IS NOT NULL AND lower(a.owner_email) = lower(ua.email))
     )
    WHERE a.deleted_at IS NULL
    ON CONFLICT (agency_id, user_id) DO UPDATE SET
      role = CASE
        WHEN public.agency_members.role = 'owner' OR EXCLUDED.role = 'owner' THEN 'owner'
        ELSE public.agency_members.role
      END,
      status = CASE
        WHEN public.agency_members.status = 'revoked' THEN public.agency_members.status
        ELSE 'active'
      END,
      updated_at = now();

    -- 2b. Backfill active members / owners linked via users_auth.organization_id
    INSERT INTO public.agency_members (agency_id, user_id, role, status, created_at, updated_at)
    SELECT DISTINCT
      a.id::text AS agency_id,
      ua.id AS user_id,
      CASE
        WHEN lower(coalesce(ua.role, '')) = 'agency_owner' THEN 'owner'
        ELSE 'member'
      END AS role,
      'active' AS status,
      COALESCE(ua.created_at, now()),
      now()
    FROM public.users_auth ua
    JOIN public.agencies a
      ON a.id::text = ua.organization_id::text
     AND a.deleted_at IS NULL
    WHERE ua.deleted_at IS NULL
      AND ua.organization_id IS NOT NULL
      AND trim(ua.organization_id) <> ''
    ON CONFLICT (agency_id, user_id) DO NOTHING;
  END IF;
END $$;

-- 3. Strict RLS on agency_members (service_role manages writes; users only read own rows)
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access agency_members" ON public.agency_members;
CREATE POLICY "Service role full access agency_members"
  ON public.agency_members
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users select own agency_memberships" ON public.agency_members;
CREATE POLICY "Authenticated users select own agency_memberships"
  ON public.agency_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users_auth ua
      WHERE ua.id = agency_members.user_id
        AND ua.deleted_at IS NULL
        AND lower(coalesce(ua.status, 'active')) <> 'suspended'
        AND (
          ua.id = auth.uid()
          OR ua.supabase_user_id = auth.uid()
          OR lower(ua.email) = lower(coalesce(auth.jwt()->>'email', ''))
        )
    )
  );

REVOKE INSERT, UPDATE, DELETE ON TABLE public.agency_members FROM anon, authenticated;

-- 4. Update agencies & projects RLS policies to recognize active agency_members + users_auth.organization_id
DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users select own agencies" ON public.agencies;
    CREATE POLICY "Authenticated users select own agencies"
      ON public.agencies
      FOR SELECT
      TO authenticated
      USING (
        deleted_at IS NULL
        AND (
          user_id = auth.uid()::text
          OR (
            owner_email IS NOT NULL
            AND lower(owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
          )
          OR EXISTS (
            SELECT 1
            FROM public.agency_members am
            JOIN public.users_auth ua ON ua.id = am.user_id
            WHERE am.agency_id::text = agencies.id::text
              AND am.status = 'active'
              AND ua.deleted_at IS NULL
              AND lower(coalesce(ua.status, 'active')) <> 'suspended'
              AND (
                ua.id = auth.uid()
                OR ua.supabase_user_id = auth.uid()
                OR lower(ua.email) = lower(coalesce(auth.jwt()->>'email', ''))
              )
          )
          OR EXISTS (
            SELECT 1
            FROM public.users_auth ua
            WHERE ua.organization_id IS NOT NULL
              AND ua.organization_id::text = agencies.id::text
              AND ua.deleted_at IS NULL
              AND lower(coalesce(ua.status, 'active')) <> 'suspended'
              AND (
                ua.id = auth.uid()
                OR ua.supabase_user_id = auth.uid()
                OR lower(ua.email) = lower(coalesce(auth.jwt()->>'email', ''))
              )
          )
        )
      );
  END IF;

  IF to_regclass('public.projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users manage own agency projects" ON public.projects;
    CREATE POLICY "Authenticated users manage own agency projects"
      ON public.projects
      FOR ALL
      TO authenticated
      USING (
        deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.agencies a
          WHERE a.id::text = projects.agency_id::text
            AND a.deleted_at IS NULL
            AND (
              a.user_id = auth.uid()::text
              OR (
                a.owner_email IS NOT NULL
                AND lower(a.owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
              )
              OR EXISTS (
                SELECT 1
                FROM public.agency_members am
                JOIN public.users_auth ua ON ua.id = am.user_id
                WHERE am.agency_id::text = a.id::text
                  AND am.status = 'active'
                  AND ua.deleted_at IS NULL
                  AND lower(coalesce(ua.status, 'active')) <> 'suspended'
                  AND (
                    ua.id = auth.uid()
                    OR ua.supabase_user_id = auth.uid()
                    OR lower(ua.email) = lower(coalesce(auth.jwt()->>'email', ''))
                  )
              )
              OR EXISTS (
                SELECT 1
                FROM public.users_auth ua
                WHERE ua.organization_id IS NOT NULL
                  AND ua.organization_id::text = a.id::text
                  AND ua.deleted_at IS NULL
                  AND lower(coalesce(ua.status, 'active')) <> 'suspended'
                  AND (
                    ua.id = auth.uid()
                    OR ua.supabase_user_id = auth.uid()
                    OR lower(ua.email) = lower(coalesce(auth.jwt()->>'email', ''))
                  )
              )
            )
        )
      )
      WITH CHECK (
        deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.agencies a
          WHERE a.id::text = projects.agency_id::text
            AND a.deleted_at IS NULL
            AND (
              a.user_id = auth.uid()::text
              OR (
                a.owner_email IS NOT NULL
                AND lower(a.owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
              )
              OR EXISTS (
                SELECT 1
                FROM public.agency_members am
                JOIN public.users_auth ua ON ua.id = am.user_id
                WHERE am.agency_id::text = a.id::text
                  AND am.status = 'active'
                  AND ua.deleted_at IS NULL
                  AND lower(coalesce(ua.status, 'active')) <> 'suspended'
                  AND (
                    ua.id = auth.uid()
                    OR ua.supabase_user_id = auth.uid()
                    OR lower(ua.email) = lower(coalesce(auth.jwt()->>'email', ''))
                  )
              )
              OR EXISTS (
                SELECT 1
                FROM public.users_auth ua
                WHERE ua.organization_id IS NOT NULL
                  AND ua.organization_id::text = a.id::text
                  AND ua.deleted_at IS NULL
                  AND lower(coalesce(ua.status, 'active')) <> 'suspended'
                  AND (
                    ua.id = auth.uid()
                    OR ua.supabase_user_id = auth.uid()
                    OR lower(ua.email) = lower(coalesce(auth.jwt()->>'email', ''))
                  )
              )
            )
        )
      );
  END IF;
END $$;
