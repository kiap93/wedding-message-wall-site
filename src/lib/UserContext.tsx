import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from './config';
import { authenticatedFetch, setAuthToken, removeAuthToken, setCsrfTokenMemory } from './auth';

interface UserContextType {
  user: any | null;
  isLoading: boolean;
  setUser: (user: any) => void;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = async () => {
    try {
      await authenticatedFetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
      });
    } catch {
      // Proceed with local cleanup even if backend is unreachable
    } finally {
      removeAuthToken();
      setCsrfTokenMemory(null);
      setUser(null);
      window.location.replace('/login');
    }
  };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadUser() {
      // 1. Capture token from URL if present (from cross-domain redirect)
      const params = new URLSearchParams(window.location.search);
      let urlToken = params.get('token');

      if (!urlToken && window.location.hash.includes('token=')) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        urlToken = hashParams.get('token');
      }

      if (urlToken) {
        setAuthToken(urlToken);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const token = localStorage.getItem('wedding_session_token');

      // Optimistic load: if we have a token, decode payload so UI renders immediately
      if (token && token.split('.').length === 3) {
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(window.atob(base64));

          if (!payload.name && payload.email) {
            payload.name = payload.email.split('@')[0];
          } else if (!payload.name) {
            payload.name = 'Anonymous User';
          }

          if (active) {
            setUser(payload);
            setIsLoading(false);
          }
        } catch {
          // Ignore malformed optimistic token; backend verification will clean up
        }
      }

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 10000);

      try {
        if (!token) {
          try {
            await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
          } catch {
            // Non-blocking preflight check
          }
        }

        const res = await authenticatedFetch(`${API_BASE}/api/auth/me`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        if (!active) return;

        if (res.ok) {
          const raw = await res.json();
          const data = raw?.data && typeof raw.data === 'object' ? { ...raw, ...raw.data } : raw;
          if (data.csrfToken) {
            setCsrfTokenMemory(data.csrfToken);
          }
          if (data.token && typeof data.token === 'string') {
            setAuthToken(data.token);
          }
          if (data.user) {
            setUser(data.user);
          } else if (token) {
            removeAuthToken();
            setUser(null);
          }
        } else if (res.status === 401) {
          if (token) {
            removeAuthToken();
            setCsrfTokenMemory(null);
            setUser(null);
          }
        } else if (res.status === 403) {
          const errData = await res.json().catch(() => ({} as any));
          if (errData?.code === 'ACCOUNT_SUSPENDED' || errData?.error?.code === 'ACCOUNT_SUSPENDED') {
            removeAuthToken();
            setCsrfTokenMemory(null);
            setUser(null);
          }
        }
      } catch {
        // Silent recovery on abort/network error
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadUser();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, setUser, logout }}>
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
