import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users as UsersIcon, ShieldBan, ShieldCheck } from 'lucide-react';
import { developerApi, UserRow, OrganizationRow } from '../../lib/developerApi';
import DataTable, { Column } from '../../design-system/components/DataTable';
import EmptyState from '../../design-system/components/EmptyState';
import Modal from '../../design-system/components/Modal';
import {
  StatusBadge,
  PaginationBar,
  ErrorAlert,
  formatDateShort,
  formatDateTimeShort,
} from '../../components/developer/DeveloperShared';

export default function DeveloperUsers() {
  const navigate = useNavigate();
  const [items, setItems] = useState<UserRow[]>([]);
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 15;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('all');
  const [organizationId, setOrganizationId] = useState('all');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [suspendTarget, setSuspendTarget] = useState<UserRow | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getUsers({
        search,
        status,
        role,
        organizationId,
        registeredFrom,
        registeredTo,
        page,
        limit,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, status, role, organizationId, registeredFrom, registeredTo, page]);

  useEffect(() => {
    developerApi
      .getOrganizations({ limit: 100 })
      .then((res) => setOrgs(res.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(loadUsers, 150);
    return () => clearTimeout(t);
  }, [loadUsers]);

  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;
    setActionBusy(true);
    setError(null);
    try {
      await developerApi.suspendUser(
        suspendTarget.id,
        suspendReason.trim() || 'Suspended by platform administrator'
      );
      setSuspendTarget(null);
      setSuspendReason('');
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to suspend user account');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReactivate = async (user: UserRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionBusy(true);
    setError(null);
    try {
      await developerApi.reactivateUser(user.id);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to reactivate user account');
    } finally {
      setActionBusy(false);
    }
  };

  const columns: Column<UserRow>[] = [
    {
      header: 'User',
      cell: (row) => (
        <div className="min-w-[180px]">
          <div className="font-medium text-[#1A1A1A]">{row.fullName}</div>
          <div className="text-[11px] font-mono text-[#777777]">{row.email}</div>
        </div>
      ),
    },
    {
      header: 'Role',
      cell: (row) => <StatusBadge status={row.role} />,
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Organizations',
      cell: (row) => (
        <span className="text-[#555555] truncate block max-w-[180px]">
          {row.organizationNames.length > 0 ? row.organizationNames.join(', ') : '—'}
        </span>
      ),
    },
    {
      header: 'Events',
      align: 'right',
      cell: (row) => <span className="tabular-nums">{row.eventCount}</span>,
    },
    {
      header: 'Last Login',
      cell: (row) => (
        <span className="tabular-nums text-[#666666]">{formatDateTimeShort(row.lastLoginAt)}</span>
      ),
    },
    {
      header: 'Registered',
      cell: (row) => <span className="tabular-nums text-[#666666]">{formatDateShort(row.createdAt)}</span>,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {row.status === 'suspended' ? (
            <button
              type="button"
              disabled={actionBusy}
              onClick={(e) => handleReactivate(row, e)}
              className="h-7 px-2.5 bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0] rounded text-[11px] font-medium hover:bg-[#DCFCE7] inline-flex items-center gap-1"
            >
              <ShieldCheck className="w-3 h-3" />
              <span>Reactivate</span>
            </button>
          ) : row.role !== 'super_admin' ? (
            <button
              type="button"
              disabled={actionBusy}
              onClick={(e) => {
                e.stopPropagation();
                setSuspendTarget(row);
                setSuspendReason('');
              }}
              className="h-7 px-2.5 bg-white text-[#B91C1C] border border-[#FECACA] rounded text-[11px] font-medium hover:bg-[#FEF2F2] inline-flex items-center gap-1"
            >
              <ShieldBan className="w-3 h-3" />
              <span>Suspend</span>
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">Registered Users</h1>
        <p className="text-xs text-[#666666] mt-0.5">
          Search accounts across organizations, inspect memberships, and enforce account suspension server-side.
        </p>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-[#E8E8E5] rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, email, or org..."
            className="w-full h-9 pl-8 pr-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A] focus:outline-none focus:bg-white focus:border-[#252525]"
          />
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>

        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A]"
        >
          <option value="all">All Roles</option>
          <option value="agency_owner">Agency Owner</option>
          <option value="agency_member">Agency Member</option>
          <option value="user">User</option>
          <option value="super_admin">Super Admin</option>
        </select>

        <select
          value={organizationId}
          onChange={(e) => {
            setOrganizationId(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A]"
        >
          <option value="all">All Organizations</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={registeredFrom}
            onChange={(e) => {
              setRegisteredFrom(e.target.value);
              setPage(1);
            }}
            title="Registered From"
            className="w-1/2 h-9 px-2 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-[11px] text-[#1A1A1A]"
          />
          <input
            type="date"
            value={registeredTo}
            onChange={(e) => {
              setRegisteredTo(e.target.value);
              setPage(1);
            }}
            title="Registered To"
            className="w-1/2 h-9 px-2 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-[11px] text-[#1A1A1A]"
          />
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadUsers} />}

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(row) => row.id}
        isLoading={loading}
        onRowClick={(row) => navigate(`/developer/users/${encodeURIComponent(row.id)}`)}
        emptyState={
          <EmptyState
            icon={<UsersIcon className="w-5 h-5" />}
            title="No users match your filters"
            description="Try clearing the date range, organization, or status filters."
          />
        }
      />

      <PaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        limit={limit}
        onPageChange={setPage}
      />

      {/* Suspend Confirmation Modal */}
      <Modal
        isOpen={Boolean(suspendTarget)}
        onClose={() => !actionBusy && setSuspendTarget(null)}
        title="Suspend User Account"
        description={
          suspendTarget
            ? `Block login & API access for ${suspendTarget.email} without deleting organization or event data.`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => setSuspendTarget(null)}
              className="h-8 px-3 bg-white border border-[#E8E8E5] rounded text-xs font-medium text-[#252525] hover:bg-[#FAF9F7]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleConfirmSuspend}
              className="h-8 px-3.5 bg-[#B91C1C] text-white rounded text-xs font-medium hover:bg-[#991B1B] disabled:opacity-50"
            >
              {actionBusy ? 'Suspending...' : 'Confirm Suspension'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-[#555555]">
          <p>
            Suspending this account immediately rejects active JWT verification and new sign-ins on the server.
            All associated organizations, events, RSVPs, and payment records remain untouched.
          </p>
          <div>
            <label className="block text-[11px] font-medium text-[#252525] mb-1">
              Suspension Reason (Audit Logged)
            </label>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
              placeholder="e.g., Policy review or billing verification hold"
              className="w-full p-2.5 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A] focus:outline-none focus:bg-white focus:border-[#252525]"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
