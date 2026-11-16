-- ============================================================================
-- EventFrame: Agency Lookup Hardening, Atomic Onboarding & RLS Policies
-- ============================================================================
-- Goals:
-- 1. Enforce case-insensitive slug hygiene and relational indexes on agencies & projects.
-- 2. Provide an atomic transactional RPC (onboard_user_workspace) so agency +
--    initial couple project + users_auth sync either all succeed or cleanly roll back.
-- 3. Provide a public non-sensitive agency metadata RPC (get_public_agency_metadata)
--    so public storefronts never expose owner_email or user_id.
-- 4. Enable and enforce strict RLS policies on agencies, projects, and users_auth
--    (authenticated users only see/manage their own agencies/projects; service_role
--    maintains backend authority; zero RLS bypasses).
-- 5. Preserve all existing production data and pay-per-event $5.00 USD pricing.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Additive Hygiene Columns & Performance/Integrity Indexes
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS agencies
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS theme_config jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS users_auth
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_agencies_slug_active
  ON agencies (lower(slug))
  WHERE slug IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_agencies_owner_email_active
  ON agencies (lower(owner_email))
  WHERE owner_email IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_agencies_user_id_active
  ON agencies (user_id)
  WHERE user_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_agencies_domain_active
  ON agencies (lower(domain))
  WHERE domain IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_agency_slug_active
  ON projects (agency_id, lower(slug))
  WHERE deleted_at IS NULL;

