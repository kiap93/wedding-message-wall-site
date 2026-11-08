-- Migration: Message Highlight & Priority System for EventFrame.io
-- Adds classification, featured status, pinning, and display configuration

-- 1. Extend messages table with classification, featured, and pinning columns
ALTER TABLE IF EXISTS messages 
ADD COLUMN IF NOT EXISTS classification VARCHAR(30) DEFAULT 'NORMAL',
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_highlight_reason TEXT,
ADD COLUMN IF NOT EXISTS guest_category VARCHAR(50);

-- Backfill existing messages to NORMAL classification
UPDATE messages 
SET classification = 'NORMAL' 
WHERE classification IS NULL;

-- 2. Add message_display_config JSONB column to projects table
ALTER TABLE IF EXISTS projects
ADD COLUMN IF NOT EXISTS message_display_config JSONB DEFAULT '{
  "normalDuration": 8,
  "specialGuestDuration": 12,
  "coupleSelectedDuration": 16,
  "featuredFrequency": 3,
  "spotlightAnimation": "elegant-spotlight",
  "maxConsecutiveFeatured": 1
}'::jsonb;

-- 3. Extend rsvps table with is_vip and guest_category
ALTER TABLE IF EXISTS rsvps
ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS guest_category VARCHAR(50) DEFAULT 'Standard';

-- 4. Create performance indexes for real-time priority filtering
CREATE INDEX IF NOT EXISTS idx_messages_classification ON messages(project_id, classification);
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages(project_id, is_pinned);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(project_id, status);
