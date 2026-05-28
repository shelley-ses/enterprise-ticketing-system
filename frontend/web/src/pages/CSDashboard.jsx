import React, { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import unassignedIcon from '@/assets/cs-unassigned.png';
import pendingIcon from '@/assets/cs-pending.png';
import assignedIcon from '@/assets/cs-assigned.png';
import prioIcon from '@/assets/cs-prio.png';
import warnIcon from '@/assets/cs-warning.png';
import { getCSDashboard } from '@/services/ticketService';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';

const MOCK_STATS = {
  unassigned: 7,
  pending: 3,
  assigned: 9,
  highPriority: 11,
  slaWarnings: 9,
};

const MOCK_TICKETS = [
  { id: 'TKT-1006', customer: 'QC General Hospital', title: 'X-Ray Machine Failure', status: 'New', priority: 'Low', updated: '1 hr ago', sla: '2026-03-28T20:00:00Z' },
  { id: 'TKT-1016', customer: 'St Lukes Taguig', title: 'Ultrasound Equipment Malfunction', status: 'New', priority: 'High', updated: '3 hrs ago', sla: '2026-03-29T12:00:00Z' },
  { id: 'TKT-1007', customer: 'Philippine General Hospital', title: 'CT Scan Machine Error', status: 'Ongoing', priority: 'Medium', updated: '5 hrs ago', sla: '2026-03-30T09:00:00Z' },
  { id: 'TKT-1017', customer: 'The Medical City', title: 'X-Ray Calibration Issue', status: 'New', priority: 'High', updated: '2 hrs ago', sla: '2026-03-29T12:00:00Z' },
];

function formatSla(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function CSDashboard() {
  const { refreshKey = 0 } = useOutletContext() || {};
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);

  const loadDashboard = useCallback(async ({ forceRefresh = false } = {}) => {
    setLoading(true);
    setError(null);
    setShowRefreshBanner(false);

    try {
      const payload = await getCSDashboard({ limit: 10, forceRefresh: forceRefresh || refreshKey > 0 });
      setStats({
        unassigned: payload.summary?.open ?? MOCK_STATS.unassigned,
        pending: payload.summary?.in_progress ?? MOCK_STATS.pending,
        assigned: payload.summary?.resolved ?? MOCK_STATS.assigned,
        highPriority: 0,
        slaWarnings: 0,
      });
      setTickets((payload.recent_tickets || MOCK_TICKETS).map((t) => ({
        ...t,
        updated: t.updated_at ? new Date(t.updated_at).toLocaleString() : t.updated || 'Just now',
        priority: t.priority || 'Unassigned',
      })));
    } catch (err) {
      setError('Unable to load data from API — using local mock data.');
      setStats(MOCK_STATS);
      setTickets(MOCK_TICKETS);
    } finally {
      setLoading(false);
    }
  }, [refreshKey]);

  const probeForUpdates = useCallback(async ({ source }) => {
    // Only show banner on real websocket events, not empty polls
    if (source === 'websocket') {
      setShowRefreshBanner(true);
    }
  }, []);

  useEffect(() => {
    loadDashboard({ forceRefresh: false });
  }, [loadDashboard]);

  useRealtimeRefresh({
    refresh: loadDashboard,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 30000,
    deferRefresh: true,
    onRefreshAvailable: ({ source }) => {
      if (source === 'websocket') {
        setShowRefreshBanner(true);
      }
    },
  });

  const statItems = stats
    ? [
        { label: 'Unassigned Tickets', value: stats.unassigned, icon: unassignedIcon },
        { label: 'Pending Tickets', value: stats.pending, icon: pendingIcon },
        { label: 'Assigned Tickets', value: stats.assigned, icon: assignedIcon },
        { label: 'High Priority', value: stats.highPriority, icon: prioIcon },
        { label: 'SLA Warnings', value: stats.slaWarnings, icon: warnIcon },
      ]
    : [];

  return (
    <div className="p-6">
      {showRefreshBanner && (
        <div 
          onClick={() => loadDashboard({ forceRefresh: true })}
          className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm cursor-pointer hover:bg-blue-100/50 transition-colors"
        >
          <div>
            <div className="font-semibold">New CS dashboard data available</div>
            <div className="text-xs text-blue-700">Load the latest queue and ticket summary when ready.</div>
          </div>
          <button
            type="button"
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 pointer-events-none"
          >
            Load latest
          </button>
        </div>
      )}
      {loading ? (
        <div className="p-8 text-center">Loading dashboard...</div>
      ) : (
        <>
          {error && (
            <div className="mb-4 p-3 text-sm bg-yellow-50 text-yellow-800 rounded">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            {statItems.map((s) => (
              <div key={s.label} className="bg-white rounded-2xl shadow-md p-4 flex items-center gap-4">
                <div className="w-14 h-14 bg-[#f1f5f9] rounded-lg flex items-center justify-center">
                  <img src={s.icon} alt="" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-800">{s.value}</div>
                  <div className="text-sm text-gray-500">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Ticket Activities</h2>
              <div className="text-sm text-gray-500">Showing {tickets.length} rows</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="py-3 px-4">Ticket ID</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Last Updated</th>
                    <th className="py-3 px-4">SLA</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {tickets.map((r, idx) => (
                    <tr key={r.id + idx} className={`${idx === 0 ? 'bg-blue-50' : ''} border-b`}>
                      <td className="py-3 px-4 font-medium text-sm">{r.id}</td>
                      <td className="py-3 px-4 text-gray-600">{r.customer}</td>
                      <td className="py-3 px-4 text-gray-700">{r.title}</td>
                      <td className="py-3 px-4"><span className="px-3 py-1 rounded-full text-xs bg-gray-100">{r.status}</span></td>
                      <td className="py-3 px-4"><span className="px-3 py-1 rounded-full text-xs bg-gray-100">{r.priority}</span></td>
                      <td className="py-3 px-4 text-gray-500">{r.updated}</td>
                      <td className="py-3 px-4 text-sm text-red-600">{formatSla(r.sla)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SLA Warnings Section */}
          <div className="mt-8 bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-3">
              <span className="text-red-600">⚠️</span>
              SLA Warnings
            </h2>

            <div className="space-y-4">
              {[
                { id: 'TKT-1001', title: 'ICU Ventilator (SB-VX3000) not powering on', sla: '2026-03-26T20:00:00Z', status: 'Breached', tone: 'breached' },
                { id: 'TKT-1011', title: 'Anesthesia Machine gas flow sensor error', sla: '2026-03-27T07:00:00Z', status: 'At Risk', tone: 'risk' },
                { id: 'TKT-1021', title: 'Hematology Analyzer reagent pack error', sla: '2026-03-28T09:00:00Z', status: 'At Risk', tone: 'risk' },
              ].map((s) => (
                <div key={s.id} className={`${s.tone === 'breached' ? 'bg-red-600 text-white' : 'bg-white'} rounded-lg p-4 border ${s.tone === 'breached' ? '' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase font-medium tracking-wide">{s.id}</div>
                      <div className={`mt-2 text-sm ${s.tone === 'breached' ? 'font-semibold' : 'text-gray-800'}`}>{s.title}</div>
                      <div className={`mt-2 text-xs ${s.tone === 'breached' ? 'text-red-100' : 'text-gray-500'}`}>SLA Deadline: {formatSla(s.sla)}</div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {s.tone === 'breached' ? (
                        <span className="px-3 py-1 rounded-full text-xs bg-white text-red-600">Breached</span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">At Risk</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
