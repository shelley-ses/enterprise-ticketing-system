import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import Pagination from '@/components/Pagination';
import SkeletonLoader from '@/components/SkeletonLoader';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import {
  getCSIncomingTickets,
  getDepartments,
} from '@/services/ticketService';
import { formatDisplayDate } from '@/utils/dateUtils';
const HISTORY_STATUSES = ['Closed', 'Resolved'];

const getDisplayStatus = (ticket) => ticket.status;

export default function CSHistory() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadStaticData = useCallback(async () => {
    try {
      const [depsResult] = await Promise.allSettled([getDepartments()]);
      if (depsResult.status === 'fulfilled') {
        setDepartments((depsResult.value || []).map((d) => d.name));
      }
    } catch (e) {
      console.warn('Failed to load static options:', e);
    }
  }, []);

  const loadLiveData = useCallback(async ({ forceRefresh = false, source = 'manual' } = {}) => {
    if (source !== 'websocket' && source !== 'poll') {
      setLoading(true);
    }
    setError('');

    try {
      const incomingResult = await getCSIncomingTickets({ limit: 100, forceRefresh });
      const list = incomingResult.filter((ticket) =>
        HISTORY_STATUSES.includes(ticket.status)
      );
      setTickets(list);
    } catch (err) {
      setError('Unable to load history tickets from ticket-service.');
    } finally {
      if (source !== 'websocket' && source !== 'poll') {
        setLoading(false);
      }
    }
  }, []);

  const handleRealtimeUpdate = useCallback((context) => {
    if (context && context.source === 'websocket') {
      const payload = context.payload;
      if (!payload) return;

      // Handle ticket updates
      if (payload.action) {
        const { action, ticket } = payload;
        if (!ticket) return;

        if (action === 'created') {
          // New tickets are not history tickets, skip
          return;
        }

        // If updated to a history status, add or update in the list
        const isHistoryTicket = HISTORY_STATUSES.includes(ticket.status);

        setTickets((prev) => {
          const index = prev.findIndex((t) => t.id === ticket.id || t.ticket_ID === ticket.ticket_ID);
          if (index !== -1) {
            if (isHistoryTicket) {
              const next = [...prev];
              next[index] = { ...next[index], ...ticket };
              return next;
            } else {
              // Removed from history status
              return prev.filter((t) => t.id !== ticket.id && t.ticket_ID !== ticket.ticket_ID);
            }
          } else {
            if (isHistoryTicket) {
              // Prepend newly resolved/closed ticket
              return [ticket, ...prev];
            }
            return prev;
          }
        });
      }
    } else {
      loadLiveData({ forceRefresh: true });
    }
  }, [loadLiveData]);

  useEffect(() => {
    loadStaticData();
    loadLiveData({ forceRefresh: true });
  }, [loadStaticData, loadLiveData]);

  useRealtimeRefresh({
    refresh: handleRealtimeUpdate,
    channels: [
      { name: 'ticket-updates', event: 'ticket.changed' },
    ],
    intervalMs: 30000,
    deferRefresh: false,
  });

  const categories = useMemo(
    () => ['All Categories', ...Array.from(new Set(tickets.map((t) => t.category)))],
    [tickets]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (category !== 'All Categories' && t.category !== category) return false;
      
      const displayStatus = getDisplayStatus(t);
      if (statusFilter !== 'All Status' && displayStatus !== statusFilter) return false;
      
      if (typeFilter === 'internal') {
        const isInternal = t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal';
        if (!isInternal) return false;
      } else if (typeFilter === 'external') {
        const isInternal = t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal';
        if (isInternal) return false;
      }

      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.equipment && t.equipment.toLowerCase().includes(q))
      );
    });
  }, [tickets, search, category, statusFilter, typeFilter]);

  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [filtered.length, totalPages, page]);

  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  const handleRowAction = (t) => {
    const ticketId = t.ticket_ID || Number(String(t.id).replace(/\D/g, ''));
    navigate(`/cs/history/${ticketId}`, { state: { ticket: t, backPath: '/cs/history' } });
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-[#252578]">Ticket History</h1>
          <div className="flex border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white shrink-0">
            {['all', 'external', 'internal'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  typeFilter === type
                    ? 'bg-[#252578] text-white'
                    : 'bg-white hover:bg-gray-55 text-gray-600'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <p className="text-gray-500 mt-1">View resolved, closed, and completed tickets</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search history by ID, customer, title..." className="flex-1 min-w-[260px] max-w-[630px] w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578] shrink" />
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 shrink-0 lg:ml-auto">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-[150px] md:w-[160px] shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
                <option value="All Status">All Statuses</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full sm:w-[150px] md:w-[160px] shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-[#252578]">Completed Logs</h2>
              <div className="text-sm text-gray-500">{filtered.length} tickets</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Ticket ID</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Type</th>
                    <th className="px-5 py-4">Title</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Date Submitted</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {paginated.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-all cursor-pointer" onClick={() => handleRowAction(t)}>
                      <td className="py-4 px-4 font-medium">{t.id}</td>
                      <td className="py-4 px-4 text-gray-600">{t.customer}</td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ${(t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal') ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {(t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal') ? 'Internal' : 'External'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-700 font-semibold">{t.title}</td>
                      <td className="py-4 px-4">
                        <span className="inline-flex whitespace-nowrap px-3 py-1 bg-gray-100 rounded-full text-xs">{t.category}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold ${
                           getDisplayStatus(t) === 'Resolved' ? 'bg-green-100 text-green-700' :
                           getDisplayStatus(t) === 'Closed' ? 'bg-gray-100 text-gray-700' :
                           'bg-gray-100 text-gray-700'
                        }`}>{getDisplayStatus(t)}</span>
                      </td>
                      <td className="py-4 px-4 text-gray-500">{formatDisplayDate(t.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {filtered.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </div>
              <Pagination
                totalItems={filtered.length}
                itemsPerPage={ITEMS_PER_PAGE}
                currentPage={page}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          </div>
        </>
      )}

    </div>
  );
}
