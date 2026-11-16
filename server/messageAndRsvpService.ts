/**
 * Isomorphic Message, Moderation, RSVP & Event Stats Service
 * Executes all database operations exclusively on the backend (Node Express & Cloudflare Worker).
 */

import { isEventActive } from '../src/lib/packages';
import { type BillingAuthUser } from './billingService';
import {
  mapDatabaseError,
  resolveProjectWithAgency,
  type ServiceResult,
} from './agencyService';
import { resolveUserOrganizations } from './billingService';

const VALID_WISH_CATEGORIES = new Set(['normal', 'funny', 'heartfelt', 'family']);

async function verifyProjectAuthorization(
  supabase: any,
  projectId: string,
  authUser?: BillingAuthUser | null,
  pin?: string | null
): Promise<ServiceResult<{ project: any; agency: any }>> {
  const resolved = await resolveProjectWithAgency(supabase, projectId);
  if (resolved.ok === false) return resolved;

  const { project, agency } = resolved.data;
  if (pin && project.access_password && project.access_password === pin) {
    return { ok: true, statusCode: 200, data: { project, agency } };
  }

  if (!authUser || (!authUser.id && !authUser.sub && !authUser.email)) {
    return {
      ok: false,
      statusCode: 401,
      code: 'UNAUTHENTICATED',
      error: 'Authentication or valid event PIN is required.',
    };
  }

  if (authUser.status === 'suspended') {
    return {
      ok: false,
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
      error: 'Your account has been suspended.',
    };
  }

  if (authUser.role === 'super_admin') {
    return { ok: true, statusCode: 200, data: { project, agency } };
  }

  const userOrgs = await resolveUserOrganizations(supabase, authUser);
  const authorized = userOrgs.some((org) => String(org.id) === String(agency.id));
  if (!authorized) {
    return {
      ok: false,
      statusCode: 403,
      code: 'FORBIDDEN_AGENCY_ACCESS',
      error: 'You do not have permission to manage this wedding event.',
    };
  }

  return { ok: true, statusCode: 200, data: { project, agency } };
}

/**
 * Fetches messages for an event:
 * - Public viewers (`includeAll = false`): returns approved messages only.
 * - Moderators (`includeAll = true`): requires verified agency ownership or valid event PIN.
 */
export async function listProjectMessages(
  supabase: any,
  params: {
    projectId: string;
    includeAll?: boolean;
    limit?: number;
    authUser?: BillingAuthUser | null;
    pin?: string | null;
  }
): Promise<ServiceResult<any[]>> {
  const projectId = String(params.projectId || '').trim();
  if (!projectId) {
    return { ok: false, statusCode: 400, code: 'INVALID_PROJECT_ID', error: 'projectId is required.' };
  }

  if (params.includeAll) {
    const authCheck = await verifyProjectAuthorization(supabase, projectId, params.authUser, params.pin);
    if (authCheck.ok === false) return authCheck;
  } else {
    const resolved = await resolveProjectWithAgency(supabase, projectId);
    if (resolved.ok === false) return resolved;
  }

  const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 250);
  let query = supabase
    .from('messages')
    .select('*')
    .eq('project_id', projectId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (!params.includeAll) {
    query = query.eq('status', 'approved');
  }

  const { data, error } = await query;
  if (error) {
    return mapDatabaseError(error, 'Unable to load guest messages.');
  }

  return {
    ok: true,
    statusCode: 200,
    data: Array.isArray(data) ? data : [],
  };
}

/**
 * Persists a guest message server-side, enforcing demo isolation, preview cap,
 * server-side auto_approve setting, and server-side VIP RSVP detection.
 */
