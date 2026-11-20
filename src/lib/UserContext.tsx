import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from './config';
import {
  authenticatedFetch,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  setCsrfTokenMemory,
  clearClientAuthStorage,
  bumpClientAuthEpoch,
} from './auth';

const AUTH_CHANNEL_NAME = 'eventframe_auth';
const LOGOUT_SYNC_STORAGE_KEY = 'ef_auth_logout_at';

interface UserContextType {
  user: any | null;
  isLoading: boolean;
  isSessionVerified: boolean;
  setUser: (user: any) => void;
  establishSession: (user: any, token?: string | null, csrfToken?: string | null) => void;
  refreshUser: () => Promise<any | null>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function decodeJwtPayloadClient(token: string | null): Record<string, any> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLength);
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

function tokenMismatchesVerifiedUser(token: string | null, verifiedUser: any): boolean {
  if (!token || !verifiedUser) return false;
  const payload = decodeJwtPayloadClient(token);
  if (!payload) return false;

  const tokenEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const userEmail = typeof verifiedUser.email === 'string' ? verifiedUser.email.trim().toLowerCase() : '';
  if (tokenEmail && userEmail && tokenEmail !== userEmail) {
    return true;
  }

  const tokenId = typeof payload.id === 'string' ? payload.id.trim() : '';
  const userId = typeof verifiedUser.id === 'string' ? verifiedUser.id.trim() : '';
  if (tokenId && userId && tokenId !== userId) {
    return true;
  }

  return false;
}

