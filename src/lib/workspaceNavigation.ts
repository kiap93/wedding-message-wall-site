export type WorkspaceView = 'grid' | 'calendar' | 'agency_settings' | 'editor';

export type WorkspaceSidebarNavItem = 'events' | 'calendar' | 'settings';

const VALID_PROJECT_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const RESERVED_INVALID_PROJECT_VALUES = new Set(['undefined', 'null', 'nan', 'false', 'true']);

/**
 * Resolves the canonical workspace view strictly from URL query parameters.
 * URL is the single source of truth for workspace navigation state.
 * Rules:
 * - view=grid -> 'grid'
 * - view=calendar -> 'calendar'
 * - view=editor -> 'editor'
 * - view=agency_settings -> 'agency_settings'
 * - Missing or invalid view parameter -> safely defaults to 'grid'
 */
export function resolveWorkspaceView(searchParams: URLSearchParams | string): WorkspaceView {
  const params =
    typeof searchParams === 'string'
      ? new URLSearchParams(searchParams.startsWith('?') ? searchParams.slice(1) : searchParams)
      : searchParams;

  const rawView = params.get('view')?.trim().toLowerCase();

  if (rawView === 'calendar') return 'calendar';
  if (rawView === 'agency_settings') return 'agency_settings';
  if (rawView === 'grid') return 'grid';
  if (rawView === 'editor') return 'editor';

  return 'grid';
}

/**
 * Extracts a trimmed project ID query parameter (or null if omitted/blank).
 */
export function normalizeProjectIdParam(searchParams: URLSearchParams | string): string | null {
  const params =
    typeof searchParams === 'string'
      ? new URLSearchParams(searchParams.startsWith('?') ? searchParams.slice(1) : searchParams)
      : searchParams;
  const raw = params.get('project')?.trim();
  return raw ? raw : null;
}

/**
 * Validates that a project identifier has a safe UUID/slug/alphanumeric format
 * and is not a placeholder literal like "undefined" or "null".
 */
export function isValidProjectIdFormat(projectId: string | null | undefined): boolean {
  if (!projectId || typeof projectId !== 'string') return false;
  const trimmed = projectId.trim();
  if (!trimmed) return false;
  if (RESERVED_INVALID_PROJECT_VALUES.has(trimmed.toLowerCase())) return false;
  return VALID_PROJECT_ID_REGEX.test(trimmed);
}

/**
 * Builds the canonical `/workspace?view=...` URL for a workspace view.
 * Always strips `project` when navigating outside the editor view.
 */
export function buildWorkspaceUrl(
  view: WorkspaceView,
  options?: { projectId?: string | null }
): string {
  const params = new URLSearchParams();
  params.set('view', view);
  if (view === 'editor' && options?.projectId && options.projectId.trim()) {
    params.set('project', options.projectId.trim());
  }
  return `/workspace?${params.toString()}`;
}

/**
 * Maps a workspace view to the highlighted sidebar navigation item.
 */
export function getDashboardNavItem(view: WorkspaceView): WorkspaceSidebarNavItem {
  if (view === 'calendar') return 'calendar';
  if (view === 'agency_settings') return 'settings';
  return 'events';
}

/**
 * Checks whether the current URL query string already represents the target view and project.
 */
export function isSameWorkspaceTarget(
  searchParams: URLSearchParams,
  targetView: WorkspaceView,
  projectId?: string | null
): boolean {
  const rawView = searchParams.get('view')?.trim().toLowerCase();
  const currentProject = normalizeProjectIdParam(searchParams);
  const expectedProject = targetView === 'editor' ? projectId?.trim() || null : null;
  return rawView === targetView && currentProject === expectedProject;
}
