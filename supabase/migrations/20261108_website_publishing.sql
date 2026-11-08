-- Migration: EventFrame Wedding Website Publishing & Lifecycle
-- Adds website_status, website_published_config, website_published_at, and website_preview_token

ALTER TABLE IF EXISTS projects
ADD COLUMN IF NOT EXISTS website_status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS website_published_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS website_published_config JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS website_preview_token TEXT DEFAULT NULL;

COMMENT ON COLUMN projects.website_status IS 'Publication lifecycle status: draft, published, or unpublished';
COMMENT ON COLUMN projects.website_published_config IS 'Snapshot of website_config at time of publication';
COMMENT ON COLUMN projects.website_published_at IS 'Timestamp of last successful publication';
COMMENT ON COLUMN projects.website_preview_token IS 'Secure token for revocable private draft preview';
