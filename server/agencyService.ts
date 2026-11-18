import { resolveUserOrganizations, type BillingAuthUser } from './billingService';
import { recordPlatformActivity } from './developerAdminService';

export interface ServiceSuccess<T = any> {
  ok: true;
  statusCode: number;
  data: T;
  reused?: boolean;
}

export interface ServiceFailure {
  ok: false;
  statusCode: number;
  code: string;
  error: string;
}

export type ServiceResult<T = any> = ServiceSuccess<T> | ServiceFailure;

export const RESERVED_AGENCY_SLUGS = new Set([
  'www',
  'api',
  'app',
  'admin',
  'developer',
  'demo',
  'login',
  'verify',
  'reset-password',
  'onboarding',
  'workspace',
  'editor',
  'website-studio',
  'templates',
  'pricing',
  'subscription',
  'couple',
  'display',
  'guest',
  'rsvp',
  'invitation',
  'e',
  'g',
  'r',
  'event',
  'agency',
  'blog',
  'mail',
  'static',
  'assets',
  'cdn',
  'status',
  'support',
]);

const PLATFORM_PREVIEW_SUFFIXES = [
  '.run.app',
  '.pages.dev',
  '.workers.dev',
  '.vercel.app',
  '.netlify.app',
];

export function extractSubdomainFromHost(hostnameRaw?: string | null): string | null {
  if (!hostnameRaw || typeof hostnameRaw !== 'string') return null;
  const hostname = hostnameRaw.trim().toLowerCase().split(':')[0];
  if (!hostname) return null;

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
    return null;
  }

  for (const suffix of PLATFORM_PREVIEW_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      return null;
    }
  }

  if (hostname === 'eventframe.io' || hostname === 'www.eventframe.io') {
    return null;
  }

  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) {
    return null;
  }

  const candidate = parts[0];
  if (!candidate || RESERVED_AGENCY_SLUGS.has(candidate) || candidate.startsWith('ais-')) {
    return null;
  }

  return candidate;
}

export function normalizeAndValidateSlug(
  rawSlug: unknown,
  label: string = 'Subdomain slug'
): { ok: true; slug: string } | ServiceFailure {
  if (typeof rawSlug !== 'string') {
    return {
      ok: false,
      statusCode: 400,
      code: 'INVALID_SLUG',
      error: `${label} is required.`,
    };
  }

  const slug = rawSlug.trim().toLowerCase();

  if (slug.length < 3 || slug.length > 63) {
    return {
      ok: false,
      statusCode: 400,
      code: 'INVALID_SLUG',
      error: `${label} must be between 3 and 63 characters.`,
    };
  }

  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug) || slug.includes('--')) {
    return {
      ok: false,
      statusCode: 400,
      code: 'INVALID_SLUG',
      error: `${label} may only contain lowercase letters, numbers, and single hyphens.`,
    };
  }

  if (RESERVED_AGENCY_SLUGS.has(slug)) {
    return {
      ok: false,
      statusCode: 422,
      code: 'RESERVED_SLUG',
      error: `The identifier "${slug}" is reserved by the platform. Please choose another.`,
    };
  }

  return { ok: true, slug };
}

export function sanitizePublicAgency(agency: any): any | null {
  if (!agency || agency.deleted_at) return null;
  return {
    id: agency.id,
    name: agency.name,
    slug: agency.slug,
    domain: agency.domain || null,
    user_role: agency.user_role || 'agency',
    logo_url: agency.logo_url || null,
    theme_config: agency.theme_config || null,
    subscription_status: agency.subscription_status || null,
    is_demo: Boolean(agency.is_demo),
    created_at: agency.created_at || null,
  };
}

export function sanitizePublicProject(
  project: any,
  options?: { includePin?: boolean; includePreviewToken?: boolean }
): any | null {
  if (!project || project.deleted_at) return null;
  let parsedRsvpFields = project.rsvp_fields;
  if (typeof parsedRsvpFields === 'string') {
    try {
      parsedRsvpFields = JSON.parse(parsedRsvpFields);
    } catch {
      parsedRsvpFields = [];
    }
  }

  const {
    access_password: accessPassword,
    website_preview_token: previewToken,
    ...rest
  } = project;

  const result: any = {
    ...rest,
    rsvp_fields: parsedRsvpFields ?? null,
    hasAccessPassword: Boolean(accessPassword && String(accessPassword).trim().length > 0),
  };

  if (options?.includePin) {
    result.access_password = accessPassword ?? null;
  }
  if (options?.includePreviewToken) {
    result.website_preview_token = previewToken ?? null;
  }

  return result;
}

export function mapDatabaseError(
  error: any,
  fallbackMessage: string = 'A database error occurred while processing your request.'
): ServiceFailure {
  const code = String(error?.code || '');
  const message = String(error?.message || '');

  if (code === '23505' || /duplicate key|unique constraint|already exists/i.test(message)) {
    return {
      ok: false,
      statusCode: 409,
      code: 'SLUG_ALREADY_EXISTS',
      error: 'This subdomain or slug is already taken.',
    };
  }

  if (code === '23503' || code === '22P02' || /foreign key|violates foreign key|invalid input syntax/i.test(message)) {
    return {
      ok: false,
      statusCode: 422,
      code: 'INVALID_REFERENCE',
      error: 'Invalid or non-existent organization reference.',
    };
  }

  if (code === 'PGRST116') {
    return {
      ok: false,
      statusCode: 404,
      code: 'NOT_FOUND',
      error: 'Requested record was not found.',
    };
  }

  console.error('[AgencyService] Database error:', { code, message });
  return {
    ok: false,
    statusCode: 500,
    code: 'DATABASE_ERROR',
    error: fallbackMessage,
  };
}

function buildDemoAgency(): any {
  return {
    id: 'demo-agency',
    name: 'EventFrame Demo',
    slug: 'demo',
    user_role: 'agency',
    subscription_status: 'active',
    is_demo: true,
    logo_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=100&h=100',
    theme_config: { primaryColor: '#8B806F', accentColor: '#252525' },
    created_at: new Date().toISOString(),
  };
}

