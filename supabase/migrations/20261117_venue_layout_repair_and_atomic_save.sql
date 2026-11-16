-- Migration: Wedding Hall Layout Coordinate Repair (v2) & Atomic Save RPC
-- Fixes layouts mis-tagged as coordinate_system='world' by 20261113_custom_venue_dimensions.sql
-- while preserving all layout IDs, object IDs, object_reference_id links, rotations, labels,
-- and seating assignments. Adds atomic PostgreSQL RPC for safe saves without data loss.

-- 1. Add migration_version tracking without falsely marking legacy rows as already v2
ALTER TABLE venue_layouts
  ADD COLUMN IF NOT EXISTS migration_version INTEGER DEFAULT 1;

-- 2. Idempotent data repair pass for all un-migrated (v1 / NULL) layouts containing pixel data
DO $$
DECLARE
  rec RECORD;
  v_unit TEXT;
  v_target_w REAL;
  v_target_h REAL;
  v_legacy_w REAL;
  v_legacy_h REAL;
  v_factor REAL;
  v_px_per_unit REAL;
  v_min_dim REAL;
  v_has_pixel_objects BOOLEAN;
BEGIN
  FOR rec IN
    SELECT *
    FROM venue_layouts
    WHERE COALESCE(migration_version, 1) < 2
  LOOP
    v_unit := CASE WHEN COALESCE(rec.venue_unit, 'm') = 'ft' THEN 'ft' ELSE 'm' END;
    v_target_w := CASE
      WHEN rec.venue_width IS NOT NULL AND rec.venue_width > 0 AND rec.venue_width <= 200
        THEN rec.venue_width
      WHEN v_unit = 'ft' THEN 100.0
      ELSE 30.0
    END;

    v_legacy_w := CASE
      WHEN rec.canvas_width IS NOT NULL AND rec.canvas_width >= 800 THEN rec.canvas_width::REAL
      ELSE 2000.0
    END;
    v_legacy_h := CASE
      WHEN rec.canvas_height IS NOT NULL AND rec.canvas_height >= 600 THEN rec.canvas_height::REAL
      ELSE 1400.0
    END;

    v_target_h := CASE
      WHEN rec.venue_height IS NOT NULL AND rec.venue_height > 0 AND rec.venue_height <= 200
        THEN rec.venue_height
      ELSE ROUND(((v_legacy_h / v_legacy_w) * v_target_w)::NUMERIC, 1)::REAL
    END;

    -- Inspect child objects to detect pixel-scale values even when coordinate_system='world'
    IF v_unit = 'ft' THEN
      SELECT EXISTS (
        SELECT 1 FROM venue_layout_objects o
        WHERE o.venue_layout_id = rec.id
          AND COALESCE((o.properties->>'migrated_v2')::BOOLEAN, false) = false
          AND (
            o.width >= 90
            OR o.height >= 90
            OR ABS(o.position_x) >= GREATEST(280.0, v_target_w * 2.5)
            OR ABS(o.position_y) >= GREATEST(280.0, v_target_h * 2.5)
          )
      ) INTO v_has_pixel_objects;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM venue_layout_objects o
        WHERE o.venue_layout_id = rec.id
          AND COALESCE((o.properties->>'migrated_v2')::BOOLEAN, false) = false
          AND (
            o.width >= 35
            OR o.height >= 35
            OR ABS(o.position_x) >= GREATEST(120.0, v_target_w * 2.5)
            OR ABS(o.position_y) >= GREATEST(120.0, v_target_h * 2.5)
          )
      ) INTO v_has_pixel_objects;
    END IF;

    v_px_per_unit := CASE WHEN v_unit = 'ft' THEN (60.0 / 3.28084) ELSE 60.0 END;
    v_min_dim := CASE WHEN v_unit = 'ft' THEN 0.6 ELSE 0.2 END;

    IF v_has_pixel_objects OR COALESCE(rec.coordinate_system, 'pixel') = 'pixel' THEN
      v_factor := GREATEST(v_legacy_w / v_target_w, v_legacy_h / v_target_h);

      UPDATE venue_layout_objects o
      SET
        position_x = ROUND((o.position_x / v_factor)::NUMERIC, 2)::REAL,
        position_y = ROUND((o.position_y / v_factor)::NUMERIC, 2)::REAL,
        width = GREATEST(v_min_dim, ROUND((GREATEST(o.width, 10.0) / v_factor)::NUMERIC, 2)::REAL),
        height = GREATEST(v_min_dim, ROUND((GREATEST(o.height, 10.0) / v_factor)::NUMERIC, 2)::REAL),
        properties = COALESCE(o.properties, '{}'::jsonb) || jsonb_build_object(
          'legacy_position_x', COALESCE(o.properties->'legacy_position_x', to_jsonb(o.position_x)),
          'legacy_position_y', COALESCE(o.properties->'legacy_position_y', to_jsonb(o.position_y)),
          'legacy_width', COALESCE(o.properties->'legacy_width', to_jsonb(o.width)),
          'legacy_height', COALESCE(o.properties->'legacy_height', to_jsonb(o.height)),
          'world_unit', v_unit,
          'migrated_v2', true
        ),
        updated_at = now()
      WHERE o.venue_layout_id = rec.id
        AND COALESCE((o.properties->>'migrated_v2')::BOOLEAN, false) = false;
    ELSE
      -- Objects are already in world coordinates; stamp migrated_v2 safely without scaling
      UPDATE venue_layout_objects o
      SET
        width = GREATEST(v_min_dim, ROUND(COALESCE(NULLIF(o.width, 0), 1.8)::NUMERIC, 2)::REAL),
        height = GREATEST(v_min_dim, ROUND(COALESCE(NULLIF(o.height, 0), 1.8)::NUMERIC, 2)::REAL),
        properties = COALESCE(o.properties, '{}'::jsonb) || jsonb_build_object(
          'world_unit', v_unit,
          'migrated_v2', true
        ),
        updated_at = now()
      WHERE o.venue_layout_id = rec.id
        AND COALESCE((o.properties->>'migrated_v2')::BOOLEAN, false) = false;
    END IF;

    UPDATE venue_layouts
    SET
      venue_width = v_target_w,
      venue_height = v_target_h,
      venue_unit = v_unit,
      venue_orientation = CASE WHEN v_target_w >= v_target_h THEN 'landscape' ELSE 'portrait' END,
      grid_unit_step = COALESCE(NULLIF(rec.grid_unit_step, 0), CASE WHEN v_unit = 'ft' THEN 2.0 ELSE 0.5 END),
      coordinate_system = 'world',
      is_migrated = true,
      migration_version = 2,
      canvas_width = ROUND(v_target_w * v_px_per_unit)::INTEGER,
      canvas_height = ROUND(v_target_h * v_px_per_unit)::INTEGER,
      grid_size = ROUND(COALESCE(NULLIF(rec.grid_unit_step, 0), CASE WHEN v_unit = 'ft' THEN 2.0 ELSE 0.5 END) * v_px_per_unit)::INTEGER,
      updated_at = now()
    WHERE id = rec.id;
  END LOOP;