-- Add unique case-insensitive index on active agency slugs ONLY if existing
-- production data has no conflicting case-duplicates (never breaks migration).
DO $$
DECLARE
  v_dup_count integer := 0;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT lower(slug) AS normalized_slug
    FROM agencies
    WHERE slug IS NOT NULL AND deleted_at IS NULL
    GROUP BY lower(slug)
    HAVING COUNT(*) > 1
  ) dup;

  IF v_dup_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_agencies_slug_lower_active
      ON agencies (lower(slug))
      WHERE slug IS NOT NULL AND deleted_at IS NULL;
  ELSE
    RAISE NOTICE 'Skipped uq_agencies_slug_lower_active because % duplicate lower(slug) group(s) already exist.', v_dup_count;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 2: Atomic Transactional Onboarding RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION onboard_user_workspace(
  p_user_id text,
  p_owner_email text,
  p_role text,
  p_org_name text,
  p_slug text,
  p_groom_name text DEFAULT NULL,
  p_bride_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_role text;
  v_email text;
  v_org_name text;
  v_existing_agency agencies%ROWTYPE;
  v_slug_owner agencies%ROWTYPE;
  v_agency agencies%ROWTYPE;
  v_project projects%ROWTYPE;
  v_created_project_id text := NULL;
  v_target_user_role text;
  v_reserved text[] := ARRAY[
    'www', 'api', 'app', 'admin', 'developer', 'demo', 'login', 'verify',
    'reset-password', 'onboarding', 'workspace', 'editor', 'website-studio',
    'templates', 'pricing', 'subscription', 'couple', 'display', 'guest',
    'rsvp', 'invitation', 'e', 'g', 'r', 'event', 'agency', 'blog',
    'mail', 'static', 'assets', 'cdn', 'status', 'support'
  ];
BEGIN
  v_slug := lower(trim(coalesce(p_slug, '')));
  v_role := lower(trim(coalesce(p_role, '')));
  v_email := NULLIF(lower(trim(coalesce(p_owner_email, ''))), '');
  v_org_name := trim(coalesce(p_org_name, ''));

  IF v_role NOT IN ('agency', 'couple') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status_code', 400,
      'code', 'INVALID_ROLE',
      'error', 'Role must be either "agency" or "couple".'
    );
  END IF;

  IF length(v_slug) < 3 OR length(v_slug) > 63 OR v_slug !~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' OR v_slug LIKE '%--%' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status_code', 400,
      'code', 'INVALID_SLUG',
      'error', 'Subdomain slug must be 3-63 lowercase letters, numbers, or single hyphens.'
    );
  END IF;

  IF v_slug = ANY(v_reserved) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status_code', 422,
      'code', 'RESERVED_SLUG',
      'error', 'This subdomain is reserved by the platform. Please choose another.'
    );
  END IF;

  IF v_role = 'couple' AND (trim(coalesce(p_groom_name, '')) = '' OR trim(coalesce(p_bride_name, '')) = '') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status_code', 400,
      'code', 'INVALID_COUPLE_NAMES',
      'error', 'Both partner names are required for couple onboarding.'
    );
  END IF;

  IF v_org_name = '' THEN
    IF v_role = 'couple' THEN
      v_org_name := trim(p_groom_name) || ' & ' || trim(p_bride_name);
    ELSE
      RETURN jsonb_build_object(
        'ok', false,
        'status_code', 400,
        'code', 'INVALID_AGENCY_NAME',
        'error', 'Agency or studio name is required.'
      );
    END IF;
  END IF;

  -- Check if slug already belongs to an active agency
  SELECT * INTO v_slug_owner
  FROM agencies
  WHERE lower(slug) = v_slug
    AND deleted_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    IF (p_user_id IS NOT NULL AND v_slug_owner.user_id = p_user_id)
       OR (v_email IS NOT NULL AND lower(coalesce(v_slug_owner.owner_email, '')) = v_email) THEN
      -- Idempotent reuse for the same owner
      IF v_slug_owner.user_role = 'couple' THEN
        SELECT * INTO v_project
        FROM projects
        WHERE agency_id::text = v_slug_owner.id::text
          AND deleted_at IS NULL
        ORDER BY created_at ASC
        LIMIT 1;

        IF NOT FOUND THEN
          INSERT INTO projects (
            agency_id, name, groom_name, bride_name, slug, theme_id,
            wedding_date, location, status, payment_status, package_id,
            created_at, updated_at
          ) VALUES (
            v_slug_owner.id,
            trim(coalesce(p_groom_name, 'Partner 1')) || ' & ' || trim(coalesce(p_bride_name, 'Partner 2')) || '''s Wedding',
            NULLIF(trim(coalesce(p_groom_name, '')), ''),
            NULLIF(trim(coalesce(p_bride_name, '')), ''),
            v_slug_owner.slug,
            'garden',
            (now() + interval '180 days')::date::text,
            'To Be Announced',
            'draft',
            'unpaid',
            'standard',
            now(),
            now()
          )
          RETURNING * INTO v_project;
        END IF;
        v_created_project_id := v_project.id::text;
      END IF;

      RETURN jsonb_build_object(
        'ok', true,
        'status_code', 200,
        'reused', true,
        'agency', to_jsonb(v_slug_owner),
        'created_project_id', v_created_project_id
      );
    ELSE
      RETURN jsonb_build_object(
        'ok', false,
        'status_code', 409,
        'code', 'SLUG_ALREADY_EXISTS',
        'error', 'This subdomain is already taken.'
      );
    END IF;
  END IF;

  -- Check if user already owns an existing active agency (prevent unintended duplicates)
  SELECT * INTO v_existing_agency
  FROM agencies
  WHERE deleted_at IS NULL
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (v_email IS NOT NULL AND lower(coalesce(owner_email, '')) = v_email)
    )
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_agency.user_role = 'couple' THEN
      SELECT id::text INTO v_created_project_id
      FROM projects
      WHERE agency_id::text = v_existing_agency.id::text
        AND deleted_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'status_code', 200,
      'reused', true,
      'agency', to_jsonb(v_existing_agency),
      'created_project_id', v_created_project_id
    );
  END IF;

  -- Insert new agency + optional couple project inside single transaction
  INSERT INTO agencies (
    name, slug, user_id, user_role, owner_email, status, created_at, updated_at
  ) VALUES (
    v_org_name, v_slug, p_user_id, v_role, v_email, 'active', now(), now()
  )
  RETURNING * INTO v_agency;

  IF v_role = 'couple' THEN
    INSERT INTO projects (
      agency_id, name, groom_name, bride_name, slug, theme_id,
      wedding_date, location, status, payment_status, package_id,
      created_at, updated_at
    ) VALUES (
      v_agency.id,
      trim(p_groom_name) || ' & ' || trim(p_bride_name) || '''s Wedding',
      trim(p_groom_name),
      trim(p_bride_name),
      v_slug,
      'garden',
      (now() + interval '180 days')::date::text,
      'To Be Announced',
      'draft',
      'unpaid',
      'standard',
      now(),
      now()
    )
    RETURNING * INTO v_project;

    v_created_project_id := v_project.id::text;
  END IF;

  -- Sync users_auth organization_id and role cleanly (never downgrade super_admin)
  v_target_user_role := CASE WHEN v_role = 'agency' THEN 'agency_owner' ELSE 'user' END;
  IF to_regclass('public.users_auth') IS NOT NULL THEN
    UPDATE users_auth
    SET organization_id = COALESCE(organization_id, v_agency.id::text),
        role = CASE
          WHEN role = 'super_admin' THEN 'super_admin'
          ELSE v_target_user_role
        END,
        updated_at = now()
    WHERE (v_email IS NOT NULL AND lower(email) = v_email)
       OR (p_user_id IS NOT NULL AND (external_user_id = p_user_id OR id::text = p_user_id));
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status_code', 201,
    'reused', false,
    'agency', to_jsonb(v_agency),
    'created_project_id', v_created_project_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status_code', 409,
      'code', 'SLUG_ALREADY_EXISTS',
      'error', 'This subdomain is already taken.'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- STEP 3: Public Non-Sensitive Agency Metadata RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_public_agency_metadata(
  p_slug text DEFAULT NULL,
  p_id text DEFAULT NULL
)
RETURNS TABLE (
  id text,
  name text,
  slug text,
  domain text,
  user_role text,
  logo_url text,
  theme_config jsonb,
  subscription_status text,
  is_demo boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id::text,
    a.name,
    a.slug,
    a.domain,
    a.user_role,
    a.logo_url,
    a.theme_config,
    a.subscription_status,
    COALESCE(a.is_demo, false) AS is_demo,
    a.created_at
  FROM agencies a
  WHERE a.deleted_at IS NULL
    AND COALESCE(a.status, 'active') <> 'suspended'
    AND (
      (p_id IS NOT NULL AND a.id::text = p_id)
      OR (p_slug IS NOT NULL AND lower(a.slug) = lower(trim(p_slug)))
    )
  ORDER BY a.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION onboard_user_workspace(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION onboard_user_workspace(text, text, text, text, text, text, text) TO service_role;

GRANT EXECUTE ON FUNCTION get_public_agency_metadata(text, text) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- STEP 4: Enable & Enforce Strict RLS on agencies, projects, and users_auth
-- ----------------------------------------------------------------------------
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Agencies RLS Policies:
-- - service_role: full server access
-- - authenticated: strictly scoped to the user's own agencies (never other users')
-- - anon: no direct table access (public branding uses backend /api/agencies/resolve
--         or get_public_agency_metadata RPC, never exposing owner_email or user_id)
DROP POLICY IF EXISTS "Service role full access agencies" ON agencies;
CREATE POLICY "Service role full access agencies"
  ON agencies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users select own agencies" ON agencies;
CREATE POLICY "Authenticated users select own agencies"
  ON agencies
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
    )
  );

