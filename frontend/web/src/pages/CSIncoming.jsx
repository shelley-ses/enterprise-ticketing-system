import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import actionIcon from '@/assets/action.png';
import Pagination from '@/components/Pagination';
import SkeletonLoader from '@/components/SkeletonLoader';
import { TicketSummary, AssignModal } from '@/components/CSModals';
import { formatDisplayDate } from '@/utils/dateUtils';
import { useAuth } from '@/context/AuthContext';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import { ticketBroadcast } from '@/services/ticketBroadcast';
import {
  getCSIncomingTickets,
  getAssignableEmployees,
  getDepartments,
  acceptTicket,
  getTicketFormOptions,
  prefetchTicketFormOptions,
  updateEmployeeTicketOverride,
  respondReassignment,
  getTicketDetails,
  updateTicket,
} from '@/services/ticketService';

const normalizeDepartmentName = (value = '') => value.trim().toLowerCase().replace(/\s+/g, ' ');

const buildIncomingSignature = (list = []) => list
  .map((ticket) => [
    ticket.id ?? ticket.ticket_ID,
    ticket.status,
    ticket.updated_at ?? ticket.last_update ?? ticket.created_at ?? '',
    ticket.reassignmentRequested ? '1' : '0',
  ].join(':'))
  .join('|');

const buildEmployeeSignature = (list = []) => list
  .map((employee) => [
    employee.id,
    employee.status,
    employee.department,
    employee.last_seen_at ?? '',
  ].join(':'))
  .join('|');

const getDisplayStatus = (ticket) => ticket.status;

