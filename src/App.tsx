import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import Guest from './pages/Guest';
import Display from './pages/Display';
import TemplateSelector from './pages/TemplateSelector';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';

import { API_BASE } from './lib/config';
import { authenticatedFetch, setAuthToken } from './lib/auth';
import { WorkspaceProvider, useWorkspace } from './lib/WorkspaceContext';
import { UserProvider, useUser } from './lib/UserContext';
import { getUserWorkspaces, getCurrentSubdomain } from './lib/workspace';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isLoadingUser } = useUser();
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const location = useLocation();
  const subdomain = getCurrentSubdomain();

  useEffect(() => {
    // 1. Capture token from URL if present (Worker redirect)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setAuthToken(urlToken);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Force reload to pick up new token in UserProvider
      window.location.reload();
      return;
    }

    // 2. Fetch workspaces once user is loaded
    async function checkWorkspaces() {
      if (!user) {
        setLoadingWorkspaces(false);
        return;
      }
      
      try {
        const userWorkspaces = await getUserWorkspaces(user.id || user.sub);
        setWorkspaces(userWorkspaces);
        
        // Redirect logic
        if (userWorkspaces.length === 0 && location.pathname !== '/onboarding') {
          window.location.href = '/onboarding';
          return;
        }

        const currentHost = window.location.host;
        const hostParts = currentHost.split('.');
        const isRoot = hostParts.length <= 2;
        
        if (isRoot && userWorkspaces.length > 0 && location.pathname === '/admin') {
          const slug = userWorkspaces[0].slug;
          const protocol = window.location.protocol;
          const baseDomain = hostParts.join('.');
          window.location.href = `${protocol}//${slug}.${baseDomain}/admin`;
          return;
        }
      } catch (err) {
        console.error('Workspace check failed:', err);
      } finally {
        setLoadingWorkspaces(false);
      }
    }

    if (!isLoadingUser) {
      checkWorkspaces();
    }
  }, [user, isLoadingUser, location.pathname, subdomain]);

  if (isLoadingUser || loadingWorkspaces) {
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
      <UserProvider>
        <WorkspaceProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />
            <Route path="/templates" element={<TemplateSelector />} />
            <Route path="/admin" element={<AuthGuard><Admin /></AuthGuard>} />
            <Route path="/guest/:projectId" element={<Guest />} />
            <Route path="/display/:projectId" element={<Display />} />
            <Route path="/e/:slug" element={<Display />} />
            <Route path="/g/:slug" element={<Guest />} />
            <Route path="/event/:projectId/display" element={<Display />} />
            <Route path="/event/:projectId/guest" element={<Guest />} />
            <Route path="/agency/:agencySlug" element={<TemplateSelector />} />
            <Route path="/guest" element={<Guest />} />
            <Route path="/display" element={<Display />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </WorkspaceProvider>
      </UserProvider>
    </BrowserRouter>
  );
}

