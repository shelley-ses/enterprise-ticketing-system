import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Inbox, Clock, CheckCircle, AlertTriangle, Bot } from 'lucide-react';
import { getCSDashboard, getTicketDetails, getInternalTickets } from '@/services/ticketService';
import { statusColors, priorityColors } from '@/constants/employeeTickets';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useAuth } from '@/context/AuthContext';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import { formatDisplayDate } from '@/utils/dateUtils';
import CustomerTicketDetailModal from '@/components/CustomerTicketDetailModal';

function ArrowRight() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

const MOCK_STATS = {
  unassigned: 7,
  pending: 3,
  assigned: 9,
  highPriority: 11,
  slaBreached: 2,
  escalated: 4,
};

const MOCK_TICKETS = [
  { id: 'TKT-1006', customer: 'QC General Hospital', title: 'X-Ray Machine Failure', status: 'New', priority: 'Low', updated: '1 hr ago' },
  { id: 'TKT-1016', customer: 'St Lukes Taguig', title: 'Ultrasound Equipment Malfunction', status: 'New', priority: 'High', updated: '3 hrs ago' },
  { id: 'TKT-1007', customer: 'Philippine General Hospital', title: 'CT Scan Machine Error', status: 'Ongoing', priority: 'Medium', updated: '5 hrs ago' },
  { id: 'TKT-1017', customer: 'The Medical City', title: 'X-Ray Calibration Issue', status: 'New', priority: 'High', updated: '2 hrs ago' },
];

