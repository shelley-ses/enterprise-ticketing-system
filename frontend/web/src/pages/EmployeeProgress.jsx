import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  statusColors,
  priorityColors,
  slaStatusColors,
} from '@/constants/employeeTickets';
import { getEmployeeAssignedTickets } from '@/services/ticketService';
import { useAuth } from '@/context/AuthContext';
import SkeletonLoader from '@/components/SkeletonLoader';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';

const HISTORY_STATUSES = ['Closed', 'Resolved', 'Pending Evaluation'];

const getDisplayStatus = (ticket) => (
  ticket.status === 'Pending Evaluation' && ticket.proofRejected !== true
    ? 'Resolved'
    : ticket.status
);

const buildHistorySignature = (list = []) => list
  .map((ticket) => [
    ticket.id,
    ticket.status,
    ticket.lastUpdate ?? ticket.updated_at ?? '',
    ticket.reassignmentRequested ? '1' : '0',
  ].join(':'))
  .join('|');

const selectClass =
  'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer min-w-[8.5rem]';

export default function EmployeeProgress() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [categoryFilter, setCategoryFilter] = useState('All Category');

  const loadHistory = useCallback(async ({ forceRefresh = false } = {}) => {
    const email = user?.email || 'frontend@example.com';
    setLoading(true);
    setLoadError('');
    setShowRefreshBanner(false);
    try {
      const list = await getEmployeeAssignedTickets({ employeeEmail: email, forceRefresh });
      // Show Closed, Resolved, or Reassigned tickets
      setTickets(
        list.filter(
          (t) => HISTORY_STATUSES.includes(t.status) || t.reassignmentRequested
        )
      );
    } catch {
      setLoadError('Unable to load ticket history.');
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  const probeForUpdates = useCallback(async ({ source }) => {
    
    if (source === 'websocket') {
      setShowRefreshBanner(true);
    }
  }, []);

  useEffect(() => {
    loadHistory({ forceRefresh: true });
  }, [loadHistory]);

  useRealtimeRefresh({
    refresh: loadHistory,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 30000,
    deferRefresh: true,
    onRefreshAvailable: ({ source }) => {
      if (source === 'websocket') {
        setShowRefreshBanner(true);
      }
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      const displayStatus = getDisplayStatus(t);

      if (statusFilter !== 'All Status' && displayStatus !== statusFilter) return false;
      if (categoryFilter !== 'All Category' && t.category !== categoryFilter) return false;
      if (q) {
        const blob =
          `${t.id} ${t.title} ${t.customer} ${t.facility ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, search, statusFilter, categoryFilter]);

  const openDetail = (t) => {
    navigate(`/employee/history/${t.id}`, { state: { ticket: t } });
  };

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#252578]">Ticket History</h1>
        <p className="text-sm text-gray-500 mt-1">
          Closed, resolved, and reassigned tickets you have handled.
        </p>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl bg-red-50 text-red-700 px-4 py-2 text-sm">
          {loadError}
        </div>
      )}

      {showRefreshBanner && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm">
          <div>
            <div className="font-semibold">New ticket updates available</div>
            <div className="text-xs text-blue-700">Load the latest history when you are ready.</div>
          </div>
          <button
            type="button"
            onClick={() => loadHistory({ forceRefresh: true })}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Load latest
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6">
        {loading ? (
          <div className="rounded-xl bg-white p-8">
            <table className="w-full">
              <tbody>
                <SkeletonLoader variant="table-row" />
                <SkeletonLoader variant="table-row" />
                <SkeletonLoader variant="table-row" />
                <SkeletonLoader variant="table-row" />
                <SkeletonLoader variant="table-row" />
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-col xl:flex-row xl:items-center gap-4 mb-6">
              <div className="relative flex-1 min-w-0">
                <svg
                  className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="search"
                  placeholder="Search ID, title, customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252578]/25"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <select
                  className={selectClass}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {['All Status', 'Closed', 'Resolved'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {[
                    'All Category',
                    'MRI',
                    'CT Scan',
                    'Ultrasound',
                    'X-Ray',
                    'Ventilator',
                    'Defibrillator',
                  ].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table or empty state */}
            {filtered.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                <svg
                  className="w-14 h-14 mx-auto mb-3 text-gray-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-sm font-medium">No history tickets found.</p>
                <p className="text-xs mt-1">
                  Closed, resolved, and reassigned tickets will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full table-fixed text-sm text-left border-collapse">
                  <colgroup>
                    <col className="w-[12%]" />
                    <col className="w-[16%]" />
                    <col className="w-[22%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-200 bg-gray-50/80">
                      <th className="py-3 px-2 font-medium">Ticket ID</th>
                      <th className="py-3 px-2 font-medium">Customer</th>
                      <th className="py-3 px-2 font-medium">Title</th>
                      <th className="py-3 px-2 font-medium">Category</th>
                      <th className="py-3 px-2 font-medium">Priority</th>
                      <th className="py-3 px-2 font-medium">Status</th>
                      <th className="py-3 px-2 font-medium">SLA</th>
                      <th className="py-3 px-2 font-medium">Last Update</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800">
                    {filtered.map((t) => (
                      <tr
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openDetail(t)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDetail(t);
                          }
                        }}
                        className="border-b border-gray-100 hover:bg-blue-50/40 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-2 align-middle">
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-[#252578] text-xs">
                              {t.id}
                            </span>
                            {t.reassignmentRequested && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 mt-0.5 w-fit">
                                REASSIGNED
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 align-middle min-w-0">
                          <p className="font-semibold text-gray-900 text-xs truncate">
                            {t.customer}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {t.facility}
                          </p>
                        </td>
                        <td className="py-2.5 px-2 align-middle min-w-0">
                          <p className="font-semibold text-gray-900 text-xs line-clamp-2 leading-snug">
                            {t.title}
                          </p>
                        </td>
                        <td className="py-2.5 px-2 align-middle text-gray-600 text-xs truncate">
                          {t.category}
                        </td>
                        <td className="py-2.5 px-2 align-middle">
                          <span
                            className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              priorityColors[t.priority] ?? 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 align-middle">
                          <span
                            className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              statusColors[getDisplayStatus(t)] ?? 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {getDisplayStatus(t)}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 align-middle">
                          <span
                            className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              slaStatusColors[t.slaStatus] ?? 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {t.slaStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 align-middle text-gray-600 text-xs whitespace-nowrap">
                          {t.lastUpdate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-sm text-gray-500 mt-4">
              Showing {filtered.length} of {tickets.length} history records
            </p>
          </>
        )}
      </div>
    </div>
  );
}
