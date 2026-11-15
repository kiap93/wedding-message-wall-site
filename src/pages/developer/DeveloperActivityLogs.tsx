import React, { useEffect, useState, useCallback } from 'react';
import { Search, ScrollText, Code2 } from 'lucide-react';
import { developerApi, ActivityLogRow } from '../../lib/developerApi';
import DataTable, { Column } from '../../design-system/components/DataTable';
import EmptyState from '../../design-system/components/EmptyState';
import Modal from '../../design-system/components/Modal';
import {
  PaginationBar,
  ErrorAlert,
  formatDateTimeShort,
} from '../../components/developer/DeveloperShared';

const ACTION_OPTIONS = [
  'USER_REGISTERED',
  'ORGANIZATION_CREATED',
  'EVENT_CREATED',
  'PAYMENT_COMPLETED',
  'PAYMENT_REFUNDED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_REACTIVATED',
  'ORGANIZATION_STATUS_UPDATED',
  'SETTINGS_UPDATED',
];

export default function DeveloperActivityLogs() {
  const [items, setItems] = useState<ActivityLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 25;

  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<ActivityLogRow | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getActivityLogs({
        search,
        action,
        dateFrom,
        dateTo,
        page,
        limit,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [search, action, dateFrom, dateTo, page]);

  useEffect(() => {
    const t = setTimeout(loadLogs, 150);
    return () => clearTimeout(t);
  }, [loadLogs]);

  const columns: Column<ActivityLogRow>[] = [
    {
      header: 'Timestamp',
      cell: (row) => (
        <span className="tabular-nums text-[#666666] whitespace-nowrap">
          {formatDateTimeShort(row.createdAt)}
        </span>
      ),
    },
    {
      header: 'Action',
      cell: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded border border-[#E8E8E5] bg-[#F7F7F5] font-mono text-[10px] font-semibold text-[#1A1A1A] whitespace-nowrap">
          {row.action}
        </span>
      ),
    },
    {
      header: 'Actor',
      cell: (row) => (
        <div>
          <div className="font-mono text-[11px] text-[#1A1A1A]">{row.actorEmail || 'system'}</div>
          {row.actorRole && <div className="text-[10px] text-[#777777]">{row.actorRole}</div>}
        </div>
      ),
    },
    {
      header: 'Summary',
      cell: (row) => <span className="text-[#444444]">{row.summary || '—'}</span>,
    },
    {
      header: 'Reference',
      cell: (row) => (
        <span className="font-mono text-[10px] text-[#777777]">
          {row.referenceId || row.organizationId || row.targetUserId || row.targetEventId || '—'}
        </span>
      ),
    },
    {
      header: 'Metadata',
      align: 'right',
      cell: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLog(row);
          }}
          className="h-7 px-2 bg-white border border-[#E8E8E5] rounded text-[11px] text-[#252525] hover:bg-[#FAF9F7] inline-flex items-center gap-1"
        >
          <Code2 className="w-3 h-3" />
          <span>JSON</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">Activity & Audit Logs</h1>
        <p className="text-xs text-[#666666] mt-0.5">
          Immutable platform event trail covering account registrations, org lifecycle, payments, and admin actions.
        </p>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-[#E8E8E5] rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search actor, summary, ref..."
            className="w-full h-9 pl-8 pr-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A] focus:outline-none focus:bg-white focus:border-[#252525]"
          />
        </div>

        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A]"
        >
          <option value="all">All Actions</option>
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          title="From Date"
          className="h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A]"
        />

        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          title="To Date"
          className="h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A]"
        />
      </div>

      {error && <ErrorAlert message={error} onRetry={loadLogs} />}

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(row) => row.id}
        isLoading={loading}
        onRowClick={(row) => setSelectedLog(row)}
        emptyState={
          <EmptyState
            icon={<ScrollText className="w-5 h-5" />}
            title="No audit events match your filters"
            description="Platform events and administrative actions will appear here as they occur."
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

      {/* JSON Metadata Modal */}
      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? selectedLog.action : 'Audit Event'}
        description={
          selectedLog ? `${formatDateTimeShort(selectedLog.createdAt)} · ${selectedLog.actorEmail || 'system'}` : ''
        }
        maxWidth="lg"
        footer={
          <button
            type="button"
            onClick={() => setSelectedLog(null)}
            className="h-8 px-3.5 bg-[#252525] text-white rounded text-xs font-medium hover:bg-[#3A3A3A]"
          >
            Close
          </button>
        }
      >
        {selectedLog && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded">
              <div className="text-[#777777] mb-0.5">Summary</div>
              <div className="text-[#1A1A1A] font-medium">{selectedLog.summary || '—'}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#555555] mb-1">Payload Metadata</div>
              <pre className="p-3 bg-[#1A1A1A] text-[#F7F7F5] rounded-md font-mono text-[11px] overflow-x-auto">
                {JSON.stringify(selectedLog.metadata || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
