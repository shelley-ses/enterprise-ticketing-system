import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Notifications from '@/components/Notifications';
import QuickActions from '@/components/QuickActions';
import TicketModal from '@/components/TicketModal';
import CustomerTicketDetailModal from '@/components/CustomerTicketDetailModal';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import {
  createTicket,
  discardCustomerTicket,
  getCachedTicketFormOptions,
  getCustomerDashboard,
  getTicketFormOptions,
  prefetchTicketFormOptions,
  saveCustomerTicketDetail,
  getNotifications,
  getTicketDetails,
  updateTicket,
} from '@/services/ticketService';
import { useAuth } from '@/context/AuthContext';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function CustomerDashboard() {
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(null);
  const [createdTicket, setCreatedTicket] = useState(null);
  const [dbNotifications, setDbNotifications] = useState([]);
  const [summary, setSummary] = useState({
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  });
  const [recentTickets, setRecentTickets] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading...');
  const { user } = useAuth();
  const effectiveUser = user || getStoredUser();
  const customerName = effectiveUser?.name || 'Customer';
  const customerId = effectiveUser?.id || 1;

  const statusColorByName = {
    Open: 'bg-amber-100 text-amber-700',
    'In Progress': 'bg-blue-100 text-blue-700',
    'Pending Assignment': 'bg-amber-100 text-amber-700',
    Resolved: 'bg-green-100 text-green-700',
    Closed: 'bg-gray-100 text-gray-700',
    Reopened: 'bg-red-100 text-red-700',
  };

  const buildDashboardSignature = useCallback((payload) => {
    const summary = payload?.summary || {};
    const recentTickets = payload?.recent_tickets || [];
    return [
      summary.open ?? 0,
      summary.in_progress ?? 0,
      summary.resolved ?? 0,
      summary.closed ?? 0,
      ...recentTickets.map((ticket) => [ticket.id, ticket.status, ticket.title].join(':')),
    ].join('|');
  }, []);

  const loadDashboardData = useCallback(async ({ forceRefresh = false, source = 'manual', payload } = {}) => {
    if (source !== 'websocket' && source !== 'poll') {
      setDashboardLoading(true);
    }
    setDashboardError('');
    setShowRefreshBanner(false);

    try {
      const data = await getCustomerDashboard({ createdBy: customerId, forceRefresh });
      const stats = data?.summary || { open: 0, in_progress: 0, resolved: 0, closed: 0 };
      setSummary({
        open: stats.open ?? 0,
        in_progress: stats.in_progress ?? 0,
        resolved: stats.resolved ?? 0,
        closed: stats.closed ?? 0,
      });

      const ticketsList = (data?.recent_tickets || []).map(t => ({
        ...t,
        statusColor: statusColorByName[t.status] || 'bg-gray-100 text-gray-700'
      }));
      setRecentTickets(ticketsList);

      try {
        const notifData = await getNotifications();
        setDbNotifications(notifData.notifications || []);
      } catch (err) {
        console.warn('Failed to load notifications for customer dashboard:', err);
      }
    } catch (error) {
      setDashboardError('Failed to load dashboard data.');
    } finally {
      setDashboardLoading(false);
    }
  }, [customerId]);

  const probeForUpdates = useCallback(async (context = {}) => {
    // Only show banner on real websocket events, not empty polls
  }, []);

  useEffect(() => {
    prefetchTicketFormOptions().catch(() => {
      // Modal handles display error if options cannot be fetched.
    });

    loadDashboardData({ forceRefresh: false }).catch(() => {
      // State handled in loadDashboardData.
    });
  }, [loadDashboardData]);

  useRealtimeRefresh({
    refresh: loadDashboardData,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 0,
    deferRefresh: false,
  });

  const dateStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());

  const summaryData = [
    { title: 'Open Tickets', count: summary.open, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
    { title: 'In Progress', count: summary.in_progress, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
    { title: 'Resolved', count: summary.resolved, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' },
    { title: 'Closed', count: summary.closed, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
  ];

  // Removed shadowed notifications array mapping to avoid ReferenceError, and we pass slice directly to Notifications component.

  const handleConfirmDiscard = async () => {
    if (!confirmDiscard) return;

    const isMock = !!confirmDiscard.isMock;
    if (isMock) {
      const stored = JSON.parse(localStorage.getItem('customer_created_tickets') || '[]');
      const updatedList = stored.map(t => {
        if (t.id === confirmDiscard.id) {
          return { ...t, status: 'Discarded' };
        }
        return t;
      });
      localStorage.setItem('customer_created_tickets', JSON.stringify(updatedList));
      setConfirmDiscard(null);
      setSelectedTicket(null);
      window.alert('Ticket discarded successfully.');
      loadDashboardData();
      return;
    }

    try {
      const ticketId = confirmDiscard.ticket_ID || parseInt(String(confirmDiscard.id || '').replace(/\D/g, ''), 10);
      await discardCustomerTicket(ticketId);
      setConfirmDiscard(null);
      setSelectedTicket(null);
      window.alert('Ticket discarded successfully.');
      loadDashboardData();
    } catch (err) {
      console.error('Failed to discard ticket:', err);
      window.alert(err?.response?.data?.message || 'Failed to discard ticket.');
    }
  };

  const handleViewTicket = async (t) => {
    const isMock = !!t.isMock;
    if (isMock) {
      setSelectedTicket({
        ...t,
        description: t.description || '',
        resolved_at: t.resolved_at || null,
        proofAttachments: t.proofAttachments || [],
        proofFiles: t.proofFiles || [],
        can_discard: t.status === 'Open' && !t.assigned_to,
      });
      return;
    }

    setLoadingText('Loading ticket details...');
    setModalLoading(true);
    try {
      const ticketId = t.ticket_ID || parseInt(String(t.id || '').replace(/\D/g, ''), 10);
      const fullTicket = await getTicketDetails(ticketId);
      setSelectedTicket({
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
      setSelectedTicket(t);
    } finally {
      setModalLoading(false);
    }
  };

  const handleResolveTicket = async (ticketId) => {
    const isMock = selectedTicket ? !!selectedTicket.isMock : false;
    if (isMock) {
      const stored = JSON.parse(localStorage.getItem('customer_created_tickets') || '[]');
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
      localStorage.setItem('customer_created_tickets', JSON.stringify(updatedList));
      setSelectedTicket(null);
      window.alert('Ticket resolved successfully.');
      loadDashboardData();
      return;
    }

    setLoadingText('Resolving ticket...');
    setModalLoading(true);
    try {
      const numericId = Number(String(ticketId).replace(/\D/g, ''));
      await updateTicket({
        ticketId: numericId,
        statusId: 3, // Resolved
      });
      setSelectedTicket(null);
      window.alert('Ticket resolved successfully.');
      loadDashboardData({ forceRefresh: true });
    } catch (err) {
      console.error('Failed to resolve ticket:', err);
      window.alert(err?.response?.data?.message || 'Failed to resolve ticket.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleReopenTicket = async (ticketId, reason) => {
    const isMock = selectedTicket ? !!selectedTicket.isMock : false;
    if (isMock) {
      const stored = JSON.parse(localStorage.getItem('customer_created_tickets') || '[]');
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
      localStorage.setItem('customer_created_tickets', JSON.stringify(updatedList));
      setSelectedTicket(null);
      window.alert('Ticket reopened successfully.');
      loadDashboardData();
      return;
    }

    setLoadingText('Reopening ticket...');
    setModalLoading(true);
    try {
      const numericId = Number(String(ticketId).replace(/\D/g, ''));
      await updateTicket({
        ticketId: numericId,
        statusId: 8, // Reopened
      });
      setSelectedTicket(null);
      window.alert('Ticket reopened successfully.');
      loadDashboardData();
    } catch (err) {
      console.error('Failed to reopen ticket:', err);
      window.alert(err?.response?.data?.message || 'Failed to reopen ticket.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCreateTicket = async (payload) => {
    setLoadingText('Creating ticket...');
    setModalLoading(true);
    try {
      await createTicket({
        ...payload,
        created_by: customerId,
      });
      
      setIsTicketModalOpen(false);
      window.alert('Ticket created successfully.');
      // Small delay to allow backend Redis cache to be cleared before refetching
      setTimeout(() => {
        loadDashboardData({ forceRefresh: true });
      }, 300);
    } catch (err) {
      console.error(err);
      window.alert(err?.response?.data?.message || 'Failed to create ticket.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8">
      
      {/* Left Column */}
      <div className="flex-1 flex flex-col gap-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-gray-500 text-sm font-medium">{dateStr}</p>
            <h1 className="text-3xl font-bold text-[#252578] mt-1">Welcome back, {customerName}!</h1>
            <p className="text-gray-500 mt-2 text-sm">Here's a summary of your equipment support tickets.</p>
          </div>

          {/* AI Support Glassmorphism Card */}
          <button className="flex items-center gap-3 px-6 py-3 bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] rounded-2xl hover:bg-white/60 transition-all duration-300 group">
            <svg className="w-6 h-6 text-[#252578] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <div className="text-left">
              <div className="text-sm font-bold text-[#252578]">AI Support</div>
              <div className="text-xs text-gray-500">Quick FAQ lookup</div>
            </div>
            <svg className="w-5 h-5 text-[#252578] ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>

        {/* Summary Cards */}
        {dashboardError && <p className="text-sm text-red-500">{dashboardError}</p>}
        {showRefreshBanner && (
          <div 
            onClick={() => loadDashboardData({ forceRefresh: true })}
            className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm cursor-pointer hover:bg-blue-100/50 transition-colors"
          >
            <div>
              <div className="font-semibold">New dashboard data available</div>
              <div className="text-xs text-blue-700">Load the latest ticket summary when you are ready.</div>
            </div>
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 pointer-events-none"
            >
              Load latest
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summaryData.map((card, idx) => (
            <div key={idx} className={`p-6 rounded-3xl bg-white border ${card.border} shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group`}>
               <div className={`absolute top-4 right-4 w-8 h-8 rounded-full ${card.bg} flex items-center justify-center`}>
                  <div className={`w-3 h-3 rounded-sm border-2 ${card.color}`}></div>
               </div>
               <div className={`text-4xl font-bold ${card.color}`}>{dashboardLoading ? '-' : card.count}</div>
               <div className={`text-sm font-medium mt-2 ${card.color} opacity-80`}>{card.title}</div>
            </div>
          ))}
        </div>

        {/* Recent Tickets Table */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/50 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Recent Tickets</h2>
              <p className="text-sm text-gray-500">Latest submitted support tickets</p>
            </div>
            <button className="text-sm font-semibold text-[#252578] flex items-center gap-1 hover:underline">
              View All <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-3">
              <thead>
                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                  <th className="px-4 pb-2">Ticket ID</th>
                  <th className="px-4 pb-2">Title</th>
                  <th className="px-4 pb-2">Status</th>
                  <th className="px-4 pb-2 text-center">View</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-4 py-6 text-center text-sm text-gray-500">
                      {dashboardLoading ? 'Loading recent tickets...' : 'No tickets yet.'}
                    </td>
                  </tr>
                )}
                {recentTickets.map((t, idx) => (
                  <tr key={idx} className="bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl group">
                    <td className="px-4 py-4 rounded-l-2xl text-sm font-medium text-gray-800 border-y border-l border-gray-100">{t.id}</td>
                    <td className="px-4 py-4 border-y border-gray-100">
                      <div className="text-sm font-semibold text-gray-800">{t.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{t.equipment}</div>
                    </td>
                    <td className="px-4 py-4 border-y border-gray-100">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full flex w-fit items-center gap-1.5 ${t.statusColor}`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 rounded-r-2xl border-y border-r border-gray-100 text-center">
                      <button
                        onClick={() => handleViewTicket(t)}
                        aria-label={`View ${t.id}`}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Right Column - Notifications & Quick Actions */}
      <div className="w-full xl:w-96 flex flex-col gap-6">
        <Notifications notifications={dbNotifications.slice(0, 3)} />
        <QuickActions onOpenTicketModal={() => setIsTicketModalOpen(true)} />
      </div>

      {/* Ticket Modal */}
      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        onSubmit={handleCreateTicket}
      />

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <CustomerTicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onDiscard={(ticket) => setConfirmDiscard(ticket)}
          onReopen={(ticketId, reason) => handleReopenTicket(ticketId, reason)}
          onResolve={(ticketId) => handleResolveTicket(ticketId)}
        />
      )}

      {/* Confirm Discard Modal */}
      {confirmDiscard && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900">Discard this ticket?</h2>
            <p className="mt-2 text-sm text-gray-600">This will mark {confirmDiscard.id} as Discarded by Customer in your current browser.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmDiscard(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={handleConfirmDiscard} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Discard</button>
            </div>
          </div>
        </div>
      )}

      {modalLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full mx-4 border border-gray-100">
            <div className="w-10 h-10 border-4 border-[#252578]/10 border-t-[#252578] rounded-full animate-spin" />
            <p className="text-sm font-semibold text-[#252578] text-center font-sans">
              {loadingText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}