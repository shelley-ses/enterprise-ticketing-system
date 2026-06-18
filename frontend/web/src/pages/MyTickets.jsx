import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';
import TicketModal from '@/components/TicketModal';
import CustomerTicketDetailModal from '@/components/CustomerTicketDetailModal';
import NotificationModal from '@/components/NotificationModal';
import SkeletonLoader from '@/components/SkeletonLoader';
import { statusColors } from '@/constants/employeeTickets';
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

const STATUSES = ['Open', 'Pending Assignment', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Discarded'];
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

const statusClass = (s) => statusColors[s] ?? (s?.includes('Discarded') ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700');

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
  const [notification, setNotification] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading...');
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
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
    if (!openMenuId) return;
    const handler = (e) => {
      if (!e.target.closest('[data-menu-id]') && !e.target.closest('.menu-trigger')) {
        setOpenMenuId(null);
        setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  useEffect(() => {
    if (location.state?.openCreateModal) {
      setIsModalOpen(true);
      window.history.replaceState({}, document.title);
    }
    const focusId = location.state?.focusTicketId;
    if (focusId && tickets.length > 0) {
      const match = tickets.find(t => t.id === focusId || t.ticket_ID === focusId);
      if (match) {
        handleViewTicket(match);
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, tickets]);

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
      if (!isHistory && ['Closed', 'Resolved'].includes(ticket.status)) return false;
      if (filters.status && normalizedStatus !== filters.status) return false;
      if (filters.category && ticket.category !== filters.category) return false;
      if (filters.dateFrom && new Date(ticket.date_created) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(ticket.date_created) > new Date(`${filters.dateTo}T23:59:59`)) return false;

      const search = filters.search.trim().toLowerCase();
      if (!search) return true;
      return ticket.id.toLowerCase().includes(search) || ticket.title.toLowerCase().includes(search);
    });
  }, [filters, isHistory, tickets]);

  const closeNotif = () => setNotification(null);
  const showSuccess = (title, message) => setNotification({ type: 'success', title, message });
  const showError = (title, message) => setNotification({ type: 'error', title, message });
  const showConfirm = (title, message, onConfirm, opts = {}) => setNotification({ type: 'confirm', title, message, onConfirm, onCancel: closeNotif, ...opts });

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
      
      const createdId = response.ticket 
        ? 'TKT-' + String(response.ticket.ticket_ID).padStart(3, '0')
        : 'TKT-' + String(response.ticket_ID || 'new').padStart(3, '0');
        
      setIsModalOpen(false);
      loadTickets({ forceRefresh: true });
      showSuccess('Ticket submitted', `${createdId} has been created successfully.`);
    } catch (err) {
      console.error(err);
      showError('Error', err?.response?.data?.message || 'Failed to create ticket.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmDiscard = async (ticket) => {
    closeNotif();
    if (!ticket) return;

    const isMock = !!ticket.isMock;
    if (isMock) {
      const stored = JSON.parse(localStorage.getItem('customer_created_tickets') || '[]');
      const updatedList = stored.map(t => {
        if (t.id === ticket.id) {
          return { ...t, status: 'Discarded' };
        }
        return t;
      });
      localStorage.setItem('customer_created_tickets', JSON.stringify(updatedList));
      setTickets(updatedList);
      setSelectedTicket(null);
      showSuccess('Ticket discarded', 'Ticket discarded successfully.');
      return;
    }

    try {
      const ticketId = ticket.ticket_ID || parseInt(String(ticket.id || '').replace(/\D/g, ''), 10);
      await discardCustomerTicket(ticketId);
      setSelectedTicket(null);
      showSuccess('Ticket discarded', 'Ticket discarded successfully.');
      loadTickets({ forceRefresh: true });
    } catch (err) {
      console.error('Failed to discard ticket:', err);
      showError('Error', err?.response?.data?.message || 'Failed to discard ticket.');
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
      showSuccess('Ticket resolved', 'Ticket resolved successfully.');
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
      showSuccess('Ticket resolved', 'Ticket resolved successfully.');
      loadTickets({ forceRefresh: true });
    } catch (err) {
      console.error('Failed to resolve ticket:', err);
      showError('Error', err?.response?.data?.message || 'Failed to resolve ticket.');
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
      showSuccess('Ticket closed', 'Ticket closed successfully.');
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
      showSuccess('Ticket closed', 'Ticket closed successfully.');
      loadTickets({ forceRefresh: true });
    } catch (err) {
      console.error('Failed to close ticket:', err);
      showError('Error', err?.response?.data?.message || 'Failed to close ticket.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditTicket = (ticket) => {
    setEditTitle(ticket.title || '');
    setEditDescription(ticket.description || '');
    setEditingTicket(ticket);
    setOpenMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingTicket) return;
    const ticket = editingTicket;
    const isMock = !!ticket.isMock;

    if (isMock) {
      const stored = JSON.parse(localStorage.getItem('customer_created_tickets') || '[]');
      const updatedList = stored.map(t => {
        if (t.id === ticket.id) {
          return { ...t, title: editTitle, description: editDescription };
        }
        return t;
      });
      localStorage.setItem('customer_created_tickets', JSON.stringify(updatedList));
      setTickets(updatedList);
      setEditingTicket(null);
      showSuccess('Ticket updated', 'Ticket updated successfully.');
      return;
    }

    setLoadingText('Updating ticket...');
    setModalLoading(true);
    try {
      const numericId = ticket.ticket_ID || parseInt(String(ticket.id || '').replace(/\D/g, ''), 10);
      await updateTicket({
        ticketId: numericId,
        title: editTitle,
        description: editDescription,
      });
      setEditingTicket(null);
      showSuccess('Ticket updated', 'Ticket updated successfully.');
      loadTickets({ forceRefresh: true });
    } catch (err) {
      console.error('Failed to update ticket:', err);
      showError('Error', err?.response?.data?.message || 'Failed to update ticket.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteTicket = (ticket) => {
    setOpenMenuId(null);
    showConfirm('Discard this ticket?', `This will mark ${ticket.id} as Discarded.`, () => handleConfirmDiscard(ticket), { confirmText: 'Discard', confirmClassName: 'bg-red-600 hover:bg-red-700' });
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
      showSuccess('Ticket reopened', 'Ticket reopened successfully.');
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
      showSuccess('Ticket reopened', 'Ticket reopened successfully.');
      loadTickets({ forceRefresh: true });
    } catch (err) {
      console.error('Failed to reopen ticket:', err);
      showError('Error', err?.response?.data?.message || 'Failed to reopen ticket.');
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

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-4">ID</th>
                <th className="px-5 py-4">Title</th>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Date Created</th>
                <th className="px-5 py-4">Last Updated</th>
                <th className="px-5 py-4 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleTickets.length === 0 && loading && (
                <tr>
                  <td colSpan="7">
                    <div className="rounded-xl bg-white p-8">
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
                  </td>
                </tr>
              )}
              {visibleTickets.length === 0 && !loading && (
                <tr>
                  <td colSpan="7" className="px-5 py-8 text-center text-sm text-gray-500">
                    No tickets match the current filters.
                  </td>
                </tr>
              )}
              {visibleTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleViewTicket(ticket)}>
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
                  <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        if (openMenuId === ticket.id) {
                          setOpenMenuId(null);
                          setMenuPos(null);
                          return;
                        }
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenuPos({ x: rect.right - 144, y: rect.bottom + 4 });
                        setOpenMenuId(ticket.id);
                      }}
                      className="rounded-full p-2 text-gray-500 hover:bg-gray-100 menu-trigger"
                      aria-label="Actions"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>

      {openMenuId && menuPos && createPortal(
        (() => {
          const t = visibleTickets.find(x => x.id === openMenuId);
          return t ? (
            <div data-menu-id={t.id}
              style={{ position: 'fixed', left: menuPos.x, top: menuPos.y, zIndex: 9999 }}
              className="w-36 rounded-xl border border-gray-200 bg-white shadow-lg">
              <button onClick={() => { handleEditTicket(t); setMenuPos(null); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-xl">
                Edit
              </button>
              <button onClick={() => { handleDeleteTicket(t); setMenuPos(null); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-b-xl">
                Delete
              </button>
            </div>
          ) : null;
        })(),
        document.body
      )}

      <TicketModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreateTicket} />
      <CustomerTicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onDiscard={(ticket) => showConfirm('Discard this ticket?', `This will mark ${ticket.id} as Discarded.`, () => handleConfirmDiscard(ticket), { confirmText: 'Discard', confirmClassName: 'bg-red-600 hover:bg-red-700' })} onReopen={(ticketId, reason) => handleReopenTicket(ticketId, reason)} onResolve={(ticketId) => handleCloseTicket(ticketId)} />

      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 shrink-0">
              <div>
                <p className="text-sm font-semibold text-[#252578]">{editingTicket.id}</p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">Edit Ticket</h2>
              </div>
              <button type="button" onClick={() => setEditingTicket(null)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">Category</p>
                  <p className="mt-1 text-sm text-gray-800">{editingTicket.category}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">Status</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800">{editingTicket.status}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">Equipment</p>
                  <p className="mt-1 text-sm text-gray-800">{editingTicket.equipment}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">Date Created</p>
                  <p className="mt-1 text-sm text-gray-800">{formatDate(editingTicket.date_created)}</p>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#252578]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows="4"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#252578]"
                />
              </div>
            </div>
            <div className="border-t border-gray-100 px-6 py-4 shrink-0 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded-xl bg-[#252578] px-8 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <NotificationModal
        isOpen={!!notification}
        type={notification?.type}
        title={notification?.title}
        message={notification?.message}
        onClose={closeNotif}
        onConfirm={notification?.onConfirm}
        onCancel={notification?.onCancel}
        confirmText={notification?.confirmText}
        confirmClassName={notification?.confirmClassName}
      />

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
