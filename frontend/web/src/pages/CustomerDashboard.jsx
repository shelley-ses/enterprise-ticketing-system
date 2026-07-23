import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Inbox, Clock, CheckCircle, Archive, Bot } from 'lucide-react';
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
  getTicketDetails,
  updateTicket,
} from '@/services/ticketService';
import { statusColors } from '@/constants/employeeTickets';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useAuth } from '@/context/AuthContext';
import { getExternalTicketsFromStorage, seedDemoExternalTicket } from '@/data/mockFeedbackData';

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

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(null);
  const [createdTicket, setCreatedTicket] = useState(null);
  const [summary, setSummary] = useState({
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  });
  const [recentTickets, setRecentTickets] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState(null);
  const [loadingText, setLoadingText] = useState('Loading...');
  const navigate = useNavigate();
  const { user } = useAuth();
  const effectiveUser = user || getStoredUser();
  const customerName = effectiveUser?.first_name
    ? `${effectiveUser.first_name}${effectiveUser.last_name ? ' ' + effectiveUser.last_name : ''}`
    : (effectiveUser?.name || 'Customer');
  const customerId = effectiveUser?.id || 1;


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

    try {
      const data = await getCustomerDashboard({ createdBy: customerId, forceRefresh });
      const stats = data?.summary || { open: 0, in_progress: 0, resolved: 0, closed: 0 };
      setSummary({
        open: stats.open ?? 0,
        in_progress: stats.in_progress ?? 0,
        resolved: stats.resolved ?? 0,
        closed: stats.closed ?? 0,
      });

      const apiTickets = (data?.recent_tickets || []).map(t => ({
        ...t,
        statusColor: statusColors[t.status] || 'bg-gray-100 text-gray-700'
      }));
      const externalTickets = getExternalTicketsFromStorage().map(t => ({
        ...t,
        statusColor: statusColors[t.status] || 'bg-gray-100 text-gray-700'
      }));
      setRecentTickets([...externalTickets, ...apiTickets]);

    } catch (error) {
      const external = getExternalTicketsFromStorage();
      if (external.length > 0) {
        setRecentTickets(external.map(t => ({
          ...t,
          statusColor: statusColors[t.status] || 'bg-gray-100 text-gray-700'
        })));
      } else {
        setDashboardError('Failed to load dashboard data.');
      }
    } finally {
      setDashboardLoading(false);
    }
  }, [customerId]);



  useEffect(() => {
    seedDemoExternalTicket();

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
    { title: 'Open Tickets', count: summary.open, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', icon: Inbox },
    { title: 'In Progress', count: summary.in_progress, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', icon: Clock },
    { title: 'Resolved', count: summary.resolved, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle },
    { title: 'Closed', count: summary.closed, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', icon: Archive },
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
      const response = await createTicket({
        ...payload,
        created_by: customerId,
      });
      
      const newTicketId = response.ticket?.ticket_ID || response.ticket_ID;
      setCreatedTicketId(newTicketId);
      setIsTicketModalOpen(false);
      setShowSuccess(true);
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

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    if (createdTicketId) {
      navigate('/messages', { state: { selectedTicketId: createdTicketId } });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Hero Section */}
        <div className="relative rounded-xl overflow-hidden bg-linear-to-br from-[#252578] via-[#3535a0] to-[#1a1a5c] px-8 py-7 flex flex-col md:flex-row md:items-center gap-4 shadow-md">
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #ffffff 0%, transparent 60%)' }}
          />
          <div className="relative z-10 flex-1">
            <p className="text-white/70 text-sm font-medium mb-1">{dateStr}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
              Welcome back, {customerName}!
            </h1>
            <p className="text-white/70 text-sm">Here's a summary of your equipment support tickets.</p>
          </div>
          <div className="relative z-10 flex flex-col gap-2 shrink-0">
            <Link
              to="/ai-support"
              className="px-5 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white text-sm font-semibold transition-all flex items-center gap-2"
            >
              <Bot size={20} />
              AI Support Assistant
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        {dashboardError && <p className="text-sm text-red-500">{dashboardError}</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summaryData.map((card, idx) => (
            <div key={idx} className={`p-6 rounded-xl bg-white border ${card.border} shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group`}>
               <div className={`absolute top-4 right-4 w-8 h-8 rounded-full ${card.bg} flex items-center justify-center ${card.color}`}>
                   <card.icon size={22} />
               </div>
               <div className={`text-4xl font-bold ${card.color}`}>{dashboardLoading ? '-' : card.count}</div>
               <div className={`text-sm font-medium mt-2 ${card.color} opacity-80`}>{card.title}</div>
            </div>
          ))}
        </div>

      <div className="flex flex-col xl:flex-row gap-8">
        {/* Recent Tickets Table */}
        <div className="flex-1 bg-white/60 backdrop-blur-md rounded-xl border border-white/50 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Recent Tickets</h2>
              <p className="text-sm text-gray-500">Latest submitted support tickets</p>
            </div>
            <Link to="/my-tickets" className="text-sm font-semibold text-[#252578] flex items-center gap-1 hover:underline">
              View All <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </Link>
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
                  dashboardLoading ? (
                    <tr>
                      <td colSpan="4" className="p-0">
                        <table className="w-full">
                          <tbody>
                            <SkeletonLoader variant="table-row" />
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-6 text-center text-sm text-gray-500">
                        No tickets yet.
                      </td>
                    </tr>
                  )
                )}
                {recentTickets.map((t, idx) => (
                  <tr key={idx} className="bg-white shadow-sm hover:shadow-md transition-shadow rounded-xl group">
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
          customerName={customerName}
        />
      )}

      {/* Confirm Discard Modal */}
      {confirmDiscard && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px] animate-in fade-in duration-200">
          <div className="bg-white rounded-xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full mx-4 border border-gray-100">
            <div className="w-10 h-10 border-4 border-[#252578]/10 border-t-[#252578] rounded-full animate-spin" />
            <p className="text-sm font-semibold text-[#252578] text-center font-sans">
              {loadingText}
            </p>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px]" onClick={handleCloseSuccess}>
          <div className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full mx-4 border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Ticket Created</h3>
            <p className="text-sm text-gray-500 text-center">Your ticket has been submitted successfully.</p>
            <button
              onClick={handleCloseSuccess}
              className="mt-2 px-6 py-2.5 bg-[#252578] text-white rounded-xl text-sm font-semibold hover:bg-[#1a1a5c] transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}