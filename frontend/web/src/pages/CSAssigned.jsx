import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, SlidersHorizontal, Loader2, Filter, RotateCcw, X } from 'lucide-react';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/context/AuthContext';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import {
  getCSIncomingTickets,
  getAssignableEmployees,
  getDepartments,
  acceptTicket,
  getTicketFormOptions,
  getCSFilterOptions,
  updateEmployeeTicketOverride,
  getTicketDetails,
  updateTicket,
  respondReassignment,
} from '@/services/ticketService';
import { TicketSummary, AssignModal } from '@/components/CSModals';
import { formatDisplayDate, parseUTCDate } from '@/utils/dateUtils';
import { formatProperSentenceCase } from '@/utils/titleCaseUtils';
import { PageHeader } from '@/components/ui/page-header';
import { Badge, getStatusBadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { DataTableSkeleton, DataTableEmptyState } from '@/components/ui/data-table';

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

  const dateValue = t.date || t.created_at || t.submitted_at || t.updated_at || '';
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
  const [customerFilter, setCustomerFilter] = useState('All Customers');
  const [category, setCategory] = useState('All Categories');
  // const [slaFilter, setSlaFilter] = useState('All SLA');
  const [machineFilter, setMachineFilter] = useState('All Machines');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [csFilterOptions, setCsFilterOptions] = useState({
    departments: [],
    statuses: [],
    machines: [],
  });
  const [notificationBanner, setNotificationBanner] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [assignedTab, setAssignedTab] = useState('all'); // 'all' | 'in_progress' | 'pending_evaluation' | 'on_hold' | 'reassigned' | 'resolved_closed'

  // modal state: null | { mode: 'assign'|'summary', ticket }
  const [modal, setModal] = useState(null);

  const resetFilters = useCallback(() => {
    setSearch('');
    setCustomerFilter('All Customers');
    setCategory('All Categories');
    setMachineFilter('All Machines');
    setDepartmentFilter('All Departments');
    setStatusFilter('All Statuses');
    setTypeFilter('all');
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
      case 'type':
        setTypeFilter('all');
        break;
      default:
        break;
    }
  }, []);

  const loadStaticData = useCallback(async () => {
    try {
      const [depsResult, optionsResult, csOptsResult] = await Promise.allSettled([
        getDepartments(),
        getTicketFormOptions(),
        getCSFilterOptions(),
      ]);
      if (depsResult.status === 'fulfilled') {
        setDepartments((depsResult.value?.departments || depsResult.value || []).map((d) => d.name || d));
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
      const [incoming, assignees] = await Promise.all([
        getCSIncomingTickets({ limit: 100, forceRefresh }),
        getAssignableEmployees({ forceRefresh }),
      ]);

      // Assigned page: show tickets with assigned / in progress / evaluation / resolved / closed / reassigned / on hold
      const assignedTickets = incoming.filter(t =>
        t.reassignmentRequested === true ||
        ['Pending Assignment', 'In Progress', 'Pending Evaluation', 'Resolved', 'Pending', 'Closed', 'On Hold'].includes(t.status) ||
        (t.assigned && t.assigned.length > 0)
      );
      
      setTickets(assignedTickets);
      
      setEmployees(
        assignees.map((row) => ({
          id: Number(row.id ?? row.emp_id),
          name: row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email || `Employee #${row.id ?? row.emp_id}`,
          role: row.role || '',
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
    try {
      localStorage.removeItem('demo_pending_evaluation_tickets');
    } catch {
      // ignore
    }
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
    const defaultStatuses = ['In Progress', 'Pending Evaluation', 'On Hold', 'Pending Assignment', 'Resolved', 'Closed', 'Reopened'];
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
    typeFilter !== 'all'
  );

  // const slaOptions = ['All SLA', 'On Track', 'At Risk', 'Breached', 'Closed'];

  const counts = useMemo(() => {
    let all = 0;
    let inProgress = 0;
    let pendingEval = 0;
    let reassigned = 0;
    let onHold = 0;
    let resolvedClosed = 0;

    tickets.forEach((t) => {
      all++;
      if (t.reassignmentRequested === true) reassigned++;
      if (t.status === 'In Progress') inProgress++;
      if (t.status === 'Pending Evaluation') pendingEval++;
      if (t.status === 'On Hold') onHold++;
      if (t.status === 'Resolved' || t.status === 'Closed') resolvedClosed++;
    });

    return { all, inProgress, pendingEval, reassigned, onHold, resolvedClosed };
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
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

      // Tab filter
      if (assignedTab === 'in_progress' && t.status !== 'In Progress') return false;
      if (assignedTab === 'pending_evaluation' && t.status !== 'Pending Evaluation') return false;
      if (assignedTab === 'on_hold' && t.status !== 'On Hold') return false;
      if (assignedTab === 'reassigned' && !t.reassignmentRequested) return false;
      if (assignedTab === 'resolved_closed' && t.status !== 'Resolved' && t.status !== 'Closed') return false;
      
      if (!q) return true;
      const cleanQ = q.trim().toLowerCase();
      const searchBlob = buildTicketSearchString(t);
      if (searchBlob.includes(cleanQ)) return true;
      const tokens = cleanQ.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
      return tokens.length > 0 && tokens.every((token) => searchBlob.includes(token));
    });
  }, [tickets, search, customerFilter, machineFilter, departmentFilter, statusFilter, category, typeFilter, assignedTab]);

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

    const isSummary = t.reassignmentRequested || t.status === 'Pending Assignment' || t.status === 'Pending Evaluation' || t.status === 'Resolved' || t.status === 'In Progress' || t.status === 'Pending' || t.status === 'Closed' || t.status === 'Reopened' || t.status === 'On Hold';
    if (isSummary) {
      setModalLoading(true);
      try {
        const ticketId = t.ticket_ID || Number(String(t.id).replace(/\D/g, ''));
        const details = await getTicketDetails(ticketId);
        setModal({ mode: 'summary', ticket: { ...t, ...details } });
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
          t.reassignmentRequested === true ||
          ['Pending Assignment', 'In Progress', 'Pending Evaluation', 'Resolved', 'Pending', 'Closed'].includes(t.status) ||
          (t.assigned && t.assigned.length > 0)
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
    <div className="space-y-6">
      <PageHeader
        title="Assigned Tickets"
        subtitle="Manage and track ongoing assigned support tickets"
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

      {notificationBanner && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-xl flex items-center gap-3 border border-primary-foreground/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-sm font-semibold tracking-wide">{notificationBanner}</span>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="w-full space-y-3 shrink-0">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets, customers..."
            className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full">
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="flex-1 min-w-[130px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {customers.map((c) => (
              <option key={c} value={c}>{c}</option>
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 min-w-[130px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="flex-1 min-w-[130px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {departmentOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
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
          {hasActiveFilters && (
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

      {/* Assigned Tabs */}
      <div className="flex border-b border-border gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => { setAssignedTab('all'); setPage(1); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            assignedTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <span>All Assigned</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            assignedTab === 'all' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {counts.all}
          </span>
        </button>
        <button
          type="button"
          onClick={() => { setAssignedTab('in_progress'); setPage(1); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            assignedTab === 'in_progress'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <span>In Progress</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            assignedTab === 'in_progress' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {counts.inProgress}
          </span>
        </button>
        <button
          type="button"
          onClick={() => { setAssignedTab('pending_evaluation'); setPage(1); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            assignedTab === 'pending_evaluation'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <span>Pending Evaluation</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            assignedTab === 'pending_evaluation' ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
          }`}>
            {counts.pendingEval}
          </span>
        </button>
        <button
          type="button"
          onClick={() => { setAssignedTab('reassigned'); setPage(1); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            assignedTab === 'reassigned'
              ? 'border-warning text-warning'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <span>Reassigned Tickets</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            assignedTab === 'reassigned' ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'
          }`}>
            {counts.reassigned}
          </span>
        </button>
        <button
          type="button"
          onClick={() => { setAssignedTab('resolved_closed'); setPage(1); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            assignedTab === 'resolved_closed'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <span>Resolved / Closed</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            assignedTab === 'resolved_closed' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {counts.resolvedClosed}
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
                message="No tickets found in this assigned queue."
              />
            ) : (
              paginated.map((t, idx) => {
                const isReassignmentReq = t.reassignmentRequested;
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
                      isReassignmentReq
                        ? 'bg-warning/5'
                        : idx === 0 && page === 1
                        ? 'bg-muted/20'
                        : ''
                    }`}
                  >
                    <TableCell className="font-semibold text-primary whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={isReassignmentReq ? 'text-warning font-bold' : ''}>
                          {t.id}
                        </span>
                        {isReassignmentReq && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-warning/15 text-warning w-fit">
                            Reassignment Requested
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
                    <TableCell className="font-medium text-foreground max-w-[18rem]">
                      <div className="flex flex-col gap-1">
                        <span className="truncate">{t.title}</span>
                        {isReassignmentReq && (
                          <div className="text-xs text-warning bg-warning/10 p-1.5 rounded border border-warning/20">
                            <p className="font-semibold">
                              Req: {t.reassignmentRequestedBy || 'Employee'} {t.reassignmentDepartment ? `• ${t.reassignmentDepartment}` : ''}
                            </p>
                            {t.reassignmentReason && (
                              <p className="text-muted-foreground italic truncate max-w-xs">
                                &quot;{formatProperSentenceCase(t.reassignmentReason)}&quot;
                              </p>
                            )}
                          </div>
                        )}
                        {t.status === 'Pending Evaluation' && !isReassignmentReq && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-accent/15 text-accent w-fit">
                            Pending Evaluation
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.category}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(isReassignmentReq ? 'Pending Reassignment' : t.status)}>
                        {isReassignmentReq ? 'Pending Reassignment' : (t.status === 'Reopen' ? 'Reopened' : t.status)}
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

            // If the status is 'On Hold', resumed, or classification updated,
            // the dedicated endpoint (POST /hold, POST /resume, or PATCH /classification) was already executed directly in TicketSummary.
            if (updatedFields.status === 'On Hold' || updatedFields.hold_reason !== undefined || updatedFields.category || updatedFields.priority) {
              try {
                const incoming = await getCSIncomingTickets({ limit: 100, forceRefresh: true });
                const assignedTickets = incoming.filter(t =>
                  t.reassignmentRequested === true ||
                  ['Pending Assignment', 'In Progress', 'Pending Evaluation', 'Resolved', 'Pending', 'Closed', 'On Hold'].includes(t.status) ||
                  (t.assigned && t.assigned.length > 0)
                );
                setTickets(assignedTickets);
              } catch (e) {
                // Keep local state
              }
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

              // Close the modal immediately after a generic status/reassignment update
              setModal(null);
            } catch (err) {
              console.error('Failed to update ticket status on backend:', err);
            }

            // Soft reload the list to reflect updates immediately
            try {
              const incoming = await getCSIncomingTickets({ limit: 100, forceRefresh: true });
              const assignedTickets = incoming.filter(t =>
                t.reassignmentRequested === true ||
                ['Pending Assignment', 'In Progress', 'Pending Evaluation', 'Resolved', 'Pending', 'Closed', 'On Hold'].includes(t.status) ||
                (t.assigned && t.assigned.length > 0)
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
