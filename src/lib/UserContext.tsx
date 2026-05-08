import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from './config';
import { authenticatedFetch } from './auth';

interface UserContextType {
  user: any | null;
  isLoading: boolean;
  setUser: (user: any) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem('wedding_session_token');
    setUser(null);
    window.location.replace('/login');
  };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadUser() {
      const requestId = Math.random().toString(36).substring(7);
      console.log(`[UserProvider] [${requestId}] Starting loadUser...`);
      
      // 1. Capture token from URL if present (from cross-domain redirect)
      const params = new URLSearchParams(window.location.search);
      let urlToken = params.get('token');
      
      // Also check for token in fragment
      if (!urlToken && window.location.hash.includes('token=')) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        urlToken = hashParams.get('token');
      }

      if (urlToken) {
        console.log(`[UserProvider] [${requestId}] Found token in URL, saving...`);
        localStorage.setItem('wedding_session_token', urlToken);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const token = localStorage.getItem('wedding_session_token');
      console.log(`[UserProvider] [${requestId}] Current token exists:`, !!token);
      
      // Optimistic load: if we have a token, decode it locally so UI can render immediately
      if (token && token.split('.').length === 3) {
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(window.atob(base64));
          
          // Ensure name fallback
          if (!payload.name && payload.email) {
            payload.name = payload.email.split('@')[0];
          } else if (!payload.name) {
            payload.name = 'Anonymous User';
          }
          
          console.log(`[UserProvider] [${requestId}] Optimistically loaded user:`, payload.email);
          if (active) {
            setUser(payload);
            setIsLoading(false);
          }
        } catch (e) {
          console.warn('Failed to optimistically decode token', e);
        }
      }

      // Timeout helper
      const timeoutId = setTimeout(() => {
        console.warn(`[UserProvider] [${requestId}] Request timed out after 10s`);
        controller.abort();
      }, 10000);

      try {
        // Fast health check only if we don't have a token to avoid extra calls
        if (!token) {
          try {
            await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
          } catch (e) {
            console.warn(`[UserProvider] [${requestId}] API Health Check failed`);
          }
        }

        console.log(`[UserProvider] [${requestId}] Fetching /api/auth/me...`);
        const res = await authenticatedFetch(`${API_BASE}/api/auth/me`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (!active) return;

        console.log(`[UserProvider] [${requestId}] Received response status:`, res.status);
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            console.log(`[UserProvider] [${requestId}] User verified with server`);
            setUser(data.user);
          } else {
            console.warn(`[UserProvider] [${requestId}] Session check returned no user`);
            if (token) {
              localStorage.removeItem('wedding_session_token');
              setUser(null);
            }
          }
        } else if (res.status === 401) {
          console.log(`[UserProvider] [${requestId}] Server says unauthorized (401)`);
          if (token) {
            localStorage.removeItem('wedding_session_token');
            setUser(null);
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.warn(`[UserProvider] [${requestId}] Fetch aborted (timeout or unmount)`);
        } else {
          console.error(`[UserProvider] [${requestId}] Error in loadUser:`, err.message || err);
        }
      } finally {
        if (active) {
          console.log(`[UserProvider] [${requestId}] Finishing load (isLoading = false)`);
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
