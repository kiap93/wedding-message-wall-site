import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Agency } from '../types';
import { API_BASE } from './config';
import { authenticatedFetch, extractApiErrorMessage } from './auth';
import { getCurrentSubdomain, resolveWorkspaceBySlug } from './workspace';
import { useUser } from './UserContext';

interface WorkspaceContextType {
  /** Public brand workspace resolved from the current subdomain (for guest/RSVP/display routes). */
  workspace: Agency | null;
  publicWorkspace: Agency | null;
  isLoading: boolean;
  isSubdomain: boolean;
  error: string | null;

  /** Server-verified agencies the authenticated user is authorized to manage. */
  authorizedAgencies: Agency[];
  activeAgency: Agency | null;
  isLoadingAuthorizedAgencies: boolean;
  authorizedAgenciesError: string | null;
  selectAgency: (agencyId: string) => boolean;
  clearActiveAgency: () => void;
  refreshAuthorizedAgencies: () => Promise<Agency[]>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

function getActiveAgencyStorageKey(userId?: string | null): string | null {
  const clean = String(userId || '').trim();
  return clean ? `ef_active_agency_${clean}` : null;
}

function readStoredAgencyId(userId?: string | null): string | null {
  if (typeof window === 'undefined') return null;
  const key = getActiveAgencyStorageKey(userId);
  if (!key) return null;
  try {
    const val = window.localStorage.getItem(key);
    return val ? val.trim() : null;
  } catch {
    return null;
  }
}

function writeStoredAgencyId(userId: string | null | undefined, agencyId: string | null): void {
  if (typeof window === 'undefined') return;
  const key = getActiveAgencyStorageKey(userId);
  if (!key) return;
  try {
    if (agencyId) {
      window.localStorage.setItem(key, agencyId);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isLoadingUser } = useUser();
  const [workspace, setWorkspace] = useState<Agency | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [authorizedAgencies, setAuthorizedAgencies] = useState<Agency[]>([]);
  const [activeAgencyId, setActiveAgencyId] = useState<string | null>(null);
  const [isLoadingAuthorizedAgencies, setIsLoadingAuthorizedAgencies] = useState(true);
  const [authorizedAgenciesError, setAuthorizedAgenciesError] = useState<string | null>(null);

  const subdomain = getCurrentSubdomain();
  const userIdentityKey = user ? String(user.id || user.sub || user.email || '') : null;

  // 1. Resolve public subdomain branding workspace (unauthenticated guest/RSVP/display routes)
  useEffect(() => {
    let active = true;
    async function loadPublicWorkspace() {
      if (!subdomain) {
        if (active) {
          setWorkspace(null);
          setIsLoading(false);
        }
        return;
      }

      if (active) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const data = await resolveWorkspaceBySlug(subdomain);
        if (!active) return;
        if (data) {
          setWorkspace(data);
        } else {
          setWorkspace(null);
          setError('Workspace not found');
        }
      } catch (err) {
        console.error('Failed to resolve workspace:', err);
        if (active) {
          setError('Failed to load workspace data');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadPublicWorkspace();
    return () => {
      active = false;
    };
  }, [subdomain]);

  // 2. Load server-verified agencies for the authenticated user (/api/agencies/me)
  const loadAuthorizedAgencies = useCallback(async (): Promise<Agency[]> => {
    if (!userIdentityKey) {
      setAuthorizedAgencies([]);
      setActiveAgencyId(null);
      setAuthorizedAgenciesError(null);
      setIsLoadingAuthorizedAgencies(false);
      return [];
    }

    setIsLoadingAuthorizedAgencies(true);
    setAuthorizedAgenciesError(null);

    try {
      const response = await authenticatedFetch(`${API_BASE}/api/agencies/me`);
      if (response.status === 401) {
        writeStoredAgencyId(userIdentityKey, null);
        setAuthorizedAgencies([]);
        setActiveAgencyId(null);
        setAuthorizedAgenciesError(null);
        return [];
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = extractApiErrorMessage(
          payload,
          response.status === 403
            ? 'Your session lacks permission to access this workspace.'
            : 'Unable to load your workspace organizations.'
        );
        setAuthorizedAgencies([]);
        setActiveAgencyId(null);
        setAuthorizedAgenciesError(msg);
        return [];
      }

      const rawAgencies = Array.isArray(payload?.agencies)
        ? payload.agencies
        : Array.isArray(payload?.data?.agencies)
          ? payload.data.agencies
          : [];
      const list = rawAgencies.filter((a: any) => a && a.id) as Agency[];

      setAuthorizedAgencies(list);
      setActiveAgencyId((prevId) => {
        const storedId = readStoredAgencyId(userIdentityKey);
        const matchesPrev = prevId ? list.find((a) => String(a.id) === String(prevId)) : undefined;
        if (matchesPrev) {
          writeStoredAgencyId(userIdentityKey, String(matchesPrev.id));
          return String(matchesPrev.id);
        }

        const matchesStored = storedId ? list.find((a) => String(a.id) === String(storedId)) : undefined;
        if (matchesStored) {
          return String(matchesStored.id);
        }

        // Only auto-select the current subdomain agency if it is actually authorized for this user
        const matchesSubdomain = subdomain
          ? list.find((a) => String(a.slug || '').toLowerCase() === subdomain.toLowerCase())
          : undefined;
        const resolved = matchesSubdomain || list[0] || null;
        const nextId = resolved ? String(resolved.id) : null;
        writeStoredAgencyId(userIdentityKey, nextId);
        return nextId;
      });

      return list;
    } catch (err: any) {
      console.error('Error fetching authorized user agencies:', err);
      setAuthorizedAgencies([]);
      setActiveAgencyId(null);
      setAuthorizedAgenciesError(err?.message || 'Network error while loading workspace.');
      return [];
    } finally {
      setIsLoadingAuthorizedAgencies(false);
    }
  }, [userIdentityKey, subdomain]);

  useEffect(() => {
    if (isLoadingUser) return;
    if (!userIdentityKey) {
      setAuthorizedAgencies([]);
      setActiveAgencyId(null);
      setAuthorizedAgenciesError(null);
      setIsLoadingAuthorizedAgencies(false);
      return;
    }
    void loadAuthorizedAgencies();
  }, [isLoadingUser, userIdentityKey, loadAuthorizedAgencies]);

  const selectAgency = useCallback(
    (agencyId: string): boolean => {
      const target = authorizedAgencies.find((a) => String(a.id) === String(agencyId));
      if (!target) {
        // Reject unauthorized or stale agency IDs immediately
        writeStoredAgencyId(userIdentityKey, null);
        return false;
      }
      const nextId = String(target.id);
      setActiveAgencyId(nextId);
      writeStoredAgencyId(userIdentityKey, nextId);
      return true;
    },
    [authorizedAgencies, userIdentityKey]
  );

  const clearActiveAgency = useCallback(() => {
    setActiveAgencyId(null);
    writeStoredAgencyId(userIdentityKey, null);
  }, [userIdentityKey]);

  const activeAgency = useMemo(() => {
    if (!activeAgencyId) return null;
    return authorizedAgencies.find((a) => String(a.id) === String(activeAgencyId)) || null;
  }, [authorizedAgencies, activeAgencyId]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        publicWorkspace: workspace,
        isLoading,
        isSubdomain: !!subdomain,
        error,
        authorizedAgencies,
        activeAgency,
        isLoadingAuthorizedAgencies,
        authorizedAgenciesError,
        selectAgency,
        clearActiveAgency,
        refreshAuthorizedAgencies: loadAuthorizedAgencies,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
