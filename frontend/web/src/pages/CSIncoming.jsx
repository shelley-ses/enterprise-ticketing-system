import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, RotateCcw, SlidersHorizontal, Loader2 } from 'lucide-react';
import Pagination from '@/components/Pagination';
import { TicketSummary, AssignModal } from '@/components/CSModals';
import { formatDisplayDate, parseUTCDate } from '@/utils/dateUtils';
import { useAuth } from '@/context/AuthContext';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import { PageHeader } from '@/components/ui/page-header';
import { Badge, getStatusBadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { DataTableSkeleton, DataTableEmptyState } from '@/components/ui/data-table';
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
    <div className="space-y-6">
      <PageHeader
        title="Incoming Tickets"
        subtitle="Triage and assign new support tickets"
        actions={
          <div className="flex border border-border rounded-lg overflow-hidden bg-card shrink-0">
            {['all', 'external', 'internal'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  typeFilter === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-muted text-muted-foreground'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <div className="rounded-lg bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Filter toolbar */}
      <div className="w-full space-y-3 shrink-0">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, customer, keyword..."
            className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 min-w-[130px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="All Statuses">All Statuses</option>
            {(csFilterOptions.statuses?.length > 0
              ? csFilterOptions.statuses.map((s) => s.status_name || s.name || s)
              : ['Open', 'In Progress', 'Pending Assignment', 'Resolved', 'Closed', 'On Hold', 'Reopened', 'Pending Evaluation']
            ).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="flex-1 min-w-[130px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="All Departments">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className="flex-1 min-w-[130px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {machines.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex-1 min-w-[130px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value)}
            className="flex-1 min-w-[130px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="All">All Assignments</option>
            <option value="Pending Assignment">Pending Assignment</option>
            <option value="Pending Reassign">Pending Reassign</option>
            <option value="Pending Evaluation">Pending Evaluation</option>
          </select>

          {(search || category !== 'All Categories' || machineFilter !== 'All Machines' || departmentFilter !== 'All Departments' || statusFilter !== 'All Statuses' || assignmentFilter !== 'All' || typeFilter !== 'all') && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="gap-1.5 text-xs text-muted-foreground hover:text-destructive shrink-0"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          type="button"
          onClick={() => { setIncomingTab('open'); setPage(1); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            incomingTab === 'open'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <span>Open / Unassigned</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            incomingTab === 'open' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {counts.open}
          </span>
        </button>
        <button
          type="button"
          onClick={() => { setIncomingTab('pending_assignment'); setPage(1); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            incomingTab === 'pending_assignment'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <span>Pending Assignment</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            incomingTab === 'pending_assignment' ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
          }`}>
            {counts.pending}
          </span>
        </button>
        <button
          type="button"
          onClick={() => { setIncomingTab('all'); setPage(1); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            incomingTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <span>All Incoming</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            incomingTab === 'all' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {counts.all}
          </span>
        </button>
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Ticket ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[150px]">Date Submitted</TableHead>
              <TableHead className="w-[80px] text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <DataTableSkeleton columns={8} rows={6} />
            ) : filtered.length === 0 ? (
              <DataTableEmptyState
                colSpan={8}
                message="No tickets match your search or filter criteria. Try adjusting your filters or resetting them to view the full queue."
              />
            ) : (
              paginated.map((t, idx) => {
                const isNew = t.id === newTicketId || t.ticket_ID === newTicketId;
                const isInternalTicket =
                  t.title?.startsWith('[Internal]') ||
                  t.is_internal ||
                  t.ticket_type === 'Internal' ||
                  t.type === 'Internal';

                return (
                  <TableRow
                    key={t.id}
                    onClick={() => handleRowAction(t)}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                      isNew ? 'bg-primary/5' : idx === 0 && page === 1 ? 'bg-muted/20' : ''
                    }`}
                  >
                    <TableCell className="font-semibold text-primary whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span>{t.id}</span>
                          {isNew && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                              New
                            </span>
                          )}
                        </div>
                        {t.reassignmentRequested && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning w-fit">
                            Pending Reassignment
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[12rem]">
                      {t.customer}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isInternalTicket ? 'secondary' : 'outline'}>
                        {isInternalTicket ? 'Internal' : 'External'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-foreground max-w-[18rem] truncate">
                      {t.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.category}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(getDisplayStatus(t))}>
                        {getDisplayStatus(t) === 'Reopen' ? 'Reopened' : getDisplayStatus(t)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDisplayDate(t.date || t.created_at)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowAction(t);
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        aria-label="Manage ticket"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1} -{' '}
              {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} tickets
            </div>
            <Pagination
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              currentPage={page}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {modalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl p-6 shadow-xl flex flex-col items-center gap-3 max-w-xs w-full mx-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">Loading ticket details...</p>
          </div>
        </div>
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