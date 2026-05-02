import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import Guest from './pages/Guest';
import Display from './pages/Display';
import TemplateSelector from './pages/TemplateSelector';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import CoupleLogin from './pages/CoupleLogin';
import CoupleDashboard from './pages/CoupleDashboard';

import { API_BASE } from './lib/config';
import { authenticatedFetch, setAuthToken } from './lib/auth';
import { WorkspaceProvider, useWorkspace } from './lib/WorkspaceContext';
import { UserProvider, useUser } from './lib/UserContext';
import { getUserWorkspaces, getCurrentSubdomain } from './lib/workspace';

import Home from './pages/Home';
import Subscription from './pages/Subscription';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isLoadingUser } = useUser();
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const location = useLocation();
  const subdomain = getCurrentSubdomain();

  useEffect(() => {
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
        // Check if root domain (e.g., eventframe.io or localhost)
        const isRoot = hostParts.length <= 2 || (hostParts.length === 3 && hostParts[0] === 'www');
        
        if (isRoot && userWorkspaces.length > 0 && location.pathname === '/admin') {
          const slug = userWorkspaces[0].slug;
          const protocol = window.location.protocol;
          // Extract base domain carefully
          const baseDomain = hostParts.slice(-2).join('.');
          const token = localStorage.getItem('wedding_session_token');
          window.location.href = `${protocol}//${slug}.${baseDomain}/admin${token ? `?token=${token}` : ''}`;
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
            
            {/* Couple Login & Dashboard */}
            <Route path="/couple/login" element={<CoupleLogin />} />
            <Route path="/couple/:eventId" element={<CoupleDashboard />} />
            <Route path="/:slug/dashboard" element={<CoupleDashboard />} />
            
            {/* New Event Slug based routes */}
            <Route path="/:slug/display" element={<Display />} />
            <Route path="/:slug/guest" element={<Guest />} />
            <Route path="/:slug" element={<Display />} />

            {/* Legacy/Compat routes */}
            <Route path="/guest/:projectId" element={<Guest />} />
            <Route path="/display/:projectId" element={<Display />} />
            <Route path="/e/:slug" element={<Display />} />
            <Route path="/g/:slug" element={<Guest />} />
            <Route path="/event/:projectId/display" element={<Display />} />
            <Route path="/event/:projectId/guest" element={<Guest />} />
            <Route path="/agency/:agencySlug" element={<TemplateSelector />} />
            <Route path="/guest" element={<Guest />} />
            <Route path="/display" element={<Display />} />
            <Route path="/subscription" element={<Subscription />} />
            
            <Route path="/" element={<Home />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </WorkspaceProvider>
      </UserProvider>
    </BrowserRouter>
  );
}

