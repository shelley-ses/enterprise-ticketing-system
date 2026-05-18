import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  statusColors,
  priorityColors,
  slaStatusColors,
  sortTicketsByPriority,
} from '@/constants/employeeTickets';
import TicketDetailModal from '@/components/employee/TicketDetailModal';
import AssignmentSummaryModal from '@/components/employee/AssignmentSummaryModal';
import { useAuth } from '@/context/AuthContext';
import { getEmployeeAssignedTickets } from '@/services/ticketService';

const selectClass =
  'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer min-w-[8.5rem]';

export default function EmployeeAssigned() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [categoryFilter, setCategoryFilter] = useState('All Category');
  const [priorityFilter, setPriorityFilter] = useState('All Priority');
  const [sortPriority, setSortPriority] = useState('Priority');

  const [summaryTicket, setSummaryTicket] = useState(null);
  const [workTicket, setWorkTicket] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user?.email) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError('');
      try {
        const list = await getEmployeeAssignedTickets({ employeeEmail: user.email });
        if (!mounted) return;
        setTickets(list.map((t) => ({ ...t, rejected: false })));
      } catch {
        if (!mounted) return;
        setLoadError('Unable to load assigned tickets from ticket-service.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [user?.email]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = tickets.filter((t) => {
      if (t.rejected) return false;
      if (statusFilter !== 'All Status' && t.status !== statusFilter) return false;
      if (categoryFilter !== 'All Category' && t.category !== categoryFilter) return false;
      if (priorityFilter !== 'All Priority' && t.priority !== priorityFilter) return false;
      if (q) {
        const blob = `${t.id} ${t.title} ${t.customer} ${t.facility ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
    if (sortPriority === 'Priority') {
      list = sortTicketsByPriority(list, 'desc');
    }
    return list;
  }, [tickets, search, statusFilter, categoryFilter, priorityFilter, sortPriority]);

  const handleAcceptAssignment = useCallback((id) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, accepted: true } : t)));
    setSummaryTicket(null);
  }, []);

  const handleRejectAssignment = useCallback((id) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, rejected: true } : t)));
    setSummaryTicket(null);
  }, []);

  const handleStatusChange = useCallback((id, newStatus) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
  }, []);

  /** Row / ticket tap: assignment summary first if not accepted; otherwise work (update) modal. */
  const openTicketFlow = useCallback((t) => {
    if (!t.accepted) setSummaryTicket(t);
    else setWorkTicket(t);
  }, []);

  const activeCount = tickets.filter((t) => !t.rejected).length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#252578]">My Assigned Tickets</h1>
        <p className="text-sm text-gray-500 mt-1">All tickets assigned to you — work, update, and resolve.</p>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl bg-red-50 text-red-700 px-4 py-2 text-sm">{loadError}</div>
      )}

      <div className="bg-white rounded-2xl shadow-md p-6">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading assigned tickets...</div>
        ) : (
          <>
        <div className="flex flex-col xl:flex-row xl:items-center gap-4 mb-6">
          <div className="relative flex-1 min-w-0">
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search ID, title, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252578]/25"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {['All Status', 'Open', 'In Progress', 'Resolved', 'Escalated', 'Closed'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className={selectClass} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              {['All Category', 'MRI', 'CT Scan', 'Ultrasound', 'X-Ray', 'Ventilator', 'Defibrillator'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select className={selectClass} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              {['All Priority', 'Critical', 'High', 'Medium', 'Low'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select className={selectClass} value={sortPriority} onChange={(e) => setSortPriority(e.target.value)}>
              <option value="Priority">Sort: Priority</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full table-fixed text-sm text-left border-collapse">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[22%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="text-gray-500 border-b border-gray-200 bg-gray-50/80">
                <th className="py-3 px-2 font-medium">Ticket ID</th>
                <th className="py-3 px-2 font-medium">Customer</th>
                <th className="py-3 px-2 font-medium">Title</th>
                <th className="py-3 px-2 font-medium">Category</th>
                <th className="py-3 px-2 font-medium">Priority</th>
                <th className="py-3 px-2 font-medium">Status</th>
                <th className="py-3 px-2 font-medium">SLA</th>
                <th className="py-3 px-2 font-medium">Last Update</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {filtered.map((t) => (
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
                  className="border-b border-gray-100 hover:bg-blue-50/40 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-2 align-middle">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Attention" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-semibold text-[#252578] text-xs leading-tight">{t.id}</span>
                          {t.escalated && (
                            <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-orange-100 text-orange-800 shrink-0">
                              ESC
                            </span>
                          )}
                        </div>
                        {!t.accepted && (
                          <span className="text-[10px] text-amber-700 font-medium">Pending acceptance</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 align-middle min-w-0">
                    <p className="font-semibold text-gray-900 text-xs truncate">{t.customer}</p>
                    <p className="text-[11px] text-gray-500 truncate">{t.facility}</p>
                  </td>
                  <td className="py-2.5 px-2 align-middle min-w-0">
                    <p className="font-semibold text-gray-900 text-xs line-clamp-2 leading-snug">{t.title}</p>
                  </td>
                  <td className="py-2.5 px-2 align-middle text-gray-600 text-xs truncate">{t.category}</td>
                  <td className="py-2.5 px-2 align-middle">
                    <span className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium ${priorityColors[t.priority]}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 align-middle">
                    <span className={`inline-flex max-w-full whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[t.status]}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 align-middle">
                    <span className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium ${slaStatusColors[t.slaStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                      {t.slaStatus}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 align-middle text-gray-600 text-xs whitespace-nowrap">{t.lastUpdate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          Showing {filtered.length} of {activeCount} tickets
        </p>
          </>
        )}
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
