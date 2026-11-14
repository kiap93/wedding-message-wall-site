import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  Layers, 
  Settings, 
  CreditCard, 
  LogOut, 
  Menu, 
  X, 
  ExternalLink,
  Heart,
  Plus
} from 'lucide-react';
import { useUser } from '../lib/UserContext';
import { useWorkspace } from '../lib/WorkspaceContext';
import { removeAuthToken } from '../lib/auth';

export interface EventSidebarNav {
  eventName: string;
  activeTab: string;
  items: Array<{ id: string; label: string; icon?: React.ReactNode }>;
  onSelectTab: (id: string) => void;
}

export interface DashboardLayoutProps {
  children: React.ReactNode;
  activeItem?: 'events' | 'calendar' | 'templates' | 'settings' | 'subscription';
  onNewEvent?: () => void;
  eventNav?: EventSidebarNav | null;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeItem = 'events',
  onNewEvent,
  eventNav,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { workspace } = useWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tabletSidebarCollapsed, setTabletSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    removeAuthToken();
    localStorage.removeItem('wedding_session_token');
    window.location.href = '/login';
  };

  const navItems = [
    {
      id: 'events',
      label: 'Weddings & Events',
      icon: <Heart className="w-4 h-4" />,
      onClick: () => {
        setMobileMenuOpen(false);
        navigate('/workspace');
      },
    },
    {
      id: 'calendar',
      label: 'Event Calendar',
      icon: <CalendarIcon className="w-4 h-4" />,
      onClick: () => {
        setMobileMenuOpen(false);
        navigate('/workspace?view=calendar');
      },
    },
    {
      id: 'templates',
      label: 'Invitation Templates',
      icon: <Layers className="w-4 h-4" />,
      onClick: () => {
        setMobileMenuOpen(false);
        navigate('/templates/manage');
      },
    },
    {
      id: 'settings',
      label: 'Agency Branding',
      icon: <Settings className="w-4 h-4" />,
      onClick: () => {
        setMobileMenuOpen(false);
        navigate('/workspace?view=agency_settings');
      },
    },
    {
      id: 'subscription',
      label: 'Billing & Plan',
      icon: <CreditCard className="w-4 h-4" />,
      onClick: () => {
        setMobileMenuOpen(false);
        navigate('/subscription');
      },
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#FFFFFF] border-r border-[#E6E0D6]">
      {/* Workspace Brand Lockup */}
      <div className="p-4 border-b border-[#EFEAE0] flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded-md bg-[#23201C] text-[#FAF8F4] flex items-center justify-center font-serif font-medium text-xs shrink-0">
            {workspace?.name ? workspace.name.charAt(0).toUpperCase() : 'E'}
          </div>
          <div className="truncate">
            <div className="text-xs font-semibold text-[#23201C] truncate">
              {workspace?.name || 'EventFrame Studio'}
            </div>
            <div className="text-[11px] text-[#7A7368] truncate">
              {workspace?.slug ? `${workspace.slug}.eventframe.io` : 'Agency Workspace'}
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      {onNewEvent && (
        <div className="p-3">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onNewEvent();
            }}
            className="w-full h-8 px-3 text-xs font-medium bg-[#23201C] text-white rounded-lg hover:bg-[#38332D] transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#D8B979]" />
            <span>New Wedding Event</span>
          </button>
        </div>
      )}

      {/* Navigation items */}
      <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
        {eventNav && eventNav.items.length > 0 && (
          <div className="space-y-1">
            <div className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#8B7344] truncate">
              {eventNav.eventName}
            </div>
            <div className="space-y-0.5">
              {eventNav.items.map((item) => {
                const isActive = eventNav.activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      eventNav.onSelectTab(item.id);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-[#FAF5EA] text-[#23201C] font-semibold border border-[#E6D6B0]'
                        : 'text-[#6E6456] hover:text-[#23201C] hover:bg-[#FAF7F0]'
                    }`}
                  >
                    {item.icon && (
                      <span className={isActive ? 'text-[#9A7B38]' : 'text-[#8A8276]'}>
                        {item.icon}
                      </span>
                    )}
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="pt-2 border-b border-[#EFEAE0]" />
          </div>
        )}

        <div className="space-y-0.5">
          {eventNav && (
            <div className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#8A8276]">
              Workspace
            </div>
          )}
          {navItems.map((item) => {
            const isActive = !eventNav && activeItem === item.id;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-[#FAF7F0] text-[#23201C] font-semibold border border-[#E6E0D6]'
                    : 'text-[#70695F] hover:text-[#23201C] hover:bg-[#FAF7F0]'
                }`}
              >
                <span className={isActive ? 'text-[#9A7B38]' : 'text-[#8A8276]'}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* User profile & Logout */}
      <div className="p-3 border-t border-[#EFEAE0] space-y-2">
        <div className="px-2 py-1.5 flex items-center justify-between text-xs text-[#7A7368]">
          <span className="truncate max-w-[140px] font-mono text-[11px]">
            {user?.email || 'Authenticated User'}
          </span>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="text-[#7A7368] hover:text-[#23201C] p-1 rounded hover:bg-[#FAF7F0] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F4] flex flex-col md:flex-row font-sans">
      {/* Desktop & Tablet Sidebar (persistent on lg+, collapsible on md) */}
      <aside
        className={`hidden ${
          tabletSidebarCollapsed ? 'lg:block' : 'md:block'
        } w-60 shrink-0 h-screen sticky top-0 z-20`}
      >
        {sidebarContent}
      </aside>

      {/* Tablet Sidebar Toggle Bar (md only) */}
      <div className="hidden md:flex lg:hidden fixed bottom-4 left-4 z-30">
        <button
          type="button"
          onClick={() => setTabletSidebarCollapsed((v) => !v)}
          className="px-3 py-2 rounded-full bg-white border border-[#DFD8CC] shadow-md text-xs font-medium text-[#23201C] flex items-center gap-1.5 hover:border-[#C9A24D]"
        >
          <Menu className="w-3.5 h-3.5 text-[#9A7B38]" />
          <span>{tabletSidebarCollapsed ? 'Show Menu' : 'Hide Menu'}</span>
        </button>
      </div>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-[#E6E0D6] px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-[#23201C] text-white flex items-center justify-center font-serif font-medium text-xs shrink-0">
            {workspace?.name ? workspace.name.charAt(0).toUpperCase() : 'E'}
          </div>
          <span className="text-xs font-semibold text-[#23201C] truncate">
            {eventNav?.eventName || workspace?.name || 'EventFrame.io'}
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-[#7A7368] hover:text-[#23201C] rounded"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div className="fixed inset-0 bg-black/25" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 max-w-[80vw] h-full z-10">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;

