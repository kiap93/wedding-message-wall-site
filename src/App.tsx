import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { WorkspaceProvider } from './lib/WorkspaceContext';
import { UserProvider, useUser } from './lib/UserContext';
import { getUserWorkspaces, getCurrentSubdomain } from './lib/workspace';

import SEO, { SEOProvider } from './components/SEO';
import { MarketingTranslationProvider } from './lib/i18n/MarketingTranslationContext';
import { normalizePathname } from './seo/canonical';

// Eagerly loaded public marketing & blog pages for instant SSR / hydration
import Home from './pages/Home';
import TemplateSelector from './pages/TemplateSelector';
import PricingPage from './pages/PricingPage';
import ContactPage from './pages/ContactPage';
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

// Lazy-loaded Super Admin (/developer) console
import DeveloperRouteGuard from './components/developer/DeveloperRouteGuard';
import DeveloperLayout from './components/developer/DeveloperLayout';
const DeveloperOverview = lazy(() => import('./pages/developer/DeveloperOverview'));
const DeveloperOrganizations = lazy(() => import('./pages/developer/DeveloperOrganizations'));
const DeveloperOrganizationDetail = lazy(() => import('./pages/developer/DeveloperOrganizationDetail'));
const DeveloperUsers = lazy(() => import('./pages/developer/DeveloperUsers'));
const DeveloperUserDetail = lazy(() => import('./pages/developer/DeveloperUserDetail'));
const DeveloperEvents = lazy(() => import('./pages/developer/DeveloperEvents'));
const DeveloperPayments = lazy(() => import('./pages/developer/DeveloperPayments'));
const DeveloperContactEnquiries = lazy(() => import('./pages/developer/DeveloperContactEnquiries'));
const DeveloperActivityLogs = lazy(() => import('./pages/developer/DeveloperActivityLogs'));
const DeveloperSettings = lazy(() => import('./pages/developer/DeveloperSettings'));

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
    let redirected = false;

    async function checkWorkspaces() {
      if (!user) {
        if (active) {
          setLoadingWorkspaces(false);
          setWorkspaces([]);
        }
        return;
      }

      if (workspaces.length === 0 && active) {
        setLoadingWorkspaces(true);
      }

      try {
        const userWorkspaces = workspaces.length > 0 ? workspaces : await getUserWorkspaces();
        if (!active) return;

        if (workspaces.length === 0) {
          setWorkspaces(userWorkspaces);
        }

        const currentHost = window.location.host;
        const hostname = window.location.hostname;
        const hostParts = currentHost.split('.');
        const isRootDomain = currentHost === 'eventframe.io' || currentHost === 'www.eventframe.io';
        const isPreviewOrLocal =
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.endsWith('.run.app') ||
          hostname.endsWith('.pages.dev') ||
          hostname.endsWith('.workers.dev') ||
          hostname.endsWith('.vercel.app') ||
          hostname.endsWith('.netlify.app');
        const isGenericRoot = hostParts.length <= 2 && !isPreviewOrLocal;
        const isRoot = isRootDomain || isGenericRoot;
        const normalizedPath = normalizePathname(location.pathname);

        if (isRoot && !isPreviewOrLocal && userWorkspaces.length === 0 && normalizedPath !== '/onboarding') {
          redirected = true;
          window.location.replace('/onboarding');
          return;
        }

        if (isPreviewOrLocal) {
          return;
        }

        const subdomainAllowed =
          !subdomain ||
          userWorkspaces.some((w: any) => String(w?.slug || '').toLowerCase() === subdomain.toLowerCase());

        if ((isRoot || !subdomainAllowed) && userWorkspaces.length > 0 && normalizedPath === '/workspace') {
          const primaryWorkspace =
            userWorkspaces.find((w: any) => w.user_role === 'agency' && w.slug) || userWorkspaces[0];
          if (primaryWorkspace.user_role === 'agency' && primaryWorkspace.slug) {
            const slug = primaryWorkspace.slug;
            const protocol = window.location.protocol;
            const baseDomain = hostParts.slice(-2).join('.');
            if (currentHost !== `${slug}.${baseDomain}`) {
              const token = localStorage.getItem('wedding_session_token');
              const nextParams = new URLSearchParams(location.search);
              if (token) nextParams.set('token', token);
              const nextSearch = nextParams.toString();
              redirected = true;
              window.location.replace(
                `${protocol}//${slug}.${baseDomain}/workspace${nextSearch ? `?${nextSearch}` : ''}`
              );
              return;
            }
          }
        }
      } catch (err) {
        console.error('AuthGuard: Workspace check failed:', err);
      } finally {
        if (active && !redirected) {
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
    const intendedDestination = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(intendedDestination)}`} replace />;
  }

  return <>{children}</>;
}

function WorkspaceWildcardRedirect() {
  const location = useLocation();
  const suffix = location.pathname.replace(/^\/workspace\/?/i, '').toLowerCase();
  const params = new URLSearchParams(location.search);
  if (suffix === 'calendar') {
    params.set('view', 'calendar');
  } else if (suffix === 'agency_settings' || suffix === 'settings') {
    params.set('view', 'agency_settings');
  } else if (suffix === 'editor') {
    params.set('view', 'editor');
  } else if (!params.get('view')) {
    params.set('view', 'grid');
  }
  const nextSearch = params.toString();
  return <Navigate to={`/workspace${nextSearch ? `?${nextSearch}` : ''}`} replace />;
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
        <Route path="/workspace/*" element={<AuthGuard><WorkspaceWildcardRedirect /></AuthGuard>} />
        <Route path="/editor/:projectId" element={<AuthGuard><InvitationEditor /></AuthGuard>} />
        <Route path="/website-studio/:projectId" element={<AuthGuard><WebsiteStudio /></AuthGuard>} />
        <Route path="/website-studio" element={<AuthGuard><WebsiteStudio /></AuthGuard>} />
        <Route path="/subscription" element={<AuthGuard><Subscription /></AuthGuard>} />

        {/* Super Admin Console (/developer) - strictly protected server-side & client-side */}
        <Route
          path="/developer"
          element={
            <DeveloperRouteGuard>
              {(admin) => (
                <DeveloperLayout admin={admin} title="Platform Overview">
                  <DeveloperOverview />
                </DeveloperLayout>
              )}
            </DeveloperRouteGuard>
          }
        />
        <Route
          path="/developer/organizations"
          element={
            <DeveloperRouteGuard>
              {(admin) => (
                <DeveloperLayout
                  admin={admin}
                  title="Organizations"
                  breadcrumbs={[{ label: 'Organizations' }]}
                >
                  <DeveloperOrganizations />
                </DeveloperLayout>
              )}
            </DeveloperRouteGuard>
          }
        />
        <Route
          path="/developer/organizations/:id"
          element={
            <DeveloperRouteGuard>
              {(admin) => (
                <DeveloperLayout
                  admin={admin}
                  title="Organization Detail"
                  breadcrumbs={[
                    { label: 'Organizations', to: '/developer/organizations' },
                    { label: 'Detail' },
                  ]}
                >
                  <DeveloperOrganizationDetail />
                </DeveloperLayout>
              )}
            </DeveloperRouteGuard>
          }
        />
        <Route
          path="/developer/users"
          element={
            <DeveloperRouteGuard>
              {(admin) => (
                <DeveloperLayout admin={admin} title="Users" breadcrumbs={[{ label: 'Users' }]}>
                  <DeveloperUsers />
                </DeveloperLayout>
              )}
            </DeveloperRouteGuard>
          }
        />
        <Route
          path="/developer/users/:id"
          element={
            <DeveloperRouteGuard>
              {(admin) => (
                <DeveloperLayout
                  admin={admin}
                  title="User Detail"
                  breadcrumbs={[{ label: 'Users', to: '/developer/users' }, { label: 'Detail' }]}
                >
                  <DeveloperUserDetail />
                </DeveloperLayout>
              )}
            </DeveloperRouteGuard>
          }
        />
        <Route
          path="/developer/events"
          element={
            <DeveloperRouteGuard>
              {(admin) => (
                <DeveloperLayout admin={admin} title="Events" breadcrumbs={[{ label: 'Events' }]}>
                  <DeveloperEvents />
                </DeveloperLayout>
              )}
            </DeveloperRouteGuard>
          }
        />
        <Route
          path="/developer/payments"
          element={
            <DeveloperRouteGuard>
              {(admin) => (
                <DeveloperLayout admin={admin} title="Payments" breadcrumbs={[{ label: 'Payments' }]}>
                  <DeveloperPayments />
                </DeveloperLayout>
              )}
            </DeveloperRouteGuard>
          }
        />
        <Route
          path="/developer/contact-enquiries"
          element={
            <DeveloperRouteGuard>
              {(admin) => (
                <DeveloperLayout
                  admin={admin}
                  title="Contact Enquiries"
                  breadcrumbs={[{ label: 'Contact Enquiries' }]}
                >
                  <DeveloperContactEnquiries />
                </DeveloperLayout>
              )}
            </DeveloperRouteGuard>
          }
        />
        <Route
          path="/developer/activity-logs"
          element={
            <DeveloperRouteGuard>
              {(admin) => (
                <DeveloperLayout
                  admin={admin}
                  title="Activity Logs"
                  breadcrumbs={[{ label: 'Activity Logs' }]}
                >
                  <DeveloperActivityLogs />
                </DeveloperLayout>
              )}
            </DeveloperRouteGuard>
          }
        />
        <Route
          path="/developer/settings"
          element={
            <DeveloperRouteGuard>
              {(admin) => (
                <DeveloperLayout
                  admin={admin}
                  title="Platform Settings"
                  breadcrumbs={[{ label: 'Platform Settings' }]}
                >
                  <DeveloperSettings />
                </DeveloperLayout>
              )}
            </DeveloperRouteGuard>
          }
        />

        {/* Public English Marketing & Solution Routes */}
        <Route path="/templates" element={<TemplateSelector />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/en/contact" element={<ContactPage />} />
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
          <Route key={`${prefix}-contact`} path={`${prefix}/contact`} element={<ContactPage />} />,
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
