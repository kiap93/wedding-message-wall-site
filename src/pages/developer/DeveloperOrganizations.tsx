import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2 } from 'lucide-react';
import { developerApi, OrganizationRow } from '../../lib/developerApi';
import DataTable, { Column } from '../../design-system/components/DataTable';
import EmptyState from '../../design-system/components/EmptyState';
import {
  StatusBadge,
  PaginationBar,
  ErrorAlert,
  formatCurrencyUsd,
  formatDateShort,
} from '../../components/developer/DeveloperShared';

export default function DeveloperOrganizations() {
  const navigate = useNavigate();
  const [items, setItems] = useState<OrganizationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 15;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [userRole, setUserRole] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getOrganizations({
        search,
        status,
        userRole,
        sortBy,
        sortDir,
        page,
        limit,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, [search, status, userRole, sortBy, sortDir, page]);

  useEffect(() => {
    const t = setTimeout(loadOrgs, 150);
    return () => clearTimeout(t);
  }, [loadOrgs]);

  const columns: Column<OrganizationRow>[] = [
    {
      header: 'Organization',
      cell: (row) => (
        <div className="min-w-[160px]">
          <div className="font-medium text-[#1A1A1A]">{row.name}</div>
          <div className="text-[11px] font-mono text-[#777777]">
            {row.slug}.eventframe.io{row.domain ? ` · ${row.domain}` : ''}
          </div>
        </div>
      ),
    },
    {
      header: 'Owner',
      cell: (row) => (
        <div className="min-w-[140px]">
          <div className="text-[#252525] truncate max-w-[200px]">{row.ownerName || 'Workspace Owner'}</div>
          <div className="text-[11px] font-mono text-[#777777] truncate max-w-[200px]">
            {row.ownerEmail || row.ownerUserId || '—'}
          </div>
        </div>
      ),
    },
    {
      header: 'Type',
      cell: (row) => <span className="capitalize text-[#555555]">{row.userRole}</span>,
    },
    {
      header: 'Members',
      align: 'right',
      cell: (row) => <span className="tabular-nums font-medium">{row.memberCount}</span>,
    },
    {
      header: 'Events (Active / Total)',
      align: 'right',
      cell: (row) => (
        <span className="tabular-nums">
          <span className="font-semibold text-[#15803D]">{row.activeEventCount}</span>
          <span className="text-[#777777]"> / {row.eventCount}</span>
        </span>
      ),
    },
    {
      header: 'Revenue',
      align: 'right',
      cell: (row) => (
        <span className="tabular-nums font-medium">{formatCurrencyUsd(row.totalRevenueCents, true)}</span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Created',
      align: 'right',
      cell: (row) => <span className="tabular-nums text-[#666666]">{formatDateShort(row.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">Organizations</h1>
        <p className="text-xs text-[#666666] mt-0.5">
          All agency studios and couple workspaces registered on EventFrame.io.
        </p>
      </div>

      {/* Filters Toolbar */}
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
            placeholder="Search name, slug, domain, or owner email..."
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
          <option value="inactive">Inactive</option>
        </select>

        <select
          value={userRole}
          onChange={(e) => {
            setUserRole(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A]"
        >
          <option value="all">All Workspace Types</option>
          <option value="agency">Agency / Studio</option>
          <option value="couple">Couple</option>
        </select>

        <div className="flex items-center gap-2">
          <select
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [sb, sd] = e.target.value.split(':');
              setSortBy(sb);
              setSortDir(sd === 'asc' ? 'asc' : 'desc');
              setPage(1);
            }}
            className="w-full h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A]"
          >
            <option value="created_at:desc">Newest First</option>
            <option value="created_at:asc">Oldest First</option>
            <option value="name:asc">Name (A–Z)</option>
            <option value="events_count:desc">Most Events</option>
            <option value="revenue_cents:desc">Highest Revenue</option>
          </select>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadOrgs} />}

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(row) => row.id}
        isLoading={loading}
        onRowClick={(row) => navigate(`/developer/organizations/${row.id}`)}
        emptyState={
          <EmptyState
            icon={<Building2 className="w-5 h-5" />}
            title="No matching organizations"
            description="Adjust your search query or workspace status filter."
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
