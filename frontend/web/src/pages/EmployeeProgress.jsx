import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import {
  statusColors,
  priorityColors,
} from '@/constants/employeeTickets';
import { getEmployeeAssignedTickets } from '@/services/ticketService';
import { useAuth } from '@/context/AuthContext';
import SkeletonLoader from '@/components/SkeletonLoader';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import { formatDisplayDate } from '@/utils/dateUtils';

const HISTORY_STATUSES = ['Closed', 'Resolved'];

const getDisplayStatus = (ticket) => ticket.status;

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

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [categoryFilter, setCategoryFilter] = useState('All Category');
  const [priorityFilter, setPriorityFilter] = useState('All Priority');

  const loadHistory = useCallback(async ({ forceRefresh = false } = {}) => {
    const email = user?.email || 'frontend@example.com';
    setLoading(true);
    setLoadError('');
    try {
      const list = await getEmployeeAssignedTickets({ employeeEmail: email, forceRefresh });
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

  useEffect(() => {
    loadHistory({ forceRefresh: true });
  }, [loadHistory]);

  useRealtimeRefresh({
    refresh: loadHistory,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 30000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      const displayStatus = getDisplayStatus(t);

      if (statusFilter !== 'All Status' && displayStatus !== statusFilter) return false;
      if (categoryFilter !== 'All Category' && t.category !== categoryFilter) return false;
      if (priorityFilter !== 'All Priority' && t.priority !== priorityFilter) return false;
      if (q) {
        const blob =
          `${t.id} ${t.title} ${t.customer} ${t.facility ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, search, statusFilter, categoryFilter, priorityFilter]);

  const openDetail = (t) => {
    navigate(`/employee/history/${t.id}`, { state: { ticket: t, backPath: '/employee/progress' } });
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-[#252578]">Ticket History</h1>
        <p className="text-sm text-gray-500 mt-1">
          Closed, resolved, and reassigned tickets you have handled.
        </p>
      </div>

      {loadError && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-2 text-sm">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8">
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
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm w-full shrink-0">
            <input type="search" placeholder="Search ID, title, customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[260px] max-w-[630px] w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578] shrink" />
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 shrink-0 lg:ml-auto">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[132px] xl:w-[150px] shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
                {['All Status', 'Closed', 'Resolved'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-[132px] xl:w-[150px] shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
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
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-[132px] xl:w-[150px] shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
                {['All Priority', 'Critical', 'High', 'Medium', 'Low'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
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
                <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm text-left border-collapse">
                  <colgroup>
                    <col className="w-[12%]" />
                    <col className="w-[16%]" />
                    <col className="w-[22%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[14%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-4">Ticket ID</th>
                      <th className="px-5 py-4">Customer</th>
                      <th className="px-5 py-4">Title</th>
                      <th className="px-5 py-4">Category</th>
                      <th className="px-5 py-4">Priority</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Last Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
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
                        <td className="px-5 py-4 text-sm font-semibold text-[#252578] whitespace-nowrap align-middle">
                          <span>{t.id}</span>
                        </td>
                        <td className="px-5 py-4 align-middle min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{t.customer}</p>
                          <p className="text-xs text-gray-500 truncate">{t.facility}</p>
                        </td>
                        <td className="px-5 py-4 align-middle min-w-0">
                          <p className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug">{t.title}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600 align-middle truncate">{t.category}</td>
                        <td className="px-5 py-4 align-middle">
                          <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ${priorityColors[t.priority] ?? 'bg-gray-100 text-gray-700'}`}>{t.priority}</span>
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[getDisplayStatus(t)] ?? 'bg-gray-100 text-gray-700'}`}>{getDisplayStatus(t)}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap align-middle">{formatDisplayDate(t.lastUpdate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
              <div className="px-4 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing {filtered.length} of {tickets.length} history records
                </p>
              </div>
            </div>
          </>
        )}
    </div>
  );
}

