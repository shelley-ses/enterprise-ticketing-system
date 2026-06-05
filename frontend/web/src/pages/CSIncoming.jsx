import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import actionIcon from '@/assets/action.png';
import Pagination from '@/components/Pagination';
import SkeletonLoader from '@/components/SkeletonLoader';
import { TicketSummary, AssignModal } from '@/components/CSModals';
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

const getDisplayStatus = (ticket) => (
  ticket.status === 'Pending Evaluation' && ticket.proofRejected !== true
    ? 'Resolved'
    : ticket.status
);

/* Modals are imported from @/components/CSModals */

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function CSIncoming() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [priorityOptions, setPriorityOptions] = useState(['Low','Medium','High','Critical']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [slaFilter, setSlaFilter] = useState('All SLA');
  const [machineFilter, setMachineFilter] = useState('All Machines');
  const [assignmentFilter, setAssignmentFilter] = useState('All');
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);
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
    setShowRefreshBanner(false);

    const [incomingResult, assigneesResult] = await Promise.allSettled([
      getCSIncomingTickets({ limit: 100, forceRefresh }),
      getAssignableEmployees({ forceRefresh }),
    ]);

    if (incomingResult.status === 'fulfilled') {
      const list = incomingResult.value.filter((ticket) => ticket.status !== 'Pending Evaluation');
      setTickets(list);
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

  const probeForUpdates = useCallback(async ({ source, payload }) => {
    // Only show banner on actual websocket events, not empty polls.
    // Avoid the stale-state bug by not comparing against current tickets/employees.
    if (source === 'websocket') {
      setShowRefreshBanner(true);
    }
  }, []);

  useEffect(() => {
    loadStaticData();
    loadLiveData({ forceRefresh: true });
  }, [loadStaticData, loadLiveData]);

  useRealtimeRefresh({
    refresh: loadLiveData,
    channels: [
      { name: 'ticket-updates', event: 'ticket.changed' },
      { name: 'employee-status', event: 'employee.status.changed' },
    ],
    intervalMs: 30000,
    deferRefresh: true,
    onRefreshAvailable: probeForUpdates,
  });

  const categories = useMemo(
    () => ['All Categories', ...Array.from(new Set(tickets.map((t) => t.category)))],
    [tickets]
  );

  const machines = useMemo(
    () => ['All Machines', ...Array.from(new Set(tickets.map((t) => t.equipment).filter(Boolean)))],
    [tickets]
  );

  const slaOptions = ['All SLA', 'On Track', 'At Risk', 'Breached'];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (category !== 'All Categories' && t.category !== category) return false;
      if (slaFilter !== 'All SLA' && t.sla !== slaFilter) return false;
      if (machineFilter !== 'All Machines' && t.equipment !== machineFilter) return false;
      if (typeFilter === 'internal') {
        const isInternal = t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal';
        if (!isInternal) return false;
      } else if (typeFilter === 'external') {
        const isInternal = t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal';
        if (isInternal) return false;
      }
      
      const isAssigned = t.assigned && t.assigned.length > 0;
      const isPendingReassign = t.reassignmentRequested === true;
      const isPendingValidation = t.status === 'Pending Evaluation';
      const isReopened = t.status === 'Reopened' || t.status === 'Reopen';

      // Filter by assignment / reassignment / validation status
      if (assignmentFilter === 'All') {
        if (isAssigned && !isPendingReassign && !isPendingValidation && !isReopened) return false;
      } else if (assignmentFilter === 'Pending Reassign') {
        if (!isPendingReassign) return false;
      } else if (assignmentFilter === 'Pending Evaluation') {
        if (!isPendingValidation) return false;
      }

      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.equipment && t.equipment.toLowerCase().includes(q))
      );
    });
  }, [tickets, search, category, slaFilter, machineFilter, assignmentFilter, typeFilter]);

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
    // If already assigned / pending validation / resolved -> show summary first
    const isSummary = t.status === 'Assigned' || t.status === 'Resolved' || t.status === 'In Progress' || t.status === 'Pending';
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
      setModal({ mode: 'assign', ticket: t });
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
        status: 'Assigned',
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

      // Soft data refetch
      try {
        const incoming = await getCSIncomingTickets({ limit: 100 });
        setTickets(incoming.filter((ticket) => ticket.status !== 'Pending Evaluation'));
        
        // Find the newly updated ticket
        const refreshedTicket = incoming.find(t => t.ticket_ID === updated.ticket_ID) || {
          ...updated,
          status: 'Assigned',
        };
        
        // Broadcast the assignment to all listening pages
        ticketBroadcast.emit('assigned', refreshedTicket);
        
        navigate('/cs/assigned');
      } catch (e) {
        // Fallback to local state if refetch fails
        const refreshed = {
          ...updated,
          status: 'Assigned',
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
      setTickets(incoming.filter((ticket) => ticket.status !== 'Pending Evaluation'));
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
    <div className="p-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-2">
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
        <div className="mb-4 rounded-xl bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>
      )}

      {showRefreshBanner && (
        <div 
          onClick={() => loadLiveData({ forceRefresh: true, source: 'manual' })}
          className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm cursor-pointer hover:bg-blue-100/50 transition-colors"
        >
          <div>
            <div className="font-semibold">New tickets available</div>
            <div className="text-xs text-blue-700">Load the latest incoming tickets and employee statuses when ready.</div>
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
        <div className="rounded-2xl bg-white p-8 text-center text-gray-500">Loading incoming tickets...</div>
      ) : (
        <>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-row flex-wrap items-center gap-3 w-full">
        <div className="flex-grow max-w-md min-w-[200px] shrink-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets, customers..."
            className="w-full px-4 py-3 bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm text-sm"
          />
        </div>

        <select
          value={assignmentFilter}
          onChange={(e) => setAssignmentFilter(e.target.value)}
          className="px-4 py-3 bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm font-semibold text-xs text-gray-700 cursor-pointer"
        >
          <option value="All">All Assignments</option>
          <option value="Pending Reassign">Pending Reassign</option>
          <option value="Pending Evaluation">Pending Evaluation</option>
        </select>

        <select
          value={machineFilter}
          onChange={(e) => setMachineFilter(e.target.value)}
          className="w-36 px-4 py-3 bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm font-semibold text-xs text-gray-700 cursor-pointer"
        >
          {machines.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-36 px-4 py-3 bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm font-semibold text-xs text-gray-700 cursor-pointer"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {slaOptions.map((s) => (
            <button
              key={s}
              onClick={() => setSlaFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                slaFilter === s
                  ? 'bg-[#252578] text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-6">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-[#252578]">Incoming Tickets</h2>
          <div className="text-sm text-gray-500">{filtered.length} tickets</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100">
                <th className="py-4 px-4 font-semibold">Ticket ID</th>
                <th className="py-4 px-4 font-semibold">Customer</th>
                <th className="py-4 px-4 font-semibold">Type</th>
                <th className="py-4 px-4 font-semibold">Title</th>
                <th className="py-4 px-4 font-semibold">Category</th>
                <th className="py-4 px-4 font-semibold">Status</th>
                <th className="py-4 px-4 font-semibold">SLA Status</th>
                <th className="py-4 px-4 font-semibold">Date Submitted</th>
                <th className="py-4 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>

            <tbody className="text-gray-700">
              {paginated.map((t, idx) => (
                <tr
                  key={t.id}
                  className={`${
                    idx === 0 && page === 1 ? 'bg-blue-50' : 'hover:bg-gray-50'
                  } transition-all`}
                >
                  <td className="py-4 px-4 font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span>{t.id}</span>
                      {t.reassignmentRequested && (
                        <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0 w-max">
                          Pending Reassign
                        </span>
                      )}
                    </div>
                  </td>
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
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">{t.title}</span>
                      {t.status === 'Pending Evaluation' && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 shrink-0 w-max mt-0.5 animate-pulse">
                          Pending Evaluation
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex whitespace-nowrap px-3 py-1 bg-gray-100 rounded-full text-xs">{t.category}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold ${
                      getDisplayStatus(t) === 'Pending Evaluation' ? 'bg-purple-100 text-purple-700' :
                      t.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                      getDisplayStatus(t) === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                      getDisplayStatus(t) === 'Resolved' ? 'bg-green-100 text-green-700' :
                      getDisplayStatus(t) === 'Closed' ? 'bg-gray-100 text-gray-700' :
                      getDisplayStatus(t) === 'Escalated' ? 'bg-red-100 text-red-700' :
                      (getDisplayStatus(t) === 'Reopened' || getDisplayStatus(t) === 'Reopen') ? 'bg-red-100 text-red-700 border border-red-200 font-bold' :
                      'bg-gray-100 text-gray-700'
                    }`}>{getDisplayStatus(t) === 'Reopen' ? 'Reopened' : getDisplayStatus(t)}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold ${
                      t.sla === 'Breached' ? 'bg-red-100 text-red-700' :
                      t.sla === 'At Risk' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>{t.sla}</span>
                  </td>
                  <td className="py-4 px-4 text-gray-500">{t.date}</td>
                  <td className="py-4 px-4 text-center">
                    <button
                      onClick={() => handleRowAction(t)}
                      className="p-2 rounded-xl hover:bg-gray-105 transition-all"
                    >
                      <img src={actionIcon} alt="action" className="w-5 h-5 opacity-70" />
                    </button>
                  </td>
                </tr>
              ))}
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
          employees={employees}
          departments={departments}
          priorityOptions={priorityOptions}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}