DROP POLICY IF EXISTS "Authenticated users insert own agencies" ON agencies;
CREATE POLICY "Authenticated users insert own agencies"
  ON agencies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND user_id = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated users update own agencies" ON agencies;
CREATE POLICY "Authenticated users update own agencies"
  ON agencies
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()::text
      OR (
        owner_email IS NOT NULL
        AND lower(owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()::text
      OR (
        owner_email IS NOT NULL
        AND lower(owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated users delete own agencies" ON agencies;
CREATE POLICY "Authenticated users delete own agencies"
  ON agencies
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Projects RLS Policies:
-- - service_role: full server access
-- - authenticated: strictly scoped to projects belonging to the user's own agency
-- - anon: no direct table access (prevents exposing access_password / unpublished drafts)
DROP POLICY IF EXISTS "Service role full access projects" ON projects;
CREATE POLICY "Service role full access projects"
  ON projects
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage own agency projects" ON projects;
CREATE POLICY "Authenticated users manage own agency projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM agencies a
      WHERE a.id::text = projects.agency_id::text
        AND a.deleted_at IS NULL
        AND (
          a.user_id = auth.uid()::text
          OR (
            a.owner_email IS NOT NULL
            AND lower(a.owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
          )
        )
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM agencies a
      WHERE a.id::text = projects.agency_id::text
        AND a.deleted_at IS NULL
        AND (
          a.user_id = auth.uid()::text
          OR (
            a.owner_email IS NOT NULL
            AND lower(a.owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
          )
        )
    )
  );

-- Lock down users_auth so password_hash / private auth fields are never exposed to anon
DO $$
BEGIN
  IF to_regclass('public.users_auth') IS NOT NULL THEN
    ALTER TABLE users_auth ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Service role full access users_auth" ON users_auth;
    CREATE POLICY "Service role full access users_auth"
      ON users_auth
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