function buildDemoProject(): any {
  return {
    id: 'demo-project',
    agency_id: 'demo-agency',
    groom_name: 'Lucas',
    bride_name: 'Sofia',
    name: 'Lucas & Sofia Wedding',
    slug: 'demo',
    theme_id: 'garden',
    image_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80',
    wedding_date: '2025-06-15',
    location: 'San Francisco, CA',
    auto_approve_messages: true,
    status: 'active',
    payment_status: 'paid',
    website_status: 'published',
    hasAccessPassword: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Safely finds an active (non-deleted) agency by ID using .maybeSingle().
 * Never auto-creates agencies on read lookup.
 */
export async function findAgencyById(supabase: any, agencyId: string): Promise<ServiceResult<any>> {
  if (!agencyId || !String(agencyId).trim()) {
    return {
      ok: false,
      statusCode: 400,
      code: 'INVALID_AGENCY_ID',
      error: 'Agency identifier is required.',
    };
  }

  if (agencyId === 'demo-agency') {
    return { ok: true, statusCode: 200, data: buildDemoAgency() };
  }

  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('id', agencyId)
    .maybeSingle();

  if (error) {
    return mapDatabaseError(error, 'Unable to load agency workspace.');
  }

  if (!data || data.deleted_at) {
    return {
      ok: false,
      statusCode: 404,
      code: 'AGENCY_NOT_FOUND',
      error: 'Agency workspace not found.',
    };
  }

  return { ok: true, statusCode: 200, data };
}

/**
 * Safely resolves an active agency by slug or custom host domain.
 * Uses .maybeSingle() (via .limit(1) fallback) so 0 rows never produces PGRST116.
 * Never creates missing agencies on read lookups.
 */
export async function findAgencyBySlugOrHost(
  supabase: any,
  params: { slug?: string | null; host?: string | null; id?: string | null }
): Promise<ServiceResult<any>> {
  if (params.id) {
    return findAgencyById(supabase, params.id);
  }

  const rawSlug = typeof params.slug === 'string' ? params.slug.trim().toLowerCase() : '';
  const rawHost = typeof params.host === 'string' ? params.host.trim().toLowerCase().split(':')[0] : '';

  if (rawSlug === 'demo') {
    return { ok: true, statusCode: 200, data: buildDemoAgency() };
  }

  let effectiveSlug = rawSlug;
  if (!effectiveSlug && rawHost) {
    effectiveSlug = extractSubdomainFromHost(rawHost) || '';
  }

  if (effectiveSlug) {
    if (RESERVED_AGENCY_SLUGS.has(effectiveSlug) || !/^[a-z0-9-]+$/.test(effectiveSlug)) {
      return {
        ok: false,
        statusCode: 404,
        code: 'AGENCY_NOT_FOUND',
        error: 'Workspace not found.',
      };
    }

    const { data, error } = await supabase
      .from('agencies')
      .select('*')
      .eq('slug', effectiveSlug)
      .limit(1)
      .maybeSingle();

    if (error) {
      return mapDatabaseError(error, 'Unable to resolve workspace.');
    }

    if (data && !data.deleted_at) {
      return { ok: true, statusCode: 200, data };
    }

    // Fallback case-insensitive lookup if ilike is supported
    if (!data && typeof supabase.from('agencies').select('*').ilike === 'function') {
      const { data: ilikeRows, error: ilikeErr } = await supabase
        .from('agencies')
        .select('*')
        .ilike('slug', effectiveSlug)
        .limit(5);
      if (ilikeErr) {
        return mapDatabaseError(ilikeErr, 'Unable to resolve workspace.');
      }
      const match = (ilikeRows || []).find((a: any) => a && !a.deleted_at && String(a.slug || '').toLowerCase() === effectiveSlug);
      if (match) {
        return { ok: true, statusCode: 200, data: match };
      }
    }
  }

  if (rawHost && rawHost !== 'localhost' && rawHost !== '127.0.0.1' && rawHost !== 'eventframe.io' && rawHost !== 'www.eventframe.io') {
    const { data: byDomain, error: domErr } = await supabase
      .from('agencies')
      .select('*')
      .eq('domain', rawHost)
      .limit(1)
      .maybeSingle();

    if (domErr && !/column/i.test(domErr.message || '')) {
      return mapDatabaseError(domErr, 'Unable to resolve workspace by domain.');
    }
    if (byDomain && !byDomain.deleted_at) {
      return { ok: true, statusCode: 200, data: byDomain };
    }
  }

  return {
    ok: false,
    statusCode: 404,
    code: 'AGENCY_NOT_FOUND',
    error: 'Workspace not found.',
  };
}

/**
 * Resolves all active agencies accessible to the authenticated user.
 */
export async function findAgenciesForUser(
  supabase: any,
  authUser: BillingAuthUser | null | undefined
): Promise<ServiceResult<{ agencies: any[]; primaryAgency: any | null; requiresOnboarding: boolean }>> {
  if (!authUser || (!authUser.id && !authUser.sub && !authUser.email)) {
    return {
      ok: false,
      statusCode: 401,
      code: 'UNAUTHENTICATED',
      error: 'Authentication required.',
    };
  }

  if (authUser.status === 'suspended') {
    return {
      ok: false,
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
      error: 'Your account has been suspended. Please contact platform support.',
    };
  }

  try {
    const agencies = await resolveUserOrganizations(supabase, authUser);
    const sorted = [...agencies].sort((a, b) => {
      const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return aTime - bTime;
    });

    return {
      ok: true,
      statusCode: 200,
      data: {
        agencies: sorted,
        primaryAgency: sorted[0] || null,
        requiresOnboarding: sorted.length === 0,
      },
    };
  } catch (err: any) {
    return mapDatabaseError(err, 'Unable to load your workspace organizations.');
  }
}

async function syncUserAuthAgencyLink(
  supabase: any,
  authUser: BillingAuthUser,
  agencyId: string,
  agencyRole: string
) {
  if (!supabase || !agencyId) return;
  const email = (authUser.email || '').trim().toLowerCase();
  const targetRole = agencyRole === 'agency' ? 'agency_owner' : 'user';

  try {
    const { data: dbUser } = email
      ? await supabase.from('users_auth').select('id, role, organization_id').ilike('email', email).limit(1).maybeSingle()
      : { data: null };

    if (dbUser) {
      const nextRole = dbUser.role === 'super_admin' ? 'super_admin' : targetRole;
      const patch: Record<string, any> = {
        organization_id: dbUser.organization_id || String(agencyId),
        role: nextRole,
      };
      await supabase.from('users_auth').update(patch).eq('id', dbUser.id);
    }
  } catch {
    // Non-fatal if users_auth table/columns not present in legacy test fixture
  }
}

async function ensureCoupleDefaultProject(
  supabase: any,
  agency: any,
  groomName?: string | null,
  brideName?: string | null
): Promise<{ project: any | null; error?: ServiceFailure }> {
  const { data: existingProjects, error: listErr } = await supabase
    .from('projects')
    .select('*')
    .eq('agency_id', agency.id);

  if (listErr) {
    return { project: null, error: mapDatabaseError(listErr, 'Failed to verify couple event workspace.') };
  }

  const activeExisting = (existingProjects || []).find((p: any) => p && !p.deleted_at);
  if (activeExisting) {
    return { project: activeExisting };
  }

  const gName = (groomName || '').trim() || 'Partner 1';
  const bName = (brideName || '').trim() || 'Partner 2';

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert([
      {
        agency_id: agency.id,
        name: `${gName} & ${bName}'s Wedding`,
        groom_name: gName,
        bride_name: bName,
        slug: agency.slug,
        theme_id: 'garden',
        wedding_date: new Date(Date.now() + 15552000000).toISOString().split('T')[0],
        location: 'To Be Announced',
        status: 'draft',
        payment_status: 'unpaid',
        package_id: 'standard',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .limit(1)
    .maybeSingle();

  if (projectError || !project) {
    return {
      project: null,
      error: mapDatabaseError(projectError, 'Failed to initialize wedding event for couple workspace.'),
    };
  }

  return { project };
}

/**
 * Atomic, race-safe, idempotent workspace onboarding for agency & couple accounts.
 */
export async function onboardWorkspaceForUser(
  supabase: any,
  authUser: BillingAuthUser,
  input: {
    role?: string;
    name?: string;
    groomName?: string;
    brideName?: string;
    slug?: string;
  }
): Promise<ServiceResult<{ agency: any; createdProjectId: string | null }>> {
  if (!authUser || (!authUser.id && !authUser.sub && !authUser.email)) {
    return { ok: false, statusCode: 401, code: 'UNAUTHENTICATED', error: 'Not authenticated' };
  }

  if (authUser.status === 'suspended') {
    return {
      ok: false,
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
      error: 'Your account has been suspended. Please contact platform support.',
    };
  }

  const role = String(input.role || '').trim().toLowerCase();
  if (role !== 'agency' && role !== 'couple') {
    return {
      ok: false,
      statusCode: 400,
      code: 'INVALID_ROLE',
      error: 'Please select a valid account type ("agency" or "couple").',
    };
  }

  const slugCheck = normalizeAndValidateSlug(input.slug, role === 'agency' ? 'Agency subdomain' : 'Event URL slug');
  if (slugCheck.ok === false) {
    return slugCheck;
  }
  const slug = slugCheck.slug;

  const groomName = (input.groomName || '').trim();
  const brideName = (input.brideName || '').trim();
  const agencyNameInput = (input.name || '').trim();

  if (role === 'couple' && (!groomName || !brideName)) {
    return {
      ok: false,
      statusCode: 400,
      code: 'MISSING_COUPLE_NAMES',
      error: 'Both partner names are required to launch your wedding suite.',
    };
  }

  if (role === 'agency' && !agencyNameInput) {
    return {
      ok: false,
      statusCode: 400,
      code: 'MISSING_AGENCY_NAME',
      error: 'Agency / Studio name is required.',
    };
  }

  const orgName = role === 'couple' ? `${groomName} & ${brideName}` : agencyNameInput;
  const userId = String(authUser.id || authUser.sub || '');
  const ownerEmail = authUser.email ? String(authUser.email).trim().toLowerCase() : null;

  const isOwnedByCaller = (agencyRow: any): boolean => {
    if (!agencyRow || agencyRow.deleted_at) return false;
    if (userId && agencyRow.user_id && String(agencyRow.user_id) === userId) return true;
    if (authUser.sub && agencyRow.user_id && String(agencyRow.user_id) === String(authUser.sub)) return true;
    if (ownerEmail && agencyRow.owner_email && String(agencyRow.owner_email).trim().toLowerCase() === ownerEmail) return true;
    return false;
  };

  // 1. Check if caller already has an active agency (idempotent reuse)
  const existingOrgs = await resolveUserOrganizations(supabase, authUser);
  const existingSlugLookup = await findAgencyBySlugOrHost(supabase, { slug });

  if (existingSlugLookup.ok) {
    const slugOwner = existingSlugLookup.data;
    if (isOwnedByCaller(slugOwner)) {
      let createdProjectId: string | null = null;
      if (slugOwner.user_role === 'couple' || role === 'couple') {
        const { project, error } = await ensureCoupleDefaultProject(supabase, slugOwner, groomName, brideName);
        if (error) return error;
        createdProjectId = project?.id ? String(project.id) : null;
      }
      await syncUserAuthAgencyLink(supabase, authUser, String(slugOwner.id), slugOwner.user_role || role);
      return {
        ok: true,
        statusCode: 200,
        reused: true,
        data: { agency: slugOwner, createdProjectId },
      };
    }

    return {
      ok: false,
      statusCode: 409,
      code: 'SLUG_ALREADY_EXISTS',
      error: 'This subdomain is already taken.',
    };
  } else if (existingSlugLookup.statusCode === 500) {
    return existingSlugLookup;
  }

  if (existingOrgs.length > 0) {
    const primary = existingOrgs[0];
    let createdProjectId: string | null = null;
    if (primary.user_role === 'couple') {
      const { project, error } = await ensureCoupleDefaultProject(supabase, primary, groomName, brideName);
      if (error) return error;
      createdProjectId = project?.id ? String(project.id) : null;
    }
    await syncUserAuthAgencyLink(supabase, authUser, String(primary.id), primary.user_role || role);
    return {
      ok: true,
      statusCode: 200,
      reused: true,
      data: { agency: primary, createdProjectId },
    };
  }

  // 2. Prefer atomic database RPC if available
  if (typeof supabase.rpc === 'function') {
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('onboard_user_workspace', {
        p_user_id: userId,
        p_owner_email: ownerEmail,
        p_role: role,
        p_org_name: orgName,
        p_slug: slug,
        p_groom_name: groomName || null,
        p_bride_name: brideName || null,
      });

      if (!rpcError && rpcResult && typeof rpcResult === 'object') {
        if (rpcResult.ok === false) {
          return {
            ok: false,
            statusCode: Number(rpcResult.status_code) || 400,
            code: String(rpcResult.code || 'ONBOARDING_FAILED'),
            error: String(rpcResult.error || 'Failed to complete onboarding.'),
          };
        }

        if (rpcResult.ok === true && rpcResult.agency) {
          if (!rpcResult.reused) {
            await recordPlatformActivity(supabase, {
              actorId: userId,
              actorEmail: ownerEmail,
              actorRole: role === 'couple' ? 'user' : 'agency_owner',
              action: 'ORGANIZATION_CREATED',
              organizationId: String(rpcResult.agency.id),
              summary: `Organization "${orgName}" (${slug}) created`,
              metadata: { slug, userRole: role },
            });
            if (rpcResult.created_project_id) {
              await recordPlatformActivity(supabase, {
                actorId: userId,
                actorEmail: ownerEmail,
                action: 'EVENT_CREATED',
                organizationId: String(rpcResult.agency.id),
                targetEventId: String(rpcResult.created_project_id),
                summary: `Event "${orgName}'s Wedding" created during couple onboarding`,
              });
            }
          }

          return {
            ok: true,
            statusCode: Number(rpcResult.status_code) || (rpcResult.reused ? 200 : 201),
            reused: Boolean(rpcResult.reused),
            data: {
              agency: rpcResult.agency,
              createdProjectId: rpcResult.created_project_id ? String(rpcResult.created_project_id) : null,
            },
          };
        }
      }
    } catch {
      // Fallback safely to service-role compensated transaction below if RPC not yet deployed
    }
  }

  // 3. Fallback: Service-role compensated transaction with concurrent unique-conflict recovery
  const nowIso = new Date().toISOString();
  let { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .insert([
      {
        name: orgName,
        slug,
        user_id: userId,
        user_role: role,
        owner_email: ownerEmail,
        status: 'active',
        created_at: nowIso,
        updated_at: nowIso,
      },
    ])
    .select()
    .limit(1)
    .maybeSingle();

  if (agencyError && /owner_email|status|updated_at/i.test(agencyError.message || '')) {
    const fallback = await supabase
      .from('agencies')
      .insert([
        {
          name: orgName,
          slug,
          user_id: userId,
          user_role: role,
          created_at: nowIso,
        },
      ])
      .select()
      .limit(1)
      .maybeSingle();
    agency = fallback.data;
    agencyError = fallback.error;
  }

  if (agencyError || !agency) {
    const mapped = mapDatabaseError(agencyError, 'Unable to create organization workspace.');
    if (mapped.code === 'SLUG_ALREADY_EXISTS') {
      // Race condition check: did another concurrent request for THIS SAME USER just create it?
      const winner = await findAgencyBySlugOrHost(supabase, { slug });
      if (winner.ok && isOwnedByCaller(winner.data)) {
        let createdProjectId: string | null = null;
        if (winner.data.user_role === 'couple' || role === 'couple') {
          const { project, error: projErr } = await ensureCoupleDefaultProject(
            supabase,
            winner.data,
            groomName,
            brideName
          );
          if (projErr) return projErr;
          createdProjectId = project?.id ? String(project.id) : null;
        }
        await syncUserAuthAgencyLink(supabase, authUser, String(winner.data.id), winner.data.user_role || role);
        return {
          ok: true,
          statusCode: 200,
          reused: true,
          data: { agency: winner.data, createdProjectId },
        };
      }
    }
    return mapped;
  }

  let createdProjectId: string | null = null;
  if (role === 'couple') {
    const { project, error: projectErr } = await ensureCoupleDefaultProject(supabase, agency, groomName, brideName);
    if (projectErr || !project) {
      // Compensating rollback so we never leave an orphaned agency on partial couple onboarding failure
      await supabase.from('agencies').delete().eq('id', agency.id);
      return (
        projectErr || {
          ok: false,
          statusCode: 500,
          code: 'ONBOARDING_PROJECT_FAILED',
          error: 'Failed to create initial wedding event. Changes were rolled back.',
        }
      );
    }
    createdProjectId = String(project.id);
  }

  await syncUserAuthAgencyLink(supabase, authUser, String(agency.id), role);

  await recordPlatformActivity(supabase, {
    actorId: userId,
    actorEmail: ownerEmail,
    actorRole: role === 'couple' ? 'user' : 'agency_owner',
    action: 'ORGANIZATION_CREATED',
    organizationId: String(agency.id),
    summary: `Organization "${orgName}" (${slug}) created`,
    metadata: { slug, userRole: role },
  });

  if (createdProjectId) {
    await recordPlatformActivity(supabase, {
      actorId: userId,
      actorEmail: ownerEmail,
      action: 'EVENT_CREATED',
      organizationId: String(agency.id),
      targetEventId: createdProjectId,
      summary: `Event "${orgName}'s Wedding" created during couple onboarding`,
    });
  }

  return {
    ok: true,
    statusCode: 201,
    reused: false,
    data: { agency, createdProjectId },
  };
}

/**
 * Safely creates or reuses an agency for POST /api/agencies.
 */
export async function createAgencyForUser(
  supabase: any,
  authUser: BillingAuthUser,
  body: any
): Promise<ServiceResult<any>> {
  if (!authUser || (!authUser.id && !authUser.sub && !authUser.email)) {
    return { ok: false, statusCode: 401, code: 'UNAUTHENTICATED', error: 'Not authenticated' };
  }
  if (authUser.status === 'suspended') {
    return { ok: false, statusCode: 403, code: 'ACCOUNT_SUSPENDED', error: 'Account suspended.' };
  }

  const name = String(body?.name || '').trim();
  if (!name) {
    return { ok: false, statusCode: 400, code: 'INVALID_AGENCY_NAME', error: 'Agency name is required.' };
  }

  const slugCheck = normalizeAndValidateSlug(body?.slug, 'Agency slug');
  if (slugCheck.ok === false) return slugCheck;
  const slug = slugCheck.slug;

  const userId = String(authUser.id || authUser.sub || '');
  const ownerEmail = authUser.email ? String(authUser.email).trim().toLowerCase() : null;

  const existingBySlug = await findAgencyBySlugOrHost(supabase, { slug });
  if (existingBySlug.ok) {
    const ownerMatches =
      (existingBySlug.data.user_id && String(existingBySlug.data.user_id) === userId) ||
      (ownerEmail && String(existingBySlug.data.owner_email || '').toLowerCase() === ownerEmail);

    if (ownerMatches) {
      return { ok: true, statusCode: 200, reused: true, data: existingBySlug.data };
    }
    return {
      ok: false,
      statusCode: 409,
      code: 'SLUG_ALREADY_EXISTS',
      error: 'This agency slug is already taken.',
    };
  } else if (existingBySlug.statusCode === 500) {
    return existingBySlug;
  }

  // Prevent unintended duplicate agency creation for the same user unless explicitly allowed
  const userOrgs = await resolveUserOrganizations(supabase, authUser);
  if (userOrgs.length > 0 && body?.allowMultiple !== true) {
    return {
      ok: false,
      statusCode: 409,
      code: 'AGENCY_ALREADY_EXISTS',
      error: 'An agency workspace already exists for this account.',
    };
  }

  const nowIso = new Date().toISOString();
  const payload: Record<string, any> = {
    name,
    slug,
    domain: body?.domain ? String(body.domain).trim().toLowerCase() : null,
    logo_url: body?.logo_url || null,
    theme_config: body?.theme_config || null,
    user_role: body?.user_role === 'couple' ? 'couple' : 'agency',
    user_id: userId,
    owner_email: ownerEmail,
    status: 'active',
    created_at: nowIso,
    updated_at: nowIso,
  };

  let { data, error } = await supabase
    .from('agencies')
    .insert([payload])
    .select()
    .limit(1)
    .maybeSingle();

  if (error && /owner_email|status|updated_at|domain|logo_url|theme_config/i.test(error.message || '')) {
    const minimalPayload = {
      name,
      slug,
      user_role: payload.user_role,
      user_id: userId,
      created_at: nowIso,
    };
    const retry = await supabase.from('agencies').insert([minimalPayload]).select().limit(1).maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    return mapDatabaseError(error, 'Failed to create agency workspace.');
  }

  await syncUserAuthAgencyLink(supabase, authUser, String(data.id), payload.user_role);

  return { ok: true, statusCode: 201, data };
}

/**
 * Safely updates an agency after verifying ownership and slug uniqueness.
 */
export async function updateAgencyForUser(
  supabase: any,
  authUser: BillingAuthUser,
  agencyId: string,
  body: any
): Promise<ServiceResult<any>> {
  if (!authUser || (!authUser.id && !authUser.sub && !authUser.email)) {
    return { ok: false, statusCode: 401, code: 'UNAUTHENTICATED', error: 'Not authenticated' };
  }
  if (authUser.status === 'suspended') {
    return { ok: false, statusCode: 403, code: 'ACCOUNT_SUSPENDED', error: 'Account suspended.' };
  }

  const agencyLookup = await findAgencyById(supabase, agencyId);
  if (agencyLookup.ok === false) return agencyLookup;
  const targetAgency = agencyLookup.data;

  const userOrgs = await resolveUserOrganizations(supabase, authUser);
  const ownsAgency =
    authUser.role === 'super_admin' || userOrgs.some((org) => String(org.id) === String(targetAgency.id));
  if (!ownsAgency) {
    return {
      ok: false,
      statusCode: 403,
      code: 'FORBIDDEN_AGENCY_ACCESS',
      error: 'You do not have permission to update this agency.',
    };
  }

  const {
    id: _ignoredId,
    user_id: _ignoredUserId,
    created_at: _ignoredCreatedAt,
    deleted_at: _ignoredDeletedAt,
    is_demo: _ignoredIsDemo,
    ...rawUpdates
  } = body || {};

  const updateData: Record<string, any> = {
    ...rawUpdates,
    updated_at: new Date().toISOString(),
  };

  if (updateData.slug !== undefined) {
    const slugCheck = normalizeAndValidateSlug(updateData.slug, 'Agency subdomain');
    if (slugCheck.ok === false) return slugCheck;
    updateData.slug = slugCheck.slug;

    if (updateData.slug !== String(targetAgency.slug || '').toLowerCase()) {
      const conflict = await findAgencyBySlugOrHost(supabase, { slug: updateData.slug });
      if (conflict.ok && String(conflict.data.id) !== String(targetAgency.id)) {
        return {
          ok: false,
          statusCode: 409,
          code: 'SLUG_ALREADY_EXISTS',
          error: 'This subdomain is already taken by another workspace.',
        };
      }
      if (conflict.ok === false && conflict.statusCode === 500) {
        return conflict;
      }
    }
  }

  const { data, error } = await supabase
    .from('agencies')
    .update(updateData)
    .eq('id', targetAgency.id)
    .select()
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return mapDatabaseError(error, 'Failed to update agency workspace.');
  }

  return { ok: true, statusCode: 200, data };
}

/**
 * Resolves a project by ID and validates its Project -> agency_id -> Agency integrity.
 */
export async function resolveProjectWithAgency(
  supabase: any,
  projectId: string
): Promise<ServiceResult<{ project: any; agency: any }>> {
  if (!projectId || !String(projectId).trim()) {
    return { ok: false, statusCode: 400, code: 'INVALID_PROJECT_ID', error: 'Project ID is required.' };
  }

  if (projectId === 'demo' || projectId === 'demo-project') {
    return {
      ok: true,
      statusCode: 200,
      data: { project: buildDemoProject(), agency: buildDemoAgency() },
    };
  }

  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .limit(1)
    .maybeSingle();

  if (projErr) {
    return mapDatabaseError(projErr, 'Failed to load wedding event.');
  }

  if (!project || project.deleted_at) {
    return {
      ok: false,
      statusCode: 404,
      code: 'PROJECT_NOT_FOUND',
      error: 'Wedding event not found.',
    };
  }

  if (!project.agency_id || !String(project.agency_id).trim()) {
    return {
      ok: false,
      statusCode: 422,
      code: 'INVALID_AGENCY_REFERENCE',
      error: 'Data integrity error: event is missing a valid agency_id reference.',
    };
  }

  const agencyLookup = await findAgencyById(supabase, String(project.agency_id));
  if (agencyLookup.ok === false) {
    if (agencyLookup.statusCode === 404 || agencyLookup.code === 'AGENCY_NOT_FOUND') {
      return {
        ok: false,
        statusCode: 422,
        code: 'INVALID_AGENCY_REFERENCE',
        error: 'Data integrity error: event references an invalid or missing agency.',
      };
    }
    return agencyLookup;
  }

  return {
    ok: true,
    statusCode: 200,
    data: { project, agency: agencyLookup.data },
  };
}

/**
 * Lists projects belonging to the authenticated user's agency (or specified agency_id after verifying ownership).
 */
export async function listProjectsForUser(
  supabase: any,
  authUser: BillingAuthUser,
  requestedAgencyId?: string | null
): Promise<ServiceResult<any[]>> {
  const userOrgsResult = await findAgenciesForUser(supabase, authUser);
  if (userOrgsResult.ok === false) return userOrgsResult;

  const { agencies, primaryAgency } = userOrgsResult.data;
  if (agencies.length === 0) {
    return {
      ok: true,
      statusCode: 200,
      data: [],
    };
  }

  let targetAgencyIds: string[] = [];
  if (requestedAgencyId) {
    const ownsRequested =
      authUser.role === 'super_admin' || agencies.some((a) => String(a.id) === String(requestedAgencyId));
    if (!ownsRequested) {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN_AGENCY_ACCESS',
        error: 'You do not have permission to access projects for this agency.',
      };
    }
    targetAgencyIds = [String(requestedAgencyId)];
  } else if (primaryAgency) {
    targetAgencyIds = [String(primaryAgency.id)];
  }

  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .eq('agency_id', targetAgencyIds[0])
    .order('created_at', { ascending: false });

  if (error) {
    return mapDatabaseError(error, 'Failed to fetch events for this agency.');
  }

  const activeProjects = (projects || [])
    .filter((p: any) => p && !p.deleted_at)
    .map((p: any) => sanitizePublicProject(p, { includePin: true, includePreviewToken: true }));

  return {
    ok: true,
    statusCode: 200,
    data: activeProjects,
  };
}

/**
 * Gets a single project for an authenticated user after verifying Project -> agency_id -> Agency ownership.
 */
export async function getProjectForAuthorizedUser(
  supabase: any,
  authUser: BillingAuthUser,
  projectId: string
): Promise<ServiceResult<{ project: any; agency: any }>> {
  if (!authUser || (!authUser.id && !authUser.sub && !authUser.email)) {
    return { ok: false, statusCode: 401, code: 'UNAUTHENTICATED', error: 'Not authenticated' };
  }

  const resolved = await resolveProjectWithAgency(supabase, projectId);
  if (resolved.ok === false) return resolved;

  const userOrgs = await resolveUserOrganizations(supabase, authUser);
  const authorized =
    authUser.role === 'super_admin' ||
    userOrgs.some((org) => String(org.id) === String(resolved.data.agency.id));

  if (!authorized) {
    return {
      ok: false,
      statusCode: 403,
      code: 'FORBIDDEN_AGENCY_ACCESS',
      error: 'You do not have permission to access this event.',
    };
  }

  return {
    ok: true,
    statusCode: 200,
    data: {
      project: sanitizePublicProject(resolved.data.project, { includePin: true, includePreviewToken: true }),
      agency: resolved.data.agency,
    },
  };
}

/**
 * Creates a project under an agency owned by the authenticated user.
 */
export async function createProjectForUser(
  supabase: any,
  authUser: BillingAuthUser,
  projectData: any
): Promise<ServiceResult<{ project: any; agency: any }>> {
  if (!authUser || (!authUser.id && !authUser.sub && !authUser.email)) {
    return { ok: false, statusCode: 401, code: 'UNAUTHENTICATED', error: 'Not authenticated' };
  }
  if (authUser.status === 'suspended') {
    return { ok: false, statusCode: 403, code: 'ACCOUNT_SUSPENDED', error: 'Account suspended.' };
  }

  const userOrgs = await resolveUserOrganizations(supabase, authUser);
  if (userOrgs.length === 0) {
    return {
      ok: false,
      statusCode: 403,
      code: 'AGENCY_REQUIRED',
      error: 'Please complete agency onboarding before creating events.',
    };
  }

  let targetAgency = userOrgs[0];
  if (projectData?.agency_id) {
    const requestedId = String(projectData.agency_id);
    const matched = userOrgs.find((org) => String(org.id) === requestedId);
    if (!matched && authUser.role !== 'super_admin') {
      return {
        ok: false,
        statusCode: 403,
        code: 'FORBIDDEN_AGENCY_ACCESS',
        error: 'You do not have permission to create events under this agency.',
      };
    }
    if (matched) {
      targetAgency = matched;
    } else {
      const lookup = await findAgencyById(supabase, requestedId);
      if (lookup.ok === false) return lookup;
      targetAgency = lookup.data;
    }
  }

  // Enforce couple single-event limit on the backend as well as the frontend
  if (targetAgency.user_role === 'couple' && authUser.role !== 'super_admin') {
    const { data: existingProjects, error: listErr } = await supabase
      .from('projects')
      .select('id, deleted_at')
      .eq('agency_id', targetAgency.id);

    if (listErr) {
      return mapDatabaseError(listErr, 'Failed to verify existing wedding events for this account.');
    }

    const activeCount = (existingProjects || []).filter((p: any) => p && !p.deleted_at).length;
    if (activeCount >= 1) {
      return {
        ok: false,
        statusCode: 409,
        code: 'COUPLE_EVENT_LIMIT_REACHED',
        error: 'Individual couple accounts are limited to one wedding event. Upgrade to an Agency account to manage multiple events.',
      };
    }
  }

  const groomName = String(projectData?.groom_name ?? '').trim();
  const brideName = String(projectData?.bride_name ?? '').trim();
  const explicitName = String(projectData?.name ?? '').trim();

  if (!explicitName && (!groomName || !brideName)) {
    return {
      ok: false,
      statusCode: 400,
      code: 'MISSING_EVENT_DETAILS',
      error: 'Please provide both partner names or a wedding event title.',
    };
  }

  const resolvedName = explicitName || `${groomName} & ${brideName}`;

  let weddingDate = new Date().toISOString().split('T')[0];
  if (projectData?.wedding_date !== undefined && projectData?.wedding_date !== null) {
    const rawDate = String(projectData.wedding_date).trim();
    if (rawDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || Number.isNaN(Date.parse(rawDate))) {
        return {
          ok: false,
          statusCode: 400,
          code: 'INVALID_WEDDING_DATE',
          error: 'Please provide a valid wedding date (YYYY-MM-DD).',
        };
      }
      weddingDate = rawDate;
    }
  }

  let validatedSlug: string;
  const rawSlugInput = typeof projectData?.slug === 'string' ? projectData.slug.trim() : '';
  if (rawSlugInput) {
    const slugCheck = normalizeAndValidateSlug(rawSlugInput, 'Event URL slug');
    if (slugCheck.ok === false) {
      return slugCheck;
    }
    validatedSlug = slugCheck.slug;
  } else {
    const baseFromName = resolvedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 40);
    const suffix = Math.random().toString(36).substring(2, 7);
    const candidate = baseFromName && baseFromName.length >= 2 ? `${baseFromName}-${suffix}` : `wedding-${suffix}`;
    validatedSlug = RESERVED_AGENCY_SLUGS.has(candidate) ? `event-${candidate}` : candidate;
  }

  // Check active slug conflict cleanly before insert
  const { data: slugMatches, error: slugErr } = await supabase
    .from('projects')
    .select('id, agency_id, slug, deleted_at')
    .eq('slug', validatedSlug)
    .limit(5);

  if (slugErr) {
    return mapDatabaseError(slugErr, 'Failed to verify event URL slug availability.');
  }

  const conflictingSlug = (slugMatches || []).find((row: any) => row && !row.deleted_at);
  if (conflictingSlug) {
    return {
      ok: false,
      statusCode: 409,
      code: 'SLUG_ALREADY_EXISTS',
      error: `The event URL slug "${validatedSlug}" is already in use. Please choose another.`,
    };
  }

  const {
    id: _ignoredId,
    user_id: _ignoredUserId,
    agency_id: _ignoredAgencyId,
    status: _ignoredStatus,
    payment_status: _ignoredPaymentStatus,
    activated_at: _ignoredActivatedAt,
    expires_at: _ignoredExpiresAt,
    deleted_at: _ignoredDeletedAt,
    created_at: _ignoredCreatedAt,
    updated_at: _ignoredUpdatedAt,
    ...safeFields
  } = projectData || {};

  const nowIso = new Date().toISOString();
  const generatedPin = Math.random().toString(36).substring(2, 8).toUpperCase();

  const newProject: Record<string, any> = {
    ...safeFields,
    name: resolvedName,
    groom_name: groomName || safeFields.groom_name || '',
    bride_name: brideName || safeFields.bride_name || '',
    slug: validatedSlug,
    wedding_date: weddingDate,
    location: typeof safeFields.location === 'string' ? safeFields.location.trim() : '',
    theme_id: typeof safeFields.theme_id === 'string' && safeFields.theme_id.trim()
      ? safeFields.theme_id.trim()
      : 'minimal_luxury',
    access_password:
      typeof safeFields.access_password === 'string' && safeFields.access_password.trim()
        ? safeFields.access_password.trim().toUpperCase()
        : generatedPin,
    auto_approve_messages: Boolean(safeFields.auto_approve_messages),
    status: 'draft',
    payment_status: 'unpaid',
    package_id: typeof safeFields.package_id === 'string' && safeFields.package_id.trim()
      ? safeFields.package_id.trim()
      : 'standard',
    agency_id: targetAgency.id,
    created_at: nowIso,
    updated_at: nowIso,
  };

  if (newProject.rsvp_fields === undefined || newProject.rsvp_fields === null) {
    newProject.rsvp_fields = '[]';
  } else if (typeof newProject.rsvp_fields === 'object') {
    newProject.rsvp_fields = JSON.stringify(newProject.rsvp_fields);
  }

  const { data, error } = await supabase
    .from('projects')
    .insert([newProject])
    .select()
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return mapDatabaseError(error, 'Failed to create wedding event.');
  }

  return {
    ok: true,
    statusCode: 201,
    data: {
      project: sanitizePublicProject(data, { includePin: true, includePreviewToken: true }),
      agency: targetAgency,
    },
  };
}

