import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { getSuperAdminHistory } from '@/services/ticketService';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';

export default function SuperAdminHistory() {
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSuperAdminHistory();
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to load configuration history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useRealtimeRefresh({
    refresh: loadHistory,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 15000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.trim().toLowerCase();
    return history.filter(
      (log) =>
        (log.user || '').toLowerCase().includes(q) ||
        (log.action || '').toLowerCase().includes(q) ||
        (log.module || '').toLowerCase().includes(q) ||
        (log.target || '').toLowerCase().includes(q) ||
        (log.details || '').toLowerCase().includes(q)
    );
  }, [history, search]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-[#252578]">Configuration History</h1>
        <p className="mt-1 text-sm text-gray-500">Timeline of all equipment categories and priority level updates.</p>
      </div>

      <div className="relative w-full">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search history..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-5 py-4 whitespace-nowrap">Timestamp</th>
              <th className="px-5 py-4 whitespace-nowrap">User</th>
              <th className="px-5 py-4 whitespace-nowrap">Action</th>
              <th className="px-5 py-4 whitespace-nowrap">Module</th>
              <th className="px-5 py-4 whitespace-nowrap">Target</th>
              <th className="px-5 py-4 whitespace-nowrap">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-5 py-8 text-center text-sm text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#252578] border-t-transparent" />
                    Loading history...
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-5 py-8 text-center text-sm text-gray-500">No history records found.</td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{log.timestamp}</td>
                  <td className="px-5 py-4 text-sm text-gray-800 whitespace-nowrap font-medium">{log.user}</td>
                  <td className="px-5 py-4 text-sm whitespace-nowrap">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      log.action === 'Created' ? 'bg-green-100 text-green-700' :
                      log.action === 'Deleted' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>{log.action}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{log.module}</td>
                  <td className="px-5 py-4 text-sm text-gray-800 whitespace-nowrap font-medium">{log.target}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{log.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