/* Modals are imported from @/components/CSModals */

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function CSIncoming() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [priorityOptions, setPriorityOptions] = useState(['Low','Medium','High','Critical']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  // const [slaFilter, setSlaFilter] = useState('All SLA');
  const [machineFilter, setMachineFilter] = useState('All Machines');
  const [assignmentFilter, setAssignmentFilter] = useState('All');
  const [newTicketId, setNewTicketId] = useState(null);
  const newTicketTimerRef = useRef(null);
  const [typeFilter, setTypeFilter] = useState('all');

  // modal state: null | { mode: 'assign'|'summary', ticket }
  const [modal, setModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const loadStaticData = useCallback(async () => {
    const [depsResult, optionsResult] = await Promise.allSettled([
      getDepartments(),
      prefetchTicketFormOptions(),
    ]);

    if (depsResult.status === 'fulfilled') {
      setDepartments((depsResult.value || []).map((d) => d.name));
    }

    if (optionsResult.status === 'fulfilled') {
      setPriorityOptions((optionsResult.value?.ticket_priorities || []).map((p) => p.priority_name));
    }
  }, []);

  const loadLiveData = useCallback(async ({ forceRefresh = false, source = 'manual' } = {}) => {
    if (source !== 'websocket' && source !== 'poll') {
      setLoading(true);
    }
    setError('');

    const [incomingResult, assigneesResult] = await Promise.allSettled([
      getCSIncomingTickets({ limit: 100, forceRefresh }),
      getAssignableEmployees({ forceRefresh }),
    ]);

    if (incomingResult.status === 'fulfilled') {
      setTickets(incomingResult.value);
    }

    if (assigneesResult.status === 'fulfilled') {
      setEmployees(
        assigneesResult.value.map((row) => ({
          id: Number(row.id ?? row.emp_id),
          name: row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email,
          status: row.is_active ? 'active' : 'inactive',
            department: row.department?.trim() || 'Unassigned',
        }))
      );
    }

    if (incomingResult.status === 'rejected') {
      setError('Unable to load incoming tickets from ticket-service.');
    }

    if (source !== 'websocket' && source !== 'poll') {
      setLoading(false);
    }
  }, []);

  const handleRealtimeUpdate = useCallback((context) => {
    if (context && context.source === 'websocket') {
      const payload = context.payload;
      if (!payload) return;

      // Check if it's an employee status update
      if (payload.email && payload.role) {
        const updatedEmp = payload;
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === Number(updatedEmp.id)
              ? {
                  ...e,
                  status: updatedEmp.is_active ? 'active' : 'inactive',
                  department: updatedEmp.department?.trim() || 'Unassigned',
                }
              : e
          )
        );
        return;
      }

      // Check if it's a ticket event
      if (payload.action) {
        const { action, ticket } = payload;
        if (!ticket) return;

        if (action === 'created') {
          setTickets((prev) => {
            const exists = prev.some((t) => t.id === ticket.id || t.ticket_ID === ticket.ticket_ID);
            if (exists) return prev;
            return [ticket, ...prev];
          });

          // Set highlight timer
          if (newTicketTimerRef.current) {
            clearTimeout(newTicketTimerRef.current);
          }
          setNewTicketId(ticket.id);
          newTicketTimerRef.current = setTimeout(() => {
            setNewTicketId(null);
          }, 5000);
        } else if (
          action === 'assigned' ||
          action === 'accepted' ||
          action === 'updated' ||
          action === 'reassign_requested' ||
          action === 'reassigned_response'
        ) {
          // Update in-place
          setTickets((prev) => {
            return prev.map((t) => {
              if (t.id === ticket.id || t.ticket_ID === ticket.ticket_ID) {
                return { ...t, ...ticket };
              }
              return t;
            });
          });
        }
      }
    } else {
      loadLiveData({ forceRefresh: true });
    }
  }, [loadLiveData]);

  useEffect(() => {
    loadStaticData();
    loadLiveData({ forceRefresh: true });
  }, [loadStaticData, loadLiveData]);

  useEffect(() => {
    const focusId = location.state?.focusTicketId;
    if (focusId && tickets.length > 0) {
      const match = tickets.find(t => t.id === focusId || t.ticket_ID === focusId);
      if (match) {
        setModal({ mode: 'summary', ticket: match });
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, tickets]);

  useRealtimeRefresh({
    refresh: handleRealtimeUpdate,
    channels: [
      { name: 'ticket-updates', event: 'ticket.changed' },
      { name: 'employee-status', event: 'employee.status.changed' },
    ],
    intervalMs: 30000,
    deferRefresh: false,
  });

  const categories = useMemo(
    () => ['All Categories', ...Array.from(new Set(tickets.map((t) => t.category)))],
    [tickets]
  );

  const machines = useMemo(
    () => ['All Machines', ...Array.from(new Set(tickets.map((t) => t.equipment).filter(Boolean)))],
    [tickets]
  );

  // const slaOptions = ['All SLA', 'On Track', 'At Risk', 'Breached'];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (category !== 'All Categories' && t.category !== category) return false;
      // if (slaFilter !== 'All SLA' && t.sla !== slaFilter) return false;
      if (machineFilter !== 'All Machines' && t.equipment !== machineFilter) return false;
      if (typeFilter === 'internal') {
        const isInternal = t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal';
        if (!isInternal) return false;
      } else if (typeFilter === 'external') {
        const isInternal = t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal';
        if (isInternal) return false;
      }
      
      const isAssigned = t.assigned && t.assigned.length > 0 && t.accepted;
      const isPendingReassign = t.reassignmentRequested === true;
      const isPendingValidation = t.status === 'Pending Evaluation';
      const isReopened = t.status === 'Reopened' || t.status === 'Reopen';

      // Filter by assignment / reassignment / validation status
      if (assignmentFilter === 'All') {
        if (isAssigned && !isPendingReassign && !isReopened) return false;
        if (isPendingValidation && !isPendingReassign && !isReopened) return false;
      } else if (assignmentFilter === 'Pending Assignment') {
        if (t.status !== 'Pending Assignment') return false;
      } else if (assignmentFilter === 'Pending Reassign') {
        if (!isPendingReassign) return false;
      }

      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.equipment && t.equipment.toLowerCase().includes(q))
      );
    });
  }, [tickets, search, category, machineFilter, assignmentFilter, typeFilter]);

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

  const handleRowAction = async (t) => {
    const isSummary = t.status === 'Pending Assignment' || t.status === 'Resolved' || t.status === 'In Progress' || t.status === 'Pending' || t.status === 'Pending Evaluation';
    if (isSummary) {
      setModalLoading(true);
      try {
        const ticketId = t.ticket_ID || Number(String(t.id).replace(/\D/g, ''));
        const details = await getTicketDetails(ticketId);
        setModal({ mode: 'summary', ticket: details });
      } catch (err) {
        console.warn('Failed to load full ticket details, fallback to list item:', err);
        setModal({ mode: 'summary', ticket: t });
      } finally {
        setModalLoading(false);
      }
    } else {
      setModalLoading(true);
      try {
        const ticketId = t.ticket_ID || Number(String(t.id).replace(/\D/g, ''));
        const details = await getTicketDetails(ticketId);
        setModal({ mode: 'assign', ticket: { ...t, ...details, description: details.description || t.description, attachments: details.attachments || t.attachments || [], proofAttachments: details.proofAttachments || [] } });
      } catch (err) {
        console.warn('Failed to load full ticket details for assign, fallback to list item:', err);
        setModal({ mode: 'assign', ticket: t });
      } finally {
        setModalLoading(false);
      }
    }
  };

  const handleSave = async (updated) => {
    const priorityMap = {
      Low: 1,
      Medium: 2,
      High: 3,
      Critical: 4,
    };

    const isMock = !!updated.isMock;
    if (isMock) {
      const refreshed = {
        ...updated,
        status: 'Pending Assignment',
      };
      ticketBroadcast.emit('assigned', refreshed);
      setTickets((prev) => prev.map((t) => (t.ticket_ID === updated.ticket_ID || t.id === updated.id ? refreshed : t)));
      window.alert('Ticket assigned successfully.');
      navigate('/cs/assigned');
      return true;
    }

    try {
      await acceptTicket({
        ticketId: updated.ticket_ID,
        employeeIds: updated.assigned,
        assignedByEmail: user?.email,
        priorityId: priorityMap[updated.priority] ?? 1,
      });

      window.dispatchEvent(new Event('notifications:updated'));

      // Soft data refetch
      try {
        const incoming = await getCSIncomingTickets({ limit: 100 });
        setTickets(incoming);
        
        // Find the newly updated ticket
        const refreshedTicket = incoming.find(t => t.ticket_ID === updated.ticket_ID) || {
          ...updated,
          status: 'Pending Assignment',
        };
        
        // Broadcast the assignment to all listening pages
        ticketBroadcast.emit('assigned', refreshedTicket);
        
        navigate('/cs/assigned');
      } catch (e) {
        // Fallback to local state if refetch fails
        const refreshed = {
          ...updated,
          status: 'Pending Assignment',
        };
        ticketBroadcast.emit('assigned', refreshed);
        setTickets((prev) => prev.map((t) => (t.ticket_ID === updated.ticket_ID ? refreshed : t)));
        navigate('/cs/assigned');
      }
      return true;
    } catch (err) {
      setError('Failed to assign ticket. Please try again.');
      console.error(err);
      return false;
    }
  };

  const handleRespondReassignment = async (ticketId, action) => {
    const ticket = tickets.find(t => {
      const tId = t.ticket_ID || Number(String(t.id).replace(/\D/g, ''));
      const targetId = Number(String(ticketId).replace(/\D/g, ''));
      return tId === targetId;
    });
    const isMock = ticket ? !!ticket.isMock : false;
    if (isMock) {
      setTickets((prev) => prev.filter((t) => t.ticket_ID !== ticketId && t.id !== ticketId));
      setModal(null);
      window.alert(`Reassignment request ${action}ed successfully.`);
      return;
    }

    try {
      await respondReassignment({ ticketId, action });
      const incoming = await getCSIncomingTickets({ limit: 100, forceRefresh: true });
      setTickets(incoming);
      setModal(null);
      if (action === 'approve') {
        const refreshedTicket = incoming.find(t => t.ticket_ID === ticketId);
        if (refreshedTicket) {
          setModal({ mode: 'assign', ticket: refreshedTicket });
        }
      }
    } catch (err) {
      setError(`Failed to respond to reassignment request: ${err.message}`);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-[#252578]">Incoming Tickets</h1>
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
        <p className="text-gray-500 mt-1">Triage and assign new support tickets</p>
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets, customers..." className="flex-1 min-w-[260px] max-w-[630px] w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578] shrink" />
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 shrink-0 lg:ml-auto">
          <select value={assignmentFilter} onChange={(e) => setAssignmentFilter(e.target.value)} className="w-full sm:w-[180px] md:w-[190px] shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
            <option value="All">All Assignments</option>
            <option value="Pending Assignment">Pending Assignment</option>
            <option value="Pending Reassign">Pending Reassign</option>
          </select>
          <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} className="w-full sm:w-[150px] md:w-[160px] shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
            {machines.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
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
          <h2 className="text-xl font-semibold text-[#252578]">Incoming Tickets</h2>
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
                <th className="px-5 py-4 text-center">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-gray-700">
              {paginated.map((t, idx) => {
                const isNew = t.id === newTicketId || t.ticket_ID === newTicketId;
                return (
                  <tr
                    key={t.id}
                    className={`${
                      isNew ? 'animate-new-pulse' : (idx === 0 && page === 1 ? 'bg-blue-50' : 'hover:bg-gray-50')
                    } transition-all`}
                  >
                    <td className="px-5 py-4 font-semibold text-[#252578] text-sm">{t.id}</td>
                  <td className="py-4 px-4 text-gray-600">{t.customer}</td>
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ${
                        (t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal')
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {(t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal') ? 'Internal' : 'External'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-gray-700">
                    <span className="font-semibold break-words whitespace-normal">{t.title}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex whitespace-nowrap px-3 py-1 bg-gray-100 rounded-full text-xs">{t.category}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold ${
                       getDisplayStatus(t) === 'Pending Evaluation' ? 'bg-purple-100 text-purple-700' :
                       t.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                       getDisplayStatus(t) === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                       getDisplayStatus(t) === 'Pending Assignment' ? 'bg-amber-100 text-amber-700' :
                       getDisplayStatus(t) === 'Resolved' ? 'bg-green-100 text-green-700' :
                       getDisplayStatus(t) === 'Closed' ? 'bg-gray-100 text-gray-700' :
                       getDisplayStatus(t) === 'Escalated' ? 'bg-red-100 text-red-700' :
                       (getDisplayStatus(t) === 'Reopened' || getDisplayStatus(t) === 'Reopen') ? 'bg-red-100 text-red-700 border border-red-200 font-bold' :
                       'bg-gray-100 text-gray-700'
                     }`}>{getDisplayStatus(t) === 'Reopen' ? 'Reopened' : getDisplayStatus(t)}</span>
                  </td>
                  {/* <td className="py-4 px-4">
                    <span className={`inline-flex whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold ${
                      t.sla === 'Breached' ? 'bg-red-100 text-red-700' :
                      t.sla === 'At Risk' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>{t.sla}</span>
                  </td> */}
                  <td className="py-4 px-4 text-gray-500">{formatDisplayDate(t.date)}</td>
                  <td className="py-4 px-4 text-center">
                    <button
                      onClick={() => handleRowAction(t)}
                      className="p-2 rounded-xl hover:bg-gray-105 transition-all"
                    >
                      <img src={actionIcon} alt="action" className="w-5 h-5 opacity-70" />
                    </button>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing{' '}
            {filtered.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1}
            {' '}-{' '}
            {Math.min(page * ITEMS_PER_PAGE, filtered.length)}
            {' '}of {filtered.length}
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

      {/* Modals */}
      {modalLoading && (
        <SkeletonLoader variant="modal" />
      )}
      {!modalLoading && modal?.mode === 'summary' && (
        <TicketSummary
          ticket={modal.ticket}
          employees={employees}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ mode: 'assign', ticket: modal.ticket })}
          onStatusUpdate={async (updatedFields) => {
            updateEmployeeTicketOverride(updatedFields.id || modal.ticket.id, updatedFields);

            setTickets((prev) => prev.map((t) => (
              t.id === (updatedFields.id || modal.ticket.id) ? { ...t, ...updatedFields } : t
            )));

            try {
              const numericId = Number(String(updatedFields.id || modal.ticket.id).replace(/\D/g, ''));
              
              if (updatedFields.reassignmentStatus) {
                await respondReassignment({
                  ticketId: numericId,
                  action: updatedFields.reassignmentStatus === 'Approved' ? 'approve' : 'deny',
                });
              } else {
                const statusMap = {
                  'Open': 1,
                  'In Progress': 2,
                  'Resolved': 3,
                  'Closed': 4,
                  'Escalated': 5,
                  'Pending Evaluation': 6,
                  'Pending': 7,
                  'Reopened': 8,
                  'Reopen': 8,
                  'Pending Assignment': 9,
                  'On Hold': 11,
                };
                
                await updateTicket({
                  ticketId: numericId,
                  statusId: statusMap[updatedFields.status] ?? 2,
                  assignedByEmail: user?.email,
                  proof_rejected: updatedFields.proofRejected ?? false,
                  rejection_reason: updatedFields.rejectionReason ?? null,
                });
              }
            } catch (err) {
              console.error('Failed to update ticket status on backend:', err);
            }
          }}
          onRespondReassignment={handleRespondReassignment}
        />
      )}

      {!modalLoading && modal?.mode === 'assign' && (
        <AssignModal
          ticket={modal.ticket}
          employees={employees.filter(e => e.id !== modal.ticket?.requested_by)}
          departments={departments}
          priorityOptions={priorityOptions}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}