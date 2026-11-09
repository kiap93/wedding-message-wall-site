import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Crown, 
  Users, 
  X, 
  ArrowRight, 
  Check, 
  AlertCircle, 
  CircleDot, 
  Square, 
  RectangleHorizontal, 
  MoreHorizontal,
  ChevronRight,
  UserCheck,
  UserX,
  Clock,
  Sparkles,
  Copy
} from 'lucide-react';
import { Guest, GuestGroup, SeatingTable, TableType } from '../../types';
import { 
  fetchEventGuests, 
  fetchEventGroups, 
  fetchEventTables, 
  createEventTable, 
  updateEventTable, 
  deleteEventTable, 
  assignGuestToTable, 
  unassignGuest,
  assignGroupToTable
} from '../../lib/guestSeatingApi';
import Button from '../../design-system/components/Button';
import Badge from '../../design-system/components/Badge';
import Input from '../../design-system/components/Input';
import Modal from '../../design-system/components/Modal';

interface TableAssignmentManagerProps {
  projectId: string;
}

export default function TableAssignmentManager({ projectId }: TableAssignmentManagerProps) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [groups, setGroups] = useState<GuestGroup[]>([]);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Left Panel filters
  const [searchGuestQuery, setSearchGuestQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'unassigned' | 'attending' | 'all'>('unassigned');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  // Drag and Drop State
  const [draggedGuestId, setDraggedGuestId] = useState<string | null>(null);
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);

  // Table Modal
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<SeatingTable | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [tableName, setTableName] = useState('');
  const [tableType, setTableType] = useState<TableType>('round');
  const [tableCapacity, setTableCapacity] = useState<number>(10);
  const [tableCategory, setTableCategory] = useState('General');
  const [tableNotes, setTableNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick accessible assignment modal/dropdown
  const [quickAssignGuest, setQuickAssignGuest] = useState<Guest | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [gData, grpData, tData] = await Promise.all([
        fetchEventGuests(projectId),
        fetchEventGroups(projectId),
        fetchEventTables(projectId)
      ]);
      setGuests(gData);
      setGroups(grpData);
      setTables(tData);
    } catch (err) {
      console.error('Error loading seating data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter guests for Left Panel
  const displayedGuests = guests.filter(g => {
    // Declined guests can NEVER be assigned to seats
    if (g.rsvp_status === 'declined') return false;

    const matchesSearch = 
      g.full_name.toLowerCase().includes(searchGuestQuery.toLowerCase()) ||
      (g.email && g.email.toLowerCase().includes(searchGuestQuery.toLowerCase()));

    const matchesFilter = 
      filterMode === 'all' ? true :
      filterMode === 'unassigned' ? !g.assigned_table_id :
      g.rsvp_status === 'attending';

    const matchesGroup = selectedGroupId === 'all' || g.guest_group_id === selectedGroupId;

    return matchesSearch && matchesFilter && matchesGroup;
  });

  // Table KPIs
  const totalCapacity = tables.reduce((acc, t) => acc + t.capacity, 0);
  const totalAssignedSeats = tables.reduce((acc, t) => acc + (t.assigned_count || 0), 0);
  const totalAttending = guests.filter(g => g.rsvp_status === 'attending').length;
  const fullTablesCount = tables.filter(t => (t.assigned_count || 0) >= t.capacity).length;

  const handleOpenTableModal = (table?: SeatingTable) => {
    if (table) {
      setEditingTable(table);
      setTableNumber(table.table_number);
      setTableName(table.table_name);
      setTableType(table.table_type);
      setTableCapacity(table.capacity);
      setTableCategory(table.category || 'General');
      setTableNotes(table.notes || '');
    } else {
      setEditingTable(null);
      const nextNum = String(tables.length + 1);
      setTableNumber(nextNum);
      setTableName(`Table ${nextNum}`);
      setTableType('round');
      setTableCapacity(10);
      setTableCategory('General');
      setTableNotes('');
    }
    setIsTableModalOpen(true);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim() || !tableNumber.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: Partial<SeatingTable> = {
        table_number: tableNumber.trim(),
        table_name: tableName.trim(),
        table_type: tableType,
        capacity: tableCapacity,
        category: tableCategory.trim() || 'General',
        notes: tableNotes.trim() || ''
      };

      if (editingTable) {
        await updateEventTable(projectId, editingTable.id, payload);
      } else {
        await createEventTable(projectId, payload);
      }

      await loadData();
      setIsTableModalOpen(false);
    } catch (err: any) {
      alert('Error saving table: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTable = async (table: SeatingTable) => {
    if (!window.confirm(`Delete "${table.table_name}"? Assigned guests will become unassigned and remain in your guest list.`)) return;
    try {
      await deleteEventTable(projectId, table.id);
      await loadData();
    } catch (err: any) {
      alert('Error deleting table: ' + err.message);
    }
  };

  const handleDuplicateTable = async (table: SeatingTable) => {
    try {
      const nextNum = `${table.table_number}-B`;
      await createEventTable(projectId, {
        table_number: nextNum,
        table_name: `${table.table_name} (Copy)`,
        table_type: table.table_type,
        capacity: table.capacity,
        category: table.category
      });
      await loadData();
    } catch (err: any) {
      alert('Error duplicating table: ' + err.message);
    }
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, guestId: string) => {
    e.dataTransfer.setData('text/plain', guestId);
    setDraggedGuestId(guestId);
  };

  const handleDragOver = (e: React.DragEvent, tableId: string) => {
    e.preventDefault();
    setDragOverTableId(tableId);
  };

  const handleDragLeave = () => {
    setDragOverTableId(null);
  };

  const handleDrop = async (e: React.DragEvent, tableId: string) => {
    e.preventDefault();
    setDragOverTableId(null);
    const guestId = e.dataTransfer.getData('text/plain') || draggedGuestId;
    if (!guestId) return;

    try {
      await assignGuestToTable(projectId, tableId, guestId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Could not assign guest');
    } finally {
      setDraggedGuestId(null);
    }
  };

  const handleUnassignGuest = async (guestId: string) => {
    try {
      await unassignGuest(projectId, guestId);
      await loadData();
    } catch (err: any) {
      alert('Error unassigning guest: ' + err.message);
    }
  };

  const handleAssignEntireGroup = async (groupId: string, tableId: string) => {
    try {
      const res = await assignGroupToTable(projectId, tableId, groupId);
      await loadData();
      alert(`Successfully assigned ${res.assignedCount} guests to table.`);
    } catch (err: any) {
      alert(err.message || 'Error assigning group');
    }
  };

  const renderTableShapeIcon = (type: TableType) => {
    switch (type) {
      case 'rectangular': return <RectangleHorizontal className="w-4 h-4 text-[#8B806F]" />;
      case 'square': return <Square className="w-3.5 h-3.5 text-[#8B806F]" />;
      default: return <CircleDot className="w-4 h-4 text-[#8B806F]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Capacity & Occupancy KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#777777]">Total Tables</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono text-[#252525]">{tables.length}</div>
          <div className="text-[11px] text-[#888888] mt-0.5">{fullTablesCount} tables at full capacity</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#8B806F]">Seating Capacity</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono text-[#8B806F]">{totalCapacity}</div>
          <div className="text-[11px] text-[#888888] mt-0.5">Total banquet seats</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-700">Assigned Guests</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono text-emerald-800">{totalAssignedSeats}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">
            {totalCapacity > 0 ? `${Math.round((totalAssignedSeats / totalCapacity) * 100)}% occupied` : '0%'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-rose-700">Seats Remaining</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono text-rose-800">
            {Math.max(0, totalCapacity - totalAssignedSeats)}
          </div>
          <div className="text-[11px] text-rose-600 mt-0.5">
            {totalAttending - totalAssignedSeats > 0 ? `${totalAttending - totalAssignedSeats} attending need seats` : 'All attending seated'}
          </div>
        </div>
      </div>

      {/* Dual Panel Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Guest Queue (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-[#E8E8E5] shadow-subtle overflow-hidden flex flex-col h-[750px]">
          {/* Left Panel Header */}
          <div className="p-4 border-b border-[#E8E8E5] bg-[#FAF9F7] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-xs text-[#252525]">
                <Users className="w-4 h-4 text-[#8B806F]" />
                <span>Guest Roster</span>
                <span className="text-[11px] font-mono text-[#777777] bg-white px-1.5 py-0.2 rounded border border-[#E8E8E5]">
                  {displayedGuests.length}
                </span>
              </div>
              <span className="text-[10px] text-[#888888] font-mono">Drag guest to table →</span>
            </div>

            {/* Guest Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#888888] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search guests..."
                value={searchGuestQuery}
                onChange={(e) => setSearchGuestQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 text-xs bg-white text-[#252525] placeholder:text-[#999999] border border-[#E8E8E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-[#EFEFEA] p-0.5 rounded-md text-[11px]">
              <button
                onClick={() => setFilterMode('unassigned')}
                className={`flex-1 py-1 font-medium rounded transition-colors ${
                  filterMode === 'unassigned' ? 'bg-white text-[#252525] shadow-xs' : 'text-[#777777] hover:text-[#252525]'
                }`}
              >
                Unassigned
              </button>
              <button
                onClick={() => setFilterMode('attending')}
                className={`flex-1 py-1 font-medium rounded transition-colors ${
                  filterMode === 'attending' ? 'bg-white text-[#252525] shadow-xs' : 'text-[#777777] hover:text-[#252525]'
                }`}
              >
                Attending
              </button>
              <button
                onClick={() => setFilterMode('all')}
                className={`flex-1 py-1 font-medium rounded transition-colors ${
                  filterMode === 'all' ? 'bg-white text-[#252525] shadow-xs' : 'text-[#777777] hover:text-[#252525]'
                }`}
              >
                All
              </button>
            </div>

            {/* Group Filter */}
            {groups.length > 0 && (
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full h-7 px-2 text-[11px] bg-white border border-[#E8E8E5] rounded text-[#252525] focus:outline-none"
              >
                <option value="all">All Groups</option>
                {groups.map(grp => (
                  <option key={grp.id} value={grp.id}>{grp.group_name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Draggable Guest List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y-0">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-[#777777]">Loading guest roster...</div>
            ) : displayedGuests.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#888888] space-y-1">
                <p>No guests match this view.</p>
                {filterMode === 'unassigned' && (
                  <p className="text-[11px] text-emerald-600 font-medium">All eligible guests are seated!</p>
                )}
              </div>
            ) : (
              displayedGuests.map((guest) => {
                const isAssigned = Boolean(guest.assigned_table_id);

                return (
                  <div
                    key={guest.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, guest.id)}
                    className={`p-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing hover:shadow-xs ${
                      isAssigned 
                        ? 'bg-[#FAF9F7]/70 border-[#E8E8E5]' 
                        : 'bg-white border-[#E8E8E5] hover:border-[#8B806F]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-medium text-[#252525] truncate">
                          {guest.full_name}
                        </span>
                        {guest.is_vip && (
                          <span title="VIP Guest">
                            <Crown className="w-3 h-3 text-amber-600 fill-current shrink-0" />
                          </span>
                        )}
                        {guest.is_plus_one && (
                          <span className="text-[10px] text-[#888888] font-mono shrink-0">+1</span>
                        )}
                      </div>

                      {/* Accessible Assign Button */}
                      <button
                        onClick={() => setQuickAssignGuest(guest)}
                        className="text-[10px] text-[#8B806F] hover:text-[#252525] px-1.5 py-0.5 rounded border border-[#E8E8E5] hover:bg-[#FAF9F7]"
                        title="Assign to table without dragging"
                      >
                        {isAssigned ? 'Move' : 'Assign'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1 text-[11px] flex-wrap">
                      {guest.guest_group && (
                        <span 
                          className="px-1.5 py-0.2 rounded text-[10px] font-medium"
                          style={{
                            backgroundColor: `${guest.guest_group.color || '#8B806F'}15`,
                            color: guest.guest_group.color || '#252525'
                          }}
                        >
                          {guest.guest_group.group_name}
                        </span>
                      )}

                      {guest.rsvp_status === 'pending' && (
                        <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded text-[10px] border border-amber-200">
                          Pending RSVP
                        </span>
                      )}

                      {guest.meal_preference && (
                        <span className="text-[#888888] text-[10px] truncate max-w-[120px]">
                          • {guest.meal_preference}
                        </span>
                      )}
                    </div>

                    {isAssigned && (
                      <div className="mt-1.5 text-[10px] text-emerald-800 bg-emerald-50/70 px-2 py-0.5 rounded border border-emerald-200/60 flex items-center justify-between">
                        <span className="truncate">Seated at: {guest.assigned_table_name}</span>
                        <button
                          onClick={() => handleUnassignGuest(guest.id)}
                          className="text-stone-400 hover:text-rose-600 ml-1"
                          title="Unassign"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Group Assignment Footer */}
          {groups.length > 0 && tables.length > 0 && (
            <div className="p-3 bg-[#FAF9F7] border-t border-[#E8E8E5] text-xs space-y-2">
              <div className="text-[11px] font-semibold text-[#252525]">Quick Group Assignment</div>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  id="batch_grp_select"
                  className="h-7 px-1.5 text-[11px] bg-white border border-[#E8E8E5] rounded text-[#252525]"
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.group_name}</option>
                  ))}
                </select>

                <select
                  id="batch_tbl_select"
                  className="h-7 px-1.5 text-[11px] bg-white border border-[#E8E8E5] rounded text-[#252525]"
                >
                  {tables.map(t => (
                    <option key={t.id} value={t.id}>T{t.table_number}: {t.table_name}</option>
                  ))}
                </select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const gSelect = document.getElementById('batch_grp_select') as HTMLSelectElement;
                  const tSelect = document.getElementById('batch_tbl_select') as HTMLSelectElement;
                  if (gSelect && tSelect) {
                    handleAssignEntireGroup(gSelect.value, tSelect.value);
                  }
                }}
                className="w-full !h-7 !text-[11px]"
              >
                Assign Entire Group to Table
              </Button>
            </div>
          )}
        </div>

        {/* MAIN PANEL: Reception Tables (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#252525]">Reception Tables & Seating</h3>
              <p className="text-xs text-[#777777]">
                Drop guests onto tables below. Tables enforce seating limits automatically.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenTableModal()}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="!bg-[#252525]"
            >
              Add Table
            </Button>
          </div>

          {/* Table Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tables.length === 0 ? (
              <div className="col-span-2 p-12 text-center bg-white rounded-xl border border-[#E8E8E5] shadow-subtle space-y-3">
                <CircleDot className="w-8 h-8 text-stone-300 mx-auto" />
                <h4 className="text-sm font-medium text-[#252525]">No Reception Tables Created</h4>
                <p className="text-xs text-[#777777] max-w-sm mx-auto">
                  Create your first round or rectangular table to begin assigning seats.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenTableModal()}
                  className="!bg-[#252525]"
                >
                  Create Table 01
                </Button>
              </div>
            ) : (
              tables.map((table) => {
                const assigned = table.assigned_guests || [];
                const isFull = (table.assigned_count || 0) >= table.capacity;
                const isDragOver = dragOverTableId === table.id;
                const occupancyPercent = Math.min(100, Math.round(((table.assigned_count || 0) / table.capacity) * 100));

                return (
                  <div
                    key={table.id}
                    onDragOver={(e) => handleDragOver(e, table.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, table.id)}
                    className={`bg-white rounded-xl border transition-all p-4 flex flex-col justify-between shadow-subtle min-h-[300px] ${
                      isDragOver 
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' 
                        : isFull 
                          ? 'border-stone-300' 
                          : 'border-[#E8E8E5] hover:border-[#D4D4CE]'
                    }`}
                  >
                    <div>
                      {/* Top Bar of Table Card */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          {renderTableShapeIcon(table.table_type)}
                          <span className="text-[11px] font-mono font-bold text-[#252525]">
                            TABLE {table.table_number}
                          </span>
                          {table.category && (
                            <span className="text-[10px] text-[#777777] bg-[#FAF9F7] px-1.5 py-0.5 rounded border border-[#E8E8E5]">
                              {table.category}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDuplicateTable(table)}
                            className="p-1 text-[#777777] hover:text-[#252525] rounded transition-colors"
                            title="Duplicate table structure"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenTableModal(table)}
                            className="p-1 text-[#777777] hover:text-[#252525] rounded transition-colors"
                            title="Edit Table Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTable(table)}
                            className="p-1 text-[#777777] hover:text-rose-600 rounded transition-colors"
                            title="Delete Table"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Table Title & Occupancy Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-[#252525] truncate">
                          {table.table_name}
                        </h4>
                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-medium ${
                          isFull 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {table.assigned_count || 0} / {table.capacity} Seats
                        </span>
                      </div>

                      {/* Progress Occupancy Bar */}
                      <div className="w-full bg-[#EFEFEA] h-1.5 rounded-full mt-2.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            isFull ? 'bg-rose-600' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${occupancyPercent}%` }}
                        />
                      </div>

                      {/* Assigned Guests List Inside Table */}
                      <div className="mt-3.5 space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                        {assigned.length === 0 ? (
                          <div className="p-5 text-center text-xs text-stone-400 border border-dashed border-[#E8E8E5] rounded-lg bg-[#FAF9F7]/50">
                            Drop guests here or use the Assign button
                          </div>
                        ) : (
                          assigned.map((guest, idx) => (
                            <div 
                              key={guest.id}
                              className="px-2.5 py-1.5 bg-[#FAF9F7] rounded-md border border-[#E8E8E5] flex items-center justify-between gap-2 text-xs hover:bg-[#F2EFE9] transition-colors"
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

                              <button
                                onClick={() => handleUnassignGuest(guest.id)}
                                className="p-0.5 text-stone-400 hover:text-rose-600 transition-colors"
                                title="Remove from table"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Table Footer */}
                    <div className="pt-3 mt-3 border-t border-[#EFEFEA] flex items-center justify-between text-[11px] text-[#777777]">
                      <span className="capitalize">
                        {table.table_type} • {table.capacity} max
                      </span>
                      <span className={table.remaining_seats === 0 ? 'text-rose-600 font-medium' : 'text-emerald-700'}>
                        {table.remaining_seats} seats left
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Table Add / Edit Modal */}
      <Modal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        title={editingTable ? "Edit Reception Table" : "Add Reception Table"}
      >
        <form onSubmit={handleSaveTable} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Table Number *"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="e.g. 1, 2, or Head Table"
              required
            />
            <Input
              label="Table Name / Description *"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. Bride Family & Close Relatives"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[#777777] block mb-1">Table Shape</label>
              <select
                value={tableType}
                onChange={(e) => setTableType(e.target.value as TableType)}
                className="w-full h-9 px-3 text-xs bg-white text-[#252525] border border-[#E8E8E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
              >
                <option value="round">Round Banquet Table</option>
                <option value="rectangular">Rectangular Table</option>
                <option value="square">Square Table</option>
                <option value="custom">Custom Table</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-[#777777] block mb-1">Seating Capacity *</label>
              <input
                type="number"
                min="2"
                max="30"
                value={tableCapacity}
                onChange={(e) => setTableCapacity(Math.max(2, parseInt(e.target.value) || 2))}
                className="w-full h-9 px-3 text-xs bg-white text-[#252525] border border-[#E8E8E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
                required
              />
            </div>

            <div>
              <label className="text-xs text-[#777777] block mb-1">Category / Grouping</label>
              <input
                type="text"
                value={tableCategory}
                onChange={(e) => setTableCategory(e.target.value)}
                placeholder="Family, Friends, VIP"
                className="w-full h-9 px-3 text-xs bg-white text-[#252525] border border-[#E8E8E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
              />
            </div>
          </div>

          <Input
            label="Internal Notes (Optional)"
            value={tableNotes}
            onChange={(e) => setTableNotes(e.target.value)}
            placeholder="e.g. Near dance floor and audio speakers"
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-[#E8E8E5]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTableModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              className="!bg-[#252525]"
            >
              {editingTable ? "Save Changes" : "Create Table"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Accessible Quick Assign Modal */}
      <Modal
        isOpen={Boolean(quickAssignGuest)}
        onClose={() => setQuickAssignGuest(null)}
        title={`Assign ${quickAssignGuest?.full_name || 'Guest'} to Table`}
      >
        <div className="space-y-4">
          <p className="text-xs text-[#777777]">
            Select an available table from the list below. Capacity limits are enforced.
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {quickAssignGuest?.assigned_table_id && (
              <button
                onClick={async () => {
                  if (quickAssignGuest) {
                    await handleUnassignGuest(quickAssignGuest.id);
                    setQuickAssignGuest(null);
                  }
                }}
                className="w-full p-2.5 text-left text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors flex items-center justify-between font-medium"
              >
                <span>Remove current table assignment (make unassigned)</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {tables.map(tbl => {
              const isCurrent = quickAssignGuest?.assigned_table_id === tbl.id;
              const isFull = (tbl.assigned_count || 0) >= tbl.capacity && !isCurrent;

              return (
                <button
                  key={tbl.id}
                  disabled={isFull}
                  onClick={async () => {
                    if (quickAssignGuest) {
                      try {
                        await assignGuestToTable(projectId, tbl.id, quickAssignGuest.id);
                        await loadData();
                        setQuickAssignGuest(null);
                      } catch (err: any) {
                        alert(err.message || 'Could not assign guest');
                      }
                    }
                  }}
                  className={`w-full p-3 rounded-lg border text-left text-xs transition-colors flex items-center justify-between ${
                    isCurrent 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' 
                      : isFull 
                        ? 'bg-[#FAF9F7] border-[#E8E8E5] text-stone-400 cursor-not-allowed opacity-60' 
                        : 'bg-white border-[#E8E8E5] hover:border-[#8B806F] text-[#252525]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {renderTableShapeIcon(tbl.table_type)}
                    <div>
                      <span className="font-medium">Table {tbl.table_number}: {tbl.table_name}</span>
                      {tbl.category && <span className="text-[10px] text-[#777777] ml-2">({tbl.category})</span>}
                    </div>
                  </div>

                  <span className={`text-[11px] font-mono ${isFull ? 'text-rose-600' : 'text-stone-500'}`}>
                    {tbl.assigned_count || 0}/{tbl.capacity} {isFull ? 'Full' : 'Seats'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-2 border-t border-[#E8E8E5]">
            <Button variant="outline" size="sm" onClick={() => setQuickAssignGuest(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
