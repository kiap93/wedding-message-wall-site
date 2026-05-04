import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Utensils, AlertCircle, CheckCircle2, XCircle, Search, Download } from 'lucide-react';
import { RSVP } from '../types';
import { fetchRSVPs } from '../lib/api';

interface RSVPManagerProps {
  projectId: string;
}

export default function RSVPManager({ projectId }: RSVPManagerProps) {
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadRSVPs();
  }, [projectId]);

  async function loadRSVPs() {
    setIsLoading(true);
    const data = await fetchRSVPs(projectId);
    setRsvps(data);
    setIsLoading(false);
  }

  const filteredRSVPs = rsvps.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.email && r.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const attendingCount = rsvps.filter(r => r.attending).length;
  const totalGuests = rsvps.reduce((acc, r) => acc + (r.attending ? r.guest_count : 0), 0);
  const decliningCount = rsvps.filter(r => !r.attending).length;

  const downloadCSV = () => {
    const headers = ['Name', 'Email', 'Attending', 'Guest Count', 'Meal', 'Dietary Notes', 'Custom Responses', 'Date'];
    const rows = rsvps.map(r => [
      r.name,
      r.email || '',
      r.attending ? 'Yes' : 'No',
      r.guest_count,
      r.meal_preference || '',
      r.dietary_requirements || '',
      r.responses ? Object.entries(r.responses).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('|') : v}`).join('; ') : '',
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
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-[#C5A059]/10 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-50 rounded-xl text-green-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Attending</p>
              <h4 className="text-2xl font-serif">{attendingCount} Responses</h4>
            </div>
          </div>
          <p className="text-sm text-gray-500">{totalGuests} total guests expected</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-[#C5A059]/10 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-50 rounded-xl text-red-600">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Declined</p>
              <h4 className="text-2xl font-serif">{decliningCount} Responses</h4>
            </div>
          </div>
          <p className="text-sm text-gray-500">Guests unable to join</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-[#C5A059]/10 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-[#C5A059]/10 rounded-xl text-[#C5A059]">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Guests</p>
              <h4 className="text-2xl font-serif">{totalGuests}</h4>
            </div>
          </div>
          <p className="text-sm text-gray-500">Across all confirmed RSVPs</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-[#C5A059]/10 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <h3 className="text-2xl font-serif">Guest List</h3>
          
          <div className="flex items-center gap-4">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search guests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20"
              />
            </div>
            <button 
              onClick={downloadCSV}
              className="p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
              title="Download CSV"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Guest</th>
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Count</th>
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Preferences</th>
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-gray-400">
                    <div className="w-6 h-6 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredRSVPs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-medium">
                    No RSVP data found.
                  </td>
                </tr>
              ) : (
                filteredRSVPs.map((rsvp) => (
                  <tr key={rsvp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="font-bold">{rsvp.name}</div>
                      <div className="text-xs text-gray-400">{rsvp.email || 'No email provided'}</div>
                    </td>
                    <td className="px-8 py-6">
                      {rsvp.attending ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                          <CheckCircle2 className="w-3 h-3" /> Attending
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                          <XCircle className="w-3 h-3" /> Declined
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6 font-mono text-sm">
                      {rsvp.attending ? `+${rsvp.guest_count}` : '--'}
                    </td>
                    <td className="px-8 py-6">
                      {rsvp.attending ? (
                        <div className="space-y-1">
                          <div className="text-xs font-bold flex items-center gap-1.5">
                            <Utensils className="w-3 h-3 opacity-30" />
                            {rsvp.meal_preference}
                          </div>
                          {rsvp.dietary_requirements && (
                            <div className="text-[10px] text-red-400 flex items-center gap-1.5 font-medium">
                              <AlertCircle className="w-3 h-3" /> {rsvp.dietary_requirements}
                            </div>
                          )}
                          {/* Custom Responses */}
                          {rsvp.responses && Object.entries(rsvp.responses).map(([key, val]) => (
                            <div key={key} className="text-[10px] text-gray-500 border-t border-gray-100 pt-1 mt-1">
                              <span className="font-bold uppercase tracking-tighter opacity-70 mr-1">{key.replace(/_/g, ' ')}:</span>
                              {Array.isArray(val) ? val.join(', ') : String(val)}
                            </div>
                          ))}
                        </div>
                      ) : '--'}
                    </td>
                    <td className="px-8 py-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
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
