import React, { useState, useEffect } from 'react';
import { Users, CheckCircle2, XCircle, Search, Download, FileSpreadsheet } from 'lucide-react';
import { RSVP, RSVPField } from '../types';
import { fetchRSVPs } from '../lib/api';
import Badge from '../design-system/components/Badge';
import Button from '../design-system/components/Button';

interface RSVPManagerProps {
  projectId: string;
  rsvpFields?: RSVPField[];
}

export default function RSVPManager({ projectId, rsvpFields }: RSVPManagerProps) {
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  let safeRsvpFields: RSVPField[] = [];
  if (Array.isArray(rsvpFields)) {
    safeRsvpFields = rsvpFields;
  } else if (typeof rsvpFields === 'string') {
    try {
      safeRsvpFields = JSON.parse(rsvpFields);
    } catch (e) {
      console.error('Failed to parse rsvpFields string:', e);
      safeRsvpFields = [];
    }
  }

  const activeFields = (safeRsvpFields && safeRsvpFields.length > 0) ? safeRsvpFields : [
    { id: 'name', label: 'Full Name', type: 'text', required: true },
    { id: 'email', label: 'Email Address', type: 'text', required: false },
    { id: 'guest_count', label: 'Guests', type: 'number', required: true, showIfAttending: true },
    { id: 'meal_preference', label: 'Meal Preference', type: 'select', required: true, options: ['Standard', 'Vegetarian', 'Vegan', 'Gluten Free'], showIfAttending: true },
    { id: 'dietary_requirements', label: 'Dietary Notes', type: 'textarea', required: false, showIfAttending: true }
  ];

  const CORE_FIELD_IDS = ['name', 'email', 'guest_count', 'meal_preference', 'dietary_requirements'];

  useEffect(() => {
    loadRSVPs();
  }, [projectId]);

  async function loadRSVPs() {
    setIsLoading(true);
    const data = await fetchRSVPs(projectId);
    const parsedData = (data || []).map(rsvp => ({
      ...rsvp,
      responses: typeof rsvp.responses === 'string' 
        ? JSON.parse(rsvp.responses) 
        : (rsvp.responses || {})
    }));
    setRsvps(parsedData);
    setIsLoading(false);
  }

  const getFieldValue = (rsvp: RSVP, fieldId: string) => {
    if (!rsvp.attending && fieldId !== 'name' && fieldId !== 'email') return '—';
    
    if (CORE_FIELD_IDS.includes(fieldId)) {
      const val = (rsvp as any)[fieldId];
      if (val !== undefined && val !== null && val !== '') {
        if (fieldId === 'guest_count' && rsvp.attending) return `+${val}`;
        return String(val);
      }
    }
    
    let responses = rsvp.responses;
    if (typeof responses === 'string') {
      try {
        responses = JSON.parse(responses);
      } catch (e) {
        return '—';
      }
    }
    
    if (responses && typeof responses === 'object') {
      const customVal = (responses as any)[fieldId];
      if (customVal !== undefined && customVal !== null && customVal !== '') {
        if (Array.isArray(customVal)) return customVal.join(', ');
        return String(customVal);
      }
    }

    const topLevelVal = (rsvp as any)[fieldId];
    if (topLevelVal !== undefined && topLevelVal !== null && topLevelVal !== '') {
      return String(topLevelVal);
    }
    
    return '—';
  };

  const filteredRSVPs = rsvps.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.email && r.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const attendingCount = rsvps.filter(r => r.attending).length;
  const totalGuests = rsvps.reduce((acc, r) => acc + (r.attending ? (Number(r.guest_count) || 1) : 0), 0);
  const decliningCount = rsvps.filter(r => !r.attending).length;

  const downloadCSV = () => {
    const headers = ['Status', ...activeFields.map(f => f.label), 'Submission Date'];
    const rows = rsvps.map(r => [
      r.attending ? 'Attending' : 'Declined',
      ...activeFields.map(f => getFieldValue(r, f.id)),
      new Date(r.created_at).toLocaleDateString()
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rsvps-${projectId}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-[#E8E8E5] shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#777777]">
            <span>Attending Responses</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#252525]">
            {attendingCount}
          </div>
          <div className="mt-1 text-xs text-[#777777]">
            {totalGuests} total attendees confirmed
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#E8E8E5] shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#777777]">
            <span>Declined Responses</span>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#252525]">
            {decliningCount}
          </div>
          <div className="mt-1 text-xs text-[#777777]">
            Guests unable to attend
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#E8E8E5] shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#777777]">
            <span>Total Headcount</span>
            <Users className="w-4 h-4 text-[#8B806F]" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#252525]">
            {totalGuests}
          </div>
          <div className="mt-1 text-xs text-[#777777]">
            Including plus-ones & party members
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-lg border border-[#E8E8E5] shadow-subtle overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-[#E8E8E5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF9F7]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#252525]">Guest Responses</span>
            <span className="text-xs font-mono text-[#777777] bg-white px-2 py-0.5 rounded border border-[#E8E8E5] tabular-nums">
              {filteredRSVPs.length}
            </span>
          </div>
          
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
              <input
                type="text"
                placeholder="Search guest or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs bg-white text-[#252525] placeholder:text-[#999999] border border-[#E8E8E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8B806F] focus:border-[#8B806F] w-48 sm:w-60"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCSV}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E8E8E5] bg-[#FAF9F7]/70 text-[#777777]">
                <th className="py-2.5 px-4 font-medium tracking-tight">Status</th>
                {activeFields.map(field => (
                  <th key={field.id} className="py-2.5 px-4 font-medium tracking-tight">
                    {field.label}
                  </th>
                ))}
                <th className="py-2.5 px-4 font-medium tracking-tight text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEFEA]">
              {isLoading ? (
                <tr>
                  <td colSpan={activeFields.length + 2} className="py-12 text-center text-[#777777]">
                    <div className="w-5 h-5 border-2 border-[#252525] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading guest responses...</span>
                  </td>
                </tr>
              ) : filteredRSVPs.length === 0 ? (
                <tr>
                  <td colSpan={activeFields.length + 2} className="py-12 text-center text-[#777777]">
                    {searchTerm ? 'No guests found matching search criteria.' : 'No RSVP responses recorded yet.'}
                  </td>
                </tr>
              ) : (
                filteredRSVPs.map((rsvp) => (
                  <tr key={rsvp.id} className="hover:bg-[#FCFCFA] transition-colors">
                    <td className="py-3 px-4">
                      {rsvp.attending ? (
                        <Badge variant="success" size="sm">
                          Attending
                        </Badge>
                      ) : (
                        <Badge variant="error" size="sm">
                          Declined
                        </Badge>
                      )}
                    </td>
                    {activeFields.map(field => (
                      <td key={field.id} className={`py-3 px-4 ${field.id === 'name' ? 'font-medium text-[#252525]' : 'text-[#555555]'}`}>
                        {getFieldValue(rsvp, field.id)}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-[#777777] font-mono text-right tabular-nums whitespace-nowrap">
                      {new Date(rsvp.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
