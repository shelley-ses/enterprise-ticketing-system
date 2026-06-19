import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Inbox, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { getCSDashboard } from '@/services/ticketService';
import { statusColors, priorityColors } from '@/constants/employeeTickets';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useAuth } from '@/context/AuthContext';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';

const MOCK_STATS = {
  unassigned: 7,
  pending: 3,
  assigned: 9,
  highPriority: 11,
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
  const newTicketTimerRef = useRef(null);

  const dateStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());

  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : (user?.name || 'Customer Service');

  const loadDashboard = useCallback(async ({ forceRefresh = false } = {}) => {
    setLoading(true);
    setError(null);

    try {
      const payload = await getCSDashboard({ limit: 10, forceRefresh: forceRefresh || refreshKey > 0 });
      setStats({
        unassigned: payload.summary?.open ?? MOCK_STATS.unassigned,
        pending: payload.summary?.in_progress ?? MOCK_STATS.pending,
        assigned: payload.summary?.resolved ?? MOCK_STATS.assigned,
        highPriority: 0,
      });
      setTickets((payload.recent_tickets || MOCK_TICKETS).map((t) => ({
        ...t,
        updated: t.updated_at ? new Date(t.updated_at).toLocaleString() : t.updated || 'Just now',
        priority: t.priority || 'Unassigned',
      })));
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
            updated: ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : 'Just now',
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
                updated: ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : t.updated,
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
                updated: ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : t.updated,
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

  useEffect(() => {
    loadDashboard({ forceRefresh: false });
  }, [loadDashboard]);

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
            onClick={() => navigate('/cs/incoming')}
            className="px-5 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white text-sm font-semibold transition-all"
          >
            View Incoming
          </button>
          <button
            type="button"
            onClick={() => navigate('/cs/assigned')}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-sm font-medium transition-all"
          >
            View Assigned
          </button>
        </div>
      </div>


      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => (
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {statItems.map((s) => (
              <div key={s.label} className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4">
                <div className="w-14 h-14 bg-[#f1f5f9] rounded-lg flex items-center justify-center text-[#252578]">
                  {s.icon}
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-800">{s.value}</div>
                  <div className="text-sm text-gray-500">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Ticket Activities</h2>
              <div className="text-sm text-gray-500">Showing {tickets.length} rows</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="py-3 px-4">Ticket ID</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {tickets.map((r, idx) => {
                    const isNew = r.id === newTicketId || r.ticket_ID === newTicketId;
                    return (
                      <tr
                        key={r.id + '-' + idx}
                        className={`${
                          isNew ? 'animate-new-pulse' : (idx === 0 ? 'bg-blue-50' : '')
                        } border-b transition-all`}
                      >
                        <td className="py-3 px-4 font-medium text-sm">
                          <div className="flex items-center gap-1.5">
                            <span>{r.id}</span>
                            {isNew && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-[10px] font-semibold animate-bounce shrink-0">
                                New
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{r.customer}</td>
                        <td className="py-3 px-4 text-gray-700">{r.title}</td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[r.status] ?? 'bg-gray-100 text-gray-700'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityColors[r.priority] ?? 'bg-gray-100 text-gray-700'}`}>
                            {r.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500">{r.updated}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
