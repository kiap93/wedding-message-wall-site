import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import Guest from './pages/Guest';
import Display from './pages/Display';
import TemplateSelector from './pages/TemplateSelector';
import Admin from './pages/Admin';
import Login from './pages/Login';

import { API_BASE } from './lib/config';
import { authenticatedFetch, setAuthToken } from './lib/auth';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Capture token from URL if present (Worker redirect)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setAuthToken(urlToken);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 2. Fetch user
    authenticatedFetch(`${API_BASE}/api/auth/me`)
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Auth check failed:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCF0]">
        <div className="w-8 h-8 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/templates" element={<TemplateSelector />} />
        <Route 
          path="/admin" 
          element={
            <AuthGuard>
              <Admin />
            </AuthGuard>
          } 
        />
        <Route path="/guest/:projectId" element={<Guest />} />
        <Route path="/display/:projectId" element={<Display />} />
        <Route path="/e/:slug" element={<Display />} />
        <Route path="/g/:slug" element={<Guest />} />
        <Route path="/guest" element={<Guest />} />
        <Route path="/display" element={<Display />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

