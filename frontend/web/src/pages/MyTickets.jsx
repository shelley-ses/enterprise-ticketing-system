import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import TicketModal from '@/components/TicketModal';
import CustomerTicketDetailModal from '@/components/CustomerTicketDetailModal';
import { useAuth } from '@/context/AuthContext';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import {
  createTicket,
  discardCustomerTicket,
  getCachedTicketFormOptions,
  getCustomerTickets,
  getTicketFormOptions,
  saveCustomerTicketDetail,
  getTicketDetails,
  updateTicket,
} from '@/services/ticketService';

const STATUSES = ['Open', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Discarded'];
const HISTORY_STATUSES = ['Resolved', 'Closed', 'Discarded by Customer', 'Discarded'];

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const formatDate = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(value));
};

const statusClass = (status) => {
  if (status === 'Open') return 'bg-amber-100 text-amber-700';
  if (status === 'In Progress') return 'bg-blue-100 text-blue-700';
  if (status === 'Pending') return 'bg-purple-100 text-purple-700';
  if (status === 'Resolved') return 'bg-green-100 text-green-700';
  if (status === 'Closed') return 'bg-gray-100 text-gray-700';
  if (status === 'Reopened') return 'bg-red-100 text-red-700';
  if (status.includes('Discarded')) return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
};

