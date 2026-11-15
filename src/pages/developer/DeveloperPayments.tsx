import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, CreditCard, ShieldCheck } from 'lucide-react';
import { developerApi, PaymentRow } from '../../lib/developerApi';
import DataTable, { Column } from '../../design-system/components/DataTable';
import EmptyState from '../../design-system/components/EmptyState';
import {
  KpiCard,
  StatusBadge,
  PaginationBar,
  ErrorAlert,
  formatCurrencyUsd,
  formatDateTimeShort,
} from '../../components/developer/DeveloperShared';

export default function DeveloperPayments() {
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState({
    totalRevenueCents: 0,
    totalRevenueUsd: 0,
    completedCount: 0,
    pendingCount: 0,
    failedCount: 0,
    refundedCount: 0,
    cancelledCount: 0,
    refundedAmountCents: 0,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [provider, setProvider] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getPayments({
        search,
        status,
        provider,
        dateFrom,
        dateTo,
        page,
        limit,
      });
      setItems(res.items);
      setSummary(res.summary);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payment records');
    } finally {
      setLoading(false);
    }
  }, [search, status, provider, dateFrom, dateTo, page]);

  useEffect(() => {
    const t = setTimeout(loadPayments, 150);
    return () => clearTimeout(t);
  }, [loadPayments]);

  const columns: Column<PaymentRow>[] = [
    {
      header: 'Transaction ID',
      cell: (row) => (
        <div className="min-w-[160px]">
          <div className="font-mono text-[11px] text-[#1A1A1A]">{row.transactionId || row.id}</div>
          {row.orderId && <div className="font-mono text-[10px] text-[#777777]">Order: {row.orderId}</div>}
        </div>
      ),
    },
    {
      header: 'Organization',
      cell: (row) =>
        row.organizationId ? (
          <Link
            to={`/developer/organizations/${encodeURIComponent(row.organizationId)}`}
            className="text-xs font-medium text-[#252525] hover:underline"
          >
            {row.organizationName}
          </Link>
        ) : (
          <span className="text-[#777777]">{row.organizationName}</span>
        ),
    },
    {
      header: 'Event',
      cell: (row) => (
        <div>
          <div className="text-[#1A1A1A] font-medium">{row.eventName}</div>
          {row.eventSlug && <div className="text-[11px] font-mono text-[#777777]">/{row.eventSlug}</div>}
        </div>
      ),
    },
    {
      header: 'Provider',
      cell: (row) => <span className="capitalize text-[#555555]">{row.provider}</span>,
    },
    {
      header: 'Amount',
      align: 'right',
      cell: (row) => (
        <span className="tabular-nums font-semibold text-[#1A1A1A]">
          {formatCurrencyUsd(row.amountCents, true)}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Timestamp',
      align: 'right',
      cell: (row) => (
        <span className="tabular-nums text-[#666666]">{formatDateTimeShort(row.paidAt || row.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">Payments & Revenue Ledger</h1>
        <p className="text-xs text-[#666666] mt-0.5">
          Platform-wide USD event activation billing records across organizations and events.
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Collected Revenue (USD)"
          value={formatCurrencyUsd(summary.totalRevenueCents, true)}
          sublabel="Succeeded & non-refunded only"
          accent="success"
        />
        <KpiCard
          label="Completed Payments"
          value={summary.completedCount}
          sublabel="Net settled transactions"
        />
        <KpiCard
          label="Pending / Failed"
          value={`${summary.pendingCount} / ${summary.failedCount}`}
          sublabel="Excluded from collected revenue"
          accent={summary.pendingCount + summary.failedCount > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Refunded (Excluded)"
          value={formatCurrencyUsd(summary.refundedAmountCents, true)}
          sublabel={`${summary.refundedCount} refunded · ${summary.cancelledCount} cancelled`}
        />
      </div>

      {/* Accounting integrity notice */}
      <div className="bg-white border border-[#E8E8E5] rounded-lg px-4 py-3 flex items-center gap-2.5 text-xs text-[#555555]">
        <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0" />
        <span>
          <strong className="text-[#1A1A1A]">Strict Revenue Accounting:</strong> Pending, failed, cancelled,
          refunded, and test/demo transactions are strictly excluded from collected revenue totals.
        </span>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E8E8E5] rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search transaction ID, event, org..."
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
          <option value="succeeded">Succeeded</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A]"
        >
          <option value="all">All Providers</option>
          <option value="stripe">Stripe</option>
          <option value="manual">Manual</option>
          <option value="curlec">Curlec</option>
        </select>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            title="From Date"
            className="w-1/2 h-9 px-2 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-[11px] text-[#1A1A1A]"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            title="To Date"
            className="w-1/2 h-9 px-2 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-[11px] text-[#1A1A1A]"
          />
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadPayments} />}

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(row) => row.id}
        isLoading={loading}
        emptyState={
          <EmptyState
            icon={<CreditCard className="w-5 h-5" />}
            title="No payment records match your filters"
            description="Try clearing the date range or status filters."
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
    </div>
  );
}
