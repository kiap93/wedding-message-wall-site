import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { WorkspaceProvider } from './lib/WorkspaceContext';
import { UserProvider, useUser } from './lib/UserContext';
import { getUserWorkspaces, getCurrentSubdomain } from './lib/workspace';

import SEO, { SEOProvider } from './components/SEO';
import { MarketingTranslationProvider } from './lib/i18n/MarketingTranslationContext';

// Eagerly loaded public marketing & blog pages for instant SSR / hydration
import Home from './pages/Home';
import TemplateSelector from './pages/TemplateSelector';
import PricingPage from './pages/PricingPage';
import WeddingPlannerSoftware from './pages/marketing/WeddingPlannerSoftware';
import WhiteLabelWeddingSoftware from './pages/marketing/WhiteLabelWeddingSoftware';
import WeddingWebsiteBuilder from './pages/marketing/WeddingWebsiteBuilder';
import WeddingSeatingChart from './pages/marketing/WeddingSeatingChart';
import DigitalWeddingInvitations from './pages/marketing/DigitalWeddingInvitations';
import WeddingRsvpManagement from './pages/marketing/WeddingRsvpManagement';
import WeddingGuestManagement from './pages/marketing/WeddingGuestManagement';
import WeddingReceptionDisplay from './pages/marketing/WeddingReceptionDisplay';
import BlogIndexPage from './pages/blog/BlogIndexPage';
import BlogPostPage from './pages/blog/BlogPostPage';

// Lazy-loaded interactive studio, guest, and portal routes
const Guest = lazy(() => import('./pages/Guest'));
const RSVPPage = lazy(() => import('./pages/RSVP'));
const Display = lazy(() => import('./pages/Display'));
const Workspace = lazy(() => import('./pages/Workspace'));
const Login = lazy(() => import('./pages/Login'));
const Verify = lazy(() => import('./pages/Verify'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const CoupleLogin = lazy(() => import('./pages/CoupleLogin'));
const CoupleDashboard = lazy(() => import('./pages/CoupleDashboard'));
const StaffTemplates = lazy(() => import('./pages/StaffTemplates'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const InvitationEditor = lazy(() => import('./pages/InvitationEditor'));
const InvitationViewer = lazy(() => import('./pages/InvitationViewer'));
const WebsiteStudio = lazy(() => import('./pages/WebsiteStudio'));
const WeddingWebsite = lazy(() => import('./pages/WeddingWebsite'));
const Subscription = lazy(() => import('./pages/Subscription'));

const RouteLoadingFallback = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F5]">
    <div className="w-6 h-6 border-2 border-[#252525] border-t-transparent rounded-full animate-spin mb-3" />
    <p className="text-xs text-[#777777]">Loading EventFrame...</p>
  </div>
);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isLoadingUser } = useUser();
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const location = useLocation();
  const subdomain = getCurrentSubdomain();

  useEffect(() => {
    let active = true;

    async function checkWorkspaces() {
      if (workspaces.length > 0 && user) {
        return;
      }

      if (!user) {
        if (active) {
          setLoadingWorkspaces(false);
          setWorkspaces([]);
        }
        return;
      }

      if (active) setLoadingWorkspaces(true);

      try {
        const userWorkspaces = await getUserWorkspaces(user.id || user.sub);
        if (!active) return;

        setWorkspaces(userWorkspaces);

        const currentHost = window.location.host;
        const hostParts = currentHost.split('.');
        const isRootDomain = currentHost === 'eventframe.io' || currentHost === 'www.eventframe.io';
        const isGenericRoot = hostParts.length <= 2 && !currentHost.includes('localhost');
        const isRoot = isRootDomain || isGenericRoot;
        const isRunApp = currentHost.includes('.run.app');

        if (isRoot && !isRunApp && userWorkspaces.length === 0 && location.pathname !== '/onboarding') {
          window.location.replace('/onboarding');
          return;
        }

        if (isRunApp) {
          return;
        }

        if (isRoot && userWorkspaces.length > 0 && location.pathname === '/workspace') {
          const workspace = userWorkspaces[0];
          if (workspace.user_role === 'agency' && workspace.slug) {
            const slug = workspace.slug;
            const protocol = window.location.protocol;
            const baseDomain = hostParts.slice(-2).join('.');
            if (currentHost !== `${slug}.${baseDomain}`) {
              const token = localStorage.getItem('wedding_session_token');
              window.location.replace(`${protocol}//${slug}.${baseDomain}/workspace${token ? `?token=${token}` : ''}`);
              return;
            }
          }
        }
      } catch (err) {
        console.error('AuthGuard: Workspace check failed:', err);
      } finally {
        if (active) {
          setLoadingWorkspaces(false);
        }
      }
    }

    if (!isLoadingUser) {
      checkWorkspaces();
    }

    return () => {
      active = false;
    };
  }, [user?.id, isLoadingUser, subdomain]);

  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F5]">
        <div className="w-6 h-6 border-2 border-[#252525] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-[#777777]">Checking authentication...</p>
      </div>
    );
  }

  if (loadingWorkspaces) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F5]">
        <div className="w-6 h-6 border-2 border-[#252525] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-[#777777]">Syncing workspace...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