export default function MyTickets({ mode = 'all' }) {
  const isHistory = mode === 'history';
  const { user } = useAuth();
  const effectiveUser = user || getStoredUser();
  const customerId = effectiveUser?.id || 1;
  const location = useLocation();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(location.state?.openCreateModal || false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(null);
  const [confirmCreated, setConfirmCreated] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading...');
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const loadTickets = useCallback(async ({ forceRefresh = false } = {}) => {
    setLoading(true);
    setError('');
    setShowRefreshBanner(false);

    try {
      const ticketsList = await getCustomerTickets({ createdBy: customerId, limit: 100, forceRefresh });
      setTickets(ticketsList);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  const probeForUpdates = useCallback(async ({ source }) => {
    if (source === 'websocket') {
      setShowRefreshBanner(true);
    }
  }, []);

  useEffect(() => {
    loadTickets({ forceRefresh: false });
  }, [loadTickets]);

  useEffect(() => {
    if (location.state?.openCreateModal) {
      setIsModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useRealtimeRefresh({
    refresh: loadTickets,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 30000,
    deferRefresh: true,
    onRefreshAvailable: ({ source }) => {
      if (source === 'websocket') {
        setShowRefreshBanner(true);
      }
    },
  });

  const categories = useMemo(() => {
    const unique = new Set(tickets.map((ticket) => ticket.category).filter(Boolean));
    return Array.from(unique).sort();
  }, [tickets]);

  const visibleTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const normalizedStatus = ticket.status === 'Discarded by Customer' ? 'Discarded' : ticket.status;
      if (isHistory && !HISTORY_STATUSES.includes(ticket.status)) return false;
      if (filters.status && normalizedStatus !== filters.status) return false;
      if (filters.category && ticket.category !== filters.category) return false;
      if (filters.dateFrom && new Date(ticket.date_created) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(ticket.date_created) > new Date(`${filters.dateTo}T23:59:59`)) return false;

      const search = filters.search.trim().toLowerCase();
      if (!search) return true;
      return ticket.id.toLowerCase().includes(search) || ticket.title.toLowerCase().includes(search);
    });
  }, [filters, isHistory, tickets]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleCreateTicket = async (payload) => {
    setLoadingText('Submitting ticket...');
    setModalLoading(true);
    try {
      const response = await createTicket({
        ...payload,
        created_by: customerId,
      });
      
      const created = response.ticket 
        ? { id: 'TKT-' + String(response.ticket.ticket_ID).padStart(3, '0') }
        : { id: 'TKT-' + String(response.ticket_ID || 'new').padStart(3, '0') };
        
      setConfirmCreated(created);
      setIsModalOpen(false);
      loadTickets({ forceRefresh: true });
    } catch (err) {
      console.error(err);
      window.alert(err?.response?.data?.message || 'Failed to create ticket.');
    } finally {
      setModalLoading(false);
    }
  };

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
      setTickets(updatedList);
      setConfirmDiscard(null);
      setSelectedTicket(null);
      window.alert('Ticket discarded successfully.');
      return;
    }

    try {
      const ticketId = confirmDiscard.ticket_ID || parseInt(String(confirmDiscard.id || '').replace(/\D/g, ''), 10);
      await discardCustomerTicket(ticketId);
      setConfirmDiscard(null);
      setSelectedTicket(null);
      window.alert('Ticket discarded successfully.');
      loadTickets({ forceRefresh: true });
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
      setTickets(updatedList);
      setSelectedTicket(null);
      window.alert('Ticket resolved successfully.');
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
      loadTickets({ forceRefresh: true });
    } catch (err) {
      console.error('Failed to resolve ticket:', err);
      window.alert(err?.response?.data?.message || 'Failed to resolve ticket.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseTicket = async (ticketId) => {
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
            status: 'Closed',
            resolved_at: timestamp,
            last_updated: timestamp,
            timeline: [
              ...timeline,
              {
                id: `status-closed-${Date.now()}`,
                type: 'status',
                text: 'Ticket closed by creator.',
                timestamp,
              }
            ]
          };
        }
        return t;
      });
      localStorage.setItem('customer_created_tickets', JSON.stringify(updatedList));
      setTickets(updatedList);
      setSelectedTicket(null);
      window.alert('Ticket closed successfully.');
      return;
    }

    setLoadingText('Closing ticket...');
    setModalLoading(true);
    try {
      const numericId = Number(String(ticketId).replace(/\D/g, ''));
      await updateTicket({
        ticketId: numericId,
        statusId: 4, // Closed
      });
      setSelectedTicket(null);
      window.alert('Ticket closed successfully.');
      loadTickets({ forceRefresh: true });
    } catch (err) {
      console.error('Failed to close ticket:', err);
      window.alert(err?.response?.data?.message || 'Failed to close ticket.');
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
      setTickets(updatedList);
      setSelectedTicket(null);
      window.alert('Ticket reopened successfully.');
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
      loadTickets({ forceRefresh: true });
    } catch (err) {
      console.error('Failed to reopen ticket:', err);
      window.alert(err?.response?.data?.message || 'Failed to reopen ticket.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#252578]">{isHistory ? 'Ticket History' : 'My Tickets'}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isHistory ? 'Review completed and discarded tickets.' : 'Track and manage your submitted support tickets.'}
          </p>
        </div>
        {!isHistory && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-[#252578] to-[#3b82f6] px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Create Ticket
          </button>
        )}
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-5">
        <input
          type="text"
          placeholder="Search ID or title"
          value={filters.search}
          onChange={(event) => updateFilter('search', event.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
        />
        <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
          <option value="">All statuses</option>
          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
          <option value="">All categories</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#252578]" />
        <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#252578]" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {showRefreshBanner && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">New ticket updates available</div>
              <div className="text-xs text-blue-700">Load the latest ticket list when you are ready.</div>
            </div>
            <button
              type="button"
              onClick={() => loadTickets({ forceRefresh: true })}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Load latest
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: '900px' }}>
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-4">ID</th>
                <th className="px-5 py-4">Title</th>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Date Created</th>
                <th className="px-5 py-4">Last Updated</th>
                <th className="px-5 py-4 text-center">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleTickets.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-5 py-8 text-center text-sm text-gray-500">
                    {loading ? 'Loading tickets...' : 'No tickets match the current filters.'}
                  </td>
                </tr>
              )}
              {visibleTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 text-sm font-semibold text-[#252578]">{ticket.id}</td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-800">{ticket.title}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{ticket.category}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${statusClass(ticket.status)}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{formatDate(ticket.date_created)}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{formatDate(ticket.last_updated)}</td>
                  <td className="px-5 py-4 text-center">
                    <button onClick={() => handleViewTicket(ticket)} className="rounded-full p-2 text-blue-600 hover:bg-blue-50" aria-label={`View ${ticket.id}`}>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TicketModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreateTicket} />
      <CustomerTicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onDiscard={(ticket) => setConfirmDiscard(ticket)} onReopen={(ticketId, reason) => handleReopenTicket(ticketId, reason)} onResolve={(ticketId) => handleCloseTicket(ticketId)} />

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

      {confirmCreated && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-bold text-gray-900">Ticket submitted</h2>
            <p className="mt-2 text-sm text-gray-600">{confirmCreated.id} has been created successfully.</p>
            <button onClick={() => setConfirmCreated(null)} className="mt-6 rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1f1f66]">Done</button>
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
