-- Migration: Seating Tables Layout Coordinates and Rotation Support
-- Adds position_x, position_y, and rotation directly to seating_tables
-- Ensures full compatibility with both standalone table management and wedding hall planners

ALTER TABLE seating_tables ADD COLUMN IF NOT EXISTS position_x REAL DEFAULT 100;
ALTER TABLE seating_tables ADD COLUMN IF NOT EXISTS position_y REAL DEFAULT 100;
ALTER TABLE seating_tables ADD COLUMN IF NOT EXISTS rotation REAL DEFAULT 0;

-- Optional index for positional spatial lookups if needed
CREATE INDEX IF NOT EXISTS idx_seating_tables_position ON seating_tables(project_id, position_x, position_y);
