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
import { seedDemoPendingEvaluationTicket, getPendingEvaluationTicketsFromStorage } from '@/data/mockFeedbackData';
import { TicketSummary, AssignModal } from '@/components/CSModals';
import { formatDisplayDate } from '@/utils/dateUtils';
import { formatProperSentenceCase } from '@/utils/titleCaseUtils';
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
  const [showFilters, setShowFilters] = useState(false);
  const [assignedTab, setAssignedTab] = useState('all'); // 'all' | 'in_progress' | 'pending_evaluation' | 'reassigned' | 'resolved_closed'

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

      // Assigned page: show tickets with assigned / in progress / evaluation / resolved / closed / reassigned
      const assignedTickets = incoming.filter(t =>
        t.reassignmentRequested === true ||
        ['Pending Assignment', 'In Progress', 'Pending Evaluation', 'Resolved', 'Pending', 'Closed'].includes(t.status) ||
        (t.assigned && t.assigned.length > 0)
      );
      
      const pendingMocks = getPendingEvaluationTicketsFromStorage();
      const merged = [
        ...pendingMocks.filter((m) => !assignedTickets.some((t) => t.id === m.id || t.ticket_ID === m.ticket_ID)),
        ...assignedTickets,
      ];
      setTickets(merged);
      
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
    seedDemoPendingEvaluationTicket();
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

  const counts = useMemo(() => {
    let all = 0;
    let inProgress = 0;
    let pendingEval = 0;
    let reassigned = 0;
    let resolvedClosed = 0;

    tickets.forEach((t) => {
      all++;
      if (t.reassignmentRequested === true) reassigned++;
      if (t.status === 'In Progress') inProgress++;
      if (t.status === 'Pending Evaluation') pendingEval++;
      if (t.status === 'Resolved' || t.status === 'Closed') resolvedClosed++;
    });

    return { all, inProgress, pendingEval, reassigned, resolvedClosed };
  }, [tickets]);

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

      // Tab filter
      if (assignedTab === 'in_progress' && t.status !== 'In Progress') return false;
      if (assignedTab === 'pending_evaluation' && t.status !== 'Pending Evaluation') return false;
      if (assignedTab === 'reassigned' && !t.reassignmentRequested) return false;
      if (assignedTab === 'resolved_closed' && t.status !== 'Resolved' && t.status !== 'Closed') return false;
      
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.equipment && t.equipment.toLowerCase().includes(q))
      );
    });
  }, [tickets, search, category, machineFilter, typeFilter, assignedTab]);

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

    const isSummary = t.reassignmentRequested || t.status === 'Pending Assignment' || t.status === 'Pending Evaluation' || t.status === 'Resolved' || t.status === 'In Progress' || t.status === 'Pending' || t.status === 'Closed' || t.status === 'Reopened';
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
    <div className="p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
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
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>
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

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-lg rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-6">

        {/* Assigned Tabs */}
        <div className="flex border-b border-gray-100 mb-6 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setAssignedTab('all'); setPage(1); }}
            className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2 cursor-pointer shrink-0 ${
              assignedTab === 'all'
                ? 'border-[#252578] text-[#252578]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            All Assigned
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              assignedTab === 'all' ? 'bg-[#252578]/10 text-[#252578]' : 'bg-gray-100 text-gray-600'
            }`}>
              {counts.all}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setAssignedTab('in_progress'); setPage(1); }}
            className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2 cursor-pointer shrink-0 ${
              assignedTab === 'in_progress'
                ? 'border-[#252578] text-[#252578]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            In Progress
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              assignedTab === 'in_progress' ? 'bg-[#252578]/10 text-[#252578]' : 'bg-gray-100 text-gray-600'
            }`}>
              {counts.inProgress}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setAssignedTab('pending_evaluation'); setPage(1); }}
            className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2 cursor-pointer shrink-0 ${
              assignedTab === 'pending_evaluation'
                ? 'border-[#252578] text-[#252578]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Pending Evaluation
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              assignedTab === 'pending_evaluation' ? 'bg-[#252578]/10 text-[#252578]' : 'bg-gray-100 text-gray-600'
            }`}>
              {counts.pendingEval}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setAssignedTab('reassigned'); setPage(1); }}
            className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2 cursor-pointer shrink-0 ${
              assignedTab === 'reassigned'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Reassigned Tickets
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              assignedTab === 'reassigned' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {counts.reassigned}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setAssignedTab('resolved_closed'); setPage(1); }}
            className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2 cursor-pointer shrink-0 ${
              assignedTab === 'resolved_closed'
                ? 'border-[#252578] text-[#252578]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Resolved / Closed
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              assignedTab === 'resolved_closed' ? 'bg-[#252578]/10 text-[#252578]' : 'bg-gray-100 text-gray-600'
            }`}>
              {counts.resolvedClosed}
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-[#252578]">
            {assignedTab === 'reassigned' ? 'Reassigned Tickets' : assignedTab === 'pending_evaluation' ? 'Pending Evaluation' : assignedTab === 'in_progress' ? 'In Progress Tickets' : assignedTab === 'resolved_closed' ? 'Resolved / Closed Tickets' : 'Assigned Tickets'}
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
              {paginated.map((t, idx) => {
                const isReassignmentReq = t.reassignmentRequested;
                
                return (
                  <tr
                    key={t.id}
                    onClick={() => handleRowAction(t)}
                    className={`cursor-pointer transition-all border-b border-gray-50 ${
                      isReassignmentReq 
                        ? 'bg-amber-50/70 hover:bg-amber-100/70' 
                        : (idx === 0 && page === 1 ? 'bg-blue-50/50 hover:bg-gray-50' : 'hover:bg-gray-50')
                    }`}
                  >
                    <td className="py-4 px-4 font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span className={isReassignmentReq ? 'text-amber-800 font-bold' : ''}>{t.id}</span>
                        {isReassignmentReq && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-600 text-white shrink-0 w-max mt-1 animate-pulse shadow-sm">
                            Reassignment Requested
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
                        <span className="font-semibold break-words whitespace-normal">{t.title}</span>
                        {isReassignmentReq && (
                          <div className="text-[11px] text-amber-900 mt-1 bg-white/80 p-1.5 rounded border border-amber-200">
                            <p className="font-semibold">
                              Req: {t.reassignmentRequestedBy || 'Employee'} {t.reassignmentDepartment ? `• ${t.reassignmentDepartment}` : ''}
                            </p>
                            {t.reassignmentReason && (
                              <p className="text-gray-600 italic truncate max-w-xs">&quot;{formatProperSentenceCase(t.reassignmentReason)}&quot;</p>
                            )}
                          </div>
                        )}
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
                        isReassignmentReq ? 'bg-amber-100 text-amber-800 border border-amber-200 font-bold' :
                        t.status === 'Pending Evaluation' ? 'bg-purple-100 text-purple-700' :
                        t.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                        t.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                        t.status === 'Pending Assignment' ? 'bg-amber-100 text-amber-700' :
                        t.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                        t.status === 'Closed' ? 'bg-gray-100 text-gray-700' :
                        t.status === 'Escalated' ? 'bg-red-100 text-red-700' :
                        (t.status === 'Reopened' || t.status === 'Reopen') ? 'bg-red-100 text-red-700 border border-red-200 font-bold' :
                        'bg-gray-100 text-gray-700'
                      }`}>{isReassignmentReq ? 'Pending Reassignment' : (t.status === 'Reopen' ? 'Reopened' : t.status)}</span>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowAction(t);
                        }}
                        className={`p-2 rounded-xl transition-all ${
                          isReassignmentReq ? 'bg-amber-100 hover:bg-amber-200' : 'hover:bg-gray-200 bg-gray-50'
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
