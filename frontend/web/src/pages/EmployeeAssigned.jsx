import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import {
  statusColors,
  priorityColors,
  slaStatusColors,
  sortTicketsByPriority,
} from '@/constants/employeeTickets';
import TicketDetailModal from '@/components/employee/TicketDetailModal';
import TicketInfoModal from '@/components/employee/TicketInfoModal';
import ReassignmentModal from '@/components/employee/ReassignmentModal';
import { useAuth } from '@/context/AuthContext';
import { getEmployeeAssignedTickets, acceptTicket, updateTicket, updateEmployeeTicketOverride } from '@/services/ticketService';
import SkeletonLoader from '@/components/SkeletonLoader';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';

const CLOSED_STATUSES = ['Closed', 'Resolved'];

const selectClass =
  'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer min-w-[8.5rem]';

export default function EmployeeAssigned() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [categoryFilter, setCategoryFilter] = useState('All Category');
  const [priorityFilter, setPriorityFilter] = useState('All Priority');
  const [sortPriority, setSortPriority] = useState('Priority');

  const [isAccepting, setIsAccepting] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Compute pending counts for display
  const pendingCount = useMemo(() => {
    return tickets.filter((t) => !t.rejected && !CLOSED_STATUSES.includes(t.status) && !t.accepted).length;
  }, [tickets]);

  // Modal state — which modal to show
  const [pendingTicket, setPendingTicket] = useState(null);   // not-yet-accepted → TicketDetailModal
  const [infoTicket, setInfoTicket] = useState(null);         // accepted & active → TicketInfoModal
  const [reassignTicket, setReassignTicket] = useState(null); // reassign flow
  const [deniedReassignTicket, setDeniedReassignTicket] = useState(null); // denied reassign → skip accept, show update

  const loadTickets = useCallback(async ({ forceRefresh = false } = {}) => {
    const email = user?.email || 'frontend@example.com';
    setLoading(true);
    setLoadError('');
    try {
      const list = await getEmployeeAssignedTickets({ employeeEmail: email, forceRefresh });
      setTickets(list.map((t) => ({ ...t, rejected: false })));
    } catch {
      setLoadError('Unable to load assigned tickets from ticket-service.');
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    loadTickets({ forceRefresh: true });
  }, [loadTickets]);

  // Handle notification-triggered ticket opens
  useEffect(() => {
    const focusId = location.state?.focusTicketId;
    if (focusId && tickets.length > 0) {
      const match = tickets.find(t => t.id === focusId || t.ticket_ID === focusId);
      if (match) {
        // Open the ticket based on its status
        if (match.deniedReassignment) {
          setDeniedReassignTicket(match);
        } else if (!match.accepted) {
          setPendingTicket(match);
        } else {
          setInfoTicket(match);
        }
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, tickets]);



  useRealtimeRefresh({
    refresh: loadTickets,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 30000,
    shouldRefresh: ({ source, payload }) => {
      if (source === 'websocket') {
        const myEmpId = Number(user?.emp_id ?? user?.id);
        const isRelevant =
          payload && (
            Number(payload.assigned_to) === myEmpId ||
            (Array.isArray(payload.employee_ids) && payload.employee_ids.map(Number).includes(myEmpId))
          );
        return !!isRelevant;
      }
      return true;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = tickets.filter((t) => {
      if (t.rejected) return false;
      // Hide closed/resolved from Assigned — they live in History
      if (CLOSED_STATUSES.includes(t.status)) return false;

      // Only show unaccepted tickets in this queue
      if (t.accepted) return false;

      if (statusFilter !== 'All Status') {
        if (statusFilter === 'Pending Reassign') {
          if (!t.reassignmentRequested) return false;
        } else if (t.status !== statusFilter) {
          return false;
        }
      }

      if (typeFilter === 'internal') {
        const isInternal = t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal';
        if (!isInternal) return false;
      } else if (typeFilter === 'external') {
        const isInternal = t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal';
        if (isInternal) return false;
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
  }, [tickets, search, statusFilter, categoryFilter, priorityFilter, sortPriority, typeFilter]);

  const handleAcceptAssignment = useCallback(async (id) => {
    const ticketObj = tickets.find((t) => t.id === id);
    if (!ticketObj) return;

    const numericId = ticketObj.ticket_ID || Number(String(id).replace(/\D/g, ''));
    setIsAccepting(true);
    try {
      await acceptTicket({
        ticketId: numericId,
        employeeIds: [Number(user?.emp_id ?? user?.id)],
        assignedByEmail: user?.email,
      });
      setIsAccepting(false);
      setPendingTicket(null);
      setTickets((prev) => prev.filter((t) => t.id !== id));
      window.dispatchEvent(new Event('notifications:updated'));
      navigate('/employee/machine');
    } catch (err) {
      console.error('Failed to accept assignment on backend:', err);
      setIsAccepting(false);
    }
  }, [tickets, user, navigate]);

  const handleRejectAssignment = useCallback((id) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, rejected: true } : t))
    );
    setPendingTicket(null);
  }, []);


  const handleStatusChange = useCallback(async (id, newStatus) => {
    // If status is 'Pending Evaluation', it has already been submitted to the backend via proof upload.
    // We only need to update the local ticket status and clear any proof rejection flags.
    if (newStatus === 'Pending Evaluation') {
      updateEmployeeTicketOverride(id, {
        status: newStatus,
        proofRejected: false,
        rejectionReason: null,
      });
      setTickets((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, status: newStatus, proofRejected: false, rejectionReason: null }
            : t
        )
      );
      return;
    }

    const statusMap = {
      'Open': 1,
      'In Progress': 2,
      'Resolved': 3,
      'Closed': 4,
      'Escalated': 5,
      'Pending Evaluation': 6,
      'Pending': 7,
      'Reopened': 8,
      'On Hold': 11,
    };
    const ticketObj = tickets.find((t) => t.id === id);
    if (!ticketObj) return;

    const numericId = ticketObj.ticket_ID || Number(String(id).replace(/\D/g, ''));
    try {
      await updateTicket({
        ticketId: numericId,
        statusId: statusMap[newStatus] ?? 2,
        assignedByEmail: user?.email,
      });
      updateEmployeeTicketOverride(id, {
        status: newStatus,
        proofRejected: false,
        rejectionReason: null,
      });
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      console.error('Failed to update ticket status on backend:', err);
      // fallback
      updateEmployeeTicketOverride(id, {
        status: newStatus,
        proofRejected: false,
        rejectionReason: null,
      });
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
      );
    }
  }, [tickets, user]);

  /** Decide what to do when a row is clicked */
  const openTicketFlow = useCallback(
    (t) => {
      // Closed / Resolved → redirect to History
      if (CLOSED_STATUSES.includes(t.status)) {
        navigate('/employee/progress');
        return;
      }
      // Denied reassignment → skip accept modal, show update modal directly
      if (t.deniedReassignment) {
        setDeniedReassignTicket(t);
        return;
      }
      // Not yet accepted → show full Accept/Reject modal
      if (!t.accepted) {
        setPendingTicket(t);
        return;
      }
      // Accepted & active → show lightweight info modal with Update button
      setInfoTicket(t);
    },
    [navigate]
  );

  const activeCount = tickets.filter(
    (t) => !t.rejected && !CLOSED_STATUSES.includes(t.status)
  ).length;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-[#252578]">My Assigned Tickets</h1>
          <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white shrink-0 shadow-xs">
            {['all', 'external', 'internal'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
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
        <p className="text-sm text-gray-500 mt-1">
          All tickets assigned to you — work, update, and resolve.
        </p>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl bg-red-50 text-red-700 px-4 py-2 text-sm">
          {loadError}
        </div>
      )}



      <div className="bg-white rounded-2xl shadow-md p-6">
        {loading ? (
          <div className="space-y-4">
            <SkeletonLoader variant="ticket-card" />
            <SkeletonLoader variant="ticket-card" />
            <SkeletonLoader variant="ticket-card" />
          </div>
        ) : (
          <>
            {/* Search & Filter Toggle */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search ID, title, customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#252578]/25"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all shrink-0 ${showFilters ? 'bg-[#252578] text-white border-[#252578]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <Filter size={16} />
                Filters
              </button>
            </div>

            {/* Collapsible Filters */}
            {showFilters && (
              <div className="flex flex-row flex-wrap items-center gap-3 mb-6 p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
                <select
                  className={selectClass}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {['All Status', 'Open', 'In Progress', 'Escalated', 'Pending', 'Pending Reassign', 'On Hold'].map(
                    (s) => (
                      <option key={s} value={s}>{s}</option>
                    )
                  )}
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
                <select
                  className={selectClass}
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  {['All Priority', 'Critical', 'High', 'Medium', 'Low'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  value={sortPriority}
                  onChange={(e) => setSortPriority(e.target.value)}
                >
                  <option value="Priority">Sort: Priority</option>
                </select>
              </div>
            )}
            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full table-fixed text-sm text-left border-collapse">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[18%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr className="text-gray-500 border-b border-gray-200 bg-gray-50/80">
                    <th className="py-3 px-2 font-medium">
                      <div className="relative">
                        <svg
                          className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2"
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
                          placeholder="Search..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#252578]/25"
                        />
                      </div>
                    </th>
                    <th className="py-3 px-2 font-medium">Customer</th>
                    <th className="py-3 px-2 font-medium">Type</th>
                    <th className="py-3 px-2 font-medium">Title</th>
                    <th className="py-3 px-2 font-medium">
                      <select
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer"
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
                    </th>
                    <th className="py-3 px-2 font-medium">
                      <select
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer"
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                      >
                        {['All Priority', 'Critical', 'High', 'Medium', 'Low'].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </th>
                    <th className="py-3 px-2 font-medium">
                      <select
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        {['All Status', 'Pending Assignment', 'Open', 'In Progress', 'Escalated', 'Pending', 'Pending Reassign', 'On Hold'].map(
                          (s) => (
                            <option key={s} value={s}>{s}</option>
                          )
                        )}
                      </select>
                    </th>
                    <th className="py-3 px-2 font-medium">SLA</th>
                    <th className="py-3 px-2 font-medium">Last Update</th>
                  </tr>
                </thead>
                <tbody className="text-gray-800">
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-12 text-center text-gray-400 text-sm"
                      >
                        No active tickets found in this tab.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((t) => (
                      <tr
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openTicketFlow(t)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openTicketFlow(t);
                          }
                        }}
                        className="border-b border-gray-100 hover:bg-blue-50/40 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-2 align-middle">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                t.reassignmentRequested ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                              }`}
                              title="Attention"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-semibold text-[#252578] text-xs leading-tight">
                                  {t.id}
                                </span>
                                {t.escalated && (
                                  <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-orange-100 text-orange-800 shrink-0">
                                    ESC
                                  </span>
                                )}
                              </div>
                              {!t.accepted && t.status === 'Open' && (
                                <span className="text-[10px] text-amber-700 font-medium">
                                  {t.reassignmentRequested ? 'Reassignment requested' : 'Pending acceptance'}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 align-middle min-w-0">
                          <p className="font-semibold text-gray-900 text-xs truncate">
                            {t.customer}
                          </p>
                        </td>
                        <td className="py-2.5 px-2 align-middle">
                          <span
                            className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              (t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal')
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {(t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal') ? 'Internal' : 'External'}
                          </span>
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
                              priorityColors[t.priority]
                            }`}
                          >
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 align-middle">
                          <span
                            className={`inline-flex max-w-full whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              t.reassignmentRequested
                                ? 'bg-amber-55 text-amber-700 border-amber-200'
                                : t.rejected
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : t.status === 'In Progress'
                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                    : t.status === 'Pending Assignment'
                                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            }`}
                          >
                            {t.reassignmentRequested ? 'reassignment' : (t.rejected ? 'rejected' : t.status.toLowerCase())}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              Showing {filtered.length} of {pendingCount} tickets
            </p>
          </>

        )}
      </div>

      {/* Modal: Not-yet-accepted ticket (Accept / Request Reassignment) */}
      {pendingTicket && (
        <TicketDetailModal
          ticket={pendingTicket}
          onClose={() => setPendingTicket(null)}
          onStatusChange={handleStatusChange}
          onAccept={handleAcceptAssignment}
          onRequestReassign={(t) => {
            setPendingTicket(null);
            setReassignTicket(t);
          }}
          isAccepting={isAccepting}
        />
      )}

      {/* Modal: Accepted active ticket — lightweight info + Update button */}
      {infoTicket && (
        <TicketInfoModal
          ticket={infoTicket}
          onClose={() => setInfoTicket(null)}
        />
      )}

      {/* Modal: Denied reassignment — skip accept, show update modal directly */}
      {deniedReassignTicket && (
        <TicketInfoModal
          ticket={deniedReassignTicket}
          onClose={() => setDeniedReassignTicket(null)}
        />
      )}

      {/* Modal: Reassignment request */}
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
          }}
        />
      )}
    </div>
  );
}
