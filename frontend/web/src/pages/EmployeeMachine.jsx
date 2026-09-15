import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import {
  statusColors,
  priorityColors,
  slaStatusColors,
  sortTicketsByPriority,
} from '@/constants/employeeTickets';
import TicketInfoModal from '@/components/employee/TicketInfoModal';
import ReassignmentModal from '@/components/employee/ReassignmentModal';
import CustomerTicketDetailModal from '@/components/CustomerTicketDetailModal';
import { formatDisplayDate } from '@/utils/dateUtils';
import { useAuth } from '@/context/AuthContext';
import { getEmployeeAssignedTickets } from '@/services/ticketService';
import SkeletonLoader from '@/components/SkeletonLoader';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';

const CLOSED_STATUSES = ['Closed', 'Resolved'];

const getDisplayStatus = (ticket) => (
  ticket.proofRejected
    ? 'Proof Rejected'
    : ticket.status
);

const isInternalTicket = (ticket) => (
  ticket?.title?.startsWith('[Internal]')
  || ticket?.is_internal
  || ticket?.ticket_type === 'Internal'
  || ticket?.type === 'Internal'
);

const getTicketTypeLabel = (ticket) => (isInternalTicket(ticket) ? 'Internal' : 'External');

const selectClass =
  'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer min-w-[8.5rem]';

export default function EmployeeMachine() {
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

  const [typeFilter, setTypeFilter] = useState('all');

  // Modal states
  const [infoTicket, setInfoTicket] = useState(null);
  const [reassignTicket, setReassignTicket] = useState(null);

  const loadTickets = useCallback(async ({ forceRefresh = false } = {}) => {
    const email = user?.email || 'frontend@example.com';
    setLoading(true);
    setLoadError('');
    try {
      const list = await getEmployeeAssignedTickets({ employeeEmail: email, forceRefresh });
      // Only show accepted & active (not closed/resolved) tickets
      setTickets(list);
    } catch (err) {
      setLoadError('Unable to load active progress tickets.');
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    loadTickets({ forceRefresh: true });
  }, [loadTickets]);

  useEffect(() => {
    const focusId = location.state?.focusTicketId;
    if (focusId && tickets.length > 0) {
      const match = tickets.find(t => t.id === focusId || t.ticket_ID === focusId);
      if (match) {
        setInfoTicket(match);
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
      if (!t.accepted) return false;
      if (CLOSED_STATUSES.includes(t.status)) return false;

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

    list = sortTicketsByPriority(list, 'desc');
    return list;
  }, [tickets, search, statusFilter, categoryFilter, priorityFilter, typeFilter]);

  const openTicketFlow = (t) => {
    setInfoTicket(t);
  };

  const handleUpdateClick = (t) => {
    setInfoTicket(null);
    navigate('/employee/ticket-update', { state: { ticket: t } });
  };

  const handleReopenProgressTicket = (ticketId, reason) => {
    const timestamp = new Date().toISOString();
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId || t.ticket_ID === ticketId) {
          const timeline = t.timeline || [
            { id: 'creation', type: 'system', text: 'Ticket created.', timestamp: t.date_created || new Date().toISOString() }
          ];
          return {
            ...t,
            status: 'Reopened',
            last_updated: timestamp,
            timeline: [
              ...timeline,
              {
                id: `status-reopened-${Date.now()}`,
                type: 'status',
                text: `Ticket reopened. Reason: "${reason}"`,
                timestamp,
              }
            ]
          };
        }
        return t;
      })
    );
    setInfoTicket(null);
    window.alert('Ticket reopened successfully.');
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-[#252578]">Assigned Ticket</h1>
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
          Tickets assigned to you — work, update, and resolve.
        </p>
      </div>

      {loadError && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-2 text-sm">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8">
          <div className="space-y-4">
            <SkeletonLoader variant="ticket-card" />
            <SkeletonLoader variant="ticket-card" />
            <SkeletonLoader variant="ticket-card" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm w-full shrink-0">
              <input type="search" placeholder="Search ID, title, customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[260px] max-w-[630px] w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578] shrink" />
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 shrink-0 lg:ml-auto">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[132px] xl:w-[150px] shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
                <option value="All Status">All Status</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending">Pending</option>
                <option value="Pending Evaluation">Pending Evaluation</option>
                <option value="Pending Reassign">Pending Reassign</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
                <option value="Reopened">Reopened</option>
              </select>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-[132px] xl:w-[150px] shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
                <option value="All Category">All Category</option>
                <option value="MRI">MRI</option>
                <option value="CT Scan">CT Scan</option>
                <option value="Ultrasound">Ultrasound</option>
                <option value="X-Ray">X-Ray</option>
                <option value="Ventilator">Ventilator</option>
              </select>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-[132px] xl:w-[150px] shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
                <option value="All Priority">All Priority</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left" style={{ minWidth: '900px' }}>
                <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Ticket ID</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Type</th>
                    <th className="px-5 py-4">Title</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Priority</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
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
                        <td className="px-5 py-4 text-sm font-semibold text-[#252578] whitespace-nowrap">{t.id}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 truncate max-w-[12rem]">{t.customer}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ${isInternalTicket(t) ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{getTicketTypeLabel(t)}</span>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-gray-800 truncate max-w-[16rem]">{t.title}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{t.category}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ${priorityColors[t.priority]}`}>{t.priority}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold border ${getDisplayStatus(t) === 'Proof Rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' : t.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : t.status === 'Pending Evaluation' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{getDisplayStatus(t)}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">{formatDisplayDate(t.lastUpdate)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing {filtered.length} of {tickets.length} accepted tickets in progress
                </p>
              </div>
            </div>
          </>
        )}

      {/* Detail management modal */}
      {infoTicket && (infoTicket.status === 'Closed' || infoTicket.status === 'Resolved' || infoTicket.status === 'Reopened') ? (
        <CustomerTicketDetailModal
          ticket={infoTicket}
          onClose={() => setInfoTicket(null)}
          onDiscard={null}
          allowReopen={false}
          onReopen={(ticketId, reason) => handleReopenProgressTicket(ticketId, reason)}
        />
      ) : infoTicket && (
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
