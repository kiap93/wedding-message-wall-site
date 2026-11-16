import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, CreditCard, ShieldCheck, RefreshCw, RotateCcw, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
    partiallyRefundedCount: 0,
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
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Transaction Inspector Modal State
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [refundAmountUsd, setRefundAmountUsd] = useState('5.00');
  const [refundReason, setRefundReason] = useState<'requested_by_customer' | 'duplicate' | 'fraudulent'>('requested_by_customer');
  const [isRefunding, setIsRefunding] = useState(false);
  const [isRetryingWebhook, setIsRetryingWebhook] = useState(false);

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
      setSummary({
        ...res.summary,
        partiallyRefundedCount: res.summary.partiallyRefundedCount || 0,
      });
      setTotal(res.total);
      setTotalPages(res.totalPages);
      if (selectedPayment) {
        const refreshed = res.items.find((i) => i.id === selectedPayment.id);
        if (refreshed) setSelectedPayment(refreshed);
      }
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

  const openInspector = (row: PaymentRow) => {
    const remainingCents = Math.max(0, row.amountCents - (row.refundAmountCents || 0));
    setRefundAmountUsd((remainingCents / 100).toFixed(2));
    setRefundReason('requested_by_customer');
    setActionNotice(null);
    setSelectedPayment(row);
  };

  const handleIssueRefund = async () => {
    if (!selectedPayment) return;
    const cents = Math.round(Number(refundAmountUsd) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setActionNotice({ type: 'error', text: 'Enter a valid USD refund amount greater than $0.00.' });
      return;
    }

    setIsRefunding(true);
    setActionNotice(null);
    try {
      const res = await developerApi.issuePaymentRefund(selectedPayment.id, {
        amountCents: cents,
        reason: refundReason,
      });
      setActionNotice({
        type: 'success',
        text: `Refund ${res.refundId} processed (${res.refundStatus}, $${(res.amountRefundedCents / 100).toFixed(2)} USD).${
          res.entitlementRevoked ? ' Event license revoked.' : ' Partial refund recorded; access preserved.'
        }`,
      });
      await loadPayments();
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err?.message || 'Failed to execute Stripe refund' });
    } finally {
      setIsRefunding(false);
    }
  };

  const handleRetryWebhook = async (row: PaymentRow) => {
    setIsRetryingWebhook(true);
    setActionNotice(null);
    try {
      const targetId = row.webhookEventId || row.id;
      const res = await developerApi.retryPaymentWebhook(targetId);
      setActionNotice({
        type: 'success',
        text: `Webhook ${res.retriedWebhookId || targetId} (${res.eventType || 'event'}) re-processed successfully.`,
      });
      await loadPayments();
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err?.message || 'Failed to retry Stripe webhook' });
    } finally {
      setIsRetryingWebhook(false);
    }
  };

  const columns: Column<PaymentRow>[] = [
    {
      header: 'Stripe / Order IDs',
      cell: (row) => (
        <div className="min-w-[200px] space-y-0.5">
          <div className="font-mono text-[11px] text-[#1A1A1A] truncate max-w-[220px]" title={row.transactionId || row.id}>
            {row.stripePaymentIntentId || row.transactionId || row.id}
          </div>
          {row.stripeSessionId && (
            <div className="font-mono text-[10px] text-[#666666] truncate max-w-[220px]" title={row.stripeSessionId}>
              Sess: {row.stripeSessionId}
            </div>
          )}
          {row.orderId && (
            <div className="font-mono text-[10px] text-[#888888] truncate max-w-[220px]" title={row.orderId}>
              Order: {row.orderId}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Customer & Org',
      cell: (row) => (
        <div className="min-w-[160px] space-y-0.5">
          {row.organizationId ? (
            <Link
              to={`/developer/organizations/${encodeURIComponent(row.organizationId)}`}
              className="text-xs font-medium text-[#252525] hover:underline block"
              onClick={(e) => e.stopPropagation()}
            >
              {row.organizationName}
            </Link>
          ) : (
            <span className="text-[#777777] block">{row.organizationName}</span>
          )}
          {(row.customerEmail || row.customerName) && (
            <div className="text-[11px] text-[#666666] truncate max-w-[190px]">
              {row.customerName ? `${row.customerName} · ` : ''}
              {row.customerEmail || row.customerId}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Event',
      cell: (row) => (
        <div>
          <div className="text-[#1A1A1A] font-medium">{row.eventName}</div>
          <div className="text-[11px] font-mono text-[#777777]">
            {row.eventSlug ? `/${row.eventSlug}` : row.orderType || 'event'}
          </div>
        </div>
      ),
    },
    {
      header: 'Amount',
      align: 'right',
      cell: (row) => (
        <div className="text-right tabular-nums">
          <div className="font-semibold text-[#1A1A1A]">
            {formatCurrencyUsd(row.amountCents, true)}
          </div>
          <div className="text-[10px] text-[#777777] uppercase">{row.currency}</div>
          {row.refundAmountCents > 0 && (
            <div className="text-[10px] text-[#B45309]">
              -{formatCurrencyUsd(row.refundAmountCents, true)} refunded
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Payment / Webhook',
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={row.status} />
            {row.webhookStatus && <StatusBadge status={row.webhookStatus} />}
          </div>
          {row.failureReason && (
            <div className="text-[10px] text-[#B91C1C] truncate max-w-[180px]" title={row.failureReason}>
              {row.failureReason}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Timestamp',
      align: 'right',
      cell: (row) => (
        <div className="text-right space-y-1">
          <div className="tabular-nums text-[#666666]">{formatDateTimeShort(row.paidAt || row.createdAt)}</div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openInspector(row);
            }}
            className="text-[11px] font-medium text-[#252525] underline hover:text-[#000000]"
          >
            Inspect
          </button>
        </div>
      ),
    },
  ];

  const remainingRefundCents = selectedPayment
    ? Math.max(0, selectedPayment.amountCents - (selectedPayment.refundAmountCents || 0))
    : 0;
  const canRefundSelected = Boolean(
    selectedPayment &&
      ['succeeded', 'partially_refunded'].includes(selectedPayment.status) &&
      selectedPayment.provider === 'stripe' &&
      remainingRefundCents > 0
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">Payments & Revenue Ledger</h1>
        <p className="text-xs text-[#666666] mt-0.5">
          Platform-wide USD event activation billing, Stripe reconciliation, webhook diagnostics, and refunds.
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Collected Net Revenue (USD)"
          value={formatCurrencyUsd(summary.totalRevenueCents, true)}
          sublabel="Net of partial & full refunds"
          accent="success"
        />
        <KpiCard
          label="Completed Payments"
          value={summary.completedCount}
          sublabel="Active settled licenses"
        />
        <KpiCard
          label="Pending / Failed"
          value={`${summary.pendingCount} / ${summary.failedCount}`}
          sublabel="Excluded from collected revenue"
          accent={summary.pendingCount + summary.failedCount > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Refunded Total"
          value={formatCurrencyUsd(summary.refundedAmountCents, true)}
          sublabel={`${summary.refundedCount} full · ${summary.partiallyRefundedCount} partial · ${summary.cancelledCount} cancelled`}
        />
      </div>

      {/* Accounting integrity notice */}
      <div className="bg-white border border-[#E8E8E5] rounded-lg px-4 py-3 flex items-center gap-2.5 text-xs text-[#555555]">
        <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0" />
        <span>
          <strong className="text-[#1A1A1A]">Strict Revenue Accounting:</strong> Collected revenue deducts all Stripe
          refunds and strictly excludes pending, failed, cancelled, and test/demo transactions.
        </span>
      </div>

      {actionNotice && !selectedPayment && (
        <div
          className={`border rounded-lg px-4 py-3 text-xs flex items-center justify-between gap-3 ${
            actionNotice.type === 'success'
              ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
          }`}
        >
          <span>{actionNotice.text}</span>
          <button type="button" onClick={() => setActionNotice(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

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
            placeholder="Search session, PaymentIntent, order ID, customer, org..."
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
          <option value="partially_refunded">Partially Refunded</option>
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
        onRowClick={openInspector}
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

      {/* Transaction Detail, Refund & Webhook Recovery Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E8E5] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-5 py-4 border-b border-[#E8E8E5] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#1A1A1A]">Transaction & Stripe Diagnostics</h2>
                <p className="text-[11px] font-mono text-[#666666] mt-0.5">{selectedPayment.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="p-1.5 text-[#666666] hover:text-[#1A1A1A] rounded hover:bg-[#F7F7F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 text-xs">
              {actionNotice && (
                <div
                  className={`border rounded-lg p-3 flex items-start gap-2 ${
                    actionNotice.type === 'success'
                      ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]'
                      : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                  }`}
                >
                  {actionNotice.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{actionNotice.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-lg p-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#777777]">Status & Amount</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-semibold text-sm tabular-nums text-[#1A1A1A]">
                      {formatCurrencyUsd(selectedPayment.amountCents, true)} {selectedPayment.currency}
                    </span>
                    <StatusBadge status={selectedPayment.status} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#777777]">Customer & Organization</div>
                  <div className="mt-1 text-[#1A1A1A] font-medium">{selectedPayment.organizationName}</div>
                  <div className="text-[11px] text-[#666666]">
                    {selectedPayment.customerName || '—'} ({selectedPayment.customerEmail || selectedPayment.customerId || '—'})
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#777777]">Order ID</div>
                  <div className="mt-1 font-mono text-[11px] break-all text-[#1A1A1A]">
                    {selectedPayment.orderId || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#777777]">Event</div>
                  <div className="mt-1 font-medium text-[#1A1A1A]">{selectedPayment.eventName}</div>
                  <div className="font-mono text-[10px] text-[#777777]">{selectedPayment.eventId || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#777777]">Stripe Session ID</div>
                  <div className="mt-1 font-mono text-[11px] break-all text-[#1A1A1A]">
                    {selectedPayment.stripeSessionId || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#777777]">Stripe PaymentIntent ID</div>
                  <div className="mt-1 font-mono text-[11px] break-all text-[#1A1A1A]">
                    {selectedPayment.stripePaymentIntentId || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#777777]">Stripe Refund ID & Status</div>
                  <div className="mt-1 text-[#1A1A1A]">
                    <span className="capitalize font-medium">{selectedPayment.refundStatus}</span>{' '}
                    {selectedPayment.refundAmountCents > 0 &&
                      `(${formatCurrencyUsd(selectedPayment.refundAmountCents, true)})`}
                    {selectedPayment.stripeRefundId && (
                      <div className="font-mono text-[10px] text-[#666666] break-all">
                        {selectedPayment.stripeRefundId}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#777777]">Webhook Status & Event ID</div>
                  <div className="mt-1 space-y-1">
                    {selectedPayment.webhookStatus ? (
                      <StatusBadge status={selectedPayment.webhookStatus} />
                    ) : (
                      <span className="text-[#777777]">Not recorded</span>
                    )}
                    {selectedPayment.webhookEventId && (
                      <div className="font-mono text-[10px] text-[#666666] break-all">
                        {selectedPayment.webhookEventId}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(selectedPayment.failureReason || selectedPayment.webhookErrorDetails) && (
                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3 space-y-1 text-[#B91C1C]">
                  <div className="font-semibold text-[11px] uppercase tracking-wider">Failure Diagnostics</div>
                  {selectedPayment.failureReason && <div>Payment Reason: {selectedPayment.failureReason}</div>}
                  {selectedPayment.webhookErrorDetails && (
                    <div>Webhook Error: {selectedPayment.webhookErrorDetails}</div>
                  )}
                </div>
              )}

              {/* Webhook Retry Control */}
              {(selectedPayment.webhookEventId || selectedPayment.orderId) && (
                <div className="border border-[#E8E8E5] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[#1A1A1A]">Webhook Recovery</div>
                    <div className="text-[11px] text-[#666666]">
                      Re-run stored Stripe webhook payload cleanly if database activation previously failed.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isRetryingWebhook}
                    onClick={() => handleRetryWebhook(selectedPayment)}
                    className="h-8 px-3 bg-white border border-[#D5D5D0] rounded text-xs font-medium text-[#1A1A1A] hover:bg-[#F7F7F5] inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRetryingWebhook ? 'animate-spin' : ''}`} />
                    <span>{isRetryingWebhook ? 'Retrying...' : 'Retry Webhook'}</span>
                  </button>
                </div>
              )}

              {/* Full / Partial Refund Control */}
              {canRefundSelected && (
                <div className="border border-[#E8E8E5] rounded-lg p-4 space-y-3">
                  <div>
                    <div className="font-semibold text-[#1A1A1A]">Issue Stripe Refund</div>
                    <div className="text-[11px] text-[#666666]">
                      Full refund ({formatCurrencyUsd(remainingRefundCents, true)}) revokes event access. Partial
                      refund logs an adjustment while preserving active access.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#777777] mb-1">
                        Refund Amount (USD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.50"
                        max={(remainingRefundCents / 100).toFixed(2)}
                        value={refundAmountUsd}
                        onChange={(e) => setRefundAmountUsd(e.target.value)}
                        className="w-full h-9 px-2.5 bg-[#F7F7F5] border border-[#E8E8E5] rounded text-xs font-mono text-[#1A1A1A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#777777] mb-1">
                        Stripe Reason
                      </label>
                      <select
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value as any)}
                        className="w-full h-9 px-2.5 bg-[#F7F7F5] border border-[#E8E8E5] rounded text-xs text-[#1A1A1A]"
                      >
                        <option value="requested_by_customer">Requested by customer</option>
                        <option value="duplicate">Duplicate charge</option>
                        <option value="fraudulent">Fraudulent</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={isRefunding}
                        onClick={handleIssueRefund}
                        className="w-full h-9 px-3 bg-[#B91C1C] text-white rounded text-xs font-medium hover:bg-[#991B1B] inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{isRefunding ? 'Processing...' : 'Execute Refund'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
