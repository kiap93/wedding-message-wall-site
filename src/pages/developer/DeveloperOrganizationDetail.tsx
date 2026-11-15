import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShieldBan, ShieldCheck } from 'lucide-react';
import {
  developerApi,
  OrganizationRow,
  UserRow,
  PlatformEventRow,
  PaymentRow,
  ActivityLogRow,
} from '../../lib/developerApi';
import DataTable, { Column } from '../../design-system/components/DataTable';
import {
  KpiCard,
  StatusBadge,
  ErrorAlert,
  formatCurrencyUsd,
  formatDateShort,
  formatDateTimeShort,
} from '../../components/developer/DeveloperShared';

export default function DeveloperOrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<{
    organization: OrganizationRow;
    owner: UserRow | null;
    members: UserRow[];
    events: PlatformEventRow[];
    payments: PaymentRow[];
    expirySummary: {
      activeCount: number;
      expiringSoonCount: number;
      expiredCount: number;
      unpaidCount: number;
    };
    activityLogs: ActivityLogRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getOrganizationDetail(id);
      setDetail(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load organization details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleToggleOrgStatus = async () => {
    if (!detail) return;
    const nextStatus = detail.organization.status === 'suspended' ? 'active' : 'suspended';
    setUpdatingStatus(true);
    try {
      await developerApi.updateOrganizationStatus(detail.organization.id, nextStatus);
      await loadDetail();
    } catch (err: any) {
      setError(err?.message || 'Failed to update organization status');
    } finally {
      setUpdatingStatus(false);
    }
  };

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
    {
      header: 'Lifecycle',
      cell: (row) => <StatusBadge status={row.lifecycleStatus} />,
    },
    {
      header: 'Payment',
      cell: (row) => <StatusBadge status={row.paymentStatus} />,
    },
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
          onClick={() => navigate('/developer/organizations')}
          className="text-xs text-[#555555] hover:text-[#1A1A1A] inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Organizations</span>
        </button>
        <ErrorAlert message={error} onRetry={loadDetail} />
      </div>
    );
  }

  if (!detail) return null;
  const { organization, owner, members, events, payments, expirySummary, activityLogs } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link
            to="/developer/organizations"
            className="text-xs text-[#666666] hover:text-[#1A1A1A] inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Organizations</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">{organization.name}</h1>
            <StatusBadge status={organization.status} />
          </div>
          <div className="text-xs text-[#666666] mt-1 font-mono">
            {organization.slug}.eventframe.io · Created {formatDateShort(organization.createdAt)} · ID: {organization.id}
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleOrgStatus}
          disabled={updatingStatus}
          className={`h-9 px-3.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 border transition-colors ${
            organization.status === 'suspended'
              ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0] hover:bg-[#DCFCE7]'
              : 'bg-white text-[#B91C1C] border-[#FECACA] hover:bg-[#FEF2F2]'
          }`}
        >
          {organization.status === 'suspended' ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Reactivate Organization</span>
            </>
          ) : (
            <>
              <ShieldBan className="w-3.5 h-3.5" />
              <span>Suspend Organization</span>
            </>
          )}
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadDetail} />}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Events" value={events.length} />
        <KpiCard label="Active Events" value={expirySummary.activeCount} accent="success" />
        <KpiCard
          label="Expiring (30d)"
          value={expirySummary.expiringSoonCount}
          accent={expirySummary.expiringSoonCount > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Expired / Unpaid"
          value={`${expirySummary.expiredCount} / ${expirySummary.unpaidCount}`}
        />
        <KpiCard
          label="Total Revenue"
          value={formatCurrencyUsd(organization.totalRevenueCents, true)}
          accent="success"
        />
      </div>

      {/* Owner & Members */}
      <div className="bg-white border border-[#E8E8E5] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#EFEFEA] flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#555555]">
            Owner & Members ({members.length})
          </h2>
          {owner && (
            <span className="text-xs text-[#666666]">
              Primary Owner: <span className="font-mono text-[#1A1A1A]">{owner.email}</span>
            </span>
          )}
        </div>
        {members.length === 0 ? (
          <div className="p-4 text-xs text-[#777777]">
            Owner ID: <span className="font-mono">{organization.ownerUserId || '—'}</span>
          </div>
        ) : (
          <div className="divide-y divide-[#EFEFEA]">
            {members.map((m) => (
              <Link
                key={m.id}
                to={`/developer/users/${encodeURIComponent(m.id)}`}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#FAF9F7] transition-colors"
              >
                <div>
                  <div className="text-xs font-medium text-[#1A1A1A]">{m.fullName}</div>
                  <div className="text-[11px] font-mono text-[#777777]">{m.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={m.role} />
                  <StatusBadge status={m.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
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
              No events created under this organization yet.
            </div>
          }
        />
      </div>

      {/* Payment History */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#555555]">
          Payment History ({payments.length})
        </h2>
        <DataTable
          columns={paymentColumns}
          data={payments}
          keyExtractor={(r) => r.id}
          emptyState={
            <div className="bg-white border border-[#E8E8E5] rounded-lg p-6 text-xs text-[#777777]">
              No payment records associated with this organization.
            </div>
          }
        />
      </div>

      {/* Recent Org Audit Logs */}
      {activityLogs.length > 0 && (
        <div className="bg-white border border-[#E8E8E5] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EFEFEA]">
            <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#555555]">
              Recent Organization Activity
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
    </div>
  );
}
