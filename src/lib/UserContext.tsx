import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from './config';
import { authenticatedFetch } from './auth';

interface UserContextType {
  user: any | null;
  isLoading: boolean;
  setUser: (user: any) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      // 1. Capture token from URL if present (from cross-domain redirect)
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        localStorage.setItem('wedding_session_token', urlToken);
        // Clean up URL without reload if possible, or just proceed
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const token = localStorage.getItem('wedding_session_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await authenticatedFetch(`${API_BASE}/api/auth/me`);
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        } else {
          // If token was invalid, clear it
          localStorage.removeItem('wedding_session_token');
        }
      } catch (err) {
        console.error('Failed to load user:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, setUser }}>
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
