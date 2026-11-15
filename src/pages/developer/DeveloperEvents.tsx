import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, CalendarHeart, Eye, Lock, Globe } from 'lucide-react';
import {
  developerApi,
  PlatformEventRow,
  OrganizationRow,
  PaymentRow,
} from '../../lib/developerApi';
import DataTable, { Column } from '../../design-system/components/DataTable';
import EmptyState from '../../design-system/components/EmptyState';
import Modal from '../../design-system/components/Modal';
import {
  StatusBadge,
  PaginationBar,
  ErrorAlert,
  formatCurrencyUsd,
  formatDateShort,
  formatDateTimeShort,
} from '../../components/developer/DeveloperShared';

export default function DeveloperEvents() {
  const [items, setItems] = useState<PlatformEventRow[]>([]);
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 15;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [organizationId, setOrganizationId] = useState('all');
  const [sort, setSort] = useState('createdAt:desc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectDetail, setInspectDetail] = useState<{
    event: PlatformEventRow & {
      themeId?: string | null;
      packageId?: string;
      websitePublishedAt?: string | null;
      autoApproveMessages?: boolean;
    };
    organization: OrganizationRow | null;
    payments: PaymentRow[];
  } | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [sortBy, sortDir] = sort.split(':');
    try {
      const res = await developerApi.getEvents({
        search,
        status,
        paymentStatus,
        organizationId,
        sortBy,
        sortDir,
        page,
        limit,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [search, status, paymentStatus, organizationId, sort, page]);

  useEffect(() => {
    developerApi
      .getOrganizations({ limit: 100 })
      .then((res) => setOrgs(res.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(loadEvents, 150);
    return () => clearTimeout(t);
  }, [loadEvents]);

  const openInspectModal = async (eventId: string) => {
    setInspectingId(eventId);
    setInspectLoading(true);
    setInspectDetail(null);
    try {
      const detail = await developerApi.getEventDetail(eventId);
      setInspectDetail(detail);
    } catch (err: any) {
      setError(err?.message || 'Failed to load event inspection details');
      setInspectingId(null);
    } finally {
      setInspectLoading(false);
    }
  };

  const columns: Column<PlatformEventRow>[] = [
    {
      header: 'Event',
      cell: (row) => (
        <div className="min-w-[180px]">
          <div className="font-medium text-[#1A1A1A]">{row.name}</div>
          <div className="text-[11px] font-mono text-[#777777]">/{row.slug}</div>
        </div>
      ),
    },
    {
      header: 'Couple',
      cell: (row) => <span className="text-[#555555]">{row.coupleNames}</span>,
    },
    {
      header: 'Organization',
      cell: (row) =>
        row.organizationId ? (
          <Link
            to={`/developer/organizations/${encodeURIComponent(row.organizationId)}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-[#252525] hover:underline font-medium"
          >
            {row.organizationName}
          </Link>
        ) : (
          <span className="text-[#777777]">{row.organizationName}</span>
        ),
    },
    {
      header: 'Lifecycle',
      cell: (row) => <StatusBadge status={row.lifecycleStatus} />,
    },
    {
      header: 'Payment',
      cell: (row) => <StatusBadge status={row.paymentStatus} />,
    },
    {
      header: 'Website',
      cell: (row) => <StatusBadge status={row.websiteStatus} />,
    },
    {
      header: 'Expires',
      align: 'right',
      cell: (row) => <span className="tabular-nums text-[#666666]">{formatDateShort(row.expiresAt)}</span>,
    },
    {
      header: 'Inspect',
      align: 'right',
      cell: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openInspectModal(row.id);
          }}
          className="h-7 px-2.5 bg-white border border-[#E8E8E5] rounded text-[11px] font-medium text-[#252525] hover:bg-[#FAF9F7] inline-flex items-center gap-1"
        >
          <Eye className="w-3 h-3" />
          <span>Inspect</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">Events Inspection</h1>
        <p className="text-xs text-[#666666] mt-0.5">
          Cross-organization wedding event inventory, lifecycle verification, and read-only configuration audit.
        </p>
      </div>

      {/* Read-only enforcement banner */}
      <div className="bg-white border border-[#E8E8E5] rounded-lg px-4 py-3 flex items-center gap-2.5 text-xs text-[#555555]">
        <Eye className="w-4 h-4 text-[#8B806F] shrink-0" />
        <span>
          <strong className="text-[#1A1A1A]">Read-Only Event Inspection:</strong> Event visibility and
          configuration remain owned by each agency or couple. Super Admins inspect metadata without modifying
          owner event settings or passwords.
        </span>
      </div>

      {/* Filter Bar */}
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
            placeholder="Search event, couple, slug, org..."
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
          <option value="all">All Lifecycles</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="draft">Draft</option>
        </select>

        <select
          value={paymentStatus}
          onChange={(e) => {
            setPaymentStatus(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A]"
        >
          <option value="all">All Payment States</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
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

        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A]"
        >
          <option value="createdAt:desc">Newest Created</option>
          <option value="createdAt:asc">Oldest Created</option>
          <option value="expiresAt:asc">Expiring Soonest</option>
          <option value="expiresAt:desc">Expiring Latest</option>
          <option value="name:asc">Name (A–Z)</option>
        </select>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadEvents} />}

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(row) => row.id}
        isLoading={loading}
        onRowClick={(row) => openInspectModal(row.id)}
        emptyState={
          <EmptyState
            icon={<CalendarHeart className="w-5 h-5" />}
            title="No events match your filters"
            description="Try adjusting the lifecycle, payment status, or organization filters."
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

      {/* Read-Only Event Inspection Modal */}
      <Modal
        isOpen={Boolean(inspectingId)}
        onClose={() => {
          setInspectingId(null);
          setInspectDetail(null);
        }}
        title={inspectDetail ? inspectDetail.event.name : 'Inspect Event'}
        description={
          inspectDetail
            ? `Read-only diagnostic view · /${inspectDetail.event.slug}`
            : 'Loading event diagnostics...'
        }
        maxWidth="lg"
        footer={
          <button
            type="button"
            onClick={() => {
              setInspectingId(null);
              setInspectDetail(null);
            }}
            className="h-8 px-3.5 bg-[#252525] text-white rounded text-xs font-medium hover:bg-[#3A3A3A]"
          >
            Close
          </button>
        }
      >
        {inspectLoading && (
          <div className="py-8 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-[#252525] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!inspectLoading && inspectDetail && (
          <div className="space-y-5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={inspectDetail.event.lifecycleStatus} />
              <StatusBadge status={inspectDetail.event.paymentStatus} />
              <StatusBadge status={inspectDetail.event.websiteStatus} />
              {inspectDetail.event.hasAccessPassword && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#E8E8E5] bg-[#F7F7F5] text-[11px] text-[#555555]">
                  <Lock className="w-3 h-3" />
                  <span>Password Protected</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md">
              <div>
                <div className="text-[#777777]">Couple</div>
                <div className="font-medium text-[#1A1A1A] mt-0.5">{inspectDetail.event.coupleNames}</div>
              </div>
              <div>
                <div className="text-[#777777]">Organization</div>
                <div className="font-medium text-[#1A1A1A] mt-0.5">
                  {inspectDetail.organization ? (
                    <Link
                      to={`/developer/organizations/${encodeURIComponent(inspectDetail.organization.id)}`}
                      className="underline hover:text-[#736959]"
                    >
                      {inspectDetail.organization.name}
                    </Link>
                  ) : (
                    inspectDetail.event.organizationName
                  )}
                </div>
              </div>
              <div>
                <div className="text-[#777777]">Wedding Date</div>
                <div className="tabular-nums text-[#1A1A1A] mt-0.5">
                  {formatDateShort(inspectDetail.event.weddingDate)}
                </div>
              </div>
              <div>
                <div className="text-[#777777]">Location</div>
                <div className="text-[#1A1A1A] mt-0.5">{inspectDetail.event.location || '—'}</div>
              </div>
              <div>
                <div className="text-[#777777]">Activated At</div>
                <div className="tabular-nums text-[#1A1A1A] mt-0.5">
                  {formatDateTimeShort(inspectDetail.event.activatedAt)}
                </div>
              </div>
              <div>
                <div className="text-[#777777]">Expires At</div>
                <div className="tabular-nums text-[#1A1A1A] mt-0.5">
                  {formatDateTimeShort(inspectDetail.event.expiresAt)}
                </div>
              </div>
              <div>
                <div className="text-[#777777]">Package / Theme</div>
                <div className="font-mono text-[#1A1A1A] mt-0.5">
                  {inspectDetail.event.packageId || 'standard_event'} ·{' '}
                  {inspectDetail.event.themeId || 'default'}
                </div>
              </div>
              <div>
                <div className="text-[#777777]">Website Published</div>
                <div className="tabular-nums text-[#1A1A1A] mt-0.5 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-[#777777]" />
                  <span>{formatDateTimeShort(inspectDetail.event.websitePublishedAt)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#555555] mb-2">
                Linked Event Payments ({inspectDetail.payments.length})
              </h3>
              {inspectDetail.payments.length === 0 ? (
                <div className="p-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded text-[#777777]">
                  No payment records recorded for this event.
                </div>
              ) : (
                <div className="border border-[#E8E8E5] rounded-md divide-y divide-[#EFEFEA]">
                  {inspectDetail.payments.map((p) => (
                    <div key={p.id} className="px-3 py-2 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[11px] text-[#1A1A1A]">{p.transactionId || p.id}</div>
                        <div className="text-[11px] text-[#777777] capitalize">
                          {p.provider} · {formatDateTimeShort(p.paidAt || p.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="tabular-nums font-medium text-[#1A1A1A]">
                          {formatCurrencyUsd(p.amountCents, true)}
                        </span>
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
