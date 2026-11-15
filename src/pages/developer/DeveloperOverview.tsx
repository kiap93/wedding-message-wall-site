import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { developerApi, OverviewResponse } from '../../lib/developerApi';
import {
  KpiCard,
  StatusBadge,
  RegistrationAnalyticsChart,
  ErrorAlert,
  formatCurrencyUsd,
  formatDateShort,
  formatDateTimeShort,
} from '../../components/developer/DeveloperShared';

export default function DeveloperOverview() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getOverview();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load platform overview metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">
            Platform Overview
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            Live multi-tenant telemetry aggregated from organizations, users, events, and verified payments.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOverview}
          disabled={loading}
          className="h-8 px-3 bg-white border border-[#E8E8E5] rounded-md text-xs font-medium text-[#252525] hover:bg-[#FAF9F7] inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadOverview} />}

      {loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-24 bg-white border border-[#E8E8E5] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard
              label="Total Organizations"
              value={data.kpis.totalOrganizations}
              sublabel="Active studio & couple workspaces"
            />
            <KpiCard
              label="Registered Users"
              value={data.kpis.totalUsers}
              sublabel={
                data.kpis.suspendedUsers > 0
                  ? `${data.kpis.suspendedUsers} suspended account(s)`
                  : 'All accounts active'
              }
              accent={data.kpis.suspendedUsers > 0 ? 'warning' : 'default'}
            />
            <KpiCard
              label="Total Events"
              value={data.kpis.totalEvents}
              sublabel={`${data.kpis.activeEvents} active · ${data.kpis.expiredEvents} expired`}
            />
            <KpiCard
              label="Active Paid Events"
              value={data.kpis.activeEvents}
              sublabel="Within 12-month license validity"
              accent="success"
            />
            <KpiCard
              label="Collected Revenue"
              value={formatCurrencyUsd(data.kpis.totalRevenueCents, true)}
              sublabel={`${data.kpis.completedPaymentsCount} succeeded payment(s)`}
              accent="success"
            />
            <KpiCard
              label="Pending / Refunded"
              value={`${data.kpis.pendingPaymentsCount} / ${data.kpis.refundedPaymentsCount}`}
              sublabel="Excluded from collected revenue"
            />
          </div>

          {/* Registration & Org Growth Analytics */}
          <RegistrationAnalyticsChart analytics={data.registrationAnalytics} />

          {/* Recent Operations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Organizations */}
            <div className="bg-white border border-[#E8E8E5] rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[#EFEFEA] flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#555555]">
                  Recent Organizations
                </h2>
                <Link
                  to="/developer/organizations"
                  className="text-xs font-medium text-[#252525] hover:underline inline-flex items-center gap-1"
                >
                  <span>View all</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {data.recentOrganizations.length === 0 ? (
                <div className="p-6 text-xs text-[#777777]">No organizations recorded yet.</div>
              ) : (
                <div className="divide-y divide-[#EFEFEA]">
                  {data.recentOrganizations.map((org) => (
                    <Link
                      key={org.id}
                      to={`/developer/organizations/${org.id}`}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#FAF9F7] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#1A1A1A] truncate">{org.name}</div>
                        <div className="text-[11px] font-mono text-[#777777] truncate">
                          {org.slug} · {org.ownerEmail || org.userRole}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2.5">
                        <span className="text-xs text-[#555555] tabular-nums">{org.eventCount} ev</span>
                        <StatusBadge status={org.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Users */}
            <div className="bg-white border border-[#E8E8E5] rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[#EFEFEA] flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#555555]">
                  Recent Registrations
                </h2>
                <Link
                  to="/developer/users"
                  className="text-xs font-medium text-[#252525] hover:underline inline-flex items-center gap-1"
                >
                  <span>View all</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {data.recentUsers.length === 0 ? (
                <div className="p-6 text-xs text-[#777777]">No registered users recorded yet.</div>
              ) : (
                <div className="divide-y divide-[#EFEFEA]">
                  {data.recentUsers.map((u) => (
                    <Link
                      key={u.id}
                      to={`/developer/users/${encodeURIComponent(u.id)}`}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#FAF9F7] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#1A1A1A] truncate">{u.fullName}</div>
                        <div className="text-[11px] font-mono text-[#777777] truncate">{u.email}</div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <StatusBadge status={u.role} />
                        <StatusBadge status={u.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Payments */}
            <div className="bg-white border border-[#E8E8E5] rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[#EFEFEA] flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#555555]">
                  Recent Transactions
                </h2>
                <Link
                  to="/developer/payments"
                  className="text-xs font-medium text-[#252525] hover:underline inline-flex items-center gap-1"
                >
                  <span>Ledger</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {data.recentPayments.length === 0 ? (
                <div className="p-6 text-xs text-[#777777]">No payment records yet.</div>
              ) : (
                <div className="divide-y divide-[#EFEFEA]">
                  {data.recentPayments.map((p) => (
                    <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#1A1A1A] truncate">{p.eventName}</div>
                        <div className="text-[11px] text-[#777777] truncate">
                          {p.organizationName} · {formatDateShort(p.createdAt)}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2.5">
                        <span className="text-xs font-semibold tabular-nums text-[#1A1A1A]">
                          {formatCurrencyUsd(p.amountCents, true)}
                        </span>
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity Audit Feed */}
            <div className="bg-white border border-[#E8E8E5] rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[#EFEFEA] flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#555555]">
                  Recent Activity Logs
                </h2>
                <Link
                  to="/developer/activity-logs"
                  className="text-xs font-medium text-[#252525] hover:underline inline-flex items-center gap-1"
                >
                  <span>Audit trail</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {data.recentActivityLogs.length === 0 ? (
                <div className="p-6 text-xs text-[#777777]">No platform activity events logged yet.</div>
              ) : (
                <div className="divide-y divide-[#EFEFEA]">
                  {data.recentActivityLogs.map((log) => (
                    <div key={log.id} className="px-4 py-3 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-semibold text-[#252525]">
                          {log.action}
                        </span>
                        <span className="text-[11px] text-[#777777] tabular-nums">
                          {formatDateTimeShort(log.createdAt)}
                        </span>
                      </div>
                      <div className="text-xs text-[#555555] truncate">
                        {log.summary || log.actorEmail || 'System action'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
