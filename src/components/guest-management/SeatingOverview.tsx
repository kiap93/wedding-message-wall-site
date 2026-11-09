import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Printer, 
  Download, 
  Crown, 
  CircleDot, 
  LayoutList, 
  Grid, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  ExternalLink,
  Utensils
} from 'lucide-react';
import { SeatingTable, Guest, GuestGroup, VenueLayout } from '../../types';
import { 
  fetchEventTables, 
  fetchEventGuests, 
  fetchEventGroups, 
  fetchVenueLayout 
} from '../../lib/guestSeatingApi';
import Button from '../../design-system/components/Button';
import Badge from '../../design-system/components/Badge';

interface SeatingOverviewProps {
  projectId: string;
}

export default function SeatingOverview({ projectId }: SeatingOverviewProps) {
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [groups, setGroups] = useState<GuestGroup[]>([]);
  const [layout, setLayout] = useState<VenueLayout | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [viewMode, setViewMode] = useState<'list' | 'visual'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [tData, gData, grpData, lData] = await Promise.all([
        fetchEventTables(projectId),
        fetchEventGuests(projectId),
        fetchEventGroups(projectId),
        fetchVenueLayout(projectId)
      ]);
      setTables(tData);
      setGuests(gData);
      setGroups(grpData);
      setLayout(lData);
    } catch (err) {
      console.error('Error loading seating overview:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // KPIs
  const confirmedAttendees = guests.filter(g => g.rsvp_status === 'attending');
  const assignedAttendees = guests.filter(g => g.rsvp_status === 'attending' && g.assigned_table_id);
  const unassignedAttendees = guests.filter(g => g.rsvp_status === 'attending' && !g.assigned_table_id);
  const totalCapacity = tables.reduce((acc, t) => acc + t.capacity, 0);
  const fullTables = tables.filter(t => (t.assigned_count || 0) >= t.capacity);

  // Filter tables and their assigned guests
  const filteredTables = tables.map(t => {
    const assigned = t.assigned_guests || [];
    const filteredAssigned = assigned.filter(g => {
      const matchesSearch = 
        t.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.table_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.full_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesGroup = groupFilter === 'all' || g.guest_group_id === groupFilter;
      return matchesSearch && matchesGroup;
    });

    const isMatch = 
      t.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.table_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      filteredAssigned.length > 0;

    return {
      ...t,
      matchedGuests: filteredAssigned,
      isMatch
    };
  }).filter(t => t.isMatch);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Table Number', 'Table Name', 'Seat #', 'Guest Name', 'Group', 'Meal Preference', 'Dietary Notes', 'VIP'];
    const rows: string[][] = [];

    tables.forEach(t => {
      if (!t.assigned_guests || t.assigned_guests.length === 0) {
        rows.push([`"${t.table_number}"`, `"${t.table_name}"`, '—', 'Empty Table', '—', '—', '—', 'No']);
      } else {
        t.assigned_guests.forEach((g, idx) => {
          rows.push([
            `"${t.table_number}"`,
            `"${t.table_name}"`,
            String(idx + 1),
            `"${g.full_name}"`,
            `"${g.guest_group?.group_name || ''}"`,
            `"${g.meal_preference || ''}"`,
            `"${g.dietary_notes || ''}"`,
            g.is_vip ? 'Yes' : 'No'
          ]);
        });
      }
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Wedding_Seating_Chart_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Centralized KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#777777]">Confirmed</div>
          <div className="mt-1 text-2xl font-semibold font-mono text-[#252525]">{confirmedAttendees.length}</div>
          <div className="text-[11px] text-[#888888] mt-0.5">Attending guests</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-700">Assigned</div>
          <div className="mt-1 text-2xl font-semibold font-mono text-emerald-800">{assignedAttendees.length}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Seated at tables</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-rose-700">Unassigned</div>
          <div className="mt-1 text-2xl font-semibold font-mono text-rose-800">{unassignedAttendees.length}</div>
          <div className="text-[11px] text-rose-600 mt-0.5">Need table seats</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#8B806F]">Total Tables</div>
          <div className="mt-1 text-2xl font-semibold font-mono text-[#8B806F]">{tables.length}</div>
          <div className="text-[11px] text-[#888888] mt-0.5">Reception tables</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#777777]">Total Capacity</div>
          <div className="mt-1 text-2xl font-semibold font-mono text-[#252525]">{totalCapacity}</div>
          <div className="text-[11px] text-[#888888] mt-0.5">Available seats</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-stone-500">Full Tables</div>
          <div className="mt-1 text-2xl font-semibold font-mono text-stone-600">{fullTables.length}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">100% capacity</div>
        </div>
      </div>

      {/* Toolbar & View Modes */}
      <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
        {/* Search & Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search guest or table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg text-[#252525] focus:outline-none"
            />
          </div>

          {groups.length > 0 && (
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="h-8 px-2 text-xs bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg text-[#252525]"
            >
              <option value="all">All Groups</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.group_name}</option>
              ))}
            </select>
          )}
        </div>

        {/* View Toggle & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[#FAF9F7] p-0.5 rounded-lg border border-[#E8E8E5]">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === 'list' ? 'bg-white text-[#252525] shadow-xs' : 'text-[#777777] hover:text-[#252525]'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
            <button
              onClick={() => setViewMode('visual')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === 'visual' ? 'bg-white text-[#252525] shadow-xs' : 'text-[#777777] hover:text-[#252525]'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Visual Chart</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            className="!h-8 !text-xs"
          >
            Export CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Printer className="w-3.5 h-3.5" />}
            className="!h-8 !text-xs !bg-[#252525]"
          >
            Print Chart
          </Button>
        </div>
      </div>

      {/* Unassigned Attending Warning Callout */}
      {unassignedAttendees.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>{unassignedAttendees.length} confirmed guests</strong> have not yet been assigned to a reception table.
            </span>
          </div>
          <span className="text-[11px] text-amber-800 font-mono">
            {unassignedAttendees.slice(0, 3).map(g => g.full_name).join(', ')}
            {unassignedAttendees.length > 3 ? ` +${unassignedAttendees.length - 3} more` : ''}
          </span>
        </div>
      )}

      {/* Printable Header (Visible only when printing) */}
      <div className="hidden print:block text-center pb-6 border-b border-stone-300">
        <h1 className="text-2xl font-serif font-bold text-stone-900">Official Wedding Seating Chart</h1>
        <p className="text-xs text-stone-600 mt-1">Reception Hall Seating Plan & Guest Directory</p>
      </div>

      {/* Mode 1: Table-by-Table List View */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTables.length === 0 ? (
            <div className="col-span-3 p-12 text-center bg-white rounded-xl border border-[#E8E8E5] text-stone-400">
              No tables match your search query.
            </div>
          ) : (
            filteredTables.map((table) => {
              const assigned = table.matchedGuests || table.assigned_guests || [];
              const isFull = (table.assigned_count || 0) >= table.capacity;

              return (
                <div 
                  key={table.id}
                  className="bg-white rounded-xl border border-[#E8E8E5] shadow-subtle p-5 flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#EFEFEA]">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8B806F] block">
                          Table {table.table_number}
                        </span>
                        <h4 className="text-sm font-semibold text-[#252525]">
                          {table.table_name}
                        </h4>
                      </div>

                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-medium ${
                        isFull 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {table.assigned_count || 0} / {table.capacity}
                      </span>
                    </div>

                    {/* Guests Roster */}
                    <div className="mt-3 space-y-2">
                      {assigned.length === 0 ? (
                        <div className="p-4 text-center text-xs text-stone-400 italic">
                          No guests assigned to this table yet.
                        </div>
                      ) : (
                        assigned.map((guest, idx) => (
                          <div 
                            key={guest.id}
                            className="p-2 rounded-md bg-[#FAF9F7] border border-[#E8E8E5] flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] font-mono text-[#888888] w-4">
                                #{idx + 1}
                              </span>
                              <span className="font-medium text-[#252525] truncate">
                                {guest.full_name}
                              </span>
                              {guest.is_vip && (
                                <Crown className="w-3 h-3 text-amber-600 fill-current shrink-0" />
                              )}
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-[#777777] shrink-0">
                              {guest.meal_preference && (
                                <span className="bg-white px-1.5 py-0.5 rounded border border-[#E8E8E5]">
                                  {guest.meal_preference}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Table Category & Notes */}
                  {table.category && (
                    <div className="mt-4 pt-2.5 border-t border-[#EFEFEA] text-[11px] text-[#777777] flex justify-between">
                      <span>Category: {table.category}</span>
                      <span className="capitalize">{table.table_type}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Mode 2: Visual Floor Overview */}
      {viewMode === 'visual' && (
        <div className="bg-white rounded-xl border border-[#E8E8E5] shadow-subtle p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#252525]">Visual Wedding Hall Blueprint</h3>
            <span className="text-xs text-[#777777] font-mono">
              {tables.length} Tables • {totalCapacity} Seats Capacity
            </span>
          </div>

          {/* Scaled Visual Grid representation of venue */}
          <div className="border border-[#E8E8E5] rounded-xl p-8 bg-[#FAF9F7] min-h-[500px] flex flex-col justify-between items-center relative overflow-hidden">
            {/* Stage */}
            <div className="w-3/5 h-16 bg-[#252525] text-white rounded-lg flex items-center justify-center text-xs font-semibold uppercase tracking-widest shadow-md">
              ★ Main Stage & Altar ★
            </div>

            {/* Central Area: Tables */}
            <div className="my-8 w-full max-w-4xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {tables.map(tbl => {
                const isFull = (tbl.assigned_count || 0) >= tbl.capacity;
                return (
                  <div
                    key={tbl.id}
                    className={`p-4 rounded-xl border text-center transition-all shadow-xs flex flex-col items-center justify-center ${
                      isFull 
                        ? 'bg-white border-stone-300' 
                        : 'bg-white border-[#E8E8E5] hover:border-[#8B806F]'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-full border-2 border-[#8B806F] bg-[#FAF9F7] flex flex-col items-center justify-center shadow-inner mb-2">
                      <span className="text-xs font-bold font-mono text-[#252525]">T{tbl.table_number}</span>
                      <span className={`text-[10px] font-mono font-medium ${isFull ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {tbl.assigned_count || 0}/{tbl.capacity}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-[#252525] truncate max-w-[120px]">
                      {tbl.table_name}
                    </div>
                    {tbl.category && (
                      <span className="text-[10px] text-[#777777] mt-0.5">{tbl.category}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Entrance */}
            <div className="w-2/5 h-10 bg-[#8B806F] text-white rounded-lg flex items-center justify-center text-xs font-medium uppercase tracking-wider shadow-sm">
              Grand Hall Entrance
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
