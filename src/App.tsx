import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import Guest from './pages/Guest';
import Display from './pages/Display';
import TemplateSelector from './pages/TemplateSelector';
import Workspace from './pages/Workspace';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import CoupleLogin from './pages/CoupleLogin';
import CoupleDashboard from './pages/CoupleDashboard';
import StaffTemplates from './pages/StaffTemplates';

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
        // Only redirect to onboarding if on root domain and truly have no workspaces
        const currentHost = window.location.host;
        const hostParts = currentHost.split('.');
        
        // Strict root check: exactly eventframe.io or www.eventframe.io
        const isRootDomain = currentHost === 'eventframe.io' || currentHost === 'www.eventframe.io';
        // Generic fallback for other domains/IPs
        const isGenericRoot = hostParts.length <= 2 && !currentHost.includes('localhost');
        const isRoot = isRootDomain || isGenericRoot;
        
        const isRunApp = currentHost.includes('.run.app');

        if (isRoot && !isRunApp && userWorkspaces.length === 0 && location.pathname !== '/onboarding') {
          window.location.replace('/onboarding');
          return;
        }
        
        // Disable subdomain redirects on run.app domains as they don't support wildcard subdomains
        if (isRunApp) return;

        if (isRoot && userWorkspaces.length > 0 && location.pathname === '/workspace') {
          const workspace = userWorkspaces[0];
          // Only redirect to subdomain if it's an agency and has a valid slug
          if (workspace.user_role === 'agency' && workspace.slug) {
            const slug = workspace.slug;
            const protocol = window.location.protocol;
            // Extract base domain carefully
            const baseDomain = hostParts.slice(-2).join('.');
            // Avoid looping if we are already on the correct host (shouldn't happen with isRoot but being safe)
            if (currentHost !== `${slug}.${baseDomain}`) {
              const token = localStorage.getItem('wedding_session_token');
              window.location.replace(`${protocol}//${slug}.${baseDomain}/workspace${token ? `?token=${token}` : ''}`);
              return;
            }
          }
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
            <Route path="/templates/manage" element={<AuthGuard><StaffTemplates /></AuthGuard>} />
            <Route path="/templates" element={<TemplateSelector />} />
            <Route path="/workspace" element={<AuthGuard><Workspace /></AuthGuard>} />
            
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

