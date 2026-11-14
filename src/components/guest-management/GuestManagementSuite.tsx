import React, { useState } from 'react';
import { 
  Users, 
  MessageSquare, 
  Grid, 
  Compass, 
  LayoutList,
  Sparkles
} from 'lucide-react';
import { RSVPField } from '../../types';
import GuestListManager from './GuestListManager';
import TableAssignmentManager from './TableAssignmentManager';
import WeddingHallPlanner from './WeddingHallPlanner';
import SeatingOverview from './SeatingOverview';
import RSVPManager from '../RSVPManager';

interface GuestManagementSuiteProps {
  projectId: string;
  rsvpFields?: RSVPField[];
  defaultTab?: 'guests' | 'rsvp' | 'tables' | 'layout' | 'overview';
  openAddGuestSignal?: number;
}

export default function GuestManagementSuite({ 
  projectId, 
  rsvpFields,
  defaultTab = 'guests',
  openAddGuestSignal = 0
}: GuestManagementSuiteProps) {
  const [activeTab, setActiveTab] = useState<'guests' | 'rsvp' | 'tables' | 'layout' | 'overview'>(defaultTab);

  React.useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const navItems = [
    { id: 'guests', label: 'Guest List', icon: Users },
    { id: 'tables', label: 'Table Assignment', icon: Grid },
    { id: 'layout', label: 'Wedding Hall Layout', icon: Compass },
    { id: 'overview', label: 'Seating Overview', icon: LayoutList },
    { id: 'rsvp', label: 'RSVP Responses', icon: MessageSquare }
  ];

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[#E8E8E5] pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                  isActive 
                    ? 'bg-[#252525] text-white shadow-xs font-semibold' 
                    : 'text-[#777777] hover:text-[#252525] hover:bg-[#FAF9F7]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[#8B806F]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#FAF9F7] text-[11px] font-mono text-[#8B806F] border border-[#E8E8E5]">
          <Sparkles className="w-3 h-3 text-[#8B806F]" />
          <span>Integrated Guest & Seating Suite</span>
        </div>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'guests' && (
          <GuestListManager projectId={projectId} openAddGuestSignal={openAddGuestSignal} />
        )}

        {activeTab === 'tables' && (
          <TableAssignmentManager projectId={projectId} />
        )}

        {activeTab === 'layout' && (
          <WeddingHallPlanner projectId={projectId} />
        )}

        {activeTab === 'overview' && (
          <SeatingOverview projectId={projectId} />
        )}

        {activeTab === 'rsvp' && (
          <RSVPManager projectId={projectId} rsvpFields={rsvpFields} />
        )}
      </div>
    </div>
  );
}