export async function createGuestMessage(
  supabase: any,
  input: {
    projectId?: string | null;
    name?: string | null;
    message?: string | null;
    wishCategory?: string | null;
    wish_category?: string | null;
  }
): Promise<ServiceResult<any>> {
  const projectId = String(input.projectId || '').trim();
  const messageText = String(input.message || '').trim();
  const guestName = String(input.name || '').trim() || 'Anonymous Guest';
  const rawWishCat = input.wishCategory ?? input.wish_category;
  const cleanWishCategory =
    typeof rawWishCat === 'string' && VALID_WISH_CATEGORIES.has(rawWishCat.trim().toLowerCase())
      ? rawWishCat.trim().toLowerCase()
      : undefined;

  if (!projectId) {
    return { ok: false, statusCode: 400, code: 'INVALID_PROJECT_ID', error: 'project_id is required.' };
  }

  if (
    projectId === 'eventframe-public-demo' ||
    projectId === 'demo' ||
    projectId === 'demo-project'
  ) {
    return {
      ok: false,
      statusCode: 400,
      code: 'DEMO_ISOLATION',
      error: 'Demo messages cannot be persisted to production database. Use /api/demo/messages endpoint.',
    };
  }

  if (!messageText) {
    return { ok: false, statusCode: 400, code: 'EMPTY_MESSAGE', error: 'Please enter a message.' };
  }

  const resolved = await resolveProjectWithAgency(supabase, projectId);
  if (resolved.ok === false) return resolved;

  const { project, agency } = resolved.data;
  const active = isEventActive(project, agency);

  if (!active) {
    const { count, error: countErr } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (!countErr && (count || 0) >= 5) {
      return {
        ok: false,
        statusCode: 403,
        code: 'PREVIEW_LIMIT_REACHED',
        error: 'This event is in preview mode and has reached the limit of 5 messages. Please contact the host.',
      };
    }
  }

  // Server-side VIP RSVP detection so browsers never query the rsvps table directly
  let guestCategory: string | null = null;
  try {
    if (guestName && guestName !== 'Anonymous Guest') {
      const { data: vipMatches } = await supabase
        .from('rsvps')
        .select('is_vip, guest_category')
        .eq('project_id', projectId)
        .ilike('name', guestName)
        .eq('is_vip', true)
        .limit(1);

      if (vipMatches && vipMatches.length > 0 && vipMatches[0].is_vip) {
        guestCategory = vipMatches[0].guest_category || 'VIP';
      }
    }
  } catch {
    // Non-fatal if RSVP VIP match fails
  }

  const isSpecialGuest =
    guestCategory === 'VIP' || guestCategory === 'Family' || guestCategory === 'Bridal Party';

  const payload: Record<string, any> = {
    name: guestName,
    message: messageText,
    timestamp: Date.now(),
    project_id: projectId,
    status: project.auto_approve_messages ? 'approved' : 'pending',
    classification: isSpecialGuest ? 'SPECIAL_GUEST' : 'NORMAL',
    is_featured: false,
    is_pinned: false,
    guest_category: guestCategory,
  };

  if (cleanWishCategory) {
    payload.wish_category = cleanWishCategory;
  }

  let { data, error } = await supabase
    .from('messages')
    .insert([payload])
    .select()
    .limit(1)
    .maybeSingle();

  if (error && cleanWishCategory && /wish_category/i.test(error.message || '')) {
    delete payload.wish_category;
    const retry = await supabase
      .from('messages')
      .insert([payload])
      .select()
      .limit(1)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return mapDatabaseError(error, 'Failed to submit wedding message.');
  }

  return {
    ok: true,
    statusCode: 201,
    data: data || payload,
  };
}

/**
 * Updates moderation approval status of a message after verifying project ownership or PIN.
 */
export async function moderateMessageStatus(
  supabase: any,
  params: {
    messageId: string;
    status: string;
    authUser?: BillingAuthUser | null;
    pin?: string | null;
  }
): Promise<ServiceResult<any>> {
  const status = String(params.status || '').trim().toLowerCase();
  if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
    return {
      ok: false,
      statusCode: 400,
      code: 'INVALID_STATUS',
      error: 'Status must be approved, rejected, or pending.',
    };
  }

  const { data: msg, error: fetchErr } = await supabase
    .from('messages')
    .select('*')
    .eq('id', params.messageId)
    .limit(1)
    .maybeSingle();

  if (fetchErr) return mapDatabaseError(fetchErr, 'Unable to find message.');
  if (!msg) {
    return { ok: false, statusCode: 404, code: 'MESSAGE_NOT_FOUND', error: 'Message not found.' };
  }

  const authCheck = await verifyProjectAuthorization(supabase, msg.project_id, params.authUser, params.pin);
  if (authCheck.ok === false) return authCheck;

  const { data: updated, error: updateErr } = await supabase
    .from('messages')
    .update({ status })
    .eq('id', params.messageId)
    .select()
    .limit(1)
    .maybeSingle();

  if (updateErr) return mapDatabaseError(updateErr, 'Failed to update message status.');
  return { ok: true, statusCode: 200, data: updated || { ...msg, status } };
}

/**
 * Updates highlight classification, featured, pinned, or wish category after verifying project ownership or PIN.
 */