export default function CSDashboard() {
  const { refreshKey = 0 } = useOutletContext() || {};
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newTicketId, setNewTicketId] = useState(null);
  const [summaryTicket, setSummaryTicket] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [myRecentTickets, setMyRecentTickets] = useState([]);
  const [loadingMyTickets, setLoadingMyTickets] = useState(true);
  const [selectedMyTicket, setSelectedMyTicket] = useState(null);
  const [myTicketsModalLoading, setMyTicketsModalLoading] = useState(false);
  const newTicketTimerRef = useRef(null);

  const statusClass = (s) => statusColors[s] ?? (s?.includes('Discarded') ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700');

  const dateStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());

  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : (user?.name || 'Customer Service');

  const loadDashboard = useCallback(async ({ forceRefresh = false } = {}) => {
    setLoading(true);
    setError(null);

    try {
      const payload = await getCSDashboard({ limit: 10, forceRefresh: forceRefresh || refreshKey > 0 });
      const recentTickets = (payload.recent_tickets || MOCK_TICKETS).map((t) => ({
        ...t,
        updated: t.updated_at ? formatDisplayDate(t.updated_at) : t.updated || 'Just now',
        priority: t.priority || 'Unassigned',
      }));
      const slaBreachedCount = recentTickets.filter((t) => t.status === 'Escalated').length;
      const escalatedCount = recentTickets.filter((t) => (t.priority === 'Critical' || t.priority === 'High') && t.status !== 'Resolved' && t.status !== 'Closed').length;
      setStats({
        unassigned: payload.summary?.open ?? MOCK_STATS.unassigned,
        pending: payload.summary?.in_progress ?? MOCK_STATS.pending,
        assigned: payload.summary?.resolved ?? MOCK_STATS.assigned,
        highPriority: 0,
        slaBreached: slaBreachedCount,
        escalated: escalatedCount,
      });
      setTickets(recentTickets);
    } catch (err) {
      setError('Unable to load data from API — using local mock data.');
      setStats(MOCK_STATS);
      setTickets(MOCK_TICKETS);
    } finally {
      setLoading(false);
    }
  }, [refreshKey]);

  const handleRealtimeUpdate = useCallback((context) => {
    if (context && context.source === 'websocket') {
      const payload = context.payload;
      if (!payload) return;

      const { action, ticket } = payload;
      if (!ticket) return;

      // Handle ticket created
      if (action === 'created') {
        // Prepend the new ticket to the tickets list (cap at 10 items)
        setTickets((prev) => {
          const exists = prev.some((t) => t.id === ticket.id || t.ticket_ID === ticket.ticket_ID);
          if (exists) return prev;
          
          const formatted = {
            ...ticket,
            updated: ticket.updated_at ? formatDisplayDate(ticket.updated_at) : 'Just now',
            priority: ticket.priority || 'Unassigned',
          };
          return [formatted, ...prev].slice(0, 10);
        });

        // Set highlight timer
        if (newTicketTimerRef.current) {
          clearTimeout(newTicketTimerRef.current);
        }
        setNewTicketId(ticket.id);
        newTicketTimerRef.current = setTimeout(() => {
          setNewTicketId(null);
        }, 5000);

        // Update stats: Increment unassigned (Open) and potentially highPriority
        setStats((prev) => {
          if (!prev) return prev;
          const isHighPriority = ticket.priority === 'High' || ticket.priority === 'Critical';
          return {
            ...prev,
            unassigned: prev.unassigned + 1,
            highPriority: isHighPriority ? prev.highPriority + 1 : prev.highPriority,
          };
        });
      } 
      // Handle ticket assigned
      else if (action === 'assigned' || action === 'accepted') {
        // Find ticket in recent activities
        setTickets((prev) => {
          return prev.map((t) => {
            if (t.id === ticket.id || t.ticket_ID === ticket.ticket_ID) {
              return {
                ...t,
                ...ticket,
                updated: ticket.updated_at ? formatDisplayDate(ticket.updated_at) : t.updated,
                priority: ticket.priority || 'Unassigned',
              };
            }
            return t;
          });
        });

        // Update stats: Decrement unassigned (Open), increment pending (In Progress)
        setStats((prev) => {
          if (!prev) return prev;
          
          const newUnassigned = Math.max(0, prev.unassigned - 1);
          const newPending = prev.pending + 1;
          
          return {
            ...prev,
            unassigned: newUnassigned,
            pending: newPending,
          };
        });
      }
      // Handle status updates (Resolved / Closed)
      else if (action === 'updated') {
        // Find ticket in recent activities and update in-place
        setTickets((prev) => {
          return prev.map((t) => {
            if (t.id === ticket.id || t.ticket_ID === ticket.ticket_ID) {
              return {
                ...t,
                ...ticket,
                updated: ticket.updated_at ? formatDisplayDate(ticket.updated_at) : t.updated,
                priority: ticket.priority || 'Unassigned',
              };
            }
            return t;
          });
        });

        // Update stats based on ticket status change
        setStats((prev) => {
          if (!prev) return prev;

          if (ticket.status === 'Resolved') {
            const isHighPriority = ticket.priority === 'High' || ticket.priority === 'Critical';
            return {
              ...prev,
              pending: Math.max(0, prev.pending - 1),
              assigned: prev.assigned + 1,
              highPriority: isHighPriority ? Math.max(0, prev.highPriority - 1) : prev.highPriority,
            };
          } else if (ticket.status === 'Closed') {
            const isHighPriority = ticket.priority === 'High' || ticket.priority === 'Critical';
            return {
              ...prev,
              pending: Math.max(0, prev.pending - 1),
              highPriority: isHighPriority ? Math.max(0, prev.highPriority - 1) : prev.highPriority,
            };
          }
          return prev;
        });
      }
    } else {
      loadDashboard({ forceRefresh: true });
    }
  }, [loadDashboard]);

  const handleViewTicket = useCallback(async (t) => {
    const isMock = !!t.isMock;
    if (isMock) {
      setSelectedTicket({ ...t, description: t.description || '', timeline: t.timeline || [{ id: 'creation', type: 'system', text: 'Ticket created.', timestamp: t.date_created || t.updated }], proofAttachments: t.proofAttachments || [] });
      return;
    }
    setModalLoading(true);
    try {
      const ticketId = t.ticket_ID || parseInt(String(t.id || '').replace(/\D/g, ''), 10);
      const full = await getTicketDetails(ticketId);
      setSelectedTicket({ ...t, ...full, description: full.description || t.description || '', timeline: full.timeline || t.timeline, proofAttachments: full.proofAttachments || [], proofFiles: full.proofFiles || [] });
    } catch {
      setSelectedTicket(t);
    } finally {
      setModalLoading(false);
    }
  }, []);

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
        localStorage.setItem('cs_created_tickets', JSON.stringify(mapped));
      } else {
        const stored = JSON.parse(localStorage.getItem('cs_created_tickets') || '[]');
        const mapped = stored.slice(0, 5);
        setMyRecentTickets(mapped);
      }
    } catch {
      const stored = JSON.parse(localStorage.getItem('cs_created_tickets') || '[]');
      setMyRecentTickets(stored.slice(0, 5));
    } finally {
      setLoadingMyTickets(false);
    }
  }, []);

  const handleViewMyTicket = useCallback(async (t) => {
    const isMock = !!t.isMock;
    if (isMock) {
      setSelectedMyTicket({ ...t, description: t.description || '', resolved_at: t.resolved_at || null, proofAttachments: t.proofAttachments || [], proofFiles: t.proofFiles || [], can_discard: t.status === 'Open' && !t.assigned_to });
      return;
    }
    setMyTicketsModalLoading(true);
    try {
      const ticketId = t.ticket_ID || parseInt(String(t.id || '').replace(/\D/g, ''), 10);
      const full = await getTicketDetails(ticketId);
      setSelectedMyTicket({ ...t, ...full, description: full.description || t.description || '', resolved_at: full.resolved_at || null, proofAttachments: full.proofAttachments || [], proofFiles: full.proofFiles || [], can_discard: (full.status || t.status) === 'Open' && !full.assigned_to });
    } catch {
      setSelectedMyTicket(t);
    } finally {
      setMyTicketsModalLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard({ forceRefresh: false });
    loadMyTickets();
  }, [loadDashboard, loadMyTickets]);

  useRealtimeRefresh({
    refresh: handleRealtimeUpdate,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 30000,
    deferRefresh: false,
  });

  const statItems = stats
    ? [
        { label: 'Unassigned Tickets', value: stats.unassigned, icon: <Inbox size={28} /> },
        { label: 'Pending Tickets', value: stats.pending, icon: <Clock size={28} /> },
        { label: 'Assigned Tickets', value: stats.assigned, icon: <CheckCircle size={28} /> },
        { label: 'High Priority', value: stats.highPriority, icon: <AlertTriangle size={28} /> },
        { label: 'SLA Breached', value: stats.slaBreached, icon: <AlertTriangle size={28} />, color: 'rose' },
        { label: 'Escalated Tickets', value: stats.escalated, icon: <AlertTriangle size={28} />, color: 'amber' },
      ]
    : [];

  return (
    <div className="p-6">
      {/* Hero Section */}
      <div className="relative rounded-xl overflow-hidden mb-8 bg-linear-to-br from-[#252578] via-[#3535a0] to-[#1a1a5c] px-8 py-7 flex flex-col md:flex-row md:items-center gap-4 shadow-md">
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #ffffff 0%, transparent 60%)' }}
        />
        <div className="relative z-10 flex-1">
          <p className="text-white/70 text-sm font-medium mb-1">{dateStr}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
            Welcome back, {displayName}!
            <span className="ml-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-400/20 border border-green-400/40 text-green-300 text-xs font-semibold align-middle">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Active
            </span>
          </h1>
          <p className="text-white/70 text-sm">Monitor incoming tickets, assignments, and service queue status.</p>
        </div>
        <div className="relative z-10 flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/ai-support')}
            className="px-5 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white text-sm font-semibold transition-all flex items-center gap-2"
          >
            <Bot size={20} />
            AI Support Assistant
          </button>
        </div>
      </div>


      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-xl shadow-md p-4">
                <div className="h-10 bg-gray-200 rounded-lg w-12 mb-3 animate-pulse" />
                <div className="h-6 bg-gray-200 rounded w-16 mb-2 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse" />
            <SkeletonLoader variant="ticket-card" />
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 p-3 text-sm bg-yellow-50 text-yellow-800 rounded">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {statItems.map((s) => (
              <div key={s.label} className={`bg-white rounded-xl shadow-md p-5 flex items-center gap-4 ${
                s.color === 'rose' ? 'border-l-4 border-l-rose-500' : s.color === 'amber' ? 'border-l-4 border-l-amber-500' : ''
              }`}>
                <div className={`w-14 h-14 rounded-lg flex items-center justify-center shrink-0 ${
                  s.color === 'rose' ? 'bg-rose-50 text-rose-500' : s.color === 'amber' ? 'bg-amber-50 text-amber-500' : 'bg-[#f1f5f9] text-[#252578]'
                }`}>
                  {s.icon}
                </div>
                <div>
                  <div className="text-4xl font-bold text-gray-800">{s.value}</div>
                  <div className="text-sm font-medium text-gray-500">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Recent Ticket Activities</h2>
              <div className="text-sm text-gray-500">Showing {tickets.length} rows</div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left" style={{ minWidth: '900px' }}>
                <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Ticket ID</th>
                    <th className="px-5 py-4">Title</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {tickets.map((r, idx) => {
                    const isNew = r.id === newTicketId || r.ticket_ID === newTicketId;
                    return (
                      <tr
                        key={r.id + '-' + idx}
                        onClick={() => handleViewTicket(r)}
                        className={`${isNew ? 'animate-new-pulse' : (idx === 0 ? 'bg-blue-50/50' : '')} border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all`}
                      >
                        <td className="px-5 py-4 font-semibold text-[#252578] text-sm align-middle">
                          <div className="flex items-center gap-1.5">
                            <span>{r.id}</span>
                            {isNew && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-[10px] font-semibold animate-bounce shrink-0">New</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-gray-800 align-middle min-w-0"><span className="line-clamp-2">{r.title}</span></td>
                        <td className="px-5 py-4 text-sm text-gray-600 align-middle min-w-0 truncate">{r.customer}</td>
                        <td className="px-5 py-4 align-middle">
                          <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[r.status] ?? 'bg-gray-100 text-gray-700'}`}>{r.status}</span>
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ${priorityColors[r.priority] ?? 'bg-gray-100 text-gray-700'}`}>{r.priority}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-800">My Recent Tickets</h2>
                <p className="text-sm text-gray-500">Latest submitted support tickets</p>
              </div>
              <button type="button" onClick={() => navigate('/cs/my-tickets')} className="text-sm font-semibold text-[#252578] flex items-center gap-1 hover:underline">
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
                      <td colSpan={4} className="py-8 px-4 text-center text-gray-500">{loadingMyTickets ? 'Loading recent tickets...' : 'No tickets yet.'}</td>
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
                          <button onClick={() => handleViewMyTicket(t)} aria-label={`View ${t.id}`} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors">
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
        </>
      )}

      {selectedTicket && (
        <CustomerTicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onDiscard={null}
          onReopen={null}
          onResolve={null}
          allowReopen={false}
          customerName={selectedTicket.customer}
        />
      )}

      {selectedMyTicket && (
        <CustomerTicketDetailModal
          ticket={selectedMyTicket}
          onClose={() => setSelectedMyTicket(null)}
          onDiscard={null}
          onReopen={null}
          onResolve={null}
          allowReopen={false}
          customerName={selectedMyTicket.customer}
        />
      )}

      {summaryTicket && !selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]" onClick={() => setSummaryTicket(null)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Ticket Summary</h2>
                <p className="text-sm font-semibold text-[#252578]">{summaryTicket.id}</p>
              </div>
              <button type="button" onClick={() => setSummaryTicket(null)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-400">Title</p>
                <p className="mt-1 text-sm font-medium text-gray-800">{summaryTicket.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">Customer</p>
                  <p className="mt-1 text-sm text-gray-800">{summaryTicket.customer}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">Priority</p>
                  <span className={`mt-1 inline-block px-3 py-1 rounded-full text-xs font-semibold ${priorityColors[summaryTicket.priority] ?? 'bg-gray-100 text-gray-700'}`}>
                    {summaryTicket.priority}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">Status</p>
                  <span className={`mt-1 inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColors[summaryTicket.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {summaryTicket.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">Last Updated</p>
                  <p className="mt-1 text-sm text-gray-800">{summaryTicket.updated}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {(modalLoading || myTicketsModalLoading) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px]">
          <div className="bg-white rounded-xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full mx-4 border border-gray-100">
            <div className="w-10 h-10 border-4 border-[#252578]/10 border-t-[#252578] rounded-full animate-spin" />
            <p className="text-sm font-semibold text-[#252578]">Loading ticket details...</p>
          </div>
        </div>
      )}
    </div>
  );
}
