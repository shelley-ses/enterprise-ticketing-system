import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { MoreVertical, Filter } from 'lucide-react';
import TicketModal from '@/components/TicketModal';
import CustomerTicketDetailModal from '@/components/CustomerTicketDetailModal';
import NotificationModal from '@/components/NotificationModal';
import SkeletonLoader from '@/components/SkeletonLoader';
import { statusColors } from '@/constants/employeeTickets';
import { useAuth } from '@/context/AuthContext';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import { normalizeCasing } from '@/utils/normalizeCasing';
import { formatDisplayDate } from '@/utils/dateUtils';
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
import { getExternalTicketsFromStorage, seedDemoExternalTicket } from '@/data/mockFeedbackData';

import { parseUTCDate } from '@/utils/dateUtils';
import TitleCasingModal from '@/components/TitleCasingModal';
import { formatProperTitleCase, needsProperCasing } from '@/utils/titleCaseUtils';

const ACTIVE_STATUSES = ['Open', 'Pending Assignment', 'In Progress', 'Pending', 'On Hold'];
const HISTORY_STATUSES = ['Resolved', 'Closed', 'Discarded by Customer', 'Discarded'];

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const formatDate = (value) => formatDisplayDate(value);

const statusClass = (s) => statusColors[s] ?? (s?.includes('Discarded') ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700');

export default function MyTickets({ mode = 'all' }) {
  const isHistory = mode === 'history';
  const { user } = useAuth();
  const effectiveUser = user || getStoredUser();
  const customerId = effectiveUser?.id || 1;
  const location = useLocation();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(location.state?.openCreateModal || false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [notification, setNotification] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading...');
  const [editingTicket, setEditingTicket] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [titleCasingData, setTitleCasingData] = useState(null);
  const [showTitleCasingModal, setShowTitleCasingModal] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editEquipment, setEditEquipment] = useState('');
  const [editOptions, setEditOptions] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
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

    try {
      const ticketsList = await getCustomerTickets({ createdBy: customerId, limit: 100, forceRefresh });
      const externalTickets = getExternalTicketsFromStorage();
      const merged = [...externalTickets, ...ticketsList];
      setTickets(merged);
    } catch (err) {
      const externalTickets = getExternalTicketsFromStorage();
      if (externalTickets.length > 0) {
        setTickets(externalTickets);
      } else {
        setError(err?.response?.data?.message || 'Failed to load tickets.');
      }
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    seedDemoExternalTicket();
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
  });

  const categories = useMemo(() => {
    const unique = new Set(tickets.map((ticket) => ticket.category).filter(Boolean));
    return Array.from(unique).sort();
  }, [tickets]);

  const visibleTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const normalizedStatus = ticket.status === 'Discarded by Customer' ? 'Discarded' : ticket.status;
      if (isHistory && !HISTORY_STATUSES.includes(ticket.status)) return false;
      if (!isHistory && (HISTORY_STATUSES.includes(ticket.status) || ['Closed', 'Resolved', 'Discarded', 'Discarded by Customer'].includes(ticket.status))) return false;
      if (filters.status && normalizedStatus !== filters.status) return false;
      if (filters.category && (ticket.category || '').trim() !== filters.category.trim()) return false;
      const ticketDate = ticket.date_created ? new Date(String(ticket.date_created).replace(' ', 'T')) : null;
      const isValidTicketDate = ticketDate && !isNaN(ticketDate.getTime());
      if (filters.dateFrom && isValidTicketDate) {
        const from = new Date(`${filters.dateFrom}T00:00:00`);
        if (ticketDate < from) return false;
      }
      if (filters.dateTo && isValidTicketDate) {
        const to = new Date(`${filters.dateTo}T23:59:59`);
        if (ticketDate > to) return false;
      }

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
        
      const newTicketId = response.ticket?.ticket_ID || response.ticket_ID;
        
      setIsModalOpen(false);
      loadTickets({ forceRefresh: true });
      setNotification({
        type: 'success',
        title: 'Ticket submitted',
        message: `${createdId} has been created successfully.`,
        onClose: () => {
          setNotification(null);
          navigate('/messages', { state: { selectedTicketId: newTicketId } });
        }
      });
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
      let localDetails = {};
      try { localDetails = JSON.parse(localStorage.getItem('customer_ticket_details') || '{}')[t.id] || {}; } catch { localDetails = {}; }
      const mergedTimeline = (() => {
        const base = fullTicket.timeline && Array.isArray(fullTicket.timeline) ? [...fullTicket.timeline] : (localDetails.timeline ? [...localDetails.timeline] : []);
        if (localDetails.timeline && fullTicket.timeline) {
          const existingIds = new Set(base.map(x => x.id));
          localDetails.timeline.forEach(evt => { if (!existingIds.has(evt.id)) base.push(evt); });
        } else if (localDetails.timeline && !fullTicket.timeline) {
          return localDetails.timeline;
        }
        return base.length ? base : undefined;
      })();
      setSelectedTicket({
        ...t,
        ...fullTicket,
        ...localDetails,
        description: localDetails.description || fullTicket.description || t.description || '',
        last_updated: localDetails.last_updated || fullTicket.updated_at || fullTicket.last_updated || t.last_updated,
        updated_at: localDetails.last_updated || fullTicket.updated_at,
        timeline: mergedTimeline || fullTicket.timeline || localDetails.timeline,
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

  const canEditTicket = (t) => {
    if (!t) return false;
    const s = (t.status || '').trim();
    const hasAssignee = !!(t.assigned_to || t.assigned_employee || t.assigned_to_emp_id);
    return s === 'Open' && !hasAssignee;
  };

  const handleEditTicket = async (ticket) => {
    if (!canEditTicket(ticket)) {
      showError('Cannot Edit Ticket', 'Tickets can only be edited while Open and not yet assigned to an employee.');
      return;
    }

    setEditTitle(ticket.title || '');
    setEditDescription(ticket.description || '');
    setEditCategory(ticket.problem_category_ID || ticket.problemCategoryId || '');
    setEditEquipment(ticket.machine_ID || ticket.machineId || '');
    setEditingTicket(ticket);
    setOpenMenuId(null);

    let opts = getCachedTicketFormOptions();
    if (!opts) {
    }
    setEditOptions(opts);

    const inferIds = (options) => {
      if (!options) return;
      const catList = options.problem_categories || options.category_options || [];
      const eqList = options.machines || options.equipment_options || [];
      if (!ticket.problem_category_ID && !ticket.problemCategoryId && ticket.category) {
        const found = catList.find(c => (c.category_name || c.label || c.name) === ticket.category);
        if (found) setEditCategory(String(found.problem_category_ID || found.value));
      }
      if (!ticket.machine_ID && !ticket.machineId && ticket.equipment) {
        const found = eqList.find(m => {
          const label = m.machine_name ? `${m.machine_name} - ${m.serial_number}` : (m.label || '');
          return label === ticket.equipment || m.machine_name === ticket.equipment;
        });
        if (found) setEditEquipment(String(found.machine_ID || found.value));
      }
    };

    inferIds(opts);

    if (!ticket.problem_category_ID && !ticket.machine_ID && ticket.ticket_ID) {
      try {
        const details = await getTicketDetails(ticket.ticket_ID || parseInt(String(ticket.id || '').replace(/\D/g, ''), 10));
        if (details?.problem_category_ID) setEditCategory(String(details.problem_category_ID));
        if (details?.machine_ID) setEditEquipment(String(details.machine_ID));
        if (details?.title) setEditTitle(details.title);
        if (details?.description) setEditDescription(details.description);
        if (details?.problem_category_ID || details?.machine_ID) {
          let freshOpts = opts;
          if (!freshOpts) {
            try { freshOpts = await getTicketFormOptions(); setEditOptions(freshOpts); } catch { /* ignore */ }
          }
          inferIds(freshOpts);
        }
      } catch { /* ignore */ }
    }
    setEditOptions(opts);
  };

  const handleSaveEdit = () => {
    if (!editingTicket) return;
    const titleTrimmed = (editTitle || '').trim();
    if (!titleTrimmed) {
      showError('Validation Error', 'Ticket title is required.');
      return;
    }

    if (needsProperCasing(titleTrimmed)) {
      const proper = formatProperTitleCase(titleTrimmed);
      setTitleCasingData({
        original: titleTrimmed,
        formatted: proper,
      });
      setShowTitleCasingModal(true);
      return;
    }

    showConfirm(
      'Update this ticket?',
      'Are you sure you want to save the changes to this ticket?',
      () => executeSaveEdit(titleTrimmed),
      { confirmText: 'Update Ticket', confirmClassName: 'bg-[#252578] hover:bg-[#1f1f66]' }
    );
  };

  const handleConfirmTitleCasing = () => {
    if (!titleCasingData) return;
    const formatted = titleCasingData.formatted;
    setEditTitle(formatted);
    setShowTitleCasingModal(false);
    showConfirm(
      'Update this ticket?',
      `Are you sure you want to save the changes with formatted title "${formatted}"?`,
      () => executeSaveEdit(formatted),
      { confirmText: 'Update Ticket', confirmClassName: 'bg-[#252578] hover:bg-[#1f1f66]' }
    );
  };

  const executeSaveEdit = async (overrideTitle) => {
    if (!editingTicket) return;
    const ticket = editingTicket;
    const normalizedTitle = normalizeCasing(editTitle);
    const normalizedDesc = normalizeCasing(editDescription);
    if (!normalizedTitle.trim() || normalizedTitle.trim().length < 5) {
      showError('Validation error', 'Title must be at least 5 characters.');
      return;
    }
    if (!normalizedDesc.trim() || normalizedDesc.trim().length < 20) {
      showError('Validation error', 'Description must be at least 20 characters.');
      return;
    }
    const isMock = !!ticket.isMock;
    const finalTitle = overrideTitle || editTitle;

    if (isMock) {
      const stored = JSON.parse(localStorage.getItem('customer_created_tickets') || '[]');
      const timestamp = new Date().toISOString();
      const categoryLabel = (() => {
        if (!editCategory) return ticket.category;
        const list = editOptions?.problem_categories || editOptions?.category_options || [];
        const found = list.find(c => String(c.problem_category_ID || c.value) === String(editCategory));
        return found ? (found.category_name || found.label || found.name) : ticket.category;
      })();
      const equipmentLabel = (() => {
        if (!editEquipment) return ticket.equipment;
        const list = editOptions?.machines || editOptions?.equipment_options || [];
        const found = list.find(m => String(m.machine_ID || m.value) === String(editEquipment));
        return found ? (found.machine_name ? `${found.machine_name} - ${found.serial_number}` : found.label) : ticket.equipment;
      })();
      const changes = [];
      if (normalizedTitle !== ticket.title) changes.push('title');
      if (normalizedDesc !== ticket.description) changes.push('description');
      if (editCategory && String(editCategory) !== String(ticket.problem_category_ID || '')) changes.push('category');
      if (editEquipment && String(editEquipment) !== String(ticket.machine_ID || '')) changes.push('equipment');
      const updatedList = stored.map(t => {
        if (t.id === ticket.id) {
          const timeline = t.timeline || [{ id: 'creation', type: 'system', text: 'Ticket created.', timestamp: t.date_created }];
          return { ...t, title: finalTitle, description: editDescription, category: categoryLabel, equipment: equipmentLabel, problem_category_ID: editCategory || t.problem_category_ID, machine_ID: editEquipment || t.machine_ID, last_updated: timestamp, updated_at: timestamp, timeline: [...timeline, { id: `update-${Date.now()}`, type: 'status', text: `Ticket details updated${changes.length ? `: ${changes.join(', ')}` : ''}.`, timestamp }] };
        }
        return t;
      });
      localStorage.setItem('customer_created_tickets', JSON.stringify(updatedList));
      setTickets(updatedList);
      setEditingTicket(null);
      showSuccess('Ticket updated', 'Ticket details updated successfully. Last updated: ' + formatDisplayDate(timestamp));
      return;
    }

    setLoadingText('Updating ticket...');
    setModalLoading(true);
    try {
      const numericId = ticket.ticket_ID || parseInt(String(ticket.id || '').replace(/\D/g, ''), 10);
      const payload = {
        ticketId: numericId,
        title: finalTitle,
        description: editDescription,
      };
      if (editCategory) payload.problem_category_ID = editCategory;
      if (editEquipment) payload.machine_ID = editEquipment;
      await updateTicket(payload);
      const timestamp = new Date().toISOString();
      try {
        const existing = JSON.parse(localStorage.getItem('customer_ticket_details') || '{}');
        const key = ticket.id;
        const prev = existing[key] || {};
        const categoryLabel = (() => {
          if (!editCategory) return prev.category || ticket.category;
          const list = editOptions?.problem_categories || editOptions?.category_options || [];
          const found = list.find(c => String(c.problem_category_ID || c.value) === String(editCategory));
          return found ? (found.category_name || found.label || found.name) : ticket.category;
        })();
        const equipmentLabel = (() => {
          if (!editEquipment) return prev.equipment || ticket.equipment;
          const list = editOptions?.machines || editOptions?.equipment_options || [];
          const found = list.find(m => String(m.machine_ID || m.value) === String(editEquipment));
          return found ? (found.machine_name ? `${found.machine_name} - ${found.serial_number}` : found.label) : ticket.equipment;
        })();
        const changes = [];
        if (normalizedTitle !== ticket.title) changes.push('title');
        if (normalizedDesc !== ticket.description) changes.push('description');
        if (editCategory && String(editCategory) !== String(ticket.problem_category_ID || '')) changes.push('category');
        if (editEquipment && String(editEquipment) !== String(ticket.machine_ID || '')) changes.push('equipment');
        const newEvent = { id: `update-${Date.now()}`, type: 'status', text: `Ticket details updated${changes.length ? `: ${changes.join(', ')}` : ''}.`, timestamp };
        const priorTimeline = prev.timeline || [];
        existing[key] = { ...prev, title: normalizedTitle, description: normalizedDesc, category: categoryLabel, equipment: equipmentLabel, last_updated: timestamp, timeline: [...priorTimeline, newEvent] };
        localStorage.setItem('customer_ticket_details', JSON.stringify(existing));
      } catch { /* ignore */ }
      setEditingTicket(null);
      showSuccess('Ticket updated', 'Ticket details updated successfully.');
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
            onClick={() => navigate('/ai-support')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-[#252578] to-[#3b82f6] px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Create Ticket
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <input
          type="text"
          placeholder="Search ID or title"
          value={filters.search}
          onChange={(event) => updateFilter('search', event.target.value)}
          className="w-full md:w-[725px] max-w-[725px] shrink-0 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
        />
        <div className="flex flex-wrap items-center gap-3 ml-auto shrink-0">
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="w-full sm:w-[150px] md:w-[160px] shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
            <option value="">All statuses</option>
            {(isHistory ? HISTORY_STATUSES : ACTIVE_STATUSES).map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} className="w-full sm:w-[150px] md:w-[160px] shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <input type="date" value={filters.dateFrom} onChange={(event) => { const v = event.target.value; setFilters((c) => ({ ...c, dateFrom: v, dateTo: v })); }} className="w-full sm:w-auto shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#252578]" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-4">ID</th>
                <th className="px-5 py-4">Title</th>
                <th className="px-5 py-4">Equipment</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Date Created</th>
                <th className="px-5 py-4">Last Updated</th>
                <th className="px-5 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleTickets.length === 0 && loading && (
                <tr>
                  <td colSpan={7}>
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
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">
                    No tickets match the current filters.
                  </td>
                </tr>
              )}
              {visibleTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleViewTicket(ticket)}>
                  <td className="px-5 py-4 text-sm font-semibold text-[#252578] whitespace-nowrap">{ticket.id}</td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-800 max-w-[280px]"><div className="truncate whitespace-nowrap overflow-hidden text-ellipsis" title={ticket.title}>{ticket.title}</div><div className="truncate max-w-[260px] text-xs text-gray-500 font-normal whitespace-nowrap overflow-hidden text-ellipsis md:hidden" title={ticket.description}>{ticket.description}</div></td>
                  <td className="px-5 py-4 text-sm text-gray-600 max-w-[160px] truncate whitespace-nowrap overflow-hidden text-ellipsis" title={ticket.equipment || ticket.category}>{ticket.equipment || ticket.category || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${statusClass(ticket.status)}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{formatDisplayDate(ticket.date_created)}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{formatDisplayDate(ticket.last_updated)}</td>
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
          if (!t) return null;
          const isHist = isHistory;
          const canEdit = canEditTicket(t);
          return (
            <div data-menu-id={t.id}
              style={{ position: 'fixed', left: menuPos.x, top: menuPos.y, zIndex: 9999 }}
              className="w-36 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
              {isHist ? (
                <>
                  <button onClick={() => { handleViewTicket(t); setMenuPos(null); setOpenMenuId(null); }} disabled={t.status !== 'Closed'} className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm ${t.status === 'Closed' ? 'text-[#252578] hover:bg-indigo-50' : 'text-gray-400 cursor-not-allowed'} `}>
                    Reopen
                  </button>
                  <button onClick={() => { handleDeleteTicket(t); setMenuPos(null); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </>
              ) : (
                <>
                  {canEdit && (
                    <button onClick={() => { handleEditTicket(t); setMenuPos(null); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                      Edit
                    </button>
                  )}
                  <button onClick={() => { handleDeleteTicket(t); setMenuPos(null); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </>
              )}
            </div>
          );
        })(),
        document.body
      )}

      <TicketModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreateTicket} />
      <CustomerTicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onDiscard={(ticket) => showConfirm('Discard this ticket?', `This will mark ${ticket.id} as Discarded.`, () => handleConfirmDiscard(ticket), { confirmText: 'Discard', confirmClassName: 'bg-red-600 hover:bg-red-700' })} onReopen={(ticketId, reason) => handleReopenTicket(ticketId, reason)} onResolve={(ticketId) => handleCloseTicket(ticketId)} customerName={effectiveUser?.name || effectiveUser?.first_name ? `${effectiveUser.first_name}${effectiveUser.last_name ? ' ' + effectiveUser.last_name : ''}` : 'Customer'} allowReopen={true} isHistoryView={isHistory} />

      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 shrink-0">
              <div>
                {!editingTicket.assigned_to ? (
                  <>
                    <h2 className="text-xl font-bold text-gray-900">Edit Ticket</h2>
                    <p className="mt-0.5 text-sm font-semibold text-[#252578]">{editingTicket.id}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-[#252578]">{editingTicket.id}</p>
                    <h2 className="mt-1 text-xl font-bold text-gray-900">Edit Ticket</h2>
                  </>
                )}
              </div>
              <button type="button" onClick={() => setEditingTicket(null)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={(e) => { const n = normalizeCasing(e.target.value); if (n !== e.target.value) { setEditTitle(n); e.target.value = n; } }}
                  placeholder={editingTicket.title || 'Enter title'}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#252578] placeholder:text-gray-400"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="min-w-0 md:col-span-2">
                  <p className="text-xs font-semibold uppercase text-gray-400">Category</p>
                  {editOptions ? (
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      title={editingTicket.category || ''}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#252578]"
                    >
                      <option value="">{editingTicket.category ? `Current: ${editingTicket.category}` : 'Select category'}</option>
                      {(editOptions.problem_categories || editOptions.category_options || []).map((cat) => (
                        <option key={cat.problem_category_ID || cat.value} value={cat.problem_category_ID || cat.value} title={cat.category_name || cat.label || cat.name}>
                          {cat.category_name || cat.label || cat.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 text-sm text-gray-800 break-words">{editingTicket.category}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">Status</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800">
                    {!editingTicket.assigned_to && editingTicket.status === 'In Progress' ? 'Open' : editingTicket.status}
                  </p>
                </div>
                <div className="min-w-0 md:col-span-2">
                  <p className="text-xs font-semibold uppercase text-gray-400">Equipment</p>
                  {editOptions ? (
                    <select
                      value={editEquipment}
                      onChange={(e) => setEditEquipment(e.target.value)}
                      title={editingTicket.equipment || ''}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#252578]"
                    >
                      <option value="">{editingTicket.equipment ? `Current: ${editingTicket.equipment}` : 'Select equipment'}</option>
                      {(editOptions.equipment_options || editOptions.machines || []).map((m) => (
                        <option key={m.machine_ID || m.value} value={m.machine_ID || m.value} title={m.machine_name ? `${m.machine_name} - ${m.serial_number}` : m.label}>
                          {m.machine_name ? `${m.machine_name} - ${m.serial_number}` : m.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 text-sm text-gray-800 break-words">{editingTicket.equipment}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">Date Created</p>
                  <p className="mt-1 text-sm text-gray-800">{formatDate(editingTicket.date_created)}</p>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows="4"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  onBlur={(e) => { const n = normalizeCasing(e.target.value); if (n !== e.target.value) { setEditDescription(n); e.target.value = n; } }}
                  placeholder={editingTicket.description || 'Enter description'}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#252578] placeholder:text-gray-400"
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

      <TitleCasingModal
        isOpen={showTitleCasingModal}
        originalTitle={titleCasingData?.original}
        formattedTitle={titleCasingData?.formatted}
        onConfirm={handleConfirmTitleCasing}
        onCancel={() => setShowTitleCasingModal(false)}
      />

      <NotificationModal
        isOpen={!!notification}
        type={notification?.type}
        title={notification?.title}
        message={notification?.message}
        onClose={notification?.onClose || closeNotif}
        onConfirm={notification?.onConfirm}
        onCancel={notification?.onCancel}
        confirmText={notification?.confirmText}
        confirmClassName={notification?.confirmClassName}
      />

      {modalLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px] animate-in fade-in duration-200">
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
