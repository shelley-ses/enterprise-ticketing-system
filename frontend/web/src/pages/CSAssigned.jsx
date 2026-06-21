import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import actionIcon from '@/assets/action.png';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/context/AuthContext';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import {
  getCSIncomingTickets,
  getAssignableEmployees,
  getDepartments,
  acceptTicket,
  getTicketFormOptions,
  updateEmployeeTicketOverride,
  getTicketDetails,
  updateTicket,
  respondReassignment,
} from '@/services/ticketService';
import { TicketSummary, AssignModal } from '@/components/CSModals';
import SkeletonLoader from '@/components/SkeletonLoader';

export default function CSAssigned() {
  const { user } = useAuth();
  const location = useLocation();
  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [priorityOptions, setPriorityOptions] = useState(['Low','Medium','High','Critical']);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  // const [slaFilter, setSlaFilter] = useState('All SLA');
  const [machineFilter, setMachineFilter] = useState('All Machines');
  const [notificationBanner, setNotificationBanner] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // modal state: null | { mode: 'assign'|'summary', ticket }
  const [modal, setModal] = useState(null);

  const loadStaticData = useCallback(async () => {
    try {
      const [deps, options] = await Promise.all([
        getDepartments(),
        getTicketFormOptions(),
      ]);
      setDepartments((deps?.departments || []).map((d) => d.name));
      setPriorityOptions((options?.ticket_priorities || []).map((p) => p.priority_name));
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
      const [incoming, assignees] = await Promise.all([
        getCSIncomingTickets({ limit: 100, forceRefresh }),
        getAssignableEmployees({ forceRefresh }),
      ]);

      // Assigned page: show accepted tickets + Pending Evaluation (may not have accepted flag)
      // Reassignment-requested tickets should be handled from the Incoming page
      const assignedTickets = incoming.filter(t =>
        (t.status === 'Pending Assignment' || t.status === 'In Progress' ||
         t.status === 'Pending Evaluation' || t.status === 'Resolved' ||
         t.status === 'Pending' || t.status === 'Closed') &&
        !t.reassignmentRequested &&
        (t.accepted || t.status === 'Pending Evaluation')
      );
      
      setTickets(assignedTickets);
      
      setEmployees(
        assignees.map((row) => ({
          id: Number(row.id),
          name: row.name,
          status: row.is_active ? 'active' : 'inactive',
          department: row.department || 'Unassigned',
        }))
      );
    } catch {
      setError('Unable to load assigned tickets from ticket-service.');
    } finally {
      if (source !== 'websocket' && source !== 'poll') {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadStaticData();
    loadLiveData({ forceRefresh: true });
  }, [loadStaticData, loadLiveData]);

  useEffect(() => {
    const focusId = location.state?.focusTicketId;
    if (focusId && tickets.length > 0) {
      const match = tickets.find(t => t.id === focusId || t.ticket_ID === focusId);
      if (match) {
        handleRowAction(match);
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, tickets]);

  useRealtimeRefresh({
    refresh: (context) => {
      loadLiveData(context);
      if (context && context.source === 'websocket') {
        setNotificationBanner('Ticket list automatically updated via real-time sync');
        setTimeout(() => {
          setNotificationBanner(null);
        }, 4000);
      }
    },
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

  // const slaOptions = ['All SLA', 'On Track', 'At Risk', 'Breached', 'Closed'];

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
      
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.equipment && t.equipment.toLowerCase().includes(q))
      );
    });
  }, [tickets, search, category, machineFilter, typeFilter]);

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
    const isMock = !!t.isMock;
    if (isMock) {
      setModal({ mode: 'summary', ticket: t });
      return;
    }

    const isSummary = t.status === 'Pending Assignment' || t.status === 'Pending Evaluation' || t.status === 'Resolved' || t.status === 'In Progress' || t.status === 'Pending' || t.status === 'Closed';
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
      const refreshed = { ...updated, status: 'Pending Assignment' };
      setTickets((prev) => prev.map((t) => ((t.ticket_ID === updated.ticket_ID || t.id === updated.id) ? refreshed : t)));
      setModal({ mode: 'summary', ticket: refreshed });
      window.alert('Ticket assigned successfully.');
      return true;
    }

    try {
      await acceptTicket({
        ticketId: updated.ticket_ID || updated.id.replace(/\D/g, ''),
        employeeIds: updated.assigned,
        assignedByEmail: user?.email,
        priorityId: priorityMap[updated.priority] ?? 1,
      });

      window.dispatchEvent(new Event('notifications:updated'));

      // Soft data refetch
      try {
        const incoming = await getCSIncomingTickets({ limit: 100, forceRefresh: true });
        const assignedTickets = incoming.filter(t =>
          (t.status === 'Pending Assignment' || t.status === 'In Progress' ||
           t.status === 'Pending Evaluation' || t.status === 'Resolved' ||
           t.status === 'Pending' || t.status === 'Closed') &&
          !t.reassignmentRequested &&
          t.accepted
        );
        setTickets(assignedTickets);
        
        const refreshedTicket = assignedTickets.find(t => t.ticket_ID === updated.ticket_ID) || {
          ...updated,
          status: 'Pending Assignment',
        };
        setModal({ mode: 'summary', ticket: refreshedTicket });
      } catch (e) {
        const refreshed = { ...updated, status: 'Pending Assignment' };
        setTickets((prev) => prev.map((t) => ((t.ticket_ID === updated.ticket_ID || t.id === updated.id) ? refreshed : t)));
        setModal({ mode: 'summary', ticket: refreshed });
      }
      return true;
    } catch (err) {
      setError('Failed to assign ticket. Please try again.');
      console.error(err);
      return false;
    }
  };

  return (
    <div className="p-6">

      {/* Header */}
      <div className="mb-8 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-[#252578]">Assigned Tickets</h1>
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
        <p className="text-gray-500 mt-1">Manage and track ongoing assigned support tickets</p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>
      )}

      {notificationBanner && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#252578] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/20 animate-bounce">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-sm font-semibold tracking-wide">{notificationBanner}</span>
        </div>
      )}

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

      {/* Search & Filter Toggle */}
      <div className="flex items-center gap-3 mb-4 w-full">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets, customers..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
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
        <div className="mb-6 flex flex-row flex-wrap items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white shadow-sm justify-end">
          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className="px-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#252578] outline-none text-sm text-gray-700 cursor-pointer"
          >
            {machines.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#252578] outline-none text-sm text-gray-700 cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

        </div>
      )}

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-lg rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-6">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-[#252578]">Assigned Tickets</h2>
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
                {/* <th className="py-4 px-4 font-semibold">SLA Status</th> */}
                <th className="py-4 px-4 font-semibold">Date Submitted</th>
                <th className="py-4 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>

            <tbody className="text-gray-700">
              {paginated.map((t, idx) => {
                const isReassignmentReq = t.reassignmentRequested;
                
                return (
                  <tr
                    key={t.id}
                    onClick={() => handleRowAction(t)}
                    className={`cursor-pointer transition-all border-b border-gray-50 ${
                      isReassignmentReq 
                        ? 'bg-red-50 hover:bg-red-100' 
                        : (idx === 0 && page === 1 ? 'bg-blue-50/50 hover:bg-gray-50' : 'hover:bg-gray-50')
                    }`}
                  >
                    <td className="py-4 px-4 font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span className={isReassignmentReq ? 'text-red-700 font-bold' : ''}>{t.id}</span>
                        {isReassignmentReq && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-600 text-white shrink-0 w-max mt-1 animate-pulse shadow-sm">
                            Immediate Action Required
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
                        {t.status === 'Pending Evaluation' && !isReassignmentReq && (
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
                        t.status === 'Pending Evaluation' ? 'bg-purple-100 text-purple-700' :
                        t.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                        t.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                        t.status === 'Pending Assignment' ? 'bg-amber-100 text-amber-700' :
                        t.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                        t.status === 'Closed' ? 'bg-gray-100 text-gray-700' :
                        t.status === 'Escalated' ? 'bg-red-100 text-red-700' :
                        (t.status === 'Reopened' || t.status === 'Reopen') ? 'bg-red-100 text-red-700 border border-red-200 font-bold' :
                        'bg-gray-100 text-gray-700'
                      }`}>{t.status === 'Reopen' ? 'Reopened' : t.status}</span>
                    </td>
                    {/* <td className="py-4 px-4">
                      <span className={`inline-flex whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold ${
                        t.sla === 'Breached' ? 'bg-red-100 text-red-700' :
                        t.sla === 'At Risk' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>{t.sla}</span>
                    </td> */}
                    <td className="py-4 px-4 text-gray-500">{t.date}</td>
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowAction(t);
                        }}
                        className={`p-2 rounded-xl transition-all ${
                          isReassignmentReq ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-gray-200 bg-gray-50'
                        }`}
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

              // Close the modal immediately after a successful update
              setModal(null);
            } catch (err) {
              console.error('Failed to update ticket status on backend:', err);
            }

            // Soft reload the list to reflect updates immediately
            try {
              const incoming = await getCSIncomingTickets({ limit: 100, forceRefresh: true });
              const assignedTickets = incoming.filter(t =>
                (t.status === 'Pending Assignment' || t.status === 'In Progress' ||
                 t.status === 'Pending Evaluation' || t.status === 'Resolved' ||
                 t.status === 'Pending' || t.status === 'Closed') &&
                !t.reassignmentRequested &&
                t.accepted
              );
              setTickets(assignedTickets);
            } catch (e) {
              setTickets(prev => prev.map(t => (t.id === (updatedFields.id || modal.ticket.id)) ? { ...t, ...updatedFields } : t));
            }
          }}
        />
      )}

      {modal?.mode === 'assign' && (
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
