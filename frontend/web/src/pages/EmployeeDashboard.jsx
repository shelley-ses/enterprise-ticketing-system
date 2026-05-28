import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import assignedStatIcon from '@/assets/cs-assigned.png';
import pendingIcon from '@/assets/cs-pending.png';
import unassignedIcon from '@/assets/cs-unassigned.png';
import prioIcon from '@/assets/cs-prio.png';
import warnIcon from '@/assets/cs-warning.png';
import {
  recentProgress,
  statusColors,
  priorityColors,
} from '@/constants/employeeTickets';
import EmployeeFilterBar from '@/components/employee/EmployeeFilterBar';
import TicketDetailModal from '@/components/employee/TicketDetailModal';
import AssignmentSummaryModal from '@/components/employee/AssignmentSummaryModal';
import { useAuth } from '@/context/AuthContext';
import { getEmployeeAssignedTickets } from '@/services/ticketService';

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

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [summaryTicket, setSummaryTicket] = useState(null);
  const [workTicket, setWorkTicket] = useState(null);
  const [filters, setFilters] = useState({
    status: 'All',
    category: 'All',
    priority: 'All',
    date: '',
  });

  const visible = useMemo(() => tickets.filter((t) => !t.rejected), [tickets]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const email = user?.email || 'frontend@example.com';
      setLoadingTickets(true);
      try {
        const list = await getEmployeeAssignedTickets({ employeeEmail: email });
        if (!mounted) return;
        setTickets(list.map((t) => ({ ...t, rejected: false })));
      } finally {
        if (mounted) setLoadingTickets(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [user?.email]);

  const handleStatusChange = useCallback((id, newStatus) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
  }, []);

  const handleAcceptAssignment = useCallback((id) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, accepted: true } : t)));
    setSummaryTicket(null);
  }, []);

  const handleRejectAssignment = useCallback((id) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, rejected: true } : t)));
    setSummaryTicket(null);
  }, []);

  const openTicketFlow = useCallback((t) => {
    if (!t.accepted) setSummaryTicket(t);
    else setWorkTicket(t);
  }, []);

  const stats = useMemo(() => {
    const active = visible.filter(
      (t) => t.status === 'Open' || t.status === 'In Progress' || t.status === 'Escalated'
    ).length;
    const inProg = visible.filter((t) => t.status === 'In Progress').length;
    const done = visible.filter((t) => t.status === 'Resolved').length;
    const sla = visible.filter((t) => t.priority === 'Critical' || t.status === 'Escalated').length;
    const esc = visible.filter((t) => t.status === 'Escalated').length;
    return [
      { label: 'Assigned Tickets', value: active, sub: 'Active tickets', icon: assignedStatIcon },
      { label: 'In Progress', value: inProg, sub: 'Being worked on', icon: pendingIcon },
      { label: 'Completed Tickets', value: done, sub: 'Resolved & closed', icon: unassignedIcon },
      { label: 'SLA Breaches', value: sla, sub: 'Immediate action needed', icon: warnIcon },
      { label: 'Escalated Tickets', value: esc, sub: 'Flagged tickets', icon: prioIcon },
    ];
  }, [visible]);

  const filtered = useMemo(
    () =>
      visible.filter((t) => {
        if (filters.status !== 'All' && t.status !== filters.status) return false;
        if (filters.category !== 'All' && t.category !== filters.category) return false;
        if (filters.priority !== 'All' && t.priority !== filters.priority) return false;
        if (filters.date && t.date !== filters.date) return false;
        return true;
      }),
    [visible, filters]
  );

  const activeTickets = visible.filter((t) => t.status === 'In Progress' || t.status === 'Open');
  const urgentTicket = visible.find((t) => t.status === 'Escalated');
  const escalatedTicket = visible.find((t) => t.priority === 'Critical' && t.status !== 'Resolved');

  const goAssigned = () => navigate('/employee/assigned');
  const goProgress = () => navigate('/employee/progress');

  return (
    <div className="p-6">
      <div className="relative rounded-2xl overflow-hidden mb-8 bg-linear-to-br from-[#252578] via-[#3535a0] to-[#1a1a5c] px-8 py-7 flex flex-col md:flex-row md:items-center gap-4 shadow-md">
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #ffffff 0%, transparent 60%)' }}
        />
        <div className="relative z-10 flex-1">
          <p className="text-white/70 text-sm font-medium mb-1">{dateStr}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
  Welcome back, Engr. John Doe!
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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl shadow-md p-4 flex items-center gap-4">
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
        <div className="mb-6 rounded-xl bg-white p-4 text-sm text-gray-500">Loading assigned tickets...</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-red-50 rounded-2xl shadow-md border border-red-100 p-6">
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
        <div className="bg-amber-50 rounded-2xl shadow-md border border-amber-100 p-6">
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-md p-6">
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
          <EmployeeFilterBar filters={filters} setFilters={setFilters} />
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

        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Progress Updates</h2>
          <div className="space-y-4">
            {recentProgress.map((log) => (
              <div key={log.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#252578] bg-blue-50 px-2 py-0.5 rounded-full">{log.id}</span>
                  <span className="text-xs text-gray-400">{log.time}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-1">{log.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{log.desc}</p>
                <p className="text-xs text-gray-400 mt-2">{log.attachments} attachments</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={goProgress}
            className="w-full mt-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-[#252578] hover:text-[#252578] transition-colors font-medium"
          >
            View All Progress Logs
          </button>
        </div>
      </div>

      {summaryTicket && (
        <AssignmentSummaryModal
          ticket={summaryTicket}
          onClose={() => setSummaryTicket(null)}
          onAccept={handleAcceptAssignment}
          onReject={handleRejectAssignment}
        />
      )}
      {workTicket && (
        <TicketDetailModal
          ticket={workTicket}
          onClose={() => setWorkTicket(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