/**
 * Updates a project after verifying Project -> agency_id -> Agency ownership or valid event PIN.
 */
export async function updateProjectForUserOrPin(
  supabase: any,
  params: {
    projectId: string;
    authUser?: BillingAuthUser | null;
    pin?: string | null;
    body: any;
  }
): Promise<ServiceResult<any>> {
  const resolved = await resolveProjectWithAgency(supabase, params.projectId);
  if (resolved.ok === false) return resolved;

  const { project, agency } = resolved.data;
  let authorized = false;

  if (params.authUser) {
    if (params.authUser.status === 'suspended') {
      return { ok: false, statusCode: 403, code: 'ACCOUNT_SUSPENDED', error: 'Account suspended.' };
    }
    const userOrgs = await resolveUserOrganizations(supabase, params.authUser);
    authorized =
      params.authUser.role === 'super_admin' ||
      userOrgs.some((org) => String(org.id) === String(agency.id));
  }

  if (!authorized && params.pin && project.access_password && project.access_password === params.pin) {
    authorized = true;
  }

  if (!authorized) {
    return {
      ok: false,
      statusCode: 403,
      code: 'FORBIDDEN_AGENCY_ACCESS',
      error: 'Unauthorized: you do not have permission to modify this event.',
    };
  }

  const {
    id: _ignoredId,
    agency_id: _ignoredAgencyId,
    created_at: _ignoredCreatedAt,
    deleted_at: _ignoredDeletedAt,
    ...updateData
  } = params.body || {};

  if (updateData.rsvp_fields && typeof updateData.rsvp_fields === 'object') {
    updateData.rsvp_fields = JSON.stringify(updateData.rsvp_fields);
  }

  updateData.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', project.id)
    .eq('agency_id', agency.id)
    .select()
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return mapDatabaseError(error, 'Failed to update wedding event.');
  }

  return { ok: true, statusCode: 200, data };
}

