-- ============================================================================
-- EventFrame.io: Secure Expiring Website Preview Tokens
-- ============================================================================
-- Replaces perpetual plaintext `projects.website_preview_token` usage with a
-- dedicated hashed, project-bound, expiring, and revocable token store.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.website_preview_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NULL REFERENCES public.users_auth(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  last_used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_preview_tokens_project_active
  ON public.website_preview_tokens (project_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_website_preview_tokens_hash
  ON public.website_preview_tokens (token_hash);

ALTER TABLE public.website_preview_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access website_preview_tokens" ON public.website_preview_tokens;
CREATE POLICY "Service role full access website_preview_tokens"
  ON public.website_preview_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Token hashes must never be readable or writable directly by browser clients.
REVOKE ALL ON TABLE public.website_preview_tokens FROM anon, authenticated;

COMMENT ON TABLE public.website_preview_tokens IS 'Hashed, project-bound, expiring, revocable preview tokens for unpublished wedding websites';
