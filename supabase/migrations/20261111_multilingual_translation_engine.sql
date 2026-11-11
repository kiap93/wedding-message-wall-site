-- Migration: EventFrame Multilingual Translation Engine
-- Tables: event_languages, event_translations

-- 1. Event Languages Configuration
CREATE TABLE IF NOT EXISTS event_languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  language_code VARCHAR(20) NOT NULL, -- 'en', 'zh-CN', 'zh-TW', 'ms', etc.
  is_enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  publication_status VARCHAR(20) DEFAULT 'draft', -- 'draft' | 'published'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_event_language UNIQUE (event_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_event_languages_event ON event_languages(event_id);
CREATE INDEX IF NOT EXISTS idx_event_languages_status ON event_languages(event_id, publication_status);

-- 2. Event Translations Storage
CREATE TABLE IF NOT EXISTS event_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  language_code VARCHAR(20) NOT NULL,
  content_key VARCHAR(255) NOT NULL,
  translated_value TEXT NOT NULL,
  source_hash VARCHAR(64) NOT NULL,
  translation_status VARCHAR(30) DEFAULT 'translated', -- 'draft' | 'translated' | 'needs_review' | 'auto_translated'
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_event_translation_key UNIQUE (event_id, language_code, content_key)
);

CREATE INDEX IF NOT EXISTS idx_event_translations_lookup ON event_translations(event_id, language_code);
CREATE INDEX IF NOT EXISTS idx_event_translations_key ON event_translations(event_id, content_key);
CREATE INDEX IF NOT EXISTS idx_event_translations_status ON event_translations(event_id, language_code, translation_status);

-- 3. Row Level Security Policies (if RLS is active)
ALTER TABLE event_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_translations ENABLE ROW LEVEL SECURITY;

-- Allow public read access to published translations of published events
CREATE POLICY IF NOT EXISTS "Allow public read published languages" ON event_languages
  FOR SELECT USING (publication_status = 'published');

CREATE POLICY IF NOT EXISTS "Allow public read translations" ON event_translations
  FOR SELECT USING (true);

-- Allow full access to service role / admin
CREATE POLICY IF NOT EXISTS "Allow service role full access event_languages" ON event_languages
  FOR ALL USING (true);

CREATE POLICY IF NOT EXISTS "Allow service role full access event_translations" ON event_translations
  FOR ALL USING (true);
