import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter, RotateCcw, X } from 'lucide-react';
import actionIcon from '@/assets/action.png';
import Pagination from '@/components/Pagination';
import SkeletonLoader from '@/components/SkeletonLoader';
import { TicketSummary, AssignModal } from '@/components/CSModals';
import { formatDisplayDate, parseUTCDate } from '@/utils/dateUtils';
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
  getCSFilterOptions,
  CS_TICKET_REFRESH_EVENT,
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

const buildTicketSearchString = (t) => {
  if (!t) return '';
  const id = String(t.id || t.ticket_ID || t.ticket_number || '');
  const customer = String(
    t.customer ||
    t.customer_name ||
    t.requestor ||
    t.created_by_name ||
    (typeof t.customer === 'object' ? t.customer?.name : '') ||
    ''
  );
  const isInternal = Boolean(
    t.title?.startsWith('[Internal]') ||
    t.is_internal ||
    t.ticket_type === 'Internal' ||
    t.type === 'Internal'
  );
  const typeStr = isInternal ? 'internal' : 'external';
  const title = String(t.title || '');
  const category = String(t.category || '');
  const rawStatus = String(t.status || '');
  const displayStatus = String(
    getDisplayStatus(t) === 'Reopen' ? 'Reopened' : (getDisplayStatus(t) || '')
  );
  const reassignmentBadge = t.reassignmentRequested ? 'pending reassignment' : '';
  const statusStr = `${rawStatus} ${displayStatus} ${reassignmentBadge}`;
  const dept = String(t.department || '');
  const equip = String(t.equipment || t.machine_name || '');
  const facility = String(t.facility || '');

  const dateValue = t.date || t.created_at || t.submitted_at || '';
  const rawDate = String(dateValue);
  const formattedDate = formatDisplayDate(dateValue);
  let extraDates = '';
  try {
    const parsed = parseUTCDate(dateValue);
    if (parsed && !isNaN(parsed.getTime())) {
      extraDates = [
        parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        parsed.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        parsed.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }),
      ].join(' ');
    }
  } catch (e) {}

  return [
    id,
    customer,
    typeStr,
    title,
    category,
    statusStr,
    dept,
    equip,
    facility,
    rawDate,
    formattedDate,
    extraDates,
  ]
    .join(' ')
    .toLowerCase();
};

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
  const [customerFilter, setCustomerFilter] = useState('All Customers');
  const [category, setCategory] = useState('All Categories');
  // const [slaFilter, setSlaFilter] = useState('All SLA');
  const [machineFilter, setMachineFilter] = useState('All Machines');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [assignmentFilter, setAssignmentFilter] = useState('All');
  const [csFilterOptions, setCsFilterOptions] = useState({
    departments: [],
    statuses: [],
    machines: [],
  });
  const [incomingTab, setIncomingTab] = useState('open'); // 'open' | 'pending_assignment' | 'all'
  const [newTicketId, setNewTicketId] = useState(null);
  const newTicketTimerRef = useRef(null);
  const [typeFilter, setTypeFilter] = useState('all');

  // modal state: null | { mode: 'assign'|'summary', ticket }
  const [modal, setModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const resetFilters = useCallback(() => {
    setSearch('');
    setCustomerFilter('All Customers');
    setCategory('All Categories');
    setMachineFilter('All Machines');
    setDepartmentFilter('All Departments');
    setStatusFilter('All Statuses');
    setAssignmentFilter('All');
    setTypeFilter('all');
    setPage(1);
  }, []);

  const clearFilter = useCallback((key) => {
    switch (key) {
      case 'search':
        setSearch('');
        break;
      case 'customer':
        setCustomerFilter('All Customers');
        break;
      case 'machine':
        setMachineFilter('All Machines');
        break;
      case 'department':
        setDepartmentFilter('All Departments');
        break;
      case 'status':
        setStatusFilter('All Statuses');
        break;
      case 'category':
        setCategory('All Categories');
        break;
      case 'assignment':
        setAssignmentFilter('All');
        break;
      case 'type':
        setTypeFilter('all');
        break;
      default:
        break;
    }
    setPage(1);
  }, []);

  const loadStaticData = useCallback(async () => {
    const [depsResult, optionsResult, csOptsResult] = await Promise.allSettled([
      getDepartments(),
      prefetchTicketFormOptions(),
      getCSFilterOptions(),
    ]);

    if (depsResult.status === 'fulfilled') {
      setDepartments((depsResult.value || []).map((d) => d.name));
    }

    if (optionsResult.status === 'fulfilled') {
      setPriorityOptions((optionsResult.value?.ticket_priorities || []).map((p) => p.priority_name));
    }

    if (csOptsResult.status === 'fulfilled' && csOptsResult.value) {
      setCsFilterOptions({
        departments: csOptsResult.value.departments || [],
        statuses: csOptsResult.value.statuses || [],
        machines: csOptsResult.value.machines || [],
      });
      if (csOptsResult.value.departments?.length > 0) {
        setDepartments(csOptsResult.value.departments.map((d) => d.name || d.department_name || d));
      }
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

  useEffect(() => {
    const handleRefreshEvent = () => {
      loadLiveData({ forceRefresh: true, source: 'poll' });
    };
    window.addEventListener(CS_TICKET_REFRESH_EVENT, handleRefreshEvent);
    return () => {
      window.removeEventListener(CS_TICKET_REFRESH_EVENT, handleRefreshEvent);
    };
  }, [loadLiveData]);

  useRealtimeRefresh({
    refresh: handleRealtimeUpdate,
    channels: [
      { name: 'ticket-updates', event: 'ticket.changed' },
      { name: 'employee-status', event: 'employee.status.changed' },
    ],
    intervalMs: 30000,
    deferRefresh: false,
  });

  const customers = useMemo(() => {
    const list = Array.from(new Set(tickets.map((t) => t.customer || t.requestor || t.created_by_name).filter(Boolean)));
    return ['All Customers', ...list.sort()];
  }, [tickets]);

  const categories = useMemo(
    () => ['All Categories', ...Array.from(new Set(tickets.map((t) => t.category).filter(Boolean)))],
    [tickets]
  );

  const machines = useMemo(() => {
    const fromTickets = tickets.map((t) => t.equipment || t.machine_name).filter(Boolean);
    const fromBackend = (csFilterOptions.machines || []).map((m) => m.machine_name || m.label || m.name || m);
    return ['All Machines', ...Array.from(new Set([...fromTickets, ...fromBackend])).sort()];
  }, [tickets, csFilterOptions.machines]);

  const statuses = useMemo(() => {
    const defaultStatuses = ['Open', 'In Progress', 'Pending Assignment', 'On Hold', 'Pending Evaluation', 'Resolved', 'Closed', 'Reopened'];
    const fromBackend = (csFilterOptions.statuses || []).map((s) => s.status_name || s.name || s);
    return ['All Statuses', ...Array.from(new Set([...defaultStatuses, ...fromBackend]))];
  }, [csFilterOptions.statuses]);

  const departmentOptions = useMemo(() => {
    const fromDeps = departments.map((d) => d.name || d);
    const fromTickets = tickets.map((t) => t.department).filter(Boolean);
    return ['All Departments', ...Array.from(new Set([...fromDeps, ...fromTickets])).sort()];
  }, [departments, tickets]);

  const hasActiveFilters = Boolean(
    search.trim() ||
    customerFilter !== 'All Customers' ||
    machineFilter !== 'All Machines' ||
    statusFilter !== 'All Statuses' ||
    departmentFilter !== 'All Departments' ||
    category !== 'All Categories' ||
    assignmentFilter !== 'All' ||
    typeFilter !== 'all'
  );

  // const slaOptions = ['All SLA', 'On Track', 'At Risk', 'Breached'];

  const counts = useMemo(() => {
    let open = 0;
    let pending = 0;
    let all = 0;

    tickets.forEach((t) => {
      if (t.reassignmentRequested === true) return;
      const isAssigned = t.assigned && t.assigned.length > 0 && t.accepted;
      const isPendingValidation = t.status === 'Pending Evaluation';
      const isReopened = t.status === 'Reopened' || t.status === 'Reopen';

      if (isAssigned && !isReopened) return;
      if (isPendingValidation && !isReopened) return;

      all++;
      const isPending = t.status === 'Pending Assignment' || (t.assigned && t.assigned.length > 0 && !t.accepted);
      if (isPending) {
        pending++;
      } else {
        open++;
      }
    });

    return { open, pending, all };
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (t.reassignmentRequested === true) return false;
      if (category !== 'All Categories' && t.category !== category) return false;
      if (customerFilter !== 'All Customers' && (t.customer || t.requestor || t.created_by_name || '') !== customerFilter) return false;
      if (machineFilter !== 'All Machines' && (t.equipment || t.machine_name || '') !== machineFilter) return false;
      if (departmentFilter !== 'All Departments' && (t.department || '').trim().toLowerCase() !== departmentFilter.trim().toLowerCase()) return false;
      if (statusFilter !== 'All Statuses' && (t.status || '').trim().toLowerCase() !== statusFilter.trim().toLowerCase()) return false;

      if (typeFilter === 'internal') {
        const isInternal = t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal';
        if (!isInternal) return false;
      } else if (typeFilter === 'external') {
        const isInternal = t.title?.startsWith('[Internal]') || t.is_internal || t.ticket_type === 'Internal' || t.type === 'Internal';
        if (isInternal) return false;
      }
      
      const isAssigned = t.assigned && t.assigned.length > 0 && t.accepted;
      const isPendingValidation = t.status === 'Pending Evaluation';
      const isReopened = t.status === 'Reopened' || t.status === 'Reopen';
      const isPendingReassign = t.reassignmentRequested === true;
      const isPendingAssignment = t.status === 'Pending Assignment' || (t.assigned && t.assigned.length > 0 && !t.accepted);

      // Filter by Incoming Tab (Open vs Pending Assignment vs All)
      if (incomingTab === 'open') {
        if (isPendingAssignment) return false;
        if (isAssigned && !isPendingReassign && !isReopened) return false;
        if (isPendingValidation && !isPendingReassign && !isReopened) return false;
      } else if (incomingTab === 'pending_assignment') {
        if (!isPendingAssignment) return false;
      } else if (incomingTab === 'all') {
        if (isAssigned && !isPendingReassign && !isReopened) return false;
        if (isPendingValidation && !isPendingReassign && !isReopened) return false;
      }

      // Filter by assignment / reassignment / validation status dropdown
      if (assignmentFilter === 'Pending Assignment') {
        if (!isPendingAssignment) return false;
      } else if (assignmentFilter === 'Pending Reassign') {
        if (!isPendingReassign) return false;
      } else if (assignmentFilter === 'Pending Evaluation') {
        if (!isPendingValidation) return false;
      }

      if (!q) return true;
      const cleanQ = q.trim().toLowerCase();
      const searchBlob = buildTicketSearchString(t);
      if (searchBlob.includes(cleanQ)) return true;
      const tokens = cleanQ.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
      return tokens.length > 0 && tokens.every((token) => searchBlob.includes(token));
    });
  }, [tickets, search, customerFilter, category, machineFilter, departmentFilter, statusFilter, assignmentFilter, typeFilter, incomingTab]);

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
      setModal(null);
      setIncomingTab('pending_assignment');
      return true;
    }

    setError(null);
    try {
      const targetTicketId = updated.ticket_ID || Number(String(updated.id || '').replace(/\D/g, ''));
      await acceptTicket({
        ticketId: targetTicketId,
        employeeIds: updated.assigned,
        assignedByEmail: user?.email,
        priorityId: priorityMap[updated.priority] ?? 1,
      });

      // Optimistically update tickets immediately so the UI reflects Pending Assignment with zero delay
      const refreshedTicket = {
        ...updated,
        ticket_ID: targetTicketId,
        status: 'Pending Assignment',
        assigned: updated.assigned,
        accepted: false,
      };

      setTickets((prev) =>
        prev.map((t) => (t.ticket_ID === targetTicketId || t.id === updated.id ? { ...t, ...refreshedTicket } : t))
      );
      ticketBroadcast.emit('assigned', refreshedTicket);
      setModal(null);
      setIncomingTab('pending_assignment');
      setPage(1);

      window.dispatchEvent(new Event('notifications:updated'));

      // Soft background data refetch to reconcile with backend
      try {
        const incoming = await getCSIncomingTickets({ limit: 100, forceRefresh: true });
        if (Array.isArray(incoming) && incoming.length > 0) {
          setTickets(incoming);
        }
      } catch (e) {
        // Optimistic state is already cleanly set
      }
      return true;
    } catch (err) {
      const errMsg = err?.response?.data?.message || 'Failed to assign ticket. Please try again.';
      setError(errMsg);
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
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm w-full shrink-0">
            <div className="flex flex-wrap items-center gap-3 w-full">
              {/* Ticket ID & Keyword Search Field */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by ticket ID, customer, type, title, category, status, date..."
                  className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-200 bg-gray-50/50 outline-none focus:ring-2 focus:ring-[#252578] focus:bg-white transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Customer Dropdown */}
              <select
                value={customerFilter}
                onChange={(e) => { setCustomerFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-auto shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#252578] bg-white cursor-pointer"
              >
                {customers.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Machine Dropdown */}
              <select
                value={machineFilter}
                onChange={(e) => { setMachineFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-auto shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#252578] bg-white cursor-pointer"
              >
                {machines.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              {/* Status Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-auto shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#252578] bg-white cursor-pointer"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Department Dropdown */}
              <select
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-auto shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#252578] bg-white cursor-pointer"
              >
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Active Filter Chips & Reset All Action */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-[#252578]" /> Active Filters:
                </span>

                {search && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
                    Search: &quot;{search}&quot;
                    <button type="button" onClick={() => clearFilter('search')} className="hover:text-blue-950 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {customerFilter !== 'All Customers' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
                    Customer: {customerFilter}
                    <button type="button" onClick={() => clearFilter('customer')} className="hover:text-blue-950 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {machineFilter !== 'All Machines' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
                    Machine: {machineFilter}
                    <button type="button" onClick={() => clearFilter('machine')} className="hover:text-blue-950 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {statusFilter !== 'All Statuses' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
                    Status: {statusFilter}
                    <button type="button" onClick={() => clearFilter('status')} className="hover:text-blue-950 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {departmentFilter !== 'All Departments' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
                    Dept: {departmentFilter}
                    <button type="button" onClick={() => clearFilter('department')} className="hover:text-blue-950 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 ml-auto px-3 py-1 text-xs font-semibold text-gray-600 hover:text-red-700 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Reset all filters
                </button>
              </div>
            )}
          </div>

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-lg rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-6">

        {/* Incoming Tabs */}
        <div className="flex border-b border-gray-100 mb-6 gap-2">
          <button
            type="button"
            onClick={() => { setIncomingTab('open'); setPage(1); }}
            className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
              incomingTab === 'open'
                ? 'border-[#252578] text-[#252578]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Open / Unassigned
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              incomingTab === 'open' ? 'bg-[#252578]/10 text-[#252578]' : 'bg-gray-100 text-gray-600'
            }`}>
              {counts.open}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setIncomingTab('pending_assignment'); setPage(1); }}
            className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
              incomingTab === 'pending_assignment'
                ? 'border-[#252578] text-[#252578]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Pending Assignment
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              incomingTab === 'pending_assignment' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {counts.pending}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setIncomingTab('all'); setPage(1); }}
            className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
              incomingTab === 'all'
                ? 'border-[#252578] text-[#252578]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            All Incoming
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              incomingTab === 'all' ? 'bg-[#252578]/10 text-[#252578]' : 'bg-gray-100 text-gray-600'
            }`}>
              {counts.all}
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-[#252578]">
            {incomingTab === 'open' ? 'Open Tickets' : incomingTab === 'pending_assignment' ? 'Pending Assignment Tickets' : 'All Incoming Tickets'}
          </h2>
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-gray-500">
                    <div className="max-w-sm mx-auto space-y-2">
                      <p className="font-semibold text-gray-700">No tickets match your search or filter criteria.</p>
                      <p className="text-xs text-gray-500">Try adjusting your filters or resetting them to view the full queue.</p>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#252578] bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer"
                      >
                        <RotateCcw size={12} /> Reset all filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {paginated.map((t, idx) => {
                const isNew = t.id === newTicketId || t.ticket_ID === newTicketId;
                return (
                  <tr
                    key={t.id}
                    onClick={() => handleRowAction(t)}
                    className={`cursor-pointer ${
                      isNew ? 'animate-new-pulse' : (idx === 0 && page === 1 ? 'bg-blue-50' : 'hover:bg-gray-50')
                    } transition-all`}
                  >
                    <td className="py-4 px-4 font-medium">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#252578]">{t.id}</span>
                          {isNew && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-green-100 text-green-800 text-xs font-semibold animate-bounce shrink-0">
                              New
                            </span>
                          )}
                        </div>
                        {t.reassignmentRequested && (
                          <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0 w-max">
                            Pending Reassignment
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
                  <td className="py-4 px-4 text-gray-500">{formatDisplayDate(t.date || t.created_at)}</td>
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
              (t.id === (updatedFields.id || modal.ticket.id) || t.ticket_ID === (updatedFields.ticket_ID || modal.ticket.ticket_ID)) ? { ...t, ...updatedFields } : t
            )));

            // If the status is 'On Hold' or if classification was updated,
            // the dedicated endpoint (POST /hold or PATCH /classification) was already executed directly in TicketSummary.
            if (updatedFields.status === 'On Hold' || updatedFields.category || updatedFields.priority) {
              return;
            }

            try {
              const numericId = modal.ticket.ticket_ID || Number(String(updatedFields.id || modal.ticket.id).replace(/\D/g, ''));
              
              if (updatedFields.reassignmentStatus) {
                await respondReassignment({
                  ticketId: numericId,
                  action: updatedFields.reassignmentStatus === 'Approved' ? 'approve' : 'deny',
                  reason: updatedFields.reassignmentDenyReason ?? '',
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