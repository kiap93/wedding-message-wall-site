-- ============================================================================
-- EventFrame.io: Make public.users_auth.password_hash Nullable & Schema Audit
-- ============================================================================
-- Fixes:
--   ERROR: 23502: null value in column "password_hash" of relation "users_auth"
--   violates not-null constraint.
--
-- Architecture:
-- - Google OAuth and Supabase Auth users authenticate externally / via
--   `auth.users` and MUST NOT be assigned fake password hashes or stored
--   OAuth tokens in `password_hash`.
-- - Email/password users continue to store PBKDF2-SHA256 hashes in
--   `users_auth.password_hash`, and all existing password hashes are preserved.
-- - Audits every column on `public.users_auth` to ensure no unexpected NOT NULL
--   constraint without a safe default blocks Google OAuth synchronization.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Make password_hash nullable and normalize defaults on public.users_auth
DO $$
DECLARE
  v_col RECORD;
  v_unexpected_col RECORD;
BEGIN
  IF to_regclass('public.users_auth') IS NOT NULL THEN
    -- Primary fix: allow NULL password_hash for Google OAuth / Supabase Auth users
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

    -- Drop accidental NOT NULL on optional profile / identity columns
    FOR v_col IN
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users_auth'
        AND is_nullable = 'NO'
        AND column_name IN (
          'full_name',
          'avatar_url',
          'external_user_id',
          'provider_user_id',
          'supabase_user_id',
          'organization_id',
          'last_login_at',
          'suspended_at',
          'suspended_reason',
          'deleted_at'
        )
    LOOP
      EXECUTE format('ALTER TABLE public.users_auth ALTER COLUMN %I DROP NOT NULL', v_col.column_name);
    END LOOP;

    -- Ensure required / operational columns exist and have safe PostgreSQL defaults
    ALTER TABLE public.users_auth
      ADD COLUMN IF NOT EXISTS supabase_user_id uuid,
      ADD COLUMN IF NOT EXISTS provider_user_id text,
      ADD COLUMN IF NOT EXISTS full_name text,
      ADD COLUMN IF NOT EXISTS avatar_url text,
      ADD COLUMN IF NOT EXISTS auth_provider text DEFAULT 'email',
      ADD COLUMN IF NOT EXISTS external_user_id text,
      ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS is_developer boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS organization_id text,
      ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
      ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
      ADD COLUMN IF NOT EXISTS suspended_reason text,
      ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

    ALTER TABLE public.users_auth ALTER COLUMN id SET DEFAULT gen_random_uuid();
    ALTER TABLE public.users_auth ALTER COLUMN auth_provider SET DEFAULT 'email';
    ALTER TABLE public.users_auth ALTER COLUMN is_verified SET DEFAULT false;
    ALTER TABLE public.users_auth ALTER COLUMN email_verified SET DEFAULT false;
    ALTER TABLE public.users_auth ALTER COLUMN role SET DEFAULT 'user';
    ALTER TABLE public.users_auth ALTER COLUMN is_developer SET DEFAULT false;
    ALTER TABLE public.users_auth ALTER COLUMN status SET DEFAULT 'active';
    ALTER TABLE public.users_auth ALTER COLUMN is_test SET DEFAULT false;
    ALTER TABLE public.users_auth ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE public.users_auth ALTER COLUMN updated_at SET DEFAULT now();

    -- Surface any unexpected NOT NULL columns without defaults during migration execution
    FOR v_unexpected_col IN
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users_auth'
        AND is_nullable = 'NO'
        AND column_default IS NULL
        AND column_name NOT IN ('id', 'email')
    LOOP
      RAISE NOTICE 'public.users_auth has custom NOT NULL column "%" (%) with no default — review if Google OAuth inserts fail.',
        v_unexpected_col.column_name, v_unexpected_col.data_type;
    END LOOP;
  END IF;
END $$;

-- 2. Safely backfill any auth.users accounts still missing from public.users_auth
--    Never creates fake password hashes (password_hash = NULL).
--    Never grants is_developer = TRUE or modifies existing password hashes.
DO $$
BEGIN
  IF to_regclass('public.users_auth') IS NOT NULL AND to_regclass('auth.users') IS NOT NULL THEN
    -- Link missing supabase_user_id onto matching existing rows without overwriting role, is_developer, or password_hash
    UPDATE public.users_auth ua
    SET supabase_user_id = au.id,
        email_verified = ua.email_verified OR (au.email_confirmed_at IS NOT NULL),
        is_verified = ua.is_verified OR (au.email_confirmed_at IS NOT NULL),
        updated_at = COALESCE(ua.updated_at, now())
    FROM auth.users au
    WHERE au.email IS NOT NULL
      AND lower(trim(ua.email)) = lower(trim(au.email))
      AND ua.supabase_user_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.users_auth other
        WHERE other.supabase_user_id = au.id
          AND other.id <> ua.id
      );

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
      is_test,
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
      FALSE,
      COALESCE(au.created_at, now()),
      now(),
      au.last_sign_in_at
    FROM auth.users au
    WHERE au.email IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.users_auth ua
        WHERE lower(trim(ua.email)) = lower(trim(au.email))
           OR ua.supabase_user_id = au.id
           OR ua.id = au.id
      )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 3. Re-affirm unique indexes & strict service_role RLS
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
    END IF;

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