const LOCALIZED_PREFIXES = ['/zh-cn', '/zh-tw', '/ms'] as const;

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Private / Auth / Editor routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />
        <Route path="/templates/manage" element={<AuthGuard><StaffTemplates /></AuthGuard>} />
        <Route path="/workspace" element={<AuthGuard><Workspace /></AuthGuard>} />
        <Route path="/editor/:projectId" element={<AuthGuard><InvitationEditor /></AuthGuard>} />
        <Route path="/website-studio/:projectId" element={<AuthGuard><WebsiteStudio /></AuthGuard>} />
        <Route path="/website-studio" element={<AuthGuard><WebsiteStudio /></AuthGuard>} />
        <Route path="/subscription" element={<Subscription />} />

        {/* Public English Marketing & Solution Routes */}
        <Route path="/templates" element={<TemplateSelector />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/wedding-website-builder" element={<WeddingWebsiteBuilder />} />
        <Route path="/wedding-seating-chart" element={<WeddingSeatingChart />} />
        <Route path="/wedding-planner-software" element={<WeddingPlannerSoftware />} />
        <Route path="/white-label-wedding-software" element={<WhiteLabelWeddingSoftware />} />
        <Route path="/digital-wedding-invitations" element={<DigitalWeddingInvitations />} />
        <Route path="/wedding-rsvp-management" element={<WeddingRsvpManagement />} />
        <Route path="/wedding-guest-management" element={<WeddingGuestManagement />} />
        <Route path="/wedding-reception-display" element={<WeddingReceptionDisplay />} />

        {/* Editorial Blog & Guides (Canonical English + /en alias) */}
        <Route path="/blog" element={<BlogIndexPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/en/blog" element={<BlogIndexPage />} />
        <Route path="/en/blog/:slug" element={<BlogPostPage />} />

        {/* Localized Marketing & Blog Route Prefixes (/zh-cn, /zh-tw, /ms) */}
        {LOCALIZED_PREFIXES.flatMap((prefix) => [
          <Route key={`${prefix}-root`} path={prefix} element={<Home />} />,
          <Route key={`${prefix}-slash`} path={`${prefix}/`} element={<Home />} />,
          <Route key={`${prefix}-templates`} path={`${prefix}/templates`} element={<TemplateSelector />} />,
          <Route key={`${prefix}-pricing`} path={`${prefix}/pricing`} element={<PricingPage />} />,
          <Route key={`${prefix}-blog`} path={`${prefix}/blog`} element={<BlogIndexPage />} />,
          <Route key={`${prefix}-blog-post`} path={`${prefix}/blog/:slug`} element={<BlogPostPage />} />,
          <Route key={`${prefix}-website`} path={`${prefix}/wedding-website-builder`} element={<WeddingWebsiteBuilder />} />,
          <Route key={`${prefix}-seating`} path={`${prefix}/wedding-seating-chart`} element={<WeddingSeatingChart />} />,
          <Route key={`${prefix}-planner`} path={`${prefix}/wedding-planner-software`} element={<WeddingPlannerSoftware />} />,
          <Route key={`${prefix}-whitelabel`} path={`${prefix}/white-label-wedding-software`} element={<WhiteLabelWeddingSoftware />} />,
          <Route key={`${prefix}-invitations`} path={`${prefix}/digital-wedding-invitations`} element={<DigitalWeddingInvitations />} />,
          <Route key={`${prefix}-rsvp`} path={`${prefix}/wedding-rsvp-management`} element={<WeddingRsvpManagement />} />,
          <Route key={`${prefix}-guest`} path={`${prefix}/wedding-guest-management`} element={<WeddingGuestManagement />} />,
          <Route key={`${prefix}-display`} path={`${prefix}/wedding-reception-display`} element={<WeddingReceptionDisplay />} />,
        ])}

        {/* Couple Login & Dashboard */}
        <Route path="/couple/login" element={<CoupleLogin />} />
        <Route path="/couple/:eventId" element={<CoupleDashboard />} />
        <Route path="/:slug/dashboard" element={<CoupleDashboard />} />

        {/* Event Slug based routes */}
        <Route path="/:slug/display" element={<Display />} />
        <Route path="/:slug/guest" element={<Guest />} />
        <Route path="/:slug/rsvp" element={<RSVPPage />} />
        <Route path="/:slug/invitation" element={<InvitationViewer />} />
        <Route path="/:slug/website" element={<WeddingWebsite />} />
        <Route path="/:slug" element={<Display />} />

        {/* Legacy / Compat routes */}
        <Route path="/guest/:projectId" element={<Guest />} />
        <Route path="/rsvp/:projectId" element={<RSVPPage />} />
        <Route path="/display/:projectId" element={<Display />} />
        <Route path="/e/:slug" element={<Display />} />
        <Route path="/g/:slug" element={<Guest />} />
        <Route path="/r/:slug" element={<RSVPPage />} />
        <Route path="/event/:projectId/display" element={<Display />} />
        <Route path="/event/:projectId/guest" element={<Guest />} />
        <Route path="/event/:projectId/rsvp" element={<RSVPPage />} />
        <Route path="/agency/:agencySlug" element={<TemplateSelector />} />
        <Route path="/guest" element={<Guest />} />
        <Route path="/rsvp" element={<RSVPPage />} />
        <Route path="/display" element={<Display />} />

        <Route path="/" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <MarketingTranslationProvider>
        <SEOProvider>
          <SEO />
          <UserProvider>
            <WorkspaceProvider>
              <AppRoutes />
            </WorkspaceProvider>
          </UserProvider>
        </SEOProvider>
      </MarketingTranslationProvider>
    </BrowserRouter>
  );
}
