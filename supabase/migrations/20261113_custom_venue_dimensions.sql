-- Migration: Custom Venue Dimensions & Dynamic Canvas
-- Enables configurable real-world venue dimensions, orientation, measurement units, and grid settings.

ALTER TABLE venue_layouts ADD COLUMN IF NOT EXISTS venue_width REAL DEFAULT 30.0;
ALTER TABLE venue_layouts ADD COLUMN IF NOT EXISTS venue_height REAL DEFAULT 20.0;
ALTER TABLE venue_layouts ADD COLUMN IF NOT EXISTS venue_unit VARCHAR(10) DEFAULT 'm';
ALTER TABLE venue_layouts ADD COLUMN IF NOT EXISTS venue_orientation VARCHAR(20) DEFAULT 'landscape';
ALTER TABLE venue_layouts ADD COLUMN IF NOT EXISTS venue_name VARCHAR(150);
ALTER TABLE venue_layouts ADD COLUMN IF NOT EXISTS venue_description TEXT;
ALTER TABLE venue_layouts ADD COLUMN IF NOT EXISTS grid_unit_step REAL DEFAULT 0.5;
ALTER TABLE venue_layouts ADD COLUMN IF NOT EXISTS show_grid BOOLEAN DEFAULT true;
ALTER TABLE venue_layouts ADD COLUMN IF NOT EXISTS show_rulers BOOLEAN DEFAULT true;
ALTER TABLE venue_layouts ADD COLUMN IF NOT EXISTS coordinate_system VARCHAR(30) DEFAULT 'world';
ALTER TABLE venue_layouts ADD COLUMN IF NOT EXISTS is_migrated BOOLEAN DEFAULT true;
