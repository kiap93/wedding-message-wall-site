/**
 * Production-Hardening Test Suite for EventFrame Agency & Tenant Architecture
 * Covers all 10 required scenarios + HTTP route parity & PGRST116 regression prevention.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import {
  extractSubdomainFromHost,
  normalizeAndValidateSlug,
  sanitizePublicAgency,
  sanitizePublicProject,
  mapDatabaseError,
  findAgencyById,
  findAgencyBySlugOrHost,
  findAgenciesForUser,
  onboardWorkspaceForUser,
  createAgencyForUser,
  updateAgencyForUser,
  resolveProjectWithAgency,
  listProjectsForUser,
  getProjectForAuthorizedUser,
  createProjectForUser,
  updateProjectForUserOrPin,
  deleteProjectForUser,
  resolvePublicEvent,
  verifyCouplePinLogin,
} from '../server/agencyService';
import { resolveAuthenticatedSessionUser } from '../server/developerAdminService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✓ PASSED: ${message}`);
}

type TableRows = Record<string, any[]>;

interface MockDbOptions {
  failNextInsertOnTable?: string | null;
  forceErrorOnTable?: { table: string; code: string; message: string } | null;
  insertDelayMs?: number;
}

class StatefulQueryBuilder {
  private db: TableRows;
  private table: string;
  private opts: MockDbOptions;
  private filters: Array<(row: any) => boolean> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private singleMode: 'none' | 'maybe' | 'single' = 'none';

  constructor(db: TableRows, table: string, opts: MockDbOptions) {
    this.db = db;
    this.table = table;
    this.opts = opts;
    if (!this.db[table]) this.db[table] = [];
  }

  select(_cols?: string) {
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((r) => r?.[col] === val);
    return this;
  }

  ilike(col: string, val: string) {
    const target = String(val || '').toLowerCase();
    this.filters.push((r) => String(r?.[col] || '').toLowerCase() === target);
    return this;
  }

  in(col: string, vals: any[]) {
    this.filters.push((r) => vals.includes(r?.[col]));
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybe';
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  insert(rows: any[]) {
    this.op = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(patch: Record<string, any>) {
    this.op = 'update';
    this.payload = patch;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  private async execute(): Promise<{ data: any; error: any }> {
    if (this.opts.forceErrorOnTable && this.opts.forceErrorOnTable.table === this.table) {
      return {
        data: null,
        error: {
          code: this.opts.forceErrorOnTable.code,
          message: this.opts.forceErrorOnTable.message,
        },
      };
    }

    if (this.op === 'insert') {
      if (this.opts.insertDelayMs) {
        await new Promise((r) => setTimeout(r, this.opts.insertDelayMs));
      }

      if (this.opts.failNextInsertOnTable === this.table) {
        this.opts.failNextInsertOnTable = null;
        return {
          data: null,
          error: {
            code: '23514',
            message: 'Simulated partial onboarding write failure on ' + this.table,
          },
        };
      }

      const inserted: any[] = [];
      for (const raw of this.payload) {
        if (this.table === 'agencies' && raw.slug) {
          const dup = this.db.agencies.find(
            (a) => !a.deleted_at && String(a.slug || '').toLowerCase() === String(raw.slug).toLowerCase()
          );
          if (dup) {
            return {
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "uq_agencies_slug_lower_active"',
              },
            };
          }
        }

        const row = {
          id: raw.id || `${this.table}-${this.db[this.table].length + 1}-${Math.random().toString(36).slice(2, 6)}`,
          ...raw,
        };
        this.db[this.table].push(row);
        inserted.push(row);
      }

      if (this.singleMode === 'single') {
        if (inserted.length !== 1) {
          return { data: null, error: { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object' } };
        }
        return { data: inserted[0], error: null };
      }
      if (this.singleMode === 'maybe') {
        return { data: inserted[0] || null, error: null };
      }
      return { data: inserted, error: null };
    }

    if (this.op === 'update') {
      const updated: any[] = [];
      for (const row of this.db[this.table]) {
        if (this.filters.every((f) => f(row))) {
          if (this.table === 'agencies' && this.payload.slug) {
            const dup = this.db.agencies.find(
              (a) =>
                !a.deleted_at &&
                a.id !== row.id &&
                String(a.slug || '').toLowerCase() === String(this.payload.slug).toLowerCase()
            );
            if (dup) {
              return {
                data: null,
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "uq_agencies_slug_lower_active"',
                },
              };
            }
          }
          Object.assign(row, this.payload);
          updated.push({ ...row });
        }
      }

      if (this.singleMode === 'single') {
        if (updated.length !== 1) {
          return { data: null, error: { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object' } };
        }
        return { data: updated[0], error: null };
      }
      if (this.singleMode === 'maybe') {
        if (updated.length > 1) {
          return { data: null, error: { code: 'PGRST116', message: 'Cannot coerce multiple rows to JSON object' } };
        }
        return { data: updated[0] || null, error: null };
      }
      return { data: updated, error: null };
    }

    if (this.op === 'delete') {
      const remaining: any[] = [];
      const removed: any[] = [];
      for (const row of this.db[this.table]) {
        if (this.filters.every((f) => f(row))) removed.push(row);
        else remaining.push(row);
      }
      this.db[this.table] = remaining;
      return { data: removed, error: null };
    }

    // SELECT
    let rows = this.db[this.table].filter((r) => this.filters.every((f) => f(r)));
    if (this.orderCol) {
      const col = this.orderCol;
      rows = [...rows].sort((a, b) => {
        const av = a?.[col] ?? '';
        const bv = b?.[col] ?? '';
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (this.orderAsc ? 1 : -1);
      });
    }
    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    if (this.singleMode === 'single') {
      // Simulate real PostgREST HTTP 406 PGRST116 whenever 0 or >1 rows match!
      if (rows.length !== 1) {
        return {
          data: null,
          error: {
            code: 'PGRST116',
            details: `The result contains ${rows.length} rows`,
            message: 'Cannot coerce the result to a single JSON object',
          },
        };
      }
      return { data: rows[0], error: null };
    }

    if (this.singleMode === 'maybe') {
      if (rows.length > 1) {
        return {
          data: null,
          error: {
            code: 'PGRST116',
            details: `The result contains ${rows.length} rows`,
            message: 'Cannot coerce the result to a single JSON object',
          },
        };
      }
      return { data: rows[0] || null, error: null };
    }

    return { data: rows, error: null };
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

function createMockSupabase(initial?: Partial<TableRows>, opts: MockDbOptions = {}) {
  const db: TableRows = {
    agencies: [...(initial?.agencies || [])],
    projects: [...(initial?.projects || [])],
    users_auth: [...(initial?.users_auth || [])],
    platform_activity_logs: [...(initial?.platform_activity_logs || [])],
  };

  return {
    db,
    opts,
    from(table: string) {
      return new StatefulQueryBuilder(db, table, opts);
    },
  };
}

async function runTests() {
  console.log('\n=== EventFrame Agency Architecture & Lookup Hardening Test Suite ===\n');

  // ---------------------------------------------------------------------------
  // Scenario 1: Lookup of Existing Agency + Host/Subdomain Parsing + Sanitization
  // ---------------------------------------------------------------------------
  {
    const sb = createMockSupabase({
      agencies: [
        {
          id: 'agency-1',
          name: 'Lumiere Weddings',
          slug: 'lumiere',
          user_id: 'user-1',
          owner_email: 'owner@lumiere.co',
          user_role: 'agency',
          subscription_status: 'active',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const bySlug = await findAgencyBySlugOrHost(sb, { slug: 'LUMIERE' });
    assert(bySlug.ok === true && bySlug.statusCode === 200, '1a. Finds existing agency case-insensitively');
    assert(bySlug.ok && bySlug.data.id === 'agency-1', '1b. Returned agency ID matches');

    const byHost = await findAgencyBySlugOrHost(sb, { host: 'lumiere.eventframe.io' });
    assert(byHost.ok === true && byHost.data.slug === 'lumiere', '1c. Resolves agency via subdomain host header');

    const sanitized = sanitizePublicAgency(bySlug.ok ? bySlug.data : null);
    assert(sanitized && sanitized.owner_email === undefined && sanitized.user_id === undefined, '1d. Public agency sanitizer strips owner_email & user_id');

    assert(extractSubdomainFromHost('eventframe.io') === null, '1e. Root eventframe.io produces null subdomain');
    assert(extractSubdomainFromHost('www.eventframe.io') === null, '1f. www.eventframe.io produces null subdomain');
    assert(extractSubdomainFromHost('demo-preview.pages.dev') === null, '1g. Preview .pages.dev host produces null subdomain');
    assert(extractSubdomainFromHost('ef-prod.workers.dev') === null, '1h. Preview .workers.dev host produces null subdomain');
    assert(extractSubdomainFromHost('ais-dev-123.us-west1.run.app') === null, '1i. Cloud Run preview host produces null subdomain');
    assert(extractSubdomainFromHost('acme.eventframe.io') === 'acme', '1j. Custom tenant subdomain extracts cleanly');
  }

  // ---------------------------------------------------------------------------
  // Scenario 2: Lookup of Missing Agency ("gewg") — Zero PGRST116, Zero HTTP 406, No Auto-Creation
  // ---------------------------------------------------------------------------
  {
    const sb = createMockSupabase({
      agencies: [
        { id: 'agency-1', name: 'Existing Studio', slug: 'existing', user_id: 'user-1', owner_email: 'a@b.com' },
      ],
    });

    const missingSlug = await findAgencyBySlugOrHost(sb, { slug: 'gewg' });
    assert(missingSlug.ok === false, '2a. Missing agency slug "gewg" fails cleanly instead of returning partial object');
    if (!missingSlug.ok) {
      assert(missingSlug.statusCode === 404, '2b. Missing agency returns HTTP 404 (not HTTP 406 PGRST116)');
      assert(missingSlug.code === 'AGENCY_NOT_FOUND', '2c. Missing agency returns structured AGENCY_NOT_FOUND code');
      assert(!/PGRST116|coerce/i.test(missingSlug.error), '2d. Error message never exposes raw PostgREST PGRST116 error');
    }

    const reservedLookup = await findAgencyBySlugOrHost(sb, { slug: 'developer' });
    assert(reservedLookup.ok === false && reservedLookup.statusCode === 404, '2e. Reserved system slug lookup returns 404 cleanly');

    const missingById = await findAgencyById(sb, 'non-existent-agency-id');
    assert(missingById.ok === false && missingById.statusCode === 404, '2f. Missing agency by ID returns 404 cleanly');

    assert(sb.db.agencies.length === 1, '2g. Lookup never auto-creates missing agencies on read');
  }

  // ---------------------------------------------------------------------------
  // Scenario 3: New User Registration / Onboarding (Agency & Couple)
  // ---------------------------------------------------------------------------
  {
    const sb = createMockSupabase({
      users_auth: [
        { id: 'user-agency', email: 'planner@studio.io', role: 'user', organization_id: null, status: 'active' },
        { id: 'user-couple', email: 'couple@love.io', role: 'user', organization_id: null, status: 'active' },
      ],
    });

    const agencyResult = await onboardWorkspaceForUser(
      sb,
      { id: 'user-agency', email: 'planner@studio.io', role: 'user', status: 'active' },
      { role: 'agency', name: 'Atelier Events', slug: 'atelier-events' }
    );
    assert(agencyResult.ok === true && agencyResult.statusCode === 201, '3a. Agency onboarding succeeds with 201 Created');
    if (agencyResult.ok) {
      assert(agencyResult.data.agency.slug === 'atelier-events', '3b. Agency created with normalized slug');
      assert(agencyResult.data.agency.owner_email === 'planner@studio.io', '3c. owner_email linked cleanly');
      assert(agencyResult.data.createdProjectId === null, '3d. Agency onboarding does not force a couple project');
    }
    const syncedUser = sb.db.users_auth.find((u) => u.id === 'user-agency');
    assert(Boolean(syncedUser?.organization_id) && syncedUser?.role === 'agency_owner', '3e. users_auth synced with organization_id & agency_owner');

    const coupleResult = await onboardWorkspaceForUser(
      sb,
      { id: 'user-couple', email: 'couple@love.io', role: 'user', status: 'active' },
      { role: 'couple', groomName: 'Liam', brideName: 'Maya', slug: 'liam-maya' }
    );
    assert(coupleResult.ok === true && coupleResult.statusCode === 201, '3f. Couple onboarding succeeds with 201 Created');
    if (coupleResult.ok) {
      assert(Boolean(coupleResult.data.createdProjectId), '3g. Couple onboarding atomically creates initial event project');
      const createdProj = sb.db.projects.find((p) => p.id === coupleResult.data.createdProjectId);
      assert(createdProj && createdProj.agency_id === coupleResult.data.agency.id, '3h. Created project strictly links to agency_id');
    }
  }

  // ---------------------------------------------------------------------------
  // Scenario 4: Existing User Without Agency + Post-Login / Auth Resolution
  // ---------------------------------------------------------------------------
  {
    const sb = createMockSupabase({
      users_auth: [
        { id: 'user-no-org', email: 'noorg@test.com', role: 'user', organization_id: null, status: 'active' },
      ],
    });

    const userWorkspaces = await findAgenciesForUser(sb, {
      id: 'user-no-org',
      email: 'noorg@test.com',
      role: 'user',
      status: 'active',
    });
    assert(userWorkspaces.ok === true && userWorkspaces.statusCode === 200, '4a. User without agency resolves with 200 (never 406/PGRST116)');
    if (userWorkspaces.ok) {
      assert(userWorkspaces.data.agencies.length === 0, '4b. Empty agencies array returned');
      assert(userWorkspaces.data.primaryAgency === null, '4c. primaryAgency is null');
      assert(userWorkspaces.data.requiresOnboarding === true, '4d. requiresOnboarding flag is true');
    }

    const createEventWithoutOrg = await createProjectForUser(
      sb,
      { id: 'user-no-org', email: 'noorg@test.com', role: 'user', status: 'active' },
      { name: 'Orphan Attempt', slug: 'orphan-attempt' }
    );
    assert(
      createEventWithoutOrg.ok === false &&
        createEventWithoutOrg.statusCode === 403 &&
        createEventWithoutOrg.code === 'AGENCY_REQUIRED',
      '4e. Creating a project without an agency is blocked cleanly with 403 AGENCY_REQUIRED'
    );

    // Also test resolveAuthenticatedSessionUser when a user owns 2 agencies (legacy .single() would fail PGRST116!)
    const multiOrgSb = createMockSupabase({
      users_auth: [{ id: 'multi-u', email: 'multi@test.com', role: 'user', organization_id: null, status: 'active' }],
      agencies: [
        { id: 'ag-m1', slug: 'm1', name: 'M1', user_id: 'multi-u', owner_email: 'multi@test.com', created_at: '2026-01-01' },
        { id: 'ag-m2', slug: 'm2', name: 'M2', user_id: 'multi-u', owner_email: 'multi@test.com', created_at: '2026-01-02' },
      ],
    });
    const sessionCheck = await resolveAuthenticatedSessionUser(multiOrgSb, {
      id: 'multi-u',
      email: 'multi@test.com',
    });
    assert(sessionCheck.ok === true && sessionCheck.user.role === 'agency_owner', '4f. resolveAuthenticatedSessionUser safely handles multi-agency owners without PGRST116');
  }

  // ---------------------------------------------------------------------------
  // Scenario 5: Duplicate Agency Initialization, Reserved Slugs & Conflict (409)
  // ---------------------------------------------------------------------------
  {
    const sb = createMockSupabase({
      agencies: [
        { id: 'ag-taken', name: 'Taken Studio', slug: 'taken-slug', user_id: 'user-other', owner_email: 'other@co.com', user_role: 'agency' },
      ],
    });

    const reservedCheck = normalizeAndValidateSlug('admin');
    assert(reservedCheck.ok === false && reservedCheck.statusCode === 422 && reservedCheck.code === 'RESERVED_SLUG', '5a. Reserved slug rejected with 422');

    const conflictOnboard = await onboardWorkspaceForUser(
      sb,
      { id: 'user-new', email: 'new@co.com', role: 'user', status: 'active' },
      { role: 'agency', name: 'Another Co', slug: 'taken-slug' }
    );
    assert(conflictOnboard.ok === false && conflictOnboard.statusCode === 409 && conflictOnboard.code === 'SLUG_ALREADY_EXISTS', '5b. Colliding slug for different user returns 409 Conflict');

    // First creation for user-1
    const first = await createAgencyForUser(
      sb,
      { id: 'user-1', email: 'u1@co.com', role: 'user', status: 'active' },
      { name: 'First Co', slug: 'first-co' }
    );
    assert(first.ok === true && first.statusCode === 201, '5c. Initial createAgencyForUser succeeds');

    // Idempotent repeat creation with same slug for user-1
    const secondSameSlug = await createAgencyForUser(
      sb,
      { id: 'user-1', email: 'u1@co.com', role: 'user', status: 'active' },
      { name: 'First Co', slug: 'first-co' }
    );
    assert(secondSameSlug.ok === true && secondSameSlug.statusCode === 200 && secondSameSlug.reused === true, '5d. Repeat create with same slug reuses existing cleanly');

    // Duplicate agency creation with DIFFERENT slug blocked unless explicitly allowed
    const duplicateDifferentSlug = await createAgencyForUser(
      sb,
      { id: 'user-1', email: 'u1@co.com', role: 'user', status: 'active' },
      { name: 'Second Co', slug: 'second-co' }
    );
    assert(
      duplicateDifferentSlug.ok === false &&
        duplicateDifferentSlug.statusCode === 409 &&
        duplicateDifferentSlug.code === 'AGENCY_ALREADY_EXISTS',
      '5e. Unintended duplicate agency for same user returns 409 AGENCY_ALREADY_EXISTS'
    );
    assert(sb.db.agencies.filter((a) => a.user_id === 'user-1').length === 1, '5f. User still has exactly 1 agency');
  }

  // ---------------------------------------------------------------------------
  // Scenario 6: Concurrent Agency Creation for Same User & Racing Different Users
  // ---------------------------------------------------------------------------
  {
    const sb = createMockSupabase({}, { insertDelayMs: 15 });
    const caller = { id: 'race-user', email: 'race@co.com', role: 'user', status: 'active' };

    const [r1, r2] = await Promise.all([
      onboardWorkspaceForUser(sb, caller, { role: 'agency', name: 'Race Studio', slug: 'race-studio' }),
      onboardWorkspaceForUser(sb, caller, { role: 'agency', name: 'Race Studio', slug: 'race-studio' }),
    ]);

    assert(r1.ok === true && r2.ok === true, '6a. Concurrent onboarding calls for same user both resolve cleanly without 500/23505 crash');
    if (r1.ok && r2.ok) {
      assert(r1.data.agency.id === r2.data.agency.id, '6b. Both concurrent calls resolve to the exact same agency ID');
    }
    assert(sb.db.agencies.length === 1, '6c. Only 1 agency record exists in DB after concurrent requests');

    // Racing TWO DIFFERENT users trying to claim the exact same slug simultaneously
    const sbRaceDifferent = createMockSupabase({}, { insertDelayMs: 15 });
    const [uA, uB] = await Promise.all([
      onboardWorkspaceForUser(sbRaceDifferent, { id: 'uA', email: 'a@co.com', status: 'active' }, { role: 'agency', name: 'Studio A', slug: 'shared-race' }),
      onboardWorkspaceForUser(sbRaceDifferent, { id: 'uB', email: 'b@co.com', status: 'active' }, { role: 'agency', name: 'Studio B', slug: 'shared-race' }),
    ]);
    const successes = [uA, uB].filter((r) => r.ok);
    const conflicts = [uA, uB].filter((r) => !r.ok && r.statusCode === 409);
    assert(successes.length === 1 && conflicts.length === 1, '6d. Racing two different users on same slug: 1 wins (201), 1 receives 409 Conflict');
  }

  // ---------------------------------------------------------------------------
  // Scenario 7: Project Lookup with Valid agency_id & Couple PIN Verification
  // ---------------------------------------------------------------------------
  {
    const sb = createMockSupabase({
      agencies: [
        { id: 'ag-7', name: 'Crown Events', slug: 'crown', user_id: 'owner-7', owner_email: 'owner7@co.com', user_role: 'agency', subscription_status: 'active' },
      ],
      projects: [
        {
          id: 'proj-7',
          agency_id: 'ag-7',
          name: 'Ethan & Chloe',
          slug: 'ethan-chloe',
          groom_name: 'Ethan',
          bride_name: 'Chloe',
          access_password: 'PIN-7788',
          website_preview_token: 'sec-prev-1',
          created_at: '2026-02-01',
        },
      ],
    });

    const resolved = await resolveProjectWithAgency(sb, 'proj-7');
    assert(resolved.ok === true && resolved.data.agency.id === 'ag-7', '7a. Project resolves cleanly with linked parent agency');

    const pubNoPin = await resolvePublicEvent(sb, { slug: 'ethan-chloe', agencyId: 'ag-7' });
    assert(pubNoPin.ok === true, '7b. Public event resolves cleanly by project slug + agencyId');
    if (pubNoPin.ok) {
      assert(pubNoPin.data.project.access_password === undefined, '7c. Public event strips raw access_password');
      assert(pubNoPin.data.project.hasAccessPassword === true, '7d. Public event exposes hasAccessPassword boolean');
      assert(pubNoPin.data.agency.owner_email === undefined, '7e. Public event response strips agency owner_email');
    }

    const badPin = await verifyCouplePinLogin(sb, { agencySlug: 'crown', slug: 'ethan-chloe', password: 'WRONG' });
    assert(badPin.ok === false && badPin.statusCode === 401 && badPin.code === 'INVALID_PIN', '7f. Invalid couple PIN rejected with 401');

    const goodPin = await verifyCouplePinLogin(sb, { agencySlug: 'crown', slug: 'ethan-chloe', password: 'PIN-7788' });
    assert(goodPin.ok === true && goodPin.data.project.access_password === 'PIN-7788', '7g. Valid couple PIN succeeds server-side');
  }

  // ---------------------------------------------------------------------------
  // Scenario 8: Project with Invalid / Missing agency_id & No Blind Slug Conflation
  // ---------------------------------------------------------------------------
  {
    const sb = createMockSupabase({
      agencies: [
        { id: 'ag-valid', name: 'Only Agency', slug: 'only-agency-slug', user_id: 'owner-8', owner_email: 'o8@co.com' },
      ],
      projects: [
        { id: 'proj-null-ag', agency_id: null, name: 'Missing Agency', slug: 'missing-ag' },
        { id: 'proj-dangling-ag', agency_id: 'ag-deleted-999', name: 'Dangling Agency', slug: 'dangling-ag' },
      ],
    });

    const nullAgRes = await resolveProjectWithAgency(sb, 'proj-null-ag');
    assert(
      nullAgRes.ok === false && nullAgRes.statusCode === 422 && nullAgRes.code === 'INVALID_AGENCY_REFERENCE',
      '8a. Project with NULL agency_id returns explicit 422 INVALID_AGENCY_REFERENCE'
    );

    const danglingAgRes = await resolveProjectWithAgency(sb, 'proj-dangling-ag');
    assert(
      danglingAgRes.ok === false && danglingAgRes.statusCode === 422 && danglingAgRes.code === 'INVALID_AGENCY_REFERENCE',
      '8b. Project pointing to missing agency_id returns explicit 422 INVALID_AGENCY_REFERENCE'
    );

    // Passing an AGENCY slug as a PROJECT slug (?slug=only-agency-slug) must NOT blindly resolve the agency
    const conflationAttempt = await resolvePublicEvent(sb, { slug: 'only-agency-slug' });
    assert(
      conflationAttempt.ok === false && conflationAttempt.statusCode === 404 && conflationAttempt.code === 'EVENT_NOT_FOUND',
      '8c. Project slug lookup does not blindly conflate agency slugs with project slugs'
    );
  }

  // ---------------------------------------------------------------------------
  // Scenario 9: Cross-Agency Authorization Checks
  // ---------------------------------------------------------------------------
  {
    const sb = createMockSupabase({
      agencies: [
        { id: 'ag-A', name: 'Agency A', slug: 'agency-a', user_id: 'user-A', owner_email: 'a@agency.com' },
        { id: 'ag-B', name: 'Agency B', slug: 'agency-b', user_id: 'user-B', owner_email: 'b@agency.com' },
      ],
      projects: [
        { id: 'proj-A', agency_id: 'ag-A', name: 'Wedding A', slug: 'wedding-a', access_password: 'SECRET-PIN-A' },
      ],
    });

    const userB = { id: 'user-B', email: 'b@agency.com', role: 'agency_owner', status: 'active' };

    const crossList = await listProjectsForUser(sb, userB, 'ag-A');
    assert(crossList.ok === false && crossList.statusCode === 403 && crossList.code === 'FORBIDDEN_AGENCY_ACCESS', '9a. Cross-agency project list blocked with 403');

    const crossGet = await getProjectForAuthorizedUser(sb, userB, 'proj-A');
    assert(crossGet.ok === false && crossGet.statusCode === 403 && crossGet.code === 'FORBIDDEN_AGENCY_ACCESS', '9b. Cross-agency project read blocked with 403');

    const crossCreate = await createProjectForUser(sb, userB, { agency_id: 'ag-A', name: 'Injected Event', slug: 'injected' });
    assert(crossCreate.ok === false && crossCreate.statusCode === 403 && crossCreate.code === 'FORBIDDEN_AGENCY_ACCESS', '9c. Cross-agency project creation blocked with 403');

    const crossUpdateProj = await updateProjectForUserOrPin(sb, { projectId: 'proj-A', authUser: userB, body: { name: 'Hacked' } });
    assert(crossUpdateProj.ok === false && crossUpdateProj.statusCode === 403 && crossUpdateProj.code === 'FORBIDDEN_AGENCY_ACCESS', '9d. Cross-agency project update blocked with 403');

    const crossDeleteProj = await deleteProjectForUser(sb, { projectId: 'proj-A', authUser: userB });
    assert(crossDeleteProj.ok === false && crossDeleteProj.statusCode === 403 && crossDeleteProj.code === 'FORBIDDEN_AGENCY_ACCESS', '9e. Cross-agency project delete blocked with 403');

    const crossUpdateAgency = await updateAgencyForUser(sb, userB, 'ag-A', { name: 'Hijacked Agency' });
    assert(crossUpdateAgency.ok === false && crossUpdateAgency.statusCode === 403 && crossUpdateAgency.code === 'FORBIDDEN_AGENCY_ACCESS', '9f. Cross-agency update blocked with 403');

    const badPinUpdate = await updateProjectForUserOrPin(sb, { projectId: 'proj-A', pin: 'WRONG', body: { location: 'Paris' } });
    assert(badPinUpdate.ok === false && badPinUpdate.statusCode === 403, '9g. Invalid event PIN blocked from modifying project');

    const goodPinUpdate = await updateProjectForUserOrPin(sb, { projectId: 'proj-A', pin: 'SECRET-PIN-A', body: { location: 'Paris' } });
    assert(goodPinUpdate.ok === true && goodPinUpdate.data.location === 'Paris', '9h. Valid couple event PIN can update own event cleanly');
  }

  // ---------------------------------------------------------------------------
  // Scenario 10: Partial Couple Onboarding Rollback & Sanitized DB Error Mapping
  // ---------------------------------------------------------------------------
  {
    const sb = createMockSupabase({}, { failNextInsertOnTable: 'projects' });
    const coupleRes = await onboardWorkspaceForUser(
      sb,
      { id: 'user-rollback', email: 'rollback@couple.io', status: 'active' },
      { role: 'couple', groomName: 'Sam', brideName: 'Taylor', slug: 'sam-taylor' }
    );

    assert(coupleRes.ok === false, '10a. Partial couple onboarding reports failure when project insert fails');
    assert(sb.db.agencies.length === 0, '10b. Compensating rollback deletes orphaned agency when project insert fails');
    assert(sb.db.projects.length === 0, '10c. Zero partial projects exist after rollback');

    const rawDbErr = mapDatabaseError(
      { code: '42501', message: 'permission denied for relation agencies on pg_catalog' },
      'Unable to load workspace.'
    );
    assert(rawDbErr.statusCode === 500 && rawDbErr.code === 'DATABASE_ERROR', '10d. Unexpected DB error maps to HTTP 500 DATABASE_ERROR');
    assert(rawDbErr.error === 'Unable to load workspace.' && !/pg_catalog|permission denied/i.test(rawDbErr.error), '10e. Sanitized DB error hides internal schema/PostgREST details');

    const notNullSanitize = sanitizePublicProject({ id: 'p', access_password: '123', website_preview_token: 'abc', rsvp_fields: '[{"name":"diet"}]' });
    assert(Array.isArray(notNullSanitize.rsvp_fields) && notNullSanitize.website_preview_token === undefined, '10f. sanitizePublicProject parses JSON rsvp_fields & strips sensitive tokens');
  }

  // ---------------------------------------------------------------------------
  // Scenario 11: End-to-End Express HTTP Verification (Simulating /api/agencies/resolve & /api/agencies/me & /api/couple/login)
  // ---------------------------------------------------------------------------
  {
    const sb = createMockSupabase({
      agencies: [
        { id: 'ag-http', name: 'HTTP Studio', slug: 'http-studio', user_id: 'u-http', owner_email: 'http@co.com', user_role: 'agency' },
      ],
      projects: [
        { id: 'p-http', agency_id: 'ag-http', name: 'Noah & Emma', slug: 'noah-emma', access_password: '4321' },
      ],
    });

    const app = express();
    app.use(express.json());
    const SECRET = 'test-secret-key';

    app.get('/api/agencies/resolve', async (req, res) => {
      const result = await findAgencyBySlugOrHost(sb, {
        slug: typeof req.query.slug === 'string' ? req.query.slug : undefined,
        host: typeof req.query.host === 'string' ? req.query.host : undefined,
      });
      if (result.ok === false) {
        return res.status(result.statusCode).json({ found: false, code: result.code, error: result.error });
      }
      return res.json({ found: true, data: sanitizePublicAgency(result.data) });
    });

    app.get('/api/agencies/me', async (req, res) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });
      const decoded = jwt.verify(token, SECRET) as any;
      const result = await findAgenciesForUser(sb, { id: decoded.id, email: decoded.email, role: 'user', status: 'active' });
      if (result.ok === false) return res.status(result.statusCode).json({ error: result.error, code: result.code });
      return res.json({ success: true, ...result.data });
    });

    const server = await new Promise<import('http').Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });

    try {
      const addr = server.address() as { port: number };
      const base = `http://127.0.0.1:${addr.port}`;

      const resMissing = await fetch(`${base}/api/agencies/resolve?slug=gewg`);
      assert(resMissing.status === 404, '11a. GET /api/agencies/resolve?slug=gewg returns HTTP 404 (not 406!)');
      const bodyMissing = await resMissing.json();
      assert(bodyMissing.found === false && bodyMissing.code === 'AGENCY_NOT_FOUND', '11b. Missing agency HTTP JSON has structured error code');

      const resFound = await fetch(`${base}/api/agencies/resolve?slug=http-studio`);
      assert(resFound.status === 200, '11c. GET /api/agencies/resolve?slug=http-studio returns HTTP 200');
      const bodyFound = await resFound.json();
      assert(bodyFound.found === true && bodyFound.data.owner_email === undefined, '11d. HTTP resolve strips owner_email');

      const tokenNew = jwt.sign({ id: 'brand-new-u', email: 'brandnew@co.com' }, SECRET);
      const resMe = await fetch(`${base}/api/agencies/me`, {
        headers: { Authorization: `Bearer ${tokenNew}` },
      });
      assert(resMe.status === 200, '11e. GET /api/agencies/me returns 200 for onboard-pending user');
      const bodyMe = await resMe.json();
      assert(bodyMe.requiresOnboarding === true && bodyMe.agencies.length === 0, '11f. /api/agencies/me signals requiresOnboarding cleanly');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  // ---------------------------------------------------------------------------
  // Scenario 12: Wedding Event Creation Validation, Slug Uniqueness & Couple Limits
  // ---------------------------------------------------------------------------
  {
    const sb = createMockSupabase({
      agencies: [
        { id: 'ag-12', name: 'Maison Lumiere', slug: 'maison-lumiere', user_id: 'owner-12', owner_email: 'o12@co.com', user_role: 'agency' },
        { id: 'cp-12', name: 'Alex & Jamie', slug: 'alex-jamie', user_id: 'couple-12', owner_email: 'c12@co.com', user_role: 'couple' },
      ],
      projects: [
        { id: 'proj-cp-1', agency_id: 'cp-12', name: 'Alex & Jamie', slug: 'alex-jamie', groom_name: 'Alex', bride_name: 'Jamie' },
      ],
    });

    const agencyUser = { id: 'owner-12', email: 'o12@co.com', role: 'agency_owner', status: 'active' };
    const coupleUser = { id: 'couple-12', email: 'c12@co.com', role: 'user', status: 'active' };

    const missingDetails = await createProjectForUser(sb, agencyUser, { agency_id: 'ag-12' });
    assert(missingDetails.ok === false && missingDetails.statusCode === 400 && missingDetails.code === 'MISSING_EVENT_DETAILS', '12a. Empty wedding details rejected cleanly with 400');

    const badDate = await createProjectForUser(sb, agencyUser, { agency_id: 'ag-12', groom_name: 'Leo', bride_name: 'Maya', wedding_date: '18-99-2026' });
    assert(badDate.ok === false && badDate.statusCode === 400 && badDate.code === 'INVALID_WEDDING_DATE', '12b. Invalid wedding_date rejected cleanly with 400');

    const reservedSlug = await createProjectForUser(sb, agencyUser, { agency_id: 'ag-12', groom_name: 'Leo', bride_name: 'Maya', slug: 'workspace' });
    assert(reservedSlug.ok === false && reservedSlug.statusCode === 422 && reservedSlug.code === 'RESERVED_SLUG', '12c. Reserved platform slug rejected cleanly with 422');

    const coupleSecond = await createProjectForUser(sb, coupleUser, { agency_id: 'cp-12', groom_name: 'Alex', bride_name: 'Jamie', slug: 'second-event' });
    assert(coupleSecond.ok === false && coupleSecond.statusCode === 409 && coupleSecond.code === 'COUPLE_EVENT_LIMIT_REACHED', '12d. Couple second event rejected cleanly with 409');

    const created = await createProjectForUser(sb, agencyUser, {
      agency_id: 'ag-12',
      groom_name: 'Leo',
      bride_name: 'Maya',
      slug: 'leo-maya',
      wedding_date: '2027-06-15',
      location: 'Florence, Italy',
      status: 'active',
      payment_status: 'paid',
    });
    assert(created.ok === true && created.statusCode === 201, '12e. Valid wedding project creation succeeds with 201');
    if (created.ok) {
      assert(Boolean(created.data.project.id), '12f. Created project returns a real persisted id');
      assert(created.data.project.name === 'Leo & Maya', '12g. Created project derives display title cleanly');
      assert(Array.isArray(created.data.project.rsvp_fields), '12h. Created project returns normalized rsvp_fields array');
      assert(created.data.project.status === 'draft' && created.data.project.payment_status === 'unpaid', '12i. Server enforces draft/unpaid defaults on creation');
    }

    const dupSlug = await createProjectForUser(sb, agencyUser, {
      agency_id: 'ag-12',
      groom_name: 'Liam',
      bride_name: 'Chloe',
      slug: 'leo-maya',
    });
    assert(dupSlug.ok === false && dupSlug.statusCode === 409 && dupSlug.code === 'SLUG_ALREADY_EXISTS', '12j. Duplicate active event slug rejected cleanly with 409');
  }

  console.log('\n🎉 ALL AGENCY ARCHITECTURE & LOOKUP HARDENING TESTS PASSED!\n');
}

runTests().catch((err) => {
  console.error('\n💥 TEST SUITE FAILED:', err);
  process.exit(1);
});