/**
 * Deletes a project after verifying Project -> agency_id -> Agency ownership.
 */
export async function deleteProjectForUser(
  supabase: any,
  params: { projectId: string; authUser: BillingAuthUser }
): Promise<ServiceResult<{ deletedId: string }>> {
  if (!params.authUser || (!params.authUser.id && !params.authUser.sub && !params.authUser.email)) {
    return { ok: false, statusCode: 401, code: 'UNAUTHENTICATED', error: 'Not authenticated' };
  }

  const resolved = await resolveProjectWithAgency(supabase, params.projectId);
  if (resolved.ok === false) return resolved;

  const { project, agency } = resolved.data;
  const userOrgs = await resolveUserOrganizations(supabase, params.authUser);
  const authorized =
    params.authUser.role === 'super_admin' ||
    userOrgs.some((org) => String(org.id) === String(agency.id));

  if (!authorized) {
    return {
      ok: false,
      statusCode: 403,
      code: 'FORBIDDEN_AGENCY_ACCESS',
      error: 'Unauthorized: you do not have permission to delete this event.',
    };
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', project.id)
    .eq('agency_id', agency.id);

  if (error) {
    return mapDatabaseError(error, 'Failed to delete wedding event.');
  }

  return { ok: true, statusCode: 200, data: { deletedId: String(project.id) } };
}

/**
 * Resolves a public event by project id, project slug (+ optional agency context),
 * or agency workspace root (when no project slug/id is supplied).
 * Strictly distinguishes agency slugs vs project slugs while validating Project -> agency_id -> Agency.
 */
export async function resolvePublicEvent(
  supabase: any,
  params: {
    id?: string | null;
    slug?: string | null;
    agencySlug?: string | null;
    agencyId?: string | null;
    host?: string | null;
    pin?: string | null;
  }
): Promise<ServiceResult<{ project: any; agency: any }>> {
  const id = params.id && params.id !== 'undefined' ? String(params.id).trim() : '';
  const slug = params.slug ? String(params.slug).trim().toLowerCase() : '';
  const agencyIdParam = params.agencyId ? String(params.agencyId).trim() : '';
  const agencySlugParam = params.agencySlug ? String(params.agencySlug).trim().toLowerCase() : '';

  if (id === 'demo' || id === 'demo-project' || id === 'public-demo-room' || slug === 'demo') {
    return {
      ok: true,
      statusCode: 200,
      data: { project: buildDemoProject(), agency: buildDemoAgency() },
    };
  }

  // 1. Lookup by explicit project ID
  if (id) {
    const resolved = await resolveProjectWithAgency(supabase, id);
    if (resolved.ok === false) return resolved;

    const validPin = Boolean(params.pin && resolved.data.project.access_password === params.pin);
    return {
      ok: true,
      statusCode: 200,
      data: {
        project: sanitizePublicProject(resolved.data.project, { includePin: validPin }),
        agency: sanitizePublicAgency(resolved.data.agency),
      },
    };
  }

  // Resolve explicit agency context if provided (subdomain, ?agency=, or explicit agencyId)
  let scopedAgency: any = null;
  const hostSubdomain = extractSubdomainFromHost(params.host);
  if (agencyIdParam || agencySlugParam || hostSubdomain) {
    const agencyLookup = await findAgencyBySlugOrHost(supabase, {
      id: agencyIdParam || undefined,
      slug: agencySlugParam || hostSubdomain || undefined,
      host: params.host,
    });
    if (agencyLookup.ok === false) {
      return agencyLookup;
    }
    scopedAgency = agencyLookup.data;
  }

  // 2. Lookup by project slug (scoped to agency if agency context exists)
  if (slug) {
    let query = supabase.from('projects').select('*').eq('slug', slug);
    if (scopedAgency) {
      query = query.eq('agency_id', scopedAgency.id);
    }

    const { data: candidates, error: projErr } = await query.limit(5);
    if (projErr) {
      return mapDatabaseError(projErr, 'Failed to resolve wedding event.');
    }

    const project = (candidates || []).find((p: any) => p && !p.deleted_at);
    if (!project) {
      return {
        ok: false,
        statusCode: 404,
        code: 'EVENT_NOT_FOUND',
        error: 'Wedding event not found.',
      };
    }

    if (!project.agency_id || !String(project.agency_id).trim()) {
      return {
        ok: false,
        statusCode: 422,
        code: 'INVALID_AGENCY_REFERENCE',
        error: 'Data integrity error: event is missing a valid agency_id reference.',
      };
    }

    const parentAgencyLookup = scopedAgency
      ? { ok: true as const, statusCode: 200, data: scopedAgency }
      : await findAgencyById(supabase, String(project.agency_id));

    if (parentAgencyLookup.ok === false) {
      if (parentAgencyLookup.statusCode === 404) {
        return {
          ok: false,
          statusCode: 422,
          code: 'INVALID_AGENCY_REFERENCE',
          error: 'Data integrity error: event references an invalid or missing agency.',
        };
      }
      return parentAgencyLookup;
    }

    const validPin = Boolean(params.pin && project.access_password === params.pin);
    return {
      ok: true,
      statusCode: 200,
      data: {
        project: sanitizePublicProject(project, { includePin: validPin }),
        agency: sanitizePublicAgency(parentAgencyLookup.data),
      },
    };
  }

  // 3. Workspace root fallback (only when an agency context was resolved and no project slug was provided)
  if (scopedAgency) {
    const { data: events, error: listErr } = await supabase
      .from('projects')
      .select('*')
      .eq('agency_id', scopedAgency.id)
      .order('created_at', { ascending: true })
      .limit(5);

    if (listErr) {
      return mapDatabaseError(listErr, 'Failed to load agency events.');
    }

    const firstProject = (events || []).find((p: any) => p && !p.deleted_at);
    if (!firstProject) {
      return {
        ok: false,
        statusCode: 404,
        code: 'EVENT_NOT_FOUND',
        error: 'No active wedding event found for this agency workspace.',
      };
    }

    const validPin = Boolean(params.pin && firstProject.access_password === params.pin);
    return {
      ok: true,
      statusCode: 200,
      data: {
        project: sanitizePublicProject(firstProject, { includePin: validPin }),
        agency: sanitizePublicAgency(scopedAgency),
      },
    };
  }

  return {
    ok: false,
    statusCode: 400,
    code: 'MISSING_EVENT_IDENTIFIER',
    error: 'An event id, event slug, or agency context is required.',
  };
}

/**
 * Verifies couple event login server-side without exposing access_password via public client queries.
 */
export async function verifyCouplePinLogin(
  supabase: any,
  params: { agencySlug?: string | null; slug?: string | null; password?: string | null }
): Promise<ServiceResult<{ project: any; agency: any }>> {
  const agencySlug = String(params.agencySlug || '').trim().toLowerCase();
  const eventSlug = String(params.slug || '').trim().toLowerCase();
  const password = String(params.password || '');

  if (!agencySlug) {
    return { ok: false, statusCode: 400, code: 'MISSING_AGENCY', error: 'Please provide your Agency identifier.' };
  }
  if (!eventSlug) {
    return { ok: false, statusCode: 400, code: 'MISSING_SLUG', error: 'Please provide your Wedding Event slug.' };
  }
  if (!password) {
    return { ok: false, statusCode: 400, code: 'MISSING_PASSWORD', error: 'Event access PIN or password is required.' };
  }

  const agencyLookup = await findAgencyBySlugOrHost(supabase, { slug: agencySlug });
  if (agencyLookup.ok === false) {
    return {
      ok: false,
      statusCode: 404,
      code: 'AGENCY_NOT_FOUND',
      error: 'Agency not found. Please verify the agency slug.',
    };
  }

  const { data: candidates, error: projErr } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', eventSlug)
    .eq('agency_id', agencyLookup.data.id)
    .limit(5);

  if (projErr) {
    return mapDatabaseError(projErr, 'Unable to verify wedding event credentials.');
  }

  const project = (candidates || []).find((p: any) => p && !p.deleted_at);
  if (!project) {
    return {
      ok: false,
      statusCode: 404,
      code: 'EVENT_NOT_FOUND',
      error: 'Event not found for this agency. Please check your wedding slug.',
    };
  }

  if (!project.access_password || project.access_password !== password) {
    return {
      ok: false,
      statusCode: 401,
      code: 'INVALID_PIN',
      error: 'Incorrect PIN or password. Please try again.',
    };
  }

  return {
    ok: true,
    statusCode: 200,
    data: {
      project: sanitizePublicProject(project, { includePin: true }),
      agency: sanitizePublicAgency(agencyLookup.data),
    },
  };
}
