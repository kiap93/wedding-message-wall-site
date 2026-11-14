import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Trash2, 
  Edit3, 
  Crown, 
  Check, 
  X, 
  FolderPlus, 
  MoreHorizontal, 
  Clock, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  Utensils,
  Share2,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { Guest, GuestGroup, GuestRSVPStatus, SeatingTable } from '../../types';
import { 
  fetchEventGuests, 
  createEventGuest, 
  updateEventGuest, 
  deleteEventGuest, 
  bulkUpdateGuests, 
  importGuests,
  fetchEventGroups,
  createEventGroup,
  deleteEventGroup,
  fetchEventTables,
  assignGuestToTable,
  unassignGuest
} from '../../lib/guestSeatingApi';
import Button from '../../design-system/components/Button';
import Badge from '../../design-system/components/Badge';
import Input from '../../design-system/components/Input';
import Modal from '../../design-system/components/Modal';

interface GuestListManagerProps {
  projectId: string;
  openAddGuestSignal?: number;
}

export default function GuestListManager({ projectId, openAddGuestSignal = 0 }: GuestListManagerProps) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [groups, setGroups] = useState<GuestGroup[]>([]);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | GuestRSVPStatus>('all');
  const [seatingFilter, setSeatingFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStatus, setFormStatus] = useState<GuestRSVPStatus>('attending');
  const [formPax, setFormPax] = useState<number>(1);
  const [formGroupId, setFormGroupId] = useState<string>('');
  const [formMeal, setFormMeal] = useState('');
  const [formDietary, setFormDietary] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsVip, setFormIsVip] = useState(false);

  // New group form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#8B806F');

  // CSV Import raw text
  const [csvText, setCsvText] = useState('');

  useEffect(() => {
    loadAllData();
  }, [projectId]);

  useEffect(() => {
    if (openAddGuestSignal > 0) {
      handleOpenAddModal();
    }
  }, [openAddGuestSignal]);

  async function loadAllData() {
    setIsLoading(true);
    try {
      const [loadedGuests, loadedGroups, loadedTables] = await Promise.all([
        fetchEventGuests(projectId),
        fetchEventGroups(projectId),
        fetchEventTables(projectId)
      ]);
      setGuests(loadedGuests);
      setGroups(loadedGroups);
      setTables(loadedTables);
    } catch (err) {
      console.error('Error loading guest data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Calculate KPIs
  const totalGuests = guests.length;
  const confirmedGuests = guests.filter(g => g.rsvp_status === 'attending').length;
  const pendingGuests = guests.filter(g => g.rsvp_status === 'pending').length;
  const declinedGuests = guests.filter(g => g.rsvp_status === 'declined').length;
  const assignedGuests = guests.filter(g => Boolean(g.assigned_table_id)).length;
  const unassignedAttending = guests.filter(g => g.rsvp_status === 'attending' && !g.assigned_table_id).length;

  // Filtered List
  const filteredGuests = guests.filter(g => {
    const matchesSearch = 
      g.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.email && g.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (g.phone && g.phone.includes(searchQuery)) ||
      (g.assigned_table_name && g.assigned_table_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || g.rsvp_status === statusFilter;

    const matchesSeating = 
      seatingFilter === 'all' ||
      (seatingFilter === 'assigned' && Boolean(g.assigned_table_id)) ||
      (seatingFilter === 'unassigned' && !g.assigned_table_id);

    const matchesGroup = groupFilter === 'all' || g.guest_group_id === groupFilter;

    return matchesSearch && matchesStatus && matchesSeating && matchesGroup;
  });

  const handleOpenAddModal = () => {
    setEditingGuest(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormStatus('attending');
    setFormPax(1);
    setFormGroupId('');
    setFormMeal('');
    setFormDietary('');
    setFormNotes('');
    setFormIsVip(false);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (guest: Guest) => {
    setEditingGuest(guest);
    setFormName(guest.full_name);
    setFormEmail(guest.email || '');
    setFormPhone(guest.phone || '');
    setFormStatus(guest.rsvp_status);
    setFormPax(guest.pax || 1);
    setFormGroupId(guest.guest_group_id || '');
    setFormMeal(guest.meal_preference || '');
    setFormDietary(guest.dietary_notes || '');
    setFormNotes(guest.notes || '');
    setFormIsVip(Boolean(guest.is_vip));
    setIsAddModalOpen(true);
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: Partial<Guest> = {
        full_name: formName.trim(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        rsvp_status: formStatus,
        pax: formPax,
        guest_group_id: formGroupId || null,
        meal_preference: formMeal.trim() || undefined,
        dietary_notes: formDietary.trim() || undefined,
        notes: formNotes.trim() || undefined,
        is_vip: formIsVip
      };

      if (editingGuest) {
        await updateEventGuest(projectId, editingGuest.id, payload);
      } else {
        await createEventGuest(projectId, payload);
      }

      await loadAllData();
      setIsAddModalOpen(false);
    } catch (err: any) {
      alert('Error saving guest: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGuest = async (guestId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from the guest list?`)) return;
    try {
      await deleteEventGuest(projectId, guestId);
      await loadAllData();
      setSelectedGuestIds(prev => prev.filter(id => id !== guestId));
    } catch (err: any) {
      alert('Error deleting guest: ' + err.message);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedGuestIds(filteredGuests.map(g => g.id));
    } else {
      setSelectedGuestIds([]);
    }
  };

  const handleToggleSelect = (guestId: string) => {
    setSelectedGuestIds(prev => 
      prev.includes(guestId) ? prev.filter(id => id !== guestId) : [...prev, guestId]
    );
  };

  const handleBulkAction = async (action: 'delete' | 'mark_attending' | 'mark_declined' | 'set_group' | 'toggle_vip', extra?: any) => {
    if (selectedGuestIds.length === 0) return;
    if (action === 'delete' && !window.confirm(`Are you sure you want to delete ${selectedGuestIds.length} selected guests?`)) return;

    try {
      let rsvpStatus: string | undefined;
      if (action === 'mark_attending') rsvpStatus = 'attending';
      if (action === 'mark_declined') rsvpStatus = 'declined';

      const op = action === 'mark_attending' || action === 'mark_declined' ? 'set_status' : action;
      await bulkUpdateGuests(projectId, op as any, selectedGuestIds, {
        rsvpStatus,
        groupId: extra?.groupId,
        isVip: extra?.isVip
      });
      await loadAllData();
      setSelectedGuestIds([]);
    } catch (err: any) {
      alert('Error during bulk action: ' + err.message);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      await createEventGroup(projectId, {
        group_name: newGroupName.trim(),
        color: newGroupColor
      });
      setNewGroupName('');
      const updatedGroups = await fetchEventGroups(projectId);
      setGroups(updatedGroups);
    } catch (err: any) {
      alert('Error creating group: ' + err.message);
    }
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!window.confirm(`Delete group "${name}"? Members will become ungrouped.`)) return;
    try {
      await deleteEventGroup(projectId, groupId);
      const updatedGroups = await fetchEventGroups(projectId);
      setGroups(updatedGroups);
      await loadAllData();
    } catch (err: any) {
      alert('Error deleting group: ' + err.message);
    }
  };

  const handleQuickTableAssign = async (guestId: string, tableId: string) => {
    try {
      if (tableId === 'unassigned') {
        await unassignGuest(projectId, guestId);
      } else {
        await assignGuestToTable(projectId, tableId, guestId);
      }
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to update table assignment');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Full Name', 'RSVP Status', 'Pax', 'Group', 'Assigned Table', 'Email', 'Phone', 'Meal Preference', 'Dietary Notes', 'VIP'];
    const rows = guests.map(g => [
      `"${g.full_name}"`,
      `"${g.rsvp_status}"`,
      g.pax || 1,
      `"${g.guest_group?.group_name || ''}"`,
      `"${g.assigned_table_name ? `Table ${g.assigned_table_number || ''}: ${g.assigned_table_name}` : 'Unassigned'}"`,
      `"${g.email || ''}"`,
      `"${g.phone || ''}"`,
      `"${g.meal_preference || ''}"`,
      `"${g.dietary_notes || ''}"`,
      g.is_vip ? 'Yes' : 'No'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Wedding_Guest_List_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProcessImportCSV = async () => {
    if (!csvText.trim()) return;
    setIsSubmitting(true);
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length <= 1) throw new Error('CSV is empty or missing data rows.');

      // Check header
      const parsed: Array<Partial<Guest>> = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
        if (cols[0]) {
          parsed.push({
            full_name: cols[0],
            rsvp_status: (cols[1]?.toLowerCase() === 'attending' || cols[1]?.toLowerCase() === 'yes') ? 'attending' : cols[1]?.toLowerCase() === 'declined' ? 'declined' : 'pending',
            pax: Number(cols[2]) || 1,
            email: cols[3] || '',
            phone: cols[4] || '',
            meal_preference: cols[5] || '',
            dietary_notes: cols[6] || '',
            is_vip: cols[7]?.toLowerCase() === 'yes' || cols[7]?.toLowerCase() === 'true'
          });
        }
      }

      await importGuests(projectId, parsed);
      await loadAllData();
      setIsImportModalOpen(false);
      setCsvText('');
      alert(`Successfully imported ${parsed.length} guests!`);
    } catch (err: any) {
      alert('Error parsing CSV: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#777777]">Total Guests</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono text-[#252525]">{totalGuests}</div>
          <div className="text-[11px] text-[#888888] mt-0.5">Invited list</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-700">Attending</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono text-emerald-800">{confirmedGuests}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Confirmed RSVP</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700">Pending</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono text-amber-800">{pendingGuests}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Awaiting reply</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-stone-500">Declined</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono text-stone-600">{declinedGuests}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">Not attending</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#8B806F]">Assigned</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono text-[#8B806F]">{assignedGuests}</div>
          <div className="text-[11px] text-[#888888] mt-0.5">With table seat</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle">
          <div className="text-[11px] font-mono uppercase tracking-wider text-rose-700">Unassigned</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono text-rose-800">{unassignedAttending}</div>
          <div className="text-[11px] text-rose-600 mt-0.5">Attending & no seat</div>
        </div>
      </div>

      {/* Action Strip & Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#E8E8E5] shadow-subtle space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search guests by name, email, table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-[#FAF9F7] text-[#252525] placeholder:text-[#999999] border border-[#E8E8E5] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsGroupModalOpen(true)}
              leftIcon={<FolderPlus className="w-3.5 h-3.5" />}
              className="!h-8 !text-xs"
            >
              Groups ({groups.length})
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              leftIcon={<Upload className="w-3.5 h-3.5" />}
              className="!h-8 !text-xs"
            >
              Import CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              leftIcon={<Download className="w-3.5 h-3.5" />}
              className="!h-8 !text-xs"
            >
              Export
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddModal}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              className="!h-8 !text-xs !bg-[#252525]"
            >
              Add Guest
            </Button>
          </div>
        </div>

        {/* Filters and Bulk Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-[#EFEFEA] text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#777777] font-medium text-[11px] uppercase tracking-wider">Filters:</span>

            {/* RSVP Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-7 px-2 text-xs bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[#252525] focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
            >
              <option value="all">All RSVP Statuses</option>
              <option value="attending">Attending ({confirmedGuests})</option>
              <option value="pending">Pending ({pendingGuests})</option>
              <option value="declined">Declined ({declinedGuests})</option>
            </select>

            {/* Seating Filter */}
            <select
              value={seatingFilter}
              onChange={(e) => setSeatingFilter(e.target.value as any)}
              className="h-7 px-2 text-xs bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[#252525] focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
            >
              <option value="all">All Seating Statuses</option>
              <option value="assigned">Assigned to Table ({assignedGuests})</option>
              <option value="unassigned">Unassigned ({unassignedAttending})</option>
            </select>

            {/* Group Filter */}
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="h-7 px-2 text-xs bg-[#FAF9F7] border border-[#E8E8E5] rounded text-[#252525] focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
            >
              <option value="all">All Groups</option>
              {groups.map(grp => (
                <option key={grp.id} value={grp.id}>{grp.group_name} ({grp.member_count || 0})</option>
              ))}
            </select>

            {(statusFilter !== 'all' || seatingFilter !== 'all' || groupFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setSeatingFilter('all');
                  setGroupFilter('all');
                  setSearchQuery('');
                }}
                className="text-[11px] text-[#8B806F] hover:underline px-1"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Bulk Selection Bar */}
          {selectedGuestIds.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
              <span className="text-amber-900 font-medium text-[11px]">
                {selectedGuestIds.length} Selected:
              </span>
              <button
                onClick={() => handleBulkAction('mark_attending')}
                className="px-2 py-0.5 text-[11px] bg-white text-emerald-800 rounded border border-emerald-200 hover:bg-emerald-50"
              >
                Mark Attending
              </button>
              <button
                onClick={() => handleBulkAction('toggle_vip', { isVip: true })}
                className="px-2 py-0.5 text-[11px] bg-white text-amber-800 rounded border border-amber-200 hover:bg-amber-50"
              >
                Mark VIP
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-2 py-0.5 text-[11px] bg-white text-rose-800 rounded border border-rose-200 hover:bg-rose-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Guest Table */}
      <div className="bg-white rounded-xl border border-[#E8E8E5] shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F7] border-b border-[#E8E8E5] text-[#777777] font-medium uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={filteredGuests.length > 0 && selectedGuestIds.length === filteredGuests.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-[#E8E8E5] text-[#252525] focus:ring-0"
                  />
                </th>
                <th className="p-3">Guest Name</th>
                <th className="p-3">Group / Family</th>
                <th className="p-3">RSVP Status</th>
                <th className="p-3">Pax</th>
                <th className="p-3">Reception Table</th>
                <th className="p-3">Meal / Notes</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEFEA]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#777777]">
                    Loading wedding guest list...
                  </td>
                </tr>
              ) : filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#777777]">
                    <div className="w-10 h-10 rounded-full bg-[#FAF9F7] border border-[#E8E8E5] flex items-center justify-center mx-auto mb-2 text-[#999999]">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="font-medium text-[#252525]">No guests found</div>
                    <div className="text-[11px] text-[#888888] mt-0.5">
                      {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'Add your first guest or import from CSV.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGuests.map((guest) => {
                  const isSelected = selectedGuestIds.includes(guest.id);

                  return (
                    <tr 
                      key={guest.id}
                      className={`hover:bg-[#FAF9F7]/70 transition-colors ${isSelected ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(guest.id)}
                          className="rounded border-[#E8E8E5] text-[#252525] focus:ring-0"
                        />
                      </td>

                      <td className="p-3 font-medium text-[#252525]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{guest.full_name}</span>
                          {guest.is_vip && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-300">
                              <Crown className="w-2.5 h-2.5 fill-current" />
                              <span>VIP</span>
                            </span>
                          )}
                          {guest.is_plus_one && (
                            <span className="text-[10px] text-[#888888] font-mono bg-[#FAF9F7] px-1 rounded border border-[#E8E8E5]">
                              +1
                            </span>
                          )}
                        </div>
                        {guest.email && (
                          <div className="text-[11px] text-[#777777] font-mono truncate max-w-xs">{guest.email}</div>
                        )}
                      </td>

                      <td className="p-3">
                        {guest.guest_group ? (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border"
                            style={{ 
                              backgroundColor: `${guest.guest_group.color || '#8B806F'}15`,
                              color: guest.guest_group.color || '#252525',
                              borderColor: `${guest.guest_group.color || '#8B806F'}40`
                            }}
                          >
                            {guest.guest_group.group_name}
                          </span>
                        ) : (
                          <span className="text-stone-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="p-3">
                        {guest.rsvp_status === 'attending' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Attending</span>
                          </span>
                        ) : guest.rsvp_status === 'declined' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                            <XCircle className="w-3 h-3" />
                            <span>Declined</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3 font-mono tabular-nums text-[#252525]">
                        {guest.pax || 1}
                      </td>

                      <td className="p-3">
                        {guest.rsvp_status === 'declined' ? (
                          <span className="text-stone-400 text-[11px] italic">Not Seated</span>
                        ) : (
                          <select
                            value={guest.assigned_table_id || 'unassigned'}
                            onChange={(e) => handleQuickTableAssign(guest.id, e.target.value)}
                            className={`h-7 px-2 text-[11px] rounded border focus:outline-none focus:ring-1 focus:ring-[#8B806F] ${
                              guest.assigned_table_id 
                                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-medium'
                                : 'bg-[#FAF9F7] border-[#E8E8E5] text-[#777777]'
                            }`}
                          >
                            <option value="unassigned">Unassigned</option>
                            {tables.map(tbl => (
                              <option 
                                key={tbl.id} 
                                value={tbl.id}
                                disabled={(tbl.assigned_count || 0) >= tbl.capacity && tbl.id !== guest.assigned_table_id}
                              >
                                T{tbl.table_number}: {tbl.table_name} ({tbl.assigned_count || 0}/{tbl.capacity})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>

                      <td className="p-3 text-[11px] text-[#777777] max-w-xs truncate">
                        {guest.meal_preference && (
                          <span className="font-medium text-[#252525]">{guest.meal_preference}</span>
                        )}
                        {guest.dietary_notes && (
                          <span className="text-[#888888] block truncate">{guest.dietary_notes}</span>
                        )}
                        {!guest.meal_preference && !guest.dietary_notes && (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(guest)}
                            className="p-1 text-[#777777] hover:text-[#252525] rounded transition-colors"
                            title="Edit Guest"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteGuest(guest.id, guest.full_name)}
                            className="p-1 text-[#777777] hover:text-rose-600 rounded transition-colors"
                            title="Delete Guest"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Guest Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingGuest ? "Edit Wedding Guest" : "Add Wedding Guest"}
      >
        <form onSubmit={handleSaveGuest} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name *"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Eleanor Vance"
              required
            />
            <Input
              label="Email Address"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="eleanor@example.com"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Phone Number"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />

            <div>
              <label className="text-xs text-[#777777] block mb-1">RSVP Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full h-9 px-3 text-xs bg-white text-[#252525] border border-[#E8E8E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
              >
                <option value="attending">Attending</option>
                <option value="pending">Pending</option>
                <option value="declined">Declined</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-[#777777] block mb-1">Party Size (Pax)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={formPax}
                onChange={(e) => setFormPax(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full h-9 px-3 text-xs bg-white text-[#252525] border border-[#E8E8E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#777777] block mb-1">Guest Group / Family</label>
              <select
                value={formGroupId}
                onChange={(e) => setFormGroupId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white text-[#252525] border border-[#E8E8E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
              >
                <option value="">No Group Assigned</option>
                {groups.map(grp => (
                  <option key={grp.id} value={grp.id}>{grp.group_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#777777] block mb-1">Meal Preference</label>
              <select
                value={formMeal}
                onChange={(e) => setFormMeal(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white text-[#252525] border border-[#E8E8E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
              >
                <option value="">Standard Chef's Selection</option>
                <option value="Beef Tenderloin">Beef Tenderloin</option>
                <option value="Atlantic Salmon">Atlantic Salmon</option>
                <option value="Vegetarian Risotto">Vegetarian Risotto</option>
                <option value="Vegan Plate">Vegan Plate</option>
                <option value="Halal">Halal</option>
                <option value="Kosher">Kosher</option>
                <option value="Kids Meal">Kids Meal</option>
              </select>
            </div>
          </div>

          <Input
            label="Dietary Restrictions / Allergies"
            value={formDietary}
            onChange={(e) => setFormDietary(e.target.value)}
            placeholder="e.g. Peanut allergy, gluten-free"
          />

          <Input
            label="Internal Notes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="e.g. Bride's college roommate"
          />

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_vip_check"
              checked={formIsVip}
              onChange={(e) => setFormIsVip(e.target.checked)}
              className="rounded border-[#E8E8E5] text-amber-600 focus:ring-0"
            />
            <label htmlFor="is_vip_check" className="text-xs text-[#252525] cursor-pointer flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-amber-600" />
              <span>Designate as VIP Guest (Priority seating & highlight recognition)</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#E8E8E5]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
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
              {editingGuest ? "Save Changes" : "Add to Guest List"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Groups Modal */}
      <Modal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        title="Guest Family & Invitation Groups"
      >
        <div className="space-y-5">
          <p className="text-xs text-[#777777] leading-relaxed">
            Organize guests into natural circles like Bride Family, Groom Friends, or VIPs. Groups allow one-click table assignments while leaving individual seats customizable.
          </p>

          {/* Add Group Sub-form */}
          <form onSubmit={handleCreateGroup} className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E8E8E5] space-y-3">
            <div className="text-xs font-semibold text-[#252525]">Create New Group</div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Group name, e.g. Bride Family"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="flex-1 h-8 px-2.5 text-xs bg-white border border-[#E8E8E5] rounded focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
                required
              />
              <input
                type="color"
                value={newGroupColor}
                onChange={(e) => setNewGroupColor(e.target.value)}
                className="w-8 h-8 rounded border border-[#E8E8E5] cursor-pointer"
                title="Group tag color"
              />
              <Button type="submit" variant="primary" size="sm" className="!h-8 !text-xs !bg-[#252525]">
                Add
              </Button>
            </div>
          </form>

          {/* Group List */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {groups.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#888888]">
                No custom groups created yet.
              </div>
            ) : (
              groups.map(grp => (
                <div key={grp.id} className="p-2.5 bg-white rounded border border-[#E8E8E5] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: grp.color || '#8B806F' }} />
                    <span className="text-xs font-medium text-[#252525]">{grp.group_name}</span>
                    <span className="text-[10px] font-mono text-[#888888] bg-[#FAF9F7] px-1.5 py-0.5 rounded border border-[#E8E8E5]">
                      {grp.member_count || 0} guests
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteGroup(grp.id, grp.group_name)}
                    className="p-1 text-[#777777] hover:text-rose-600 transition-colors"
                    title="Delete Group"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-[#E8E8E5]">
            <Button variant="outline" size="sm" onClick={() => setIsGroupModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Guests from CSV / Spreadsheet"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#777777] leading-relaxed">
            Paste CSV rows with headers. Format: <code className="bg-[#FAF9F7] px-1 py-0.5 border border-[#E8E8E5] rounded text-[11px]">Full Name, RSVP Status, Pax, Email, Phone, Meal Preference, Dietary Notes, VIP</code>
          </p>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={8}
            placeholder={`Full Name, RSVP Status, Pax, Email, Phone, Meal Preference, Dietary Notes, VIP
Arthur Pendelton, Attending, 1, arthur@example.com, +15551234567, Beef, Nut allergy, Yes
Genevieve Miller, Attending, 2, genevieve@example.com, +15552345678, Salmon, Gluten free, No`}
            className="w-full p-3 text-xs font-mono bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8B806F]"
          />

          <div className="flex justify-between items-center pt-2 border-t border-[#E8E8E5]">
            <button
              onClick={() => {
                setCsvText(`Full Name, RSVP Status, Pax, Email, Phone, Meal Preference, Dietary Notes, VIP
Arthur Pendelton, Attending, 1, arthur@example.com, +15551234567, Beef, Nut allergy, Yes
Genevieve Miller, Attending, 2, genevieve@example.com, +15552345678, Salmon, Gluten free, No
Julian Vance, Attending, 1, julian@example.com, +15553456789, Vegetarian, None, Yes
Claire Beaumont, Pending, 1, claire@example.com, +15554567890, Chef Choice, None, No`);
              }}
              className="text-[11px] text-[#8B806F] hover:underline"
            >
              Load Sample Template
            </button>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleProcessImportCSV}
                isLoading={isSubmitting}
                className="!bg-[#252525]"
              >
                Process Import
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
