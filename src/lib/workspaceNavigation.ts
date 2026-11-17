export type WorkspaceView = 'grid' | 'calendar' | 'agency_settings' | 'editor';

export type WorkspaceSidebarNavItem = 'events' | 'calendar' | 'settings';

/**
 * Resolves the canonical workspace view strictly from URL query parameters.
 * URL is the single source of truth for workspace navigation state.
 */
export function resolveWorkspaceView(searchParams: URLSearchParams | string): WorkspaceView {
  const params =
    typeof searchParams === 'string'
      ? new URLSearchParams(searchParams.startsWith('?') ? searchParams.slice(1) : searchParams)
      : searchParams;

  const rawView = params.get('view')?.trim().toLowerCase();

  if (rawView === 'calendar') return 'calendar';
  if (rawView === 'agency_settings') return 'agency_settings';
  if (rawView === 'grid' || rawView === 'list') return 'grid';
  if (rawView === 'editor') return 'editor';

  if (params.get('project')?.trim()) {
    return 'editor';
  }

  return 'grid';
}

/**
 * Builds the canonical `/workspace?view=...` URL for a workspace view.
 */
export function buildWorkspaceUrl(
  view: WorkspaceView,
  options?: { projectId?: string | null }
): string {
  const params = new URLSearchParams();
  params.set('view', view);
  if (view === 'editor' && options?.projectId) {
    params.set('project', options.projectId);
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
  const currentProject = searchParams.get('project') || null;
  const expectedProject = targetView === 'editor' ? projectId || null : null;
  return rawView === targetView && currentProject === expectedProject;
}