export async function updateMessageHighlightForProject(
  supabase: any,
  params: {
    messageId: string;
    updates: Record<string, any>;
    authUser?: BillingAuthUser | null;
    pin?: string | null;
  }
): Promise<ServiceResult<any>> {
  const { data: msg, error: fetchErr } = await supabase
    .from('messages')
    .select('*')
    .eq('id', params.messageId)
    .limit(1)
    .maybeSingle();

  if (fetchErr) return mapDatabaseError(fetchErr, 'Unable to find message.');
  if (!msg) {
    return { ok: false, statusCode: 404, code: 'MESSAGE_NOT_FOUND', error: 'Message not found.' };
  }

  const authCheck = await verifyProjectAuthorization(supabase, msg.project_id, params.authUser, params.pin);
  if (authCheck.ok === false) return authCheck;

  const {
    classification,
    is_featured,
    is_pinned,
    guest_category,
    ai_highlight_reason,
    wish_category,
  } = params.updates || {};

  const updateData: Record<string, any> = {};
  if (classification !== undefined) updateData.classification = classification;
  if (is_featured !== undefined) updateData.is_featured = Boolean(is_featured);
  if (is_pinned !== undefined) updateData.is_pinned = Boolean(is_pinned);
  if (guest_category !== undefined) updateData.guest_category = guest_category;
  if (ai_highlight_reason !== undefined) updateData.ai_highlight_reason = ai_highlight_reason;
  if (wish_category !== undefined && VALID_WISH_CATEGORIES.has(String(wish_category))) {
    updateData.wish_category = wish_category;
  }

  let { data, error } = await supabase
    .from('messages')
    .update(updateData)
    .eq('id', params.messageId)
    .select()
    .limit(1)
    .maybeSingle();

  if (error && updateData.wish_category !== undefined && /wish_category/i.test(error.message || '')) {
    delete updateData.wish_category;
    const retry = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', params.messageId)
      .select()
      .limit(1)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) return mapDatabaseError(error, 'Failed to update message highlight.');
  return { ok: true, statusCode: 200, data: data || { ...msg, ...updateData } };
}

/**
 * Fetches RSVPs for a project after verifying ownership or event PIN.
 */
export async function listProjectRsvps(
  supabase: any,
  params: { projectId: string; authUser?: BillingAuthUser | null; pin?: string | null }
): Promise<ServiceResult<any[]>> {
  const projectId = String(params.projectId || '').trim();
  if (!projectId) {
    return { ok: false, statusCode: 400, code: 'INVALID_PROJECT_ID', error: 'projectId is required.' };
  }

  const authCheck = await verifyProjectAuthorization(supabase, projectId, params.authUser, params.pin);
  if (authCheck.ok === false) return authCheck;

  const { data, error } = await supabase
    .from('rsvps')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) return mapDatabaseError(error, 'Unable to load RSVPs.');
  return { ok: true, statusCode: 200, data: Array.isArray(data) ? data : [] };
}

/**
 * Updates RSVP VIP flag after verifying project ownership or valid event PIN.
 */
export async function updateRsvpVipAuthorized(
  supabase: any,
  params: {
    rsvpId: string;
    isVip: boolean;
    guestCategory?: string | null;
    authUser?: BillingAuthUser | null;
    pin?: string | null;
  }
): Promise<ServiceResult<any>> {
  const { data: rsvp, error: fetchErr } = await supabase
    .from('rsvps')
    .select('*')
    .eq('id', params.rsvpId)
    .limit(1)
    .maybeSingle();

  if (fetchErr) return mapDatabaseError(fetchErr, 'Unable to locate RSVP.');
  if (!rsvp) {
    return { ok: false, statusCode: 404, code: 'RSVP_NOT_FOUND', error: 'RSVP not found.' };
  }

  if (rsvp.project_id) {
    const authCheck = await verifyProjectAuthorization(supabase, rsvp.project_id, params.authUser, params.pin);
    if (authCheck.ok === false) return authCheck;
  }

  const { data, error } = await supabase
    .from('rsvps')
    .update({
      is_vip: Boolean(params.isVip),
      guest_category: params.isVip ? (params.guestCategory || 'VIP') : null,
    })
    .eq('id', params.rsvpId)
    .select()
    .limit(1)
    .maybeSingle();

  if (error) return mapDatabaseError(error, 'Failed to update VIP status.');
  return { ok: true, statusCode: 200, data: data || rsvp };
}

/**
 * Returns public counts (`messageCount`, `rsvpCount`) for a resolved project so Guest/RSVP
 * pages never query Supabase counts directly from the browser.
 */
export async function getPublicEventCounts(
  supabase: any,
  projectId: string
): Promise<{ messageCount: number; rsvpCount: number }> {
  if (!supabase || !projectId || projectId === 'demo' || projectId === 'demo-project') {
    return { messageCount: 0, rsvpCount: 0 };
  }

  try {
    const [{ count: msgCount }, { count: rsvpCount }] = await Promise.all([
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('rsvps').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    ]);
    return {
      messageCount: Number(msgCount) || 0,
      rsvpCount: Number(rsvpCount) || 0,
    };
  } catch {
    return { messageCount: 0, rsvpCount: 0 };
  }
}
