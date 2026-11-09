-- Migration: EventFrame Guest List, Table Assignment & Wedding Hall Planner
-- Tables: guest_groups, guests, seating_tables, seating_assignments, venue_layouts, venue_layout_objects

-- 1. Guest Groups
CREATE TABLE IF NOT EXISTS guest_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  group_name VARCHAR(100) NOT NULL,
  invitation_reference VARCHAR(100),
  color VARCHAR(20) DEFAULT '#8B806F',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_groups_project ON guest_groups(project_id);

-- 2. Guests Table
CREATE TABLE IF NOT EXISTS guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  guest_group_id UUID REFERENCES guest_groups(id) ON DELETE SET NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(50),
  rsvp_status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'attending' | 'declined'
  pax INTEGER DEFAULT 1,
  meal_preference VARCHAR(100),
  dietary_notes TEXT,
  notes TEXT,
  is_vip BOOLEAN DEFAULT false,
  is_plus_one BOOLEAN DEFAULT false,
  primary_guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  rsvp_id TEXT, -- Link to original rsvps entry if generated via RSVP form
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_project ON guests(project_id);
CREATE INDEX IF NOT EXISTS idx_guests_rsvp_status ON guests(project_id, rsvp_status);
CREATE INDEX IF NOT EXISTS idx_guests_group ON guests(guest_group_id);

-- 3. Seating Tables
CREATE TABLE IF NOT EXISTS seating_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  table_number VARCHAR(50) NOT NULL,
  table_type VARCHAR(30) DEFAULT 'round', -- 'round' | 'rectangular' | 'square' | 'custom'
  capacity INTEGER NOT NULL DEFAULT 10,
  category VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seating_tables_project ON seating_tables(project_id);

-- 4. Seating Assignments (One active table assignment per guest)
CREATE TABLE IF NOT EXISTS seating_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  seating_table_id UUID NOT NULL REFERENCES seating_tables(id) ON DELETE CASCADE,
  seat_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_guest_table_assignment UNIQUE(project_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_seating_assignments_project ON seating_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_seating_assignments_table ON seating_assignments(seating_table_id);

-- 5. Venue Layouts
CREATE TABLE IF NOT EXISTS venue_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL UNIQUE,
  layout_name VARCHAR(150) DEFAULT 'Main Reception Hall',
  canvas_width INTEGER DEFAULT 2000,
  canvas_height INTEGER DEFAULT 1400,
  grid_size INTEGER DEFAULT 40,
  snap_to_grid BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_layouts_project ON venue_layouts(project_id);

-- 6. Venue Layout Objects (Tables, Stage, Dance Floor, etc.)
CREATE TABLE IF NOT EXISTS venue_layout_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_layout_id UUID NOT NULL REFERENCES venue_layouts(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  object_type VARCHAR(50) NOT NULL, -- 'table' | 'stage' | 'couple_table' | 'entrance' | 'dance_floor' | 'buffet' | 'bar' | 'photo_booth' | 'registration' | 'pillar' | 'wall' | 'decor' | 'label'
  object_reference_id TEXT, -- E.g., seating_table_id if object_type is 'table'
  label VARCHAR(100),
  position_x REAL NOT NULL DEFAULT 100,
  position_y REAL NOT NULL DEFAULT 100,
  width REAL NOT NULL DEFAULT 120,
  height REAL NOT NULL DEFAULT 120,
  rotation REAL NOT NULL DEFAULT 0,
  properties JSONB DEFAULT '{}'::jsonb,
  z_index INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_layout_objects_layout ON venue_layout_objects(venue_layout_id);
CREATE INDEX IF NOT EXISTS idx_venue_layout_objects_project ON venue_layout_objects(project_id);
