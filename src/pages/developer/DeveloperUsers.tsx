import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users as UsersIcon,
  ShieldBan,
  ShieldCheck,
  ShieldPlus,
  ShieldOff,
  CheckCircle2,
} from 'lucide-react';
import { developerApi, UserRow, OrganizationRow } from '../../lib/developerApi';
import { useUser } from '../../lib/UserContext';
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
  const { user: currentUser } = useUser();
  const [items, setItems] = useState<UserRow[]>([]);
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 15;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('all');
  const [isDeveloperFilter, setIsDeveloperFilter] = useState('all');
  const [organizationId, setOrganizationId] = useState('all');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [suspendTarget, setSuspendTarget] = useState<UserRow | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [developerActionTarget, setDeveloperActionTarget] = useState<{
    user: UserRow;
    nextIsDeveloper: boolean;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const isCurrentUserRow = (row: UserRow): boolean => {
    const actorEmail = String(currentUser?.email || '').trim().toLowerCase();
    const rowEmail = String(row.email || '').trim().toLowerCase();
    return Boolean(
      (actorEmail && rowEmail && actorEmail === rowEmail) ||
        (currentUser?.dbUserId && String(currentUser.dbUserId) === row.id) ||
        (currentUser?.id && (String(currentUser.id) === row.id || String(currentUser.id) === row.externalUserId))
    );
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getUsers({
        search,
        status,
        role,
        isDeveloper: isDeveloperFilter,
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
  }, [search, status, role, isDeveloperFilter, organizationId, registeredFrom, registeredTo, page]);

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
    setNotice(null);
    try {
      await developerApi.suspendUser(
        suspendTarget.id,
        suspendReason.trim() || 'Suspended by platform administrator'
      );
      setNotice(`Suspended account for ${suspendTarget.email}.`);
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
    setNotice(null);
    try {
      await developerApi.reactivateUser(user.id);
      setNotice(`Reactivated account for ${user.email}.`);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to reactivate user account');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmDeveloperAccess = async () => {
    if (!developerActionTarget) return;
    setActionBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { user, nextIsDeveloper } = developerActionTarget;
      await developerApi.updateUserDeveloperAccess(user.id, nextIsDeveloper);
      setNotice(
        nextIsDeveloper
          ? `Granted developer access to ${user.email}.`
          : `Revoked developer access from ${user.email}.`
      );
      setDeveloperActionTarget(null);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to update developer access');
      setDeveloperActionTarget(null);
    } finally {
      setActionBusy(false);
    }
  };

  const columns: Column<UserRow>[] = [
    {
      header: 'User',
      cell: (row) => (
        <div className="min-w-[180px]">
          <div className="font-medium text-[#1A1A1A] flex items-center gap-1.5">
            <span>{row.fullName}</span>
            {isCurrentUserRow(row) && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#F7F7F5] border border-[#E0E0DC] text-[#666666]">
                You
              </span>
            )}
          </div>
          <div className="text-[11px] font-mono text-[#777777]">{row.email}</div>
        </div>
      ),
    },
    {
      header: 'Access & Role',
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.isDeveloper && <StatusBadge status="developer" />}
          {!(row.role === 'super_admin' && row.isDeveloper) && <StatusBadge status={row.role} />}
        </div>
      ),
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
      cell: (row) => {
        const isSelf = isCurrentUserRow(row);
        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            {!isSelf && row.status !== 'suspended' && (
              row.isDeveloper ? (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeveloperActionTarget({ user: row, nextIsDeveloper: false });
                  }}
                  className="h-7 px-2.5 bg-white text-[#B45309] border border-[#FDE68A] rounded text-[11px] font-medium hover:bg-[#FFFBEB] inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <ShieldOff className="w-3 h-3" />
                  <span>Revoke Developer</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeveloperActionTarget({ user: row, nextIsDeveloper: true });
                  }}
                  className="h-7 px-2.5 bg-[#252525] text-white border border-[#252525] rounded text-[11px] font-medium hover:bg-[#3A3A3A] inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <ShieldPlus className="w-3 h-3 text-[#D8B979]" />
                  <span>Grant Developer</span>
                </button>
              )
            )}

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
            ) : !row.isDeveloper && !isSelf ? (
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
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">Registered Users &amp; Developer Access</h1>
        <p className="text-xs text-[#666666] mt-0.5">
          Manage platform-level developer authorization (<code className="font-mono">is_developer</code>), inspect organization memberships, and enforce account status server-side.
        </p>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-[#E8E8E5] rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
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
          value={isDeveloperFilter}
          onChange={(e) => {
            setIsDeveloperFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by developer access"
          className="h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A]"
        >
          <option value="all">All Access Levels</option>
          <option value="developers">Developers Only</option>
          <option value="non_developers">Non-Developers</option>
        </select>

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
          <option value="all">All Agency Roles</option>
          <option value="agency_owner">Agency Owner</option>
          <option value="agency_member">Agency Member</option>
          <option value="user">User</option>
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

      {notice && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-4 py-3 flex items-center gap-2.5 text-xs text-[#15803D]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

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
            description="Try clearing the date range, organization, or access level filters."
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

      {/* Developer Access Confirmation Modal */}
      <Modal
        isOpen={Boolean(developerActionTarget)}
        onClose={() => !actionBusy && setDeveloperActionTarget(null)}
        title={
          developerActionTarget?.nextIsDeveloper
            ? 'Grant Platform Developer Access'
            : 'Revoke Platform Developer Access'
        }
        description={
          developerActionTarget
            ? developerActionTarget.nextIsDeveloper
              ? `Grant ${developerActionTarget.user.email} access to the /developer console and /api/developer/* endpoints.`
              : `Immediately revoke /developer console and /api/developer/* access from ${developerActionTarget.user.email}.`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => setDeveloperActionTarget(null)}
              className="h-8 px-3 bg-white border border-[#E8E8E5] rounded text-xs font-medium text-[#252525] hover:bg-[#FAF9F7]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleConfirmDeveloperAccess}
              className={`h-8 px-3.5 text-white rounded text-xs font-medium disabled:opacity-50 ${
                developerActionTarget?.nextIsDeveloper
                  ? 'bg-[#252525] hover:bg-[#3A3A3A]'
                  : 'bg-[#B45309] hover:bg-[#92400E]'
              }`}
            >
              {actionBusy
                ? 'Updating...'
                : developerActionTarget?.nextIsDeveloper
                  ? 'Confirm Grant Developer'
                  : 'Confirm Revoke Developer'}
            </button>
          </>
        }
      >
        <div className="space-y-2.5 text-xs text-[#555555]">
          {developerActionTarget?.nextIsDeveloper ? (
            <p>
              This user will receive platform-level <code className="font-mono">is_developer = true</code>{' '}
              authorization without altering their existing agency ownership or membership roles.
            </p>
          ) : (
            <p>
              Revoking developer access takes effect immediately on all backend API requests and active sessions.
              Their agency ownership, workspace projects, and normal workspace login remain unaffected.
            </p>
          )}
        </div>
      </Modal>

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
