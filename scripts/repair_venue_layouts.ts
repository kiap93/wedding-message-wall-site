/**
 * Dry-run & Backup Utility: Repair Legacy / Mis-tagged Wedding Hall Venue Layouts
 *
 * Usage:
 *   npx tsx scripts/repair_venue_layouts.ts                   # Dry-run report only (no DB writes)
 *   npx tsx scripts/repair_venue_layouts.ts --apply           # Writes backup JSON then updates DB atomically
 *   npx tsx scripts/repair_venue_layouts.ts --backup out.json # Custom backup path
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { VenueLayout, VenueLayoutObject } from '../src/types';
import { isLegacyLayout, migrateVenueLayout } from '../src/utils/venueCoordinates';

export interface RepairAuditItem {
  layoutId: string;
  projectId: string;
  reason: 'untagged_legacy' | 'mis_tagged_world_with_pixel_objects';
  coordinateSystemBefore: string | null | undefined;
  migrationVersionBefore: number | null | undefined;
  objectCount: number;
  migratedLayout: VenueLayout;
}

export interface RepairReport {
  totalLayouts: number;
  affectedLayouts: number;
  affectedObjects: number;
  items: RepairAuditItem[];
}

export function auditLayoutsForRepair(layouts: VenueLayout[]): RepairReport {
  const items: RepairAuditItem[] = [];
  let affectedObjects = 0;

  for (const layout of layouts) {
    if (!isLegacyLayout(layout)) {
      continue;
    }

    const migratedLayout = migrateVenueLayout(layout);
    const reason =
      layout.coordinate_system === 'world' || layout.is_migrated
        ? 'mis_tagged_world_with_pixel_objects'
        : 'untagged_legacy';

    affectedObjects += layout.objects?.length || 0;
    items.push({
      layoutId: layout.id,
      projectId: layout.project_id,
      reason,
      coordinateSystemBefore: layout.coordinate_system,
      migrationVersionBefore: layout.migration_version,
      objectCount: layout.objects?.length || 0,
      migratedLayout
    });
  }

  return {
    totalLayouts: layouts.length,
    affectedLayouts: items.length,
    affectedObjects,
    items
  };
}

async function runCli() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const backupIdx = args.indexOf('--backup');
  const backupPath =
    backupIdx !== -1 && args[backupIdx + 1]
      ? path.resolve(args[backupIdx + 1])
      : path.resolve(`venue_layouts_backup_${Date.now()}.json`);

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables. Cannot connect to database.'
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: layoutsRaw, error: layoutsErr } = await supabase
    .from('venue_layouts')
    .select('*');
  if (layoutsErr) {
    throw new Error(`Failed to fetch venue_layouts: ${layoutsErr.message}`);
  }

  const { data: objectsRaw, error: objectsErr } = await supabase
    .from('venue_layout_objects')
    .select('*');
  if (objectsErr) {
    throw new Error(`Failed to fetch venue_layout_objects: ${objectsErr.message}`);
  }

  const objectsByLayout = new Map<string, VenueLayoutObject[]>();
  (objectsRaw || []).forEach((obj: any) => {
    const list = objectsByLayout.get(obj.venue_layout_id) || [];
    list.push(obj as VenueLayoutObject);
    objectsByLayout.set(obj.venue_layout_id, list);
  });

  const hydratedLayouts: VenueLayout[] = (layoutsRaw || []).map((l: any) => ({
    ...l,
    objects: objectsByLayout.get(l.id) || []
  }));

  const report = auditLayoutsForRepair(hydratedLayouts);
  console.log(
    JSON.stringify(
      {
        mode: apply ? 'APPLY' : 'DRY_RUN',
        totalLayouts: report.totalLayouts,
        affectedLayouts: report.affectedLayouts,
        affectedObjects: report.affectedObjects,
        affectedDetails: report.items.map(i => ({
          layoutId: i.layoutId,
          projectId: i.projectId,
          reason: i.reason,
          objectCount: i.objectCount
        }))
      },
      null,
      2
    )
  );

  if (!apply || report.affectedLayouts === 0) {
    return;
  }

  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      report.items.map(i => hydratedLayouts.find(l => l.id === i.layoutId)),
      null,
      2
    ),
    'utf8'
  );
  console.log(`Backup written to ${backupPath}`);

  for (const item of report.items) {
    const { objects, ...layoutFields } = item.migratedLayout;
    const { error: rpcErr } = await supabase.rpc('save_venue_layout_atomic', {
      p_layout: layoutFields,
      p_objects: objects
    });
    if (rpcErr) {
      throw new Error(
        `Atomic repair failed for layout ${item.layoutId} (project ${item.projectId}): ${rpcErr.message}`
      );
    }
  }

  console.log(`Successfully repaired ${report.affectedLayouts} layouts atomically.`);
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1]?.includes('repair_venue_layouts');

if (isDirectExecution) {
  runCli().catch(err => {
    console.error('[repair_venue_layouts] Error:', err);
    process.exit(1);
  });
}
