import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarHeart,
  CreditCard,
  ScrollText,
  Settings,
  LogOut,
  ArrowLeft,
  Menu,
  X,
  ShieldCheck,
  Mail,
} from 'lucide-react';
import { DeveloperAdminIdentity } from '../../lib/developerApi';
import { useUser } from '../../lib/UserContext';

interface DeveloperLayoutProps {
  admin: DeveloperAdminIdentity;
  title: string;
  breadcrumbs?: Array<{ label: string; to?: string }>;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', to: '/developer', icon: LayoutDashboard, exact: true },
  { id: 'organizations', label: 'Organizations', to: '/developer/organizations', icon: Building2 },
  { id: 'users', label: 'Users', to: '/developer/users', icon: Users },
  { id: 'events', label: 'Events', to: '/developer/events', icon: CalendarHeart },
  { id: 'payments', label: 'Payments', to: '/developer/payments', icon: CreditCard },
  { id: 'contact-enquiries', label: 'Contact Enquiries', to: '/developer/contact-enquiries', icon: Mail },
  { id: 'activity-logs', label: 'Activity Logs', to: '/developer/activity-logs', icon: ScrollText },
  { id: 'settings', label: 'Platform Settings', to: '/developer/settings', icon: Settings },
];

export const DeveloperLayout: React.FC<DeveloperLayoutProps> = ({
  admin,
  title,
  breadcrumbs,
  children,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const isActivePath = (to: string, exact?: boolean) => {
    if (exact) return location.pathname === to || location.pathname === `${to}/`;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const sidebar = (
    <div className="flex flex-col h-full bg-white border-r border-[#E8E8E5]">
      <div className="h-14 px-4 border-b border-[#E8E8E5] flex items-center justify-between">
        <Link to="/developer" className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-[#252525] text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-[#D8B979]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#1A1A1A] tracking-tight truncate">
              EventFrame Admin
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#777777]">
              Platform Developer
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777777]">
          Platform Control
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(item.to, item.exact);
          return (
            <Link
              key={item.id}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                active
                  ? 'bg-[#252525] text-white'
                  : 'text-[#555555] hover:text-[#1A1A1A] hover:bg-[#F7F7F5]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#D8B979]' : 'text-[#777777]'}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#E8E8E5] space-y-2">
        <button
          type="button"
          onClick={() => navigate('/workspace')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-[#555555] hover:text-[#1A1A1A] hover:bg-[#F7F7F5] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Agency Workspace</span>
        </button>
        <div className="px-3 py-2 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-[#1A1A1A] truncate">{admin.name}</div>
            <div className="text-[10px] font-mono text-[#777777] truncate">{admin.email}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 text-[#777777] hover:text-[#B91C1C] rounded hover:bg-white transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#1A1A1A] flex flex-col lg:flex-row font-sans">
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 h-screen sticky top-0 z-20">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 max-w-[80vw] h-full z-10">{sidebar}</div>
        </div>
      )}

      {/* Right Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 bg-white border-b border-[#E8E8E5] px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-1.5 text-[#555555] hover:text-[#1A1A1A] rounded border border-[#E8E8E5]"
              aria-label="Toggle admin navigation"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-[#777777] truncate">
              <Link to="/developer" className="hover:text-[#1A1A1A] font-medium">
                Developer Console
              </Link>
              {breadcrumbs?.map((b, idx) => (
                <React.Fragment key={idx}>
                  <span>/</span>
                  {b.to ? (
                    <Link to={b.to} className="hover:text-[#1A1A1A] truncate">
                      {b.label}
                    </Link>
                  ) : (
                    <span className="text-[#1A1A1A] font-medium truncate">{b.label}</span>
                  )}
                </React.Fragment>
              ))}
              {(!breadcrumbs || breadcrumbs.length === 0) && (
                <>
                  <span>/</span>
                  <span className="text-[#1A1A1A] font-medium truncate">{title}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-block px-2 py-0.5 rounded border border-[#E8E8E5] bg-[#F7F7F5] text-[10px] font-mono text-[#555555]">
              {admin.email}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DeveloperLayout;