function broadcastAuthMessage(type: 'LOGOUT' | 'SESSION_CHANGED') {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
      channel.postMessage({ type, at: Date.now() });
      channel.close();
    }
  } catch {
    // Ignore BroadcastChannel errors in restricted browsers or test environments
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionVerified, setIsSessionVerified] = useState(false);

  const authEpochRef = useRef(0);
  const activeVerifyAbortRef = useRef<AbortController | null>(null);
  const isLoggingOutRef = useRef(false);

  const fetchVerifiedUser = useCallback(async (externalSignal?: AbortSignal): Promise<any | null> => {
    if (isLoggingOutRef.current) {
      return null;
    }

    const epoch = ++authEpochRef.current;
    activeVerifyAbortRef.current?.abort();
    const controller = new AbortController();
    activeVerifyAbortRef.current = controller;

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    try {
      const res = await authenticatedFetch(`${API_BASE}/api/auth/me`, {
        signal: controller.signal,
        cache: 'no-store',
        skipAuthRefresh: true,
      });

      if (epoch !== authEpochRef.current || isLoggingOutRef.current || controller.signal.aborted) {
        return null;
      }

      if (res.ok) {
        const raw = await res.json();
        if (epoch !== authEpochRef.current || isLoggingOutRef.current || controller.signal.aborted) {
          return null;
        }

        const data = raw?.data && typeof raw.data === 'object' ? { ...raw, ...raw.data } : raw;
        if (data.csrfToken) {
          setCsrfTokenMemory(data.csrfToken);
        }
        if (data.user) {
          if (data.token && typeof data.token === 'string') {
            setAuthToken(data.token);
          } else {
            const localToken = getAuthToken();
            if (tokenMismatchesVerifiedUser(localToken, data.user)) {
              removeAuthToken();
            }
          }
          setUser(data.user);
          return data.user;
        }

        clearClientAuthStorage();
        setUser(null);
        return null;
      }

      if (res.status === 401) {
        clearClientAuthStorage();
        setUser(null);
        return null;
      }

      if (res.status === 403) {
        const errData = await res.json().catch(() => ({} as any));
        if (epoch !== authEpochRef.current || isLoggingOutRef.current) {
          return null;
        }
        if (errData?.code === 'ACCOUNT_SUSPENDED' || errData?.error?.code === 'ACCOUNT_SUSPENDED') {
          clearClientAuthStorage();
          setUser(null);
          return null;
        }
      }
    } catch {
      // Network or abort error: do not fabricate or restore an unverified cached user
    } finally {
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
      if (activeVerifyAbortRef.current === controller) {
        activeVerifyAbortRef.current = null;
      }
      if (epoch === authEpochRef.current && !isLoggingOutRef.current) {
        setIsSessionVerified(true);
      }
    }
    return null;
  }, []);

  const establishSession = useCallback(
    (nextUser: any, token?: string | null, csrfToken?: string | null) => {
      isLoggingOutRef.current = false;
      authEpochRef.current += 1;
      activeVerifyAbortRef.current?.abort();
      activeVerifyAbortRef.current = null;

      clearClientAuthStorage();
      if (token && typeof token === 'string') {
        setAuthToken(token);
      }
      if (csrfToken && typeof csrfToken === 'string') {
        setCsrfTokenMemory(csrfToken);
      }
      setUser(nextUser || null);
      setIsLoading(false);
      setIsSessionVerified(true);
      broadcastAuthMessage('SESSION_CHANGED');
    },
    []
  );

  const refreshUser = useCallback(async (): Promise<any | null> => {
    isLoggingOutRef.current = false;
    setIsSessionVerified(false);
    const verified = await fetchVerifiedUser();
    if (!isLoggingOutRef.current) {
      setIsLoading(false);
    }
    return verified;
  }, [fetchVerifiedUser]);

  const logout = useCallback(async () => {
    isLoggingOutRef.current = true;
    authEpochRef.current += 1;
    activeVerifyAbortRef.current?.abort();
    activeVerifyAbortRef.current = null;
    bumpClientAuthEpoch();

    // Immediately reset UI user state so no previous account renders while server logout runs
    setUser(null);
    setIsLoading(false);
    setIsSessionVerified(true);

    const callServerLogout = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await authenticatedFetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          skipAuthRefresh: true,
          signal: controller.signal,
          cache: 'no-store',
        });
        return res.ok;
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      const ok = await callServerLogout().catch(() => false);
      if (!ok) {
        await callServerLogout().catch(() => false);
      }
    } finally {
      clearClientAuthStorage();
      try {
        window.localStorage.setItem(LOGOUT_SYNC_STORAGE_KEY, String(Date.now()));
      } catch {
        // Ignore storage errors
      }
      broadcastAuthMessage('LOGOUT');
      setUser(null);
      setIsSessionVerified(true);
      try {
        window.location.replace('/login');
      } catch {
        // Fallback in non-navigation test environments
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadUser() {
      // 1. Capture token from URL if present (from cross-domain OAuth callback redirect)
      const params = new URLSearchParams(window.location.search);
      let urlToken = params.get('token');

      if (!urlToken && window.location.hash.includes('token=')) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        urlToken = hashParams.get('token');
      }

      if (urlToken) {
        setAuthToken(urlToken);
        const cleanParams = new URLSearchParams(window.location.search);
        cleanParams.delete('token');
        const cleanSearch = cleanParams.toString();
        const nextUrl = `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`;
        window.history.replaceState({}, document.title, nextUrl);
      }

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 10000);

      try {
        // Always verify authoritative session against backend before exposing any user identity
        await fetchVerifiedUser(controller.signal);
      } finally {
        clearTimeout(timeoutId);
        if (active && !isLoggingOutRef.current) {
          setIsLoading(false);
          setIsSessionVerified(true);
        }
      }
    }

    void loadUser();
    return () => {
      active = false;
      controller.abort();
    };
  }, [fetchVerifiedUser]);

  // Multi-tab logout & account-switch synchronization
  useEffect(() => {
    const handleLogoutSignal = () => {
      authEpochRef.current += 1;
      activeVerifyAbortRef.current?.abort();
      clearClientAuthStorage();
      setUser(null);
      setIsSessionVerified(true);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_SYNC_STORAGE_KEY && event.newValue) {
        handleLogoutSignal();
      } else if (event.key === 'wedding_session_token') {
        if (!event.newValue) {
          handleLogoutSignal();
        } else if (!isLoggingOutRef.current) {
          void fetchVerifiedUser();
        }
      }
    };

    window.addEventListener('storage', onStorage);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
        channel.onmessage = (msg) => {
          if (msg?.data?.type === 'LOGOUT') {
            handleLogoutSignal();
          } else if (msg?.data?.type === 'SESSION_CHANGED' && !isLoggingOutRef.current) {
            void fetchVerifiedUser();
          }
        };
      }
    } catch {
      channel = null;
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      if (channel) {
        channel.close();
      }
    };
  }, [fetchVerifiedUser]);

  return (
    <UserContext.Provider
      value={{ user, isLoading, isSessionVerified, setUser, establishSession, refreshUser, logout }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
