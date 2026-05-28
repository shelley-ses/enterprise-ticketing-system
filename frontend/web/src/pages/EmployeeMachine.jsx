import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  statusColors,
  priorityColors,
  slaStatusColors,
  sortTicketsByPriority,
} from '@/constants/employeeTickets';
import TicketInfoModal from '@/components/employee/TicketInfoModal';
import ReassignmentModal from '@/components/employee/ReassignmentModal';
import { useAuth } from '@/context/AuthContext';
import { getEmployeeAssignedTickets } from '@/services/ticketService';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';

const CLOSED_STATUSES = ['Closed', 'Resolved'];

const selectClass =
  'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer min-w-[8.5rem]';

export default function EmployeeMachine() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [categoryFilter, setCategoryFilter] = useState('All Category');
  const [priorityFilter, setPriorityFilter] = useState('All Priority');
  const [sortPriority, setSortPriority] = useState('Priority');
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);

  // Modal states
  const [infoTicket, setInfoTicket] = useState(null);
  const [reassignTicket, setReassignTicket] = useState(null);

  const loadTickets = useCallback(async ({ forceRefresh = false } = {}) => {
    const email = user?.email || 'frontend@example.com';
    setLoading(true);
    setLoadError('');
    setShowRefreshBanner(false);
    try {
      const list = await getEmployeeAssignedTickets({ employeeEmail: email, forceRefresh });
      // Only show accepted & active (not closed/resolved) tickets
      const activeTickets = list.filter(
        (t) => t.accepted && !CLOSED_STATUSES.includes(t.status)
      );
      setTickets(activeTickets);
    } catch (err) {
      setLoadError('Unable to load active progress tickets.');
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    loadTickets({ forceRefresh: false });
  }, [loadTickets]);

  useRealtimeRefresh({
    refresh: loadTickets,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 30000,
    deferRefresh: true,
    onRefreshAvailable: ({ source, payload }) => {
      if (source === 'websocket') {
        const myEmpId = Number(user?.emp_id ?? user?.id);
        const isRelevant =
          payload && (
            Number(payload.assigned_to) === myEmpId ||
            (Array.isArray(payload.employee_ids) && payload.employee_ids.map(Number).includes(myEmpId))
          );
        if (isRelevant) {
          setShowRefreshBanner(true);
        }
      }
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = tickets.filter((t) => {
      if (statusFilter !== 'All Status') {
        if (statusFilter === 'Pending Reassign') {
          if (!t.reassignmentRequested) return false;
        } else if (t.status !== statusFilter) {
          return false;
        }
      }

      if (categoryFilter !== 'All Category' && t.category !== categoryFilter) return false;
      if (priorityFilter !== 'All Priority' && t.priority !== priorityFilter) return false;
      if (q) {
        const blob = `${t.id} ${t.title} ${t.customer} ${t.facility ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });

    if (sortPriority === 'Priority') {
      list = sortTicketsByPriority(list, 'desc');
    }
    return list;
  }, [tickets, search, statusFilter, categoryFilter, priorityFilter, sortPriority]);

  const openTicketFlow = (t) => {
    setInfoTicket(t);
  };

  const handleUpdateClick = (t) => {
    setInfoTicket(null);
    navigate('/employee/ticket-update', { state: { ticket: t } });
  };

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#252578]">My Progress Queue</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track and update tickets that you have accepted and are currently working on.
        </p>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl bg-red-50 text-red-700 px-4 py-2 text-sm">
          {loadError}
        </div>
      )}

      {showRefreshBanner && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm">
          <div>
            <div className="font-semibold">New ticket updates available</div>
            <div className="text-xs text-blue-700">Load the latest active progress tickets.</div>
          </div>
          <button
            type="button"
            onClick={() => loadTickets({ forceRefresh: true })}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Load latest
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-md p-6">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading active tickets...</div>
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
                  <option value="All Status">All Status</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Pending">Pending</option>
                  <option value="Pending Validation">Pending Validation</option>
                  <option value="Pending Reassign">Pending Reassign</option>
                </select>

                <select
                  className={selectClass}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="All Category">All Category</option>
                  <option value="MRI">MRI</option>
                  <option value="CT Scan">CT Scan</option>
                  <option value="Ultrasound">Ultrasound</option>
                  <option value="X-Ray">X-Ray</option>
                  <option value="Ventilator">Ventilator</option>
                </select>

                <select
                  className={selectClass}
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="All Priority">All Priority</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>

                <select
                  className={selectClass}
                  value={sortPriority}
                  onChange={(e) => setSortPriority(e.target.value)}
                >
                  <option value="Priority">Sort: Default</option>
                  <option value="Standard">Sort: Standard</option>
                </select>
              </div>
            </div>

            {/* List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-4">Ticket ID</th>
                    <th className="pb-3 px-2">Customer & Facility</th>
                    <th className="pb-3 px-2">Subject / Title</th>
                    <th className="pb-3 px-2">Category</th>
                    <th className="pb-3 px-2">Priority</th>
                    <th className="pb-3 px-2">Status</th>
                    <th className="pb-3 px-2">SLA Status</th>
                    <th className="pb-3 px-2">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-700 text-sm">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400 italic">
                        No active accepted tickets found in your progress queue.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => openTicketFlow(t)}
                        className="hover:bg-gray-55/60 cursor-pointer transition-colors"
                      >
                        <td className="py-3 pl-4 font-bold text-[#252578] whitespace-nowrap">
                          {t.id}
                        </td>
                        <td className="py-3 px-2 max-w-[12rem] truncate">
                          <p className="font-semibold text-gray-900 text-xs truncate">{t.customer}</p>
                          <p className="text-[10px] text-gray-500 truncate">{t.facility || '—'}</p>
                        </td>
                        <td className="py-3 px-2 font-semibold text-gray-800 text-xs truncate max-w-[16rem]">
                          {t.title}
                        </td>
                        <td className="py-3 px-2 text-gray-500 text-xs">{t.category}</td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              priorityColors[t.priority]
                            }`}
                          >
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-flex whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              t.proofRejected
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : t.reassignmentRequested
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : t.status === 'Pending'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : t.status === 'Pending Validation'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-100'
                            }`}
                          >
                            {t.proofRejected ? 'Proof Rejected' : (t.reassignmentRequested ? 'Pending Reassign' : t.status)}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              slaStatusColors[t.slaStatus] ?? 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {t.slaStatus}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-gray-400 text-xs whitespace-nowrap">
                          {t.lastUpdate}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              Showing {filtered.length} of {tickets.length} accepted tickets in progress
            </p>
          </>
        )}
      </div>

      {/* Detail management modal */}
      {infoTicket && (
        <TicketInfoModal
          ticket={infoTicket}
          onClose={() => setInfoTicket(null)}
        />
      )}

      {/* Reassignment modal */}
      {reassignTicket && (
        <ReassignmentModal
          ticket={reassignTicket}
          onClose={() => setReassignTicket(null)}
          onReassignSuccess={(id) => {
            setTickets((prev) =>
              prev.map((t) =>
                t.id === id
                  ? { ...t, reassignmentRequested: true, reassignmentStatus: 'Pending' }
                  : t
              )
            );
            setReassignTicket(null);
          }}
        />
      )}
    </div>
  );
}
