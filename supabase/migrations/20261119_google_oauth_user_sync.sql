-- ============================================================================
-- EventFrame.io: Google OAuth & Supabase User Synchronization Hardening
-- ============================================================================
-- Safely extends the existing canonical `public.users_auth` table with
-- Supabase Auth UUID linkage (`supabase_user_id`), OAuth provider identity
-- (`provider_user_id`), and `email_verified` synchronization without creating
-- duplicate user tables or breaking existing email/agency/developer data.
-- ============================================================================

-- 1. Additive synchronization columns on `public.users_auth` & nullable password_hash
ALTER TABLE IF EXISTS public.users_auth
  ADD COLUMN IF NOT EXISTS supabase_user_id uuid,
  ADD COLUMN IF NOT EXISTS provider_user_id text,
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users_auth'
      AND column_name = 'password_hash'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.users_auth ALTER COLUMN password_hash DROP NOT NULL;
  END IF;
END $$;

-- 2. Backfill existing records cleanly and idempotently
DO $$
BEGIN
  IF to_regclass('public.users_auth') IS NOT NULL THEN
    -- Sync `email_verified` from existing `is_verified`
    UPDATE public.users_auth
    SET email_verified = COALESCE(is_verified, false)
    WHERE email_verified IS DISTINCT FROM COALESCE(is_verified, false);

    -- Preserve Google provider subject IDs stored previously in `external_user_id`
    UPDATE public.users_auth
    SET provider_user_id = external_user_id
    WHERE auth_provider = 'google'
      AND provider_user_id IS NULL
      AND external_user_id IS NOT NULL
      AND external_user_id NOT LIKE 'email-%';

    -- If `auth.users` exists, link matching emails to their Supabase Auth UUID
    IF to_regclass('auth.users') IS NOT NULL THEN
      UPDATE public.users_auth ua
      SET supabase_user_id = au.id,
          email_verified = ua.email_verified OR (au.email_confirmed_at IS NOT NULL),
          is_verified = ua.is_verified OR (au.email_confirmed_at IS NOT NULL),
          updated_at = COALESCE(ua.updated_at, now())
      FROM auth.users au
      WHERE au.email IS NOT NULL
        AND lower(ua.email) = lower(au.email)
        AND ua.supabase_user_id IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.users_auth other
          WHERE other.supabase_user_id = au.id
            AND other.id <> ua.id
        );

      -- Backfill any `auth.users` accounts missing from `public.users_auth`
      -- Strictly assigns `role = 'user'`, `is_developer = FALSE`, and `password_hash = NULL`.
      INSERT INTO public.users_auth (
        id,
        supabase_user_id,
        email,
        password_hash,
        full_name,
        avatar_url,
        auth_provider,
        provider_user_id,
        external_user_id,
        is_verified,
        email_verified,
        role,
        is_developer,
        status,
        created_at,
        updated_at,
        last_login_at
      )
      SELECT
        au.id,
        au.id,
        lower(trim(au.email)),
        NULL,
        COALESCE(
          NULLIF(trim(au.raw_user_meta_data ->> 'full_name'), ''),
          NULLIF(trim(au.raw_user_meta_data ->> 'name'), ''),
          split_part(lower(trim(au.email)), '@', 1)
        ),
        COALESCE(
          NULLIF(trim(au.raw_user_meta_data ->> 'avatar_url'), ''),
          NULLIF(trim(au.raw_user_meta_data ->> 'picture'), '')
        ),
        COALESCE(NULLIF(trim(au.raw_app_meta_data ->> 'provider'), ''), 'email'),
        NULLIF(trim(au.raw_user_meta_data ->> 'sub'), ''),
        COALESCE(NULLIF(trim(au.raw_user_meta_data ->> 'sub'), ''), au.id::text),
        (au.email_confirmed_at IS NOT NULL),
        (au.email_confirmed_at IS NOT NULL),
        'user',
        FALSE,
        'active',
        COALESCE(au.created_at, now()),
        now(),
        au.last_sign_in_at
      FROM auth.users au
      WHERE au.email IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.users_auth ua
          WHERE lower(ua.email) = lower(trim(au.email))
             OR ua.supabase_user_id = au.id
             OR ua.id = au.id
        )
      ON CONFLICT (email) DO NOTHING;
    END IF;
  END IF;
END $$;

-- 3. Uniqueness & lookup indexes (guarded against conflicting legacy data)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_auth_supabase_user_id
  ON public.users_auth (supabase_user_id)
  WHERE supabase_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_auth_provider_user
  ON public.users_auth (auth_provider, provider_user_id)
  WHERE provider_user_id IS NOT NULL;

DO $$
DECLARE
  v_dup_count integer := 0;
BEGIN
  IF to_regclass('public.users_auth') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_dup_count
    FROM (
      SELECT lower(email) AS norm_email
      FROM public.users_auth
      WHERE email IS NOT NULL
      GROUP BY lower(email)
      HAVING COUNT(*) > 1
    ) dups;

    IF v_dup_count = 0 THEN
      CREATE UNIQUE INDEX IF NOT EXISTS uq_users_auth_email_lower
        ON public.users_auth (lower(email));
    ELSE
      RAISE NOTICE 'Skipped uq_users_auth_email_lower because % duplicate case-insensitive email group(s) already exist.', v_dup_count;
    END IF;
  END IF;
END $$;

-- 4. Re-affirm strict backend-only RLS on `public.users_auth`
DO $$
BEGIN
  IF to_regclass('public.users_auth') IS NOT NULL THEN
    ALTER TABLE public.users_auth ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Service role full access users_auth" ON public.users_auth;
    CREATE POLICY "Service role full access users_auth"
      ON public.users_auth
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    REVOKE ALL ON TABLE public.users_auth FROM anon;
    REVOKE INSERT, UPDATE, DELETE, SELECT ON TABLE public.users_auth FROM authenticated;
  END IF;
END $$;
