import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import assignedStatIcon from '@/assets/cs-assigned.png';
import pendingIcon from '@/assets/cs-pending.png';
import unassignedIcon from '@/assets/cs-unassigned.png';
import prioIcon from '@/assets/cs-prio.png';
import warnIcon from '@/assets/cs-warning.png';
import { Search, Filter } from 'lucide-react';
import {
  recentProgress,
  statusColors,
  priorityColors,
} from '@/constants/employeeTickets';
import TicketDetailModal from '@/components/employee/TicketDetailModal';
import CustomerTicketDetailModal from '@/components/CustomerTicketDetailModal';
import { useAuth } from '@/context/AuthContext';
import { getEmployeeAssignedTickets, acceptTicket, updateTicket, updateEmployeeTicketOverride, getTicketDetails, getInternalTickets, getEmployeeProfile } from '@/services/ticketService';
import SkeletonLoader from '@/components/SkeletonLoader';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';

function ChevronRight() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

const statusClass = (s) => statusColors[s] ?? (s?.includes('Discarded') ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700');

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const effectiveUser = user || getStoredUser();
  const navigate = useNavigate();
  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [workTicket, setWorkTicket] = useState(null);

  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [categoryFilter, setCategoryFilter] = useState('All Category');
  const [priorityFilter, setPriorityFilter] = useState('All Priority');

  const [employeeName, setEmployeeName] = useState('');
  const [myRecentTickets, setMyRecentTickets] = useState([]);
  const [loadingMyTickets, setLoadingMyTickets] = useState(true);
  const [selectedMyTicket, setSelectedMyTicket] = useState(null);
  const [myTicketsModalLoading, setMyTicketsModalLoading] = useState(false);
  const [myTicketsLoadingText, setMyTicketsLoadingText] = useState('Loading...');

  const visible = useMemo(() => tickets.filter((t) => !t.rejected), [tickets]);

  const loadTickets = useCallback(async ({ forceRefresh = false } = {}) => {
    const email = user?.email || 'frontend@example.com';
    setLoadingTickets(true);
    try {
      const list = await getEmployeeAssignedTickets({ employeeEmail: email, forceRefresh });
      setTickets(list.map((t) => ({ ...t, rejected: false })));
    } finally {
      setLoadingTickets(false);
    }
  }, [user?.email]);

  const loadMyTickets = useCallback(async () => {
    setLoadingMyTickets(true);
    try {
      const apiTickets = await getInternalTickets();
      if (apiTickets.length > 0) {
        const mapped = apiTickets.map((ticket) => ({
          ...ticket,
          date_created: ticket.date || ticket.created_at,
          last_updated: ticket.lastUpdate || ticket.updated_at || ticket.last_updated,
          is_internal: true,
          ticket_type: 'Internal',
          can_discard: ticket.status === 'Open' && !ticket.assigned_to,
        }));
        setMyRecentTickets(mapped.slice(0, 5));
        localStorage.setItem('employee_created_tickets', JSON.stringify(mapped));
      } else {
        const stored = JSON.parse(localStorage.getItem('employee_created_tickets') || '[]');
        const updated = await Promise.all(
          stored.slice(0, 5).map(async (t) => {
            const numericId = t.ticket_ID || parseInt(String(t.id || '').replace(/\D/g, ''), 10);
            if (!!t.isMock) return t;
            try {
              const detail = await getTicketDetails(numericId);
              return {
                ...t,
                ...detail,
                status: detail.status || t.status,
                last_updated: detail.last_updated || t.last_updated,
              };
            } catch {
              return t;
            }
          })
        );
        setMyRecentTickets(updated);

        const fullList = JSON.parse(localStorage.getItem('employee_created_tickets') || '[]');
        const updatedFullList = fullList.map((item) => {
          const found = updated.find((candidate) => candidate.id === item.id);
          return found ? { ...item, ...found } : item;
        });
        localStorage.setItem('employee_created_tickets', JSON.stringify(updatedFullList));
      }
    } catch (err) {
      console.error('Failed to load my tickets on dashboard:', err);
    } finally {
      setLoadingMyTickets(false);
    }
  }, []);

  const handleResolveMyTicket = async (ticketId) => {
    const isMock = selectedMyTicket ? !!selectedMyTicket.isMock : false;
    if (isMock) {
      const stored = JSON.parse(localStorage.getItem('employee_created_tickets') || '[]');
      const updatedList = stored.map(t => {
        if (t.id === ticketId || t.ticket_ID === ticketId) {
          const timestamp = new Date().toISOString();
          const timeline = t.timeline || [
            { id: 'creation', type: 'system', text: 'Ticket created.', timestamp: t.date_created }
          ];
          return {
            ...t,
            status: 'Resolved',
            resolved_at: timestamp,
            last_updated: timestamp,
            timeline: [
              ...timeline,
              {
                id: `status-resolved-${Date.now()}`,
                type: 'status',
                text: 'Ticket resolved by creator.',
                timestamp,
              }
            ]
          };
        }
        return t;
      });
      localStorage.setItem('employee_created_tickets', JSON.stringify(updatedList));
      await loadMyTickets();
      setSelectedMyTicket(null);
      window.alert('Ticket resolved successfully.');
      return;
    }
  };

  const handleReopenMyTicket = async (ticketId, reason) => {
    const isMock = selectedMyTicket ? !!selectedMyTicket.isMock : false;
    if (isMock) {
      const stored = JSON.parse(localStorage.getItem('employee_created_tickets') || '[]');
      const updatedList = stored.map(t => {
        if (t.id === ticketId || t.ticket_ID === ticketId) {
          const timestamp = new Date().toISOString();
          const timeline = t.timeline || [
            { id: 'creation', type: 'system', text: 'Ticket created.', timestamp: t.date_created }
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
      });
      localStorage.setItem('employee_created_tickets', JSON.stringify(updatedList));
      await loadMyTickets();
      setSelectedMyTicket(null);
      window.alert('Ticket reopened successfully.');
      return;
    }

    setMyTicketsLoadingText('Reopening ticket...');
    setMyTicketsModalLoading(true);
    try {
      const numericId = Number(String(ticketId).replace(/\D/g, ''));
      await updateTicket({
        ticketId: numericId,
        statusId: 8, // Reopened
      });
      await loadMyTickets();
      setSelectedMyTicket(null);
      window.alert('Ticket reopened successfully.');
    } catch (err) {
      console.error('Failed to reopen ticket:', err);
      window.alert(err?.response?.data?.message || 'Failed to reopen ticket.');
    } finally {
      setMyTicketsModalLoading(false);
    }
  };

  const handleViewMyTicket = async (t) => {
    const numericId = t.ticket_ID || parseInt(String(t.id || '').replace(/\D/g, ''), 10);
    const isMock = !!t.isMock || [1001, 1002, 1003, 1004, 7545, 9091, 9092].includes(numericId) || String(t.id).startsWith('TKT-100');
    if (isMock) {
      setSelectedMyTicket({
        ...t,
        isMock: true,
        description: t.description || '',
        resolved_at: t.resolved_at || null,
        proofAttachments: t.proofAttachments || [],
        proofFiles: t.proofFiles || [],
        can_discard: t.status === 'Open' && !t.assigned_to,
      });
      return;
    }

    setMyTicketsLoadingText('Loading ticket details...');
    setMyTicketsModalLoading(true);
    try {
      const fullTicket = await getTicketDetails(numericId);
      setSelectedMyTicket({
        ...t,
        ...fullTicket,
        description: fullTicket.description || t.description || '',
        resolved_at: fullTicket.resolved_at || null,
        proofAttachments: fullTicket.proofAttachments || [],
        proofFiles: fullTicket.proofFiles || [],
        can_discard: (fullTicket.status || t.status) === 'Open' && !fullTicket.assigned_to,
      });
    } catch (err) {
      console.error('Failed to load ticket details:', err);
      setSelectedMyTicket(t);
    } finally {
      setMyTicketsModalLoading(false);
    }
  };

  useEffect(() => {
    loadTickets({ forceRefresh: false });
    loadMyTickets();
    getEmployeeProfile().then(p => setEmployeeName(p.name)).catch(() => {});
  }, [loadTickets, loadMyTickets]);

  const handleRefreshAll = useCallback(async (opts = {}) => {
    await loadTickets(opts);
    await loadMyTickets();
  }, [loadTickets, loadMyTickets]);

  useRealtimeRefresh({
    refresh: handleRefreshAll,
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
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
    } catch (err) {
      console.error('Failed to update ticket status on backend:', err);
      // fallback to optimistic update
      updateEmployeeTicketOverride(id, {
        status: newStatus,
        proofRejected: false,
        rejectionReason: null,
      });
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
    }
  }, [tickets, user]);

  const openTicketFlow = useCallback((t) => {
    if (t.accepted) {
      setWorkTicket(t);
    } else {
      setSelectedMyTicket(t);
    }
  }, []);

  const stats = useMemo(() => {
    const active = visible.filter(
      (t) => t.status === 'Open' || t.status === 'Pending Assignment' || t.status === 'In Progress' || t.status === 'Escalated' || t.status === 'On Hold'
    ).length;
    const inProg = visible.filter((t) => t.status === 'In Progress').length;
    const done = visible.filter((t) => t.status === 'Resolved').length;
    // const sla = visible.filter((t) => t.priority === 'Critical' || t.status === 'Escalated').length;
    // const esc = visible.filter((t) => t.status === 'Escalated').length;
    return [
      { label: 'Assigned Tickets', value: active, sub: 'Active tickets', icon: assignedStatIcon },
      { label: 'In Progress', value: inProg, sub: 'Being worked on', icon: pendingIcon },
      { label: 'Completed Tickets', value: done, sub: 'Resolved & closed', icon: unassignedIcon },
      // { label: 'SLA Breaches', value: sla, sub: 'Immediate action needed', icon: warnIcon },
      // { label: 'Escalated Tickets', value: esc, sub: 'Flagged tickets', icon: prioIcon },
    ];
  }, [visible]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visible.filter((t) => {
      if (q && !t.id?.toLowerCase().includes(q) && !t.title?.toLowerCase().includes(q) && !t.customer?.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'All Status' && t.status !== statusFilter) return false;
      if (categoryFilter !== 'All Category' && t.category !== categoryFilter) return false;
      if (priorityFilter !== 'All Priority' && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [visible, search, statusFilter, categoryFilter, priorityFilter]);

  const activeTickets = visible.filter((t) => t.status === 'In Progress' || t.status === 'Pending Assignment' || t.status === 'Open' || t.status === 'On Hold');
  const urgentTicket = visible.find((t) => t.status === 'Escalated');
  const escalatedTicket = visible.find((t) => t.priority === 'Critical' && t.status !== 'Resolved');

  const goAssigned = () => navigate('/employee/assigned');
  const goProgress = () => navigate('/employee/progress');

  return (
    <div className="p-6">
      <div className="relative rounded-xl overflow-hidden mb-8 bg-linear-to-br from-[#252578] via-[#3535a0] to-[#1a1a5c] px-8 py-7 flex flex-col md:flex-row md:items-center gap-4 shadow-md">
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #ffffff 0%, transparent 60%)' }}
        />
        <div className="relative z-10 flex-1">
          <p className="text-white/70 text-sm font-medium mb-1">{dateStr}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
  {(() => { const displayName = effectiveUser?.first_name ? `${effectiveUser.first_name}${effectiveUser.last_name ? ' ' + effectiveUser.last_name : ''}` : (effectiveUser?.name || 'General Employee'); return `Welcome back, ${displayName}!`; })()}
  <span className="ml-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-400/20 border border-green-400/40 text-green-300 text-xs font-semibold align-middle">
    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
    Active
  </span>
</h1>
          <p className="text-white/70 text-sm">Here&apos;s a summary of your equipment support tickets.</p>
        </div>
        <div className="relative z-10 flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={goAssigned}
            className="px-5 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white text-sm font-semibold transition-all"
          >
            View All Tickets
          </button>
          <button
            type="button"
            onClick={goProgress}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-sm font-medium transition-all"
          >
            Progress Logs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4">
            <div className="w-14 h-14 bg-[#f1f5f9] rounded-lg flex items-center justify-center">
              <img src={s.icon} alt="" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-800">{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {loadingTickets && (
        <div className="mb-6 rounded-xl bg-white p-4">
          <SkeletonLoader variant="ticket-card" />
        </div>
      )}



      {/*
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-red-50 rounded-xl shadow-md border border-red-100 p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-red-400 animate-pulse" />
            <span className="text-sm font-bold text-red-700">Ventilator Pressure Alarm Fault</span>
          </div>
          <p className="text-xs text-red-600 mb-4 font-medium">Immediate action required</p>
          {urgentTicket && (
            <button
              type="button"
              onClick={() => openTicketFlow(urgentTicket)}
              className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-red-100 hover:border-red-300 transition-colors shadow-sm text-left"
            >
              <div>
                <p className="text-sm font-semibold text-gray-800">SLA Breached</p>
                <p className="text-xs text-gray-500">{urgentTicket.id} · {urgentTicket.facility}</p>
              </div>
              <ChevronRight />
            </button>
          )}
        </div>
        <div className="bg-amber-50 rounded-xl shadow-md border border-amber-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-sm font-bold text-amber-800">Escalated Tickets</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/employee/assigned')}
              className="text-amber-700 hover:text-amber-900"
              aria-label="Go to assigned"
            >
              <ChevronRight />
            </button>
          </div>
          <p className="text-xs text-amber-700 mb-4 font-medium">Requires senior review</p>
          {escalatedTicket && (
            <button
              type="button"
              onClick={() => openTicketFlow(escalatedTicket)}
              className="w-full flex items-center gap-2 bg-white rounded-xl px-4 py-3 border border-amber-100 hover:border-amber-300 transition-colors shadow-sm text-left"
            >
              <div className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{escalatedTicket.title}</p>
                <p className="text-xs text-gray-500">{escalatedTicket.id} · {escalatedTicket.facility}</p>
              </div>
            </button>
          )}
        </div>
      </div>
      */}

      <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Active Assigned Tickets</h2>
                <p className="text-sm text-gray-500">{activeTickets.length} tickets need attention</p>
              </div>
              <button
                type="button"
                onClick={goAssigned}
                className="flex items-center gap-1 text-sm font-semibold text-[#252578] hover:underline"
              >
                View All <ArrowRight />
              </button>
            </div>
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
            {showFilters && (
              <div className="flex flex-row flex-wrap items-center gap-3 mb-6 p-4 rounded-xl border border-gray-100 bg-white shadow-sm justify-end">
                <select
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {['All Status', 'Open', 'In Progress', 'Escalated', 'Pending', 'Pending Reassign', 'On Hold'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {['All Category', 'MRI', 'CT Scan', 'Ultrasound', 'X-Ray', 'Ventilator', 'Defibrillator'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  {['All Priority', 'Critical', 'High', 'Medium', 'Low'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm text-left">
                <colgroup>
                  <col className="w-[13%]" />
                  <col className="w-[32%]" />
                  <col className="w-[25%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="py-3 px-3">Ticket ID</th>
                    <th className="py-3 px-3">Title</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Priority</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 px-4 text-center text-gray-400">
                        No tickets match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((t, idx) => (
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
                        className={`border-b hover:bg-gray-50 cursor-pointer ${idx === 0 ? 'bg-blue-50/50' : ''}`}
                      >
                        <td className="py-3 px-3 font-medium text-[#252578] align-middle">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs">{t.id}</span>
                            {!t.accepted && (
                              <span className="text-[10px] text-amber-700 font-medium">Tap to review</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-800 align-middle min-w-0">
                          <span className="line-clamp-2">{t.title}</span>
                        </td>
                        <td className="py-3 px-3 text-gray-600 align-middle min-w-0 truncate">{t.customer}</td>
                        <td className="py-3 px-3 align-middle">
                          <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[t.status]}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 align-middle">
                          <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium ${priorityColors[t.priority]}`}>
                            {t.priority}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-800">My Recent Tickets</h2>
                <p className="text-sm text-gray-500">Latest submitted support tickets</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/employee/my-tickets')}
                className="text-sm font-semibold text-[#252578] flex items-center gap-1 hover:underline"
              >
                View All <ArrowRight />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b pb-2">
                    <th className="py-3 px-3 w-[20%]">Ticket ID</th>
                    <th className="py-3 px-3 w-[50%]">Title</th>
                    <th className="py-3 px-3 w-[30%]">Status</th>
                    <th className="py-3 px-3 text-center w-[10%]">View</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {myRecentTickets.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-8 px-4 text-center text-gray-500">
                        {loadingMyTickets ? 'Loading recent tickets...' : 'No tickets yet.'}
                      </td>
                    </tr>
                  ) : (
                    myRecentTickets.map((t) => (
                      <tr key={t.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-3 font-semibold text-[#252578] align-middle">{t.id}</td>
                        <td className="py-3 px-3 text-gray-800 align-middle">
                          <div className="font-semibold text-gray-800">{t.title}</div>
                          <div className="text-xs text-gray-500 mt-1">{t.equipment || 'General'}</div>
                        </td>
                        <td className="py-3 px-3 align-middle">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full flex w-fit items-center gap-1.5 ${statusClass(t.status)}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center align-middle">
                          <button
                            onClick={() => handleViewMyTicket(t)}
                            aria-label={`View ${t.id}`}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        </div>
      </div>

      {workTicket && (
        <TicketDetailModal
          ticket={workTicket}
          onClose={() => setWorkTicket(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {selectedMyTicket && (
        <CustomerTicketDetailModal
          ticket={selectedMyTicket}
          onClose={() => setSelectedMyTicket(null)}
          onDiscard={null}
          onReopen={(ticketId, reason) => handleReopenMyTicket(ticketId, reason)}
          onResolve={null}
        />
      )}

      {myTicketsModalLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px] animate-in fade-in duration-200">
          <div className="bg-white rounded-xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full mx-4 border border-gray-100">
            <div className="w-10 h-10 border-4 border-[#252578]/10 border-t-[#252578] rounded-full animate-spin" />
            <p className="text-sm font-semibold text-[#252578] text-center font-sans">
              {myTicketsLoadingText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
