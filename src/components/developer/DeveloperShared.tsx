import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

export function formatCurrencyUsd(centsOrUsd: number, isCents = true): string {
  const usd = isCents ? centsOrUsd / 100 : centsOrUsd;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(usd) ? usd : 0);
}

export function formatDateShort(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTimeShort(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const KpiCard: React.FC<{
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: 'default' | 'success' | 'warning' | 'danger';
}> = ({ label, value, sublabel, accent = 'default' }) => {
  const valueColor =
    accent === 'success'
      ? 'text-[#15803D]'
      : accent === 'warning'
        ? 'text-[#B45309]'
        : accent === 'danger'
          ? 'text-[#B91C1C]'
          : 'text-[#1A1A1A]';

  return (
    <div className="bg-white border border-[#E8E8E5] rounded-lg p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#777777]">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${valueColor}`}>
        {value}
      </div>
      {sublabel && (
        <div className="mt-1 text-xs text-[#777777] tabular-nums truncate">
          {sublabel}
        </div>
      )}
    </div>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const normalized = String(status || '').toLowerCase();
  let classes = 'bg-[#F7F7F5] text-[#555555] border-[#E0E0DC]';

  if (['active', 'succeeded', 'paid', 'published', 'completed', 'processed', 'verified'].includes(normalized)) {
    classes = 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]';
  } else if (['suspended', 'failed', 'error', 'checkout_failed'].includes(normalized)) {
    classes = 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]';
  } else if (['pending', 'pending_payment', 'expired', 'refunded', 'partially_refunded', 'awaiting_async_payment', 'processing'].includes(normalized)) {
    classes = 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]';
  } else if (['super_admin'].includes(normalized)) {
    classes = 'bg-[#252525] text-white border-[#252525]';
  } else if (['agency_owner'].includes(normalized)) {
    classes = 'bg-[#FAF5EA] text-[#736959] border-[#E6D6B0]';
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium tracking-tight whitespace-nowrap capitalize ${classes}`}
    >
      {normalized.replace(/_/g, ' ')}
    </span>
  );
};

export const PaginationBar: React.FC<{
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (nextPage: number) => void;
}> = ({ page, totalPages, total, limit, onPageChange }) => {
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 text-xs text-[#666666]">
      <div className="tabular-nums">
        Showing <span className="font-medium text-[#252525]">{start}</span>–
        <span className="font-medium text-[#252525]">{end}</span> of{' '}
        <span className="font-medium text-[#252525]">{total}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="h-8 px-2.5 bg-white border border-[#E8E8E5] rounded text-[#252525] hover:bg-[#FAF9F7] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>
        <span className="px-2 tabular-nums text-[#252525] font-medium">
          Page {page} of {Math.max(1, totalPages)}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="h-8 px-2.5 bg-white border border-[#E8E8E5] rounded text-[#252525] hover:bg-[#FAF9F7] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const ErrorAlert: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="bg-white border border-[#FECACA] rounded-lg p-4 flex items-center justify-between gap-4">
    <div className="flex items-center gap-2.5 text-xs text-[#B91C1C]">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="h-8 px-3 bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] rounded text-xs font-medium hover:bg-[#FEE2E2] inline-flex items-center gap-1.5 shrink-0"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Retry</span>
      </button>
    )}
  </div>
);

export const RegistrationAnalyticsChart: React.FC<{
  analytics: {
    daily: Array<{ key: string; label: string; users: number; organizations: number }>;
    weekly: Array<{ key: string; label: string; users: number; organizations: number }>;
    monthly: Array<{ key: string; label: string; users: number; organizations: number }>;
    summary: {
      usersToday: number;
      usersThisWeek: number;
      usersThisMonth: number;
      usersLast30Days: number;
      orgsThisMonth: number;
      orgsPreviousMonth: number;
      userGrowthPct: number | null;
      orgGrowthPct: number | null;
    };
  };
}> = ({ analytics }) => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const buckets = analytics[period] || [];
  const maxValue = Math.max(1, ...buckets.map((b) => Math.max(b.users, b.organizations)));
  const activeBucket = hoveredIdx !== null && buckets[hoveredIdx] ? buckets[hoveredIdx] : buckets[buckets.length - 1];

  return (
    <div className="bg-white border border-[#E8E8E5] rounded-lg p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EFEFEA]">
        <div>
          <h2 className="text-sm font-semibold text-[#1A1A1A] tracking-tight">
            Registration & Organization Growth
          </h2>
          <p className="text-xs text-[#777777] mt-0.5">
            Real database signups and workspace creations computed from creation timestamps.
          </p>
        </div>

        <div className="inline-flex bg-[#F7F7F5] border border-[#E8E8E5] rounded-md p-0.5 self-start">
          {(['daily', 'weekly', 'monthly'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setPeriod(tab);
                setHoveredIdx(null);
              }}
              className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                period === tab
                  ? 'bg-white text-[#1A1A1A] border border-[#E8E8E5]'
                  : 'text-[#666666] hover:text-[#1A1A1A] border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-[#EFEFEA] text-xs">
        <div>
          <div className="text-[#777777]">Today</div>
          <div className="mt-0.5 font-semibold text-[#1A1A1A] tabular-nums text-sm">
            {analytics.summary.usersToday} users
          </div>
        </div>
        <div>
          <div className="text-[#777777]">This Week</div>
          <div className="mt-0.5 font-semibold text-[#1A1A1A] tabular-nums text-sm">
            {analytics.summary.usersThisWeek} users
          </div>
        </div>
        <div>
          <div className="text-[#777777]">This Month</div>
          <div className="mt-0.5 font-semibold text-[#1A1A1A] tabular-nums text-sm">
            {analytics.summary.usersThisMonth} users · {analytics.summary.orgsThisMonth} orgs
          </div>
        </div>
        <div>
          <div className="text-[#777777]">Monthly Org Growth</div>
          <div className="mt-0.5 font-semibold text-[#1A1A1A] tabular-nums text-sm">
            {analytics.summary.orgGrowthPct !== null
              ? `${analytics.summary.orgGrowthPct >= 0 ? '+' : ''}${analytics.summary.orgGrowthPct}%`
              : '—'}
          </div>
        </div>
      </div>

      {/* Legend + Active Hover Inspect */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-4 pb-2 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[#555555]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#252525] inline-block" />
            <span>Registered Users</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#555555]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#8B806F] inline-block" />
            <span>Organizations Created</span>
          </div>
        </div>
        {activeBucket && (
          <div className="text-xs text-[#555555] tabular-nums">
            <span className="font-medium text-[#1A1A1A]">{activeBucket.label}</span>:{' '}
            {activeBucket.users} users, {activeBucket.organizations} orgs
          </div>
        )}
      </div>

      {/* Responsive Bar Visualization */}
      <div className="mt-2 h-48 flex items-end gap-1.5 pt-6 border-b border-[#E8E8E5]">
        {buckets.map((b, idx) => {
          const userHeightPct = Math.round((b.users / maxValue) * 100);
          const orgHeightPct = Math.round((b.organizations / maxValue) * 100);
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={b.key}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`flex-1 h-full flex flex-col justify-end items-center gap-1 px-0.5 rounded-t transition-colors cursor-default ${
                isHovered ? 'bg-[#FAF9F7]' : ''
              }`}
              title={`${b.label}: ${b.users} users, ${b.organizations} organizations`}
            >
              <div className="w-full flex items-end justify-center gap-0.5 h-40">
                <div
                  className="w-1/2 max-w-[14px] bg-[#252525] rounded-t-sm transition-all"
                  style={{ height: `${b.users > 0 ? Math.max(6, userHeightPct) : 2}%`, opacity: b.users > 0 ? 1 : 0.15 }}
                />
                <div
                  className="w-1/2 max-w-[14px] bg-[#8B806F] rounded-t-sm transition-all"
                  style={{ height: `${b.organizations > 0 ? Math.max(6, orgHeightPct) : 2}%`, opacity: b.organizations > 0 ? 1 : 0.2 }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-1 pt-2 text-[10px] text-[#777777] tabular-nums overflow-hidden">
        {buckets.map((b, idx) => (
          <div
            key={b.key}
            className={`flex-1 text-center truncate ${
              period === 'daily' && idx % 2 === 1 && idx !== buckets.length - 1 ? 'hidden sm:block' : ''
            }`}
          >
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
};
