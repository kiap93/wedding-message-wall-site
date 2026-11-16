import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldBan,
  ShieldCheck,
  ShieldPlus,
  ShieldOff,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  developerApi,
  UserRow,
  OrganizationRow,
  PlatformEventRow,
  PaymentRow,
  ActivityLogRow,
} from '../../lib/developerApi';
import { useUser } from '../../lib/UserContext';
import DataTable, { Column } from '../../design-system/components/DataTable';
import Modal from '../../design-system/components/Modal';
import {
  KpiCard,
  StatusBadge,
  ErrorAlert,
  formatCurrencyUsd,
  formatDateShort,
  formatDateTimeShort,
} from '../../components/developer/DeveloperShared';

export default function DeveloperUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useUser();

  const [detail, setDetail] = useState<{
    user: UserRow;
    organizations: OrganizationRow[];
    events: PlatformEventRow[];
    payments: PaymentRow[];
    activityLogs: ActivityLogRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [developerActionNext, setDeveloperActionNext] = useState<boolean | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getUserDetail(id);
      setDetail(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load user details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleConfirmSuspend = async () => {
    if (!detail) return;
    setActionBusy(true);
    setError(null);
    setNotice(null);
    try {
      await developerApi.suspendUser(
        detail.user.id,
        suspendReason.trim() || 'Suspended by platform administrator'
      );
      setNotice(`Suspended account for ${detail.user.email}.`);
      setSuspendModalOpen(false);
      setSuspendReason('');
      await loadDetail();
    } catch (err: any) {
      setError(err?.message || 'Failed to suspend user account');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReactivate = async () => {
    if (!detail) return;
    setActionBusy(true);
    setError(null);
    setNotice(null);
    try {
      await developerApi.reactivateUser(detail.user.id);
      setNotice(`Reactivated account for ${detail.user.email}.`);
      await loadDetail();
    } catch (err: any) {
      setError(err?.message || 'Failed to reactivate user account');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmDeveloperAccess = async () => {
    if (!detail || developerActionNext === null) return;
    setActionBusy(true);
    setError(null);
    setNotice(null);
    try {
      await developerApi.updateUserDeveloperAccess(detail.user.id, developerActionNext);
      setNotice(
        developerActionNext
          ? `Granted developer access to ${detail.user.email}.`
          : `Revoked developer access from ${detail.user.email}.`
      );
      setDeveloperActionNext(null);
      await loadDetail();
    } catch (err: any) {
      setError(err?.message || 'Failed to update developer access');
      setDeveloperActionNext(null);
    } finally {
      setActionBusy(false);
    }
  };

  const orgColumns: Column<OrganizationRow>[] = [
    {
      header: 'Organization',
      cell: (row) => (
        <div>
          <div className="font-medium text-[#1A1A1A]">{row.name}</div>
          <div className="text-[11px] font-mono text-[#777777]">{row.slug}.eventframe.io</div>
        </div>
      ),
    },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Events',
      align: 'right',
      cell: (row) => <span className="tabular-nums">{row.eventCount}</span>,
    },
    {
      header: 'Revenue',
      align: 'right',
      cell: (row) => (
        <span className="tabular-nums font-medium">{formatCurrencyUsd(row.totalRevenueCents, true)}</span>
      ),
    },
  ];

  const eventColumns: Column<PlatformEventRow>[] = [
    {
      header: 'Event',
      cell: (row) => (
        <div>
          <div className="font-medium text-[#1A1A1A]">{row.name}</div>
          <div className="text-[11px] font-mono text-[#777777]">/{row.slug}</div>
        </div>
      ),
    },
    { header: 'Couple', cell: (row) => <span>{row.coupleNames}</span> },
    { header: 'Lifecycle', cell: (row) => <StatusBadge status={row.lifecycleStatus} /> },
    { header: 'Payment', cell: (row) => <StatusBadge status={row.paymentStatus} /> },
    {
      header: 'Expires',
      align: 'right',
      cell: (row) => <span className="tabular-nums">{formatDateShort(row.expiresAt)}</span>,
    },
  ];

  const paymentColumns: Column<PaymentRow>[] = [
    {
      header: 'Transaction ID',
      cell: (row) => <span className="font-mono text-[11px]">{row.transactionId || row.id}</span>,
    },
    { header: 'Event', cell: (row) => <span>{row.eventName}</span> },
    {
      header: 'Amount',
      align: 'right',
      cell: (row) => (
        <span className="tabular-nums font-medium">{formatCurrencyUsd(row.amountCents, true)}</span>
      ),
    },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Date',
      align: 'right',
      cell: (row) => <span className="tabular-nums">{formatDateShort(row.paidAt || row.createdAt)}</span>,
    },
  ];

  if (loading && !detail) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-white border border-[#E8E8E5] rounded-lg animate-pulse" />
        <div className="h-48 bg-white border border-[#E8E8E5] rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/developer/users')}
          className="text-xs text-[#555555] hover:text-[#1A1A1A] inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Users</span>
        </button>
        <ErrorAlert message={error} onRetry={loadDetail} />
      </div>
    );
  }

  if (!detail) return null;
  const { user, organizations, events, payments, activityLogs } = detail;

  const actorEmail = String(currentUser?.email || '').trim().toLowerCase();
  const targetEmail = String(user.email || '').trim().toLowerCase();
  const isSelf = Boolean(
    (actorEmail && targetEmail && actorEmail === targetEmail) ||
      (currentUser?.dbUserId && String(currentUser.dbUserId) === user.id) ||
      (currentUser?.id && (String(currentUser.id) === user.id || String(currentUser.id) === user.externalUserId))
  );

  const collectedRevenueCents = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((acc, p) => acc + p.amountCents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link
            to="/developer/users"
            className="text-xs text-[#666666] hover:text-[#1A1A1A] inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Users</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">{user.fullName}</h1>
            {user.isDeveloper && <StatusBadge status="developer" />}
            {!(user.role === 'super_admin' && user.isDeveloper) && <StatusBadge status={user.role} />}
            <StatusBadge status={user.status} />
          </div>
          <div className="text-xs text-[#666666] mt-1 font-mono">
            {user.email} · Provider: {user.authProvider} · ID: {user.id}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isSelf && user.status !== 'suspended' && (
            user.isDeveloper ? (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setDeveloperActionNext(false)}
                className="h-9 px-3.5 bg-white text-[#B45309] border border-[#FDE68A] rounded-md text-xs font-medium hover:bg-[#FFFBEB] inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <ShieldOff className="w-3.5 h-3.5" />
                <span>Revoke Developer</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setDeveloperActionNext(true)}
                className="h-9 px-3.5 bg-[#252525] text-white border border-[#252525] rounded-md text-xs font-medium hover:bg-[#3A3A3A] inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <ShieldPlus className="w-3.5 h-3.5 text-[#D8B979]" />
                <span>Grant Developer</span>
              </button>
            )
          )}

          {!isSelf && (
            user.status === 'suspended' ? (
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleReactivate}
                className="h-9 px-3.5 bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0] rounded-md text-xs font-medium hover:bg-[#DCFCE7] inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{actionBusy ? 'Reactivating...' : 'Reactivate Account'}</span>
              </button>
            ) : !user.isDeveloper ? (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => {
                  setSuspendReason('');
                  setSuspendModalOpen(true);
                }}
                className="h-9 px-3.5 bg-white text-[#B91C1C] border border-[#FECACA] rounded-md text-xs font-medium hover:bg-[#FEF2F2] inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <ShieldBan className="w-3.5 h-3.5" />
                <span>Suspend Account</span>
              </button>
            ) : null
          )}
        </div>
      </div>

      {notice && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-4 py-3 flex items-center gap-2.5 text-xs text-[#15803D]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {user.status === 'suspended' && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
          <div className="text-xs text-[#7F1D1D] space-y-1">
            <div className="font-semibold">Account Suspended</div>
            <div>
              Suspended at: <span className="tabular-nums">{formatDateTimeShort(user.suspendedAt)}</span>
            </div>
            <div>Reason: {user.suspendedReason || 'Suspended by platform administrator'}</div>
          </div>
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={loadDetail} />}

      {/* User Metadata + KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Organizations" value={organizations.length} />
        <KpiCard label="Associated Events" value={events.length} />
        <KpiCard label="Completed Revenue" value={formatCurrencyUsd(collectedRevenueCents, true)} accent="success" />
        <KpiCard
          label="Email Verification"
          value={user.isVerified ? 'Verified' : 'Unverified'}
          sublabel={`Last login: ${formatDateTimeShort(user.lastLoginAt)}`}
        />
      </div>

      {/* Account Profile Box */}
      <div className="bg-white border border-[#E8E8E5] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <div className="text-[#777777]">External Auth ID</div>
          <div className="mt-0.5 font-mono text-[#1A1A1A] break-all">{user.externalUserId || '—'}</div>
        </div>
        <div>
          <div className="text-[#777777]">Registered At</div>
          <div className="mt-0.5 tabular-nums text-[#1A1A1A]">{formatDateTimeShort(user.createdAt)}</div>
        </div>
        <div>
          <div className="text-[#777777]">Last Login</div>
          <div className="mt-0.5 tabular-nums text-[#1A1A1A]">{formatDateTimeShort(user.lastLoginAt)}</div>
        </div>
      </div>

      {/* Linked Organizations */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#555555]">
          Linked Organizations ({organizations.length})
        </h2>
        <DataTable
          columns={orgColumns}
          data={organizations}
          keyExtractor={(r) => r.id}
          onRowClick={(r) => navigate(`/developer/organizations/${encodeURIComponent(r.id)}`)}
          emptyState={
            <div className="bg-white border border-[#E8E8E5] rounded-lg p-6 text-xs text-[#777777]">
              This user is not linked to any organizations.
            </div>
          }
        />
      </div>

      {/* Associated Events */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#555555]">
          Associated Events ({events.length})
        </h2>
        <DataTable
          columns={eventColumns}
          data={events}
          keyExtractor={(r) => r.id}
          emptyState={
            <div className="bg-white border border-[#E8E8E5] rounded-lg p-6 text-xs text-[#777777]">
              No events associated with this account.
            </div>
          }
        />
      </div>

      {/* Payments */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#555555]">
          Payment Records ({payments.length})
        </h2>
        <DataTable
          columns={paymentColumns}
          data={payments}
          keyExtractor={(r) => r.id}
          emptyState={
            <div className="bg-white border border-[#E8E8E5] rounded-lg p-6 text-xs text-[#777777]">
              No payment records for this user&apos;s organizations.
            </div>
          }
        />
      </div>

      {/* Activity Logs */}
      {activityLogs.length > 0 && (
        <div className="bg-white border border-[#E8E8E5] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EFEFEA]">
            <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#555555]">
              Account Activity History
            </h2>
          </div>
          <div className="divide-y divide-[#EFEFEA]">
            {activityLogs.map((log) => (
              <div key={log.id} className="px-4 py-2.5 flex items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-mono font-semibold text-[#1A1A1A] mr-2">{log.action}</span>
                  <span className="text-[#555555]">{log.summary}</span>
                </div>
                <span className="text-[11px] text-[#777777] tabular-nums shrink-0">
                  {formatDateTimeShort(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Developer Access Confirmation Modal */}
      <Modal
        isOpen={developerActionNext !== null}
        onClose={() => !actionBusy && setDeveloperActionNext(null)}
        title={
          developerActionNext
            ? 'Grant Platform Developer Access'
            : 'Revoke Platform Developer Access'
        }
        description={
          developerActionNext
            ? `Grant ${user.email} access to the /developer console and /api/developer/* endpoints.`
            : `Immediately revoke /developer console and /api/developer/* access from ${user.email}.`
        }
        footer={
          <>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => setDeveloperActionNext(null)}
              className="h-8 px-3 bg-white border border-[#E8E8E5] rounded text-xs font-medium text-[#252525] hover:bg-[#FAF9F7]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleConfirmDeveloperAccess}
              className={`h-8 px-3.5 text-white rounded text-xs font-medium disabled:opacity-50 ${
                developerActionNext
                  ? 'bg-[#252525] hover:bg-[#3A3A3A]'
                  : 'bg-[#B45309] hover:bg-[#92400E]'
              }`}
            >
              {actionBusy
                ? 'Updating...'
                : developerActionNext
                  ? 'Confirm Grant Developer'
                  : 'Confirm Revoke Developer'}
            </button>
          </>
        }
      >
        <div className="space-y-2.5 text-xs text-[#555555]">
          {developerActionNext ? (
            <p>
              This user will receive platform-level <code className="font-mono">is_developer = true</code>{' '}
              authorization without changing any existing agency ownership or organization memberships.
            </p>
          ) : (
            <p>
              Revoking developer access takes effect immediately on the server across Express and Cloudflare
              Worker routes. Agency workspace ownership and normal access remain unaffected.
            </p>
          )}
        </div>
      </Modal>

      {/* Suspend Confirmation Modal */}
      <Modal
        isOpen={suspendModalOpen}
        onClose={() => !actionBusy && setSuspendModalOpen(false)}
        title="Suspend User Account"
        description={`Block authentication & workspace API access for ${user.email}. Existing organizations and events remain preserved.`}
        footer={
          <>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => setSuspendModalOpen(false)}
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
            Suspending this account enforces immediate server-side login and session rejection across Express
            and Cloudflare Worker endpoints.
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