END $$;

-- Now future new rows default to migration_version = 2
ALTER TABLE venue_layouts
  ALTER COLUMN migration_version SET DEFAULT 2;

-- 3. Atomic transactional save RPC for venue layouts + objects
-- Guarantees save failure never wipes existing objects (automatic rollback on any insert error).
CREATE OR REPLACE FUNCTION save_venue_layout_atomic(
  p_layout JSONB,
  p_objects JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_layout_id UUID;
  v_project_id TEXT;
  v_layout_row venue_layouts%ROWTYPE;
  v_saved_objects JSONB;
BEGIN
  v_project_id := p_layout->>'project_id';
  IF v_project_id IS NULL OR LENGTH(TRIM(v_project_id)) = 0 THEN
    RAISE EXCEPTION 'project_id is required in save_venue_layout_atomic';
  END IF;

  v_layout_id := COALESCE(NULLIF(p_layout->>'id', '')::UUID, gen_random_uuid());

  INSERT INTO venue_layouts (
    id,
    project_id,
    layout_name,
    venue_width,
    venue_height,
    venue_unit,
    venue_orientation,
    venue_name,
    venue_description,
    grid_unit_step,
    show_grid,
    show_rulers,
    coordinate_system,
    is_migrated,
    migration_version,
    canvas_width,
    canvas_height,
    grid_size,
    snap_to_grid,
    updated_at
  ) VALUES (
    v_layout_id,
    v_project_id,
    COALESCE(NULLIF(p_layout->>'layout_name', ''), 'Main Ballroom & Reception Hall'),
    COALESCE((p_layout->>'venue_width')::REAL, 30.0),
    COALESCE((p_layout->>'venue_height')::REAL, 20.0),
    COALESCE(NULLIF(p_layout->>'venue_unit', ''), 'm'),
    COALESCE(NULLIF(p_layout->>'venue_orientation', ''), 'landscape'),
    p_layout->>'venue_name',
    p_layout->>'venue_description',
    COALESCE((p_layout->>'grid_unit_step')::REAL, 0.5),
    COALESCE((p_layout->>'show_grid')::BOOLEAN, true),
    COALESCE((p_layout->>'show_rulers')::BOOLEAN, true),
    COALESCE(NULLIF(p_layout->>'coordinate_system', ''), 'world'),
    COALESCE((p_layout->>'is_migrated')::BOOLEAN, true),
    COALESCE((p_layout->>'migration_version')::INTEGER, 2),
    COALESCE((p_layout->>'canvas_width')::INTEGER, 1800),
    COALESCE((p_layout->>'canvas_height')::INTEGER, 1200),
    COALESCE((p_layout->>'grid_size')::INTEGER, 30),
    COALESCE((p_layout->>'snap_to_grid')::BOOLEAN, true),
    now()
  )
  ON CONFLICT (project_id) DO UPDATE SET
    layout_name = COALESCE(NULLIF(EXCLUDED.layout_name, ''), venue_layouts.layout_name),
    venue_width = EXCLUDED.venue_width,
    venue_height = EXCLUDED.venue_height,
    venue_unit = EXCLUDED.venue_unit,
    venue_orientation = EXCLUDED.venue_orientation,
    venue_name = COALESCE(EXCLUDED.venue_name, venue_layouts.venue_name),
    venue_description = COALESCE(EXCLUDED.venue_description, venue_layouts.venue_description),
    grid_unit_step = EXCLUDED.grid_unit_step,
    show_grid = EXCLUDED.show_grid,
    show_rulers = EXCLUDED.show_rulers,
    coordinate_system = EXCLUDED.coordinate_system,
    is_migrated = EXCLUDED.is_migrated,
    migration_version = EXCLUDED.migration_version,
    canvas_width = EXCLUDED.canvas_width,
    canvas_height = EXCLUDED.canvas_height,
    grid_size = EXCLUDED.grid_size,
    snap_to_grid = EXCLUDED.snap_to_grid,
    updated_at = now()
  RETURNING * INTO v_layout_row;

  IF p_objects IS NOT NULL THEN
    DELETE FROM venue_layout_objects
    WHERE venue_layout_id = v_layout_row.id;

    IF jsonb_array_length(p_objects) > 0 THEN
      INSERT INTO venue_layout_objects (
        id,
        venue_layout_id,
        project_id,
        object_type,
        object_reference_id,
        label,
        position_x,
        position_y,
        width,
        height,
        rotation,
        properties,
        z_index,
        created_at,
        updated_at
      )
      SELECT
        COALESCE(NULLIF(item->>'id', '')::UUID, gen_random_uuid()),
        v_layout_row.id,
        v_project_id,
        COALESCE(NULLIF(item->>'object_type', ''), 'table'),
        NULLIF(item->>'object_reference_id', ''),
        item->>'label',
        COALESCE((item->>'position_x')::REAL, 1.0),
        COALESCE((item->>'position_y')::REAL, 1.0),
        GREATEST(0.2, COALESCE((item->>'width')::REAL, 1.8)),
        GREATEST(0.2, COALESCE((item->>'height')::REAL, 1.8)),
        COALESCE((item->>'rotation')::REAL, 0),
        COALESCE(item->'properties', '{}'::jsonb),
        COALESCE((item->>'z_index')::INTEGER, 1),
        COALESCE(NULLIF(item->>'created_at', '')::TIMESTAMPTZ, now()),
        now()
      FROM jsonb_array_elements(p_objects) AS item;
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.z_index ASC, o.created_at ASC), '[]'::jsonb)
  INTO v_saved_objects
  FROM venue_layout_objects o
  WHERE o.venue_layout_id = v_layout_row.id;

  RETURN jsonb_build_object(
    'layout', to_jsonb(v_layout_row),
    'objects', v_saved_objects
  );
END;
$$;
