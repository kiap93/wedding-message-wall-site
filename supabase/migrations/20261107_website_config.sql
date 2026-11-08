-- Migration: Website Studio Workspace & Configuration
-- Adds website_config JSONB column to projects table to support Canva-style website builder

ALTER TABLE IF EXISTS projects
ADD COLUMN IF NOT EXISTS website_config JSONB DEFAULT NULL;

COMMENT ON COLUMN projects.website_config IS 'Stores structured Canva-style website sections, palette, typography, and narrative content';
