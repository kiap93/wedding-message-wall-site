import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Mail,
  Eye,
  CheckCircle2,
  AlertCircle,
  Save,
  Calendar,
} from 'lucide-react';
import {
  developerApi,
  ContactInquiryRow,
  ContactInquirySummary,
  ContactEnquiryStatus,
} from '../../lib/developerApi';
import DataTable, { Column } from '../../design-system/components/DataTable';
import EmptyState from '../../design-system/components/EmptyState';
import Modal from '../../design-system/components/Modal';
import {
  KpiCard,
  StatusBadge,
  PaginationBar,
  ErrorAlert,
  formatDateTimeShort,
} from '../../components/developer/DeveloperShared';

export default function DeveloperContactEnquiries() {
  const [items, setItems] = useState<ContactInquiryRow[]>([]);
  const [summary, setSummary] = useState<ContactInquirySummary>({
    total: 0,
    newCount: 0,
    inProgressCount: 0,
    resolvedCount: 0,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 15;

  const [search, setSearch] = useState('');
  const [enquiryType, setEnquiryType] = useState('all');
  const [status, setStatus] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ContactInquiryRow | null>(null);
  const [editStatus, setEditStatus] = useState<ContactEnquiryStatus>('NEW');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadEnquiries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getContactEnquiries({
        search,
        enquiryType: enquiryType === 'all' ? undefined : enquiryType,
        status: status === 'all' ? undefined : status,
        page,
        limit,
      });
      setItems(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load contact enquiries');
    } finally {
      setLoading(false);
    }
  }, [search, enquiryType, status, page]);

  useEffect(() => {
    const timer = setTimeout(loadEnquiries, 150);
    return () => clearTimeout(timer);
  }, [loadEnquiries]);

  const openDetailModal = (row: ContactInquiryRow) => {
    setSelected(row);
    setEditStatus(row.status);
    setEditNotes(row.internalNotes || '');
    setSaveFeedback(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || saving) return;

    setSaving(true);
    setSaveFeedback(null);
    try {
      const res = await developerApi.updateContactInquiry(selected.id, {
        status: editStatus,
        internalNotes: editNotes.trim() || null,
      });
      setSelected(res.inquiry);
      setEditStatus(res.inquiry.status);
      setEditNotes(res.inquiry.internalNotes || '');
      setSaveFeedback({ type: 'success', text: 'Enquiry status and internal notes saved.' });
      await loadEnquiries();
    } catch (err: any) {
      setSaveFeedback({
        type: 'error',
        text: err?.message || 'Failed to save enquiry changes.',
      });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<ContactInquiryRow>[] = [
    {
      header: 'Customer',
      cell: (row) => (
        <div className="min-w-[180px]">
          <div className="font-medium text-[#1A1A1A]">{row.name}</div>
          <div className="text-[11px] font-mono text-[#777777]">{row.email}</div>
        </div>
      ),
    },
    {
      header: 'Category',
      cell: (row) => (
        <span className="text-xs font-medium text-[#252525] whitespace-nowrap">
          {row.enquiryTypeLabel}
        </span>
      ),
    },
    {
      header: 'Subject',
      cell: (row) => (
        <div className="min-w-[200px] max-w-xs">
          <div className="text-xs font-medium text-[#1A1A1A] truncate">{row.subject}</div>
          {row.eventName && (
            <div className="text-[11px] text-[#777777] truncate flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3 shrink-0" />
              <span>{row.eventName}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Delivery',
      cell: (row) => (
        <div className="text-[11px] whitespace-nowrap">
          {row.adminNotificationSent ? (
            <span className="text-[#15803D] font-medium">
              Admin sent{row.customerAckSent ? ' · Ack sent' : ''}
            </span>
          ) : (
            <span className="text-[#B91C1C] font-medium">Email pending/failed</span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Submitted',
      align: 'right',
      cell: (row) => (
        <span className="tabular-nums text-[#666666] whitespace-nowrap">
          {formatDateTimeShort(row.createdAt)}
        </span>
      ),
    },
    {
      header: 'Inspect',
      align: 'right',
      cell: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openDetailModal(row);
          }}
          className="h-7 px-2.5 bg-white border border-[#E8E8E5] rounded text-[11px] font-medium text-[#252525] hover:bg-[#FAF9F7] inline-flex items-center gap-1"
        >
          <Eye className="w-3 h-3" />
          <span>View</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">
          Contact Enquiries
        </h1>
        <p className="text-xs text-[#666666] mt-0.5">
          Customer enquiries submitted via eventframe.io/contact, Resend delivery tracking, and internal follow-up notes.
        </p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="Total Enquiries" value={summary.total} />
        <KpiCard label="New" value={summary.newCount} accent="warning" />
        <KpiCard label="In Progress" value={summary.inProgressCount} />
        <KpiCard label="Resolved" value={summary.resolvedCount} accent="success" />
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E8E8E5] rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, email, subject, event, message..."
            className="w-full h-9 pl-8 pr-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A] focus:outline-none focus:bg-white focus:border-[#252525]"
          />
        </div>

        <select
          value={enquiryType}
          onChange={(e) => {
            setEnquiryType(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A]"
        >
          <option value="all">All Categories</option>
          <option value="general">General Enquiries</option>
          <option value="technical_support">Technical Support</option>
          <option value="partnerships">Business Partnerships</option>
          <option value="billing">Billing & Payments</option>
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
          <option value="NEW">New</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadEnquiries} />}

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(row) => row.id}
        isLoading={loading}
        onRowClick={openDetailModal}
        emptyState={
          <EmptyState
            icon={<Mail className="w-6 h-6 text-[#8B806F]" />}
            title="No contact enquiries found"
            description="Customer enquiries from eventframe.io/contact will appear here once submitted."
          />
        }
      />

      {total > 0 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setPage}
        />
      )}

      {/* Detail & Triage Modal */}
      <Modal
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? selected.subject : 'Contact Enquiry'}
        maxWidth="2xl"
      >
        {selected && (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg p-4 text-xs">
              <div>
                <div className="text-[#777777]">Customer Name</div>
                <div className="font-semibold text-[#1A1A1A] mt-0.5">{selected.name}</div>
              </div>
              <div>
                <div className="text-[#777777]">Email Address</div>
                <div className="mt-0.5">
                  <a
                    href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}
                    className="font-mono text-[#252525] underline hover:text-[#8B806F]"
                  >
                    {selected.email}
                  </a>
                </div>
              </div>
              <div>
                <div className="text-[#777777]">Enquiry Category</div>
                <div className="font-medium text-[#1A1A1A] mt-0.5">{selected.enquiryTypeLabel}</div>
              </div>
              <div>
                <div className="text-[#777777]">Submitted</div>
                <div className="tabular-nums text-[#1A1A1A] mt-0.5">
                  {formatDateTimeShort(selected.createdAt)}
                </div>
              </div>
              {selected.eventName && (
                <div className="sm:col-span-2">
                  <div className="text-[#777777]">Event Name</div>
                  <div className="font-medium text-[#1A1A1A] mt-0.5">{selected.eventName}</div>
                </div>
              )}
              <div className="sm:col-span-2 pt-2 border-t border-[#E8E8E5] flex flex-wrap items-center justify-between gap-2">
                <div className="text-[#777777]">
                  Admin Notification:{' '}
                  <span className={selected.adminNotificationSent ? 'text-[#15803D] font-medium' : 'text-[#B91C1C] font-medium'}>
                    {selected.adminNotificationSent ? 'Sent to eventframeio@gmail.com' : 'Failed'}
                  </span>
                </div>
                <div className="text-[#777777]">
                  Customer Acknowledgement:{' '}
                  <span className={selected.customerAckSent ? 'text-[#15803D] font-medium' : 'text-[#B45309] font-medium'}>
                    {selected.customerAckSent ? 'Sent' : 'Not sent'}
                  </span>
                </div>
                {selected.notificationError && (
                  <div className="w-full text-[11px] font-mono text-[#B91C1C]">
                    Delivery detail: {selected.notificationError}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#777777] mb-1.5">
                Message
              </div>
              <div className="bg-white border border-[#E8E8E5] rounded-lg p-4 text-xs text-[#252525] leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                {selected.message}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#EFEFEA]">
              <div>
                <label className="block text-xs font-medium text-[#252525] mb-1.5">
                  Enquiry Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as ContactEnquiryStatus)}
                  className="w-full h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:border-[#252525] focus:outline-none"
                >
                  <option value="NEW">NEW</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#252525] mb-1.5">
                  Internal Notes
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add internal follow-up notes (visible only to Super Admins)..."
                  className="w-full px-3 py-2 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:border-[#252525] focus:outline-none resize-y"
                />
              </div>
            </div>

            {saveFeedback && (
              <div
                className={`p-3 rounded-md border text-xs flex items-center gap-2 ${
                  saveFeedback.type === 'success'
                    ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]'
                    : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                }`}
              >
                {saveFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{saveFeedback.text}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="h-9 px-4 rounded-md border border-[#E8E8E5] text-xs font-medium text-[#555555] hover:bg-[#FAF9F7]"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-4 rounded-md bg-[#252525] text-white text-xs font-medium hover:bg-[#383838] disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Updates'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
