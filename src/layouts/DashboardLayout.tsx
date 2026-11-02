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

export interface DashboardLayoutProps {
  children: React.ReactNode;
  activeItem?: 'events' | 'calendar' | 'templates' | 'settings' | 'subscription';
  onNewEvent?: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeItem = 'events',
  onNewEvent,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { workspace } = useWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="flex flex-col h-full bg-[#FFFFFF] border-r border-[#E8E8E5]">
      {/* Workspace Brand Lockup */}
      <div className="p-4 border-b border-[#E8E8E5] flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded-md bg-[#252525] text-white flex items-center justify-center font-medium text-xs shrink-0">
            {workspace?.name ? workspace.name.charAt(0).toUpperCase() : 'E'}
          </div>
          <div className="truncate">
            <div className="text-xs font-semibold text-[#252525] truncate">
              {workspace?.name || 'EventFrame Studio'}
            </div>
            <div className="text-[11px] text-[#777777] truncate">
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
            className="w-full h-8 px-3 text-xs font-medium bg-[#252525] text-white rounded-md hover:bg-[#383838] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Wedding Event</span>
          </button>
        </div>
      )}

      {/* Navigation items */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                isActive
                  ? 'bg-[#FAF9F7] text-[#252525] font-semibold border border-[#E8E8E5]'
                  : 'text-[#777777] hover:text-[#252525] hover:bg-[#FAF9F7]'
              }`}
            >
              <span className={isActive ? 'text-[#8B806F]' : 'text-[#777777]'}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User profile & Logout */}
      <div className="p-3 border-t border-[#E8E8E5] space-y-2">
        <div className="px-2 py-1.5 flex items-center justify-between text-xs text-[#777777]">
          <span className="truncate max-w-[140px] font-mono text-[11px]">{user?.email || 'Authenticated User'}</span>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="text-[#777777] hover:text-[#252525] p-1 rounded hover:bg-[#FAF9F7] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col md:flex-row font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-60 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-[#E8E8E5] px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#252525] text-white flex items-center justify-center font-medium text-xs">
            {workspace?.name ? workspace.name.charAt(0).toUpperCase() : 'E'}
          </div>
          <span className="text-xs font-semibold text-[#252525] truncate">
            {workspace?.name || 'EventFrame.io'}
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-[#777777] hover:text-[#252525] rounded"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div className="fixed inset-0 bg-black/20" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 max-w-[80vw] h-full z-10">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
