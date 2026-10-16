import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { MoreVertical, Filter, RotateCcw, Trash2, Edit3, FileText, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { DataTableSkeleton, DataTableEmptyState } from '@/components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import TicketModal from '@/components/TicketModal';
import CustomerTicketDetailModal from '@/components/CustomerTicketDetailModal';
import NotificationModal from '@/components/NotificationModal';
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
  getTicketDrafts,
  deleteTicketDraft,
  getCustomerFilterOptions,
} from '@/services/ticketService';
import { getMaxOpenTicketsLimit, OPEN_STATUS_SET } from '@/data/ticketLimitConfig';

import { parseUTCDate } from '@/utils/dateUtils';
import TitleCasingModal from '@/components/TitleCasingModal';
import { formatProperTitleCase, needsProperCasing } from '@/utils/titleCaseUtils';
import { hasFeedbackBeenSubmitted } from '@/data/mockFeedbackData';

const ACTIVE_STATUSES = ['Open', 'Pending Assignment', 'In Progress', 'Pending', 'On Hold', 'Closed'];
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
  const [activeTab, setActiveTab] = useState('tickets'); // 'tickets' | 'drafts'
  const [drafts, setDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    statuses: [],
    priorities: [],
    machines: [],
  });

  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: '',
    machine: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const list = await getTicketDrafts({ client_id: customerId });
      setDrafts(list || []);
    } catch (err) {
      console.warn('Failed to load ticket drafts:', err);
    } finally {
      setLoadingDrafts(false);
    }
  }, [customerId]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const opts = await getCustomerFilterOptions(customerId);
      if (opts) {
        setFilterOptions({
          categories: opts.categories || [],
          statuses: opts.statuses || [],
          priorities: opts.priorities || [],
          machines: opts.machines || [],
        });
      }
    } catch (err) {
      console.warn('Failed to load customer filter options:', err);
    }
  }, [customerId]);

  const loadTickets = useCallback(async ({ forceRefresh = false } = {}) => {
    setLoading(true);
    setError('');

    try {
      const ticketsList = await getCustomerTickets({ createdBy: customerId, limit: 100, forceRefresh });
      setTickets(ticketsList || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    try {
      localStorage.removeItem('demo_external_tickets');
    } catch {
      // ignore
    }
    loadTickets({ forceRefresh: false });
    loadDrafts();
    loadFilterOptions();
  }, [loadTickets, loadDrafts, loadFilterOptions]);

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

  const [feedbackVersion, setFeedbackVersion] = useState(0);

  useEffect(() => {
    const handleFeedbackSubmitted = () => {
      setFeedbackVersion((v) => v + 1);
    };
    window.addEventListener('customer_feedback_submitted', handleFeedbackSubmitted);
    return () => window.removeEventListener('customer_feedback_submitted', handleFeedbackSubmitted);
  }, []);

  const visibleTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const normalizedStatus = ticket.status === 'Discarded by Customer' ? 'Discarded' : ticket.status;
      const isInternal = ticket.is_internal || ticket.ticket_type === 'Internal';
      const hasFeedback = hasFeedbackBeenSubmitted(ticket.id) || hasFeedbackBeenSubmitted(ticket.ticket_ID);
      const isClosedPendingFeedback = ticket.status === 'Closed' && !isInternal && !hasFeedback;

      if (isHistory) {
        if (!HISTORY_STATUSES.includes(ticket.status)) return false;
        // Closed tickets pending feedback stay in My Tickets until feedback is submitted
        if (isClosedPendingFeedback) return false;
      } else {
        // Active "My Tickets"
        if (ticket.status === 'Closed') {
          if (!isClosedPendingFeedback) return false;
        } else if (HISTORY_STATUSES.includes(ticket.status) || ['Resolved', 'Discarded', 'Discarded by Customer'].includes(ticket.status)) {
          return false;
        }
      }

      if (filters.status && normalizedStatus !== filters.status) return false;
      if (filters.category && (ticket.category || '').trim().toLowerCase() !== filters.category.trim().toLowerCase()) return false;
      if (filters.priority && (ticket.priority || '').trim().toLowerCase() !== filters.priority.trim().toLowerCase()) return false;
      if (filters.machine && (ticket.equipment || ticket.machine_name || '').trim().toLowerCase() !== filters.machine.trim().toLowerCase()) return false;

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
      return (
        ticket.id.toLowerCase().includes(search) ||
        (ticket.title && ticket.title.toLowerCase().includes(search)) ||
        (ticket.equipment && ticket.equipment.toLowerCase().includes(search))
      );
    });
  }, [filters, isHistory, tickets, feedbackVersion]);

  const closeNotif = () => setNotification(null);
  const showSuccess = (title, message) => setNotification({ type: 'success', title, message });
  const showError = (title, message) => setNotification({ type: 'error', title, message });
  const showConfirm = (title, message, onConfirm, opts = {}) => setNotification({ type: 'confirm', title, message, onConfirm, onCancel: closeNotif, ...opts });

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      status: '',
      category: '',
      priority: '',
      machine: '',
      dateFrom: '',
      dateTo: '',
      search: '',
    });
  };

  const handleEditDraft = (draft) => {
    navigate('/create-ticket', { state: { draftId: draft.id } });
  };

  const handleDeleteDraft = (draft) => {
    showConfirm(
      'Delete this draft?',
      `Delete "${draft.title || 'Untitled draft'}"? This action cannot be undone.`,
      async () => {
        closeNotif();
        try {
          await deleteTicketDraft(draft.id);
          showSuccess('Draft Deleted', 'The draft has been permanently removed.');
          loadDrafts();
        } catch (err) {
          showError('Error', err?.response?.data?.message || 'Failed to delete draft.');
        }
      },
      { confirmText: 'Delete Draft', confirmClassName: 'bg-red-600 hover:bg-red-700' }
    );
  };

  const customerOpenCount = useMemo(() => {
    return (tickets || []).filter((t) => !t.is_internal && OPEN_STATUS_SET.includes(t.status)).length;
  }, [tickets]);

  const handleCreateTicket = async (payload) => {
    const limitConfig = getMaxOpenTicketsLimit();
    if (!limitConfig.isUnlimited && customerOpenCount >= limitConfig.limit) {
      throw new Error(`You've reached the maximum number of open tickets (${limitConfig.limit}). Resolve or close an existing ticket before submitting another.`);
    }

    setLoadingText('Submitting ticket...');
    setModalLoading(true);
    try {
      const response = await createTicket({
        ...payload,
        created_by: customerId,
      });
      
      const createdId = response.ticket?.ticket_number
        || response.dashboard_ticket?.ticket_number
        || response.ticket_number
        || (response.ticket
          ? 'TKT-' + String(response.ticket.ticket_ID).padStart(4, '0')
          : 'TKT-' + String(response.ticket_ID || 'new').padStart(4, '0'));
        
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
    <div className="flex flex-col gap-6 font-sans text-dark-slate">
      <PageHeader
        title={isHistory ? 'Ticket History' : 'My Tickets'}
        subtitle={isHistory ? 'Review completed and discarded tickets.' : 'Track and manage your submitted support tickets.'}
        actions={
          !isHistory && (
            <Button
              onClick={() => navigate('/ai-support')}
              icon={<Plus className="h-4 w-4" />}
            >
              Create Ticket
            </Button>
          )
        }
      />

      {!isHistory && (
        <div className="flex border-b border-gray-200 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('tickets')}
            className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
              activeTab === 'tickets'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-muted-slate hover:text-dark-slate'
            }`}
          >
            All Tickets
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'tickets' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-page text-muted-slate'
            }`}>
              {visibleTickets.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('drafts'); loadDrafts(); }}
            className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
              activeTab === 'drafts'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-muted-slate hover:text-dark-slate'
            }`}
          >
            My Drafts
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'drafts' ? 'bg-amber-100 text-amber-800' : 'bg-page text-muted-slate'
            }`}>
              {drafts.length}
            </span>
          </button>
        </div>
      )}

      {activeTab === 'tickets' ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-150 bg-surface px-4 py-3 shadow-level-1">
            <input
              type="text"
              placeholder="Search by Ticket ID or title..."
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              className="flex-1 min-w-[220px] rounded-xl border border-gray-200 bg-surface px-4 py-2.5 text-sm text-dark-slate placeholder:text-muted-slate/60 outline-none focus:border-transparent focus:ring-2 focus:ring-brand-accent"
            />
            <div className="flex flex-wrap items-center gap-2.5 ml-auto shrink-0">
              <select
                value={filters.status}
                onChange={(event) => updateFilter('status', event.target.value)}
                className="w-full sm:w-auto shrink-0 rounded-xl border border-gray-200 bg-surface px-3 py-2.5 text-sm text-dark-slate outline-none focus:border-transparent focus:ring-2 focus:ring-brand-accent"
              >
                <option value="">All statuses</option>
                {(filterOptions.statuses.length > 0
                  ? filterOptions.statuses.map((s) => s.status_name || s.name || s)
                  : (isHistory ? HISTORY_STATUSES : ACTIVE_STATUSES)
                ).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>

              <select
                value={filters.category}
                onChange={(event) => updateFilter('category', event.target.value)}
                className="w-full sm:w-auto shrink-0 rounded-xl border border-gray-200 bg-surface px-3 py-2.5 text-sm text-dark-slate outline-none focus:border-transparent focus:ring-2 focus:ring-brand-accent"
              >
                <option value="">All categories</option>
                {(filterOptions.categories.length > 0
                  ? filterOptions.categories.map((c) => c.category_name || c.name || c)
                  : categories
                ).map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              {filterOptions.machines.length > 0 && (
                <select
                  value={filters.machine}
                  onChange={(event) => updateFilter('machine', event.target.value)}
                  className="w-full sm:w-auto shrink-0 rounded-xl border border-gray-200 bg-surface px-3 py-2.5 text-sm text-dark-slate outline-none focus:border-transparent focus:ring-2 focus:ring-brand-accent"
                >
                  <option value="">All machines</option>
                  {filterOptions.machines.map((m) => {
                    const label = typeof m === 'string'
                      ? m
                      : m.label || (m.machine_name ? `${m.machine_name}${m.serial_number ? ` - ${m.serial_number}` : ''}` : (m.name || `Machine #${m.machine_ID || ''}`));
                    const key = typeof m === 'object' && m ? (m.machine_ID || m.value || label) : label;
                    return <option key={key} value={label}>{label}</option>;
                  })}
                </select>
              )}

              <input
                type="date"
                title="Filter by creation date"
                value={filters.dateFrom}
                onChange={(event) => {
                  const v = event.target.value;
                  setFilters((c) => ({ ...c, dateFrom: v, dateTo: v }));
                }}
                className="w-full sm:w-auto shrink-0 rounded-xl border border-gray-200 bg-surface px-3 py-2.5 text-sm text-dark-slate outline-none focus:border-transparent focus:ring-2 focus:ring-brand-accent"
              />

              {(filters.search || filters.status || filters.category || filters.machine || filters.priority || filters.dateFrom) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  icon={<RotateCcw className="h-3.5 w-3.5" />}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="overflow-x-auto rounded-2xl border border-gray-150 bg-surface shadow-level-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">ID</TableHead>
                  <TableHead className="min-w-[240px]">Title</TableHead>
                  <TableHead className="min-w-[160px]">Equipment</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[140px]">Date Created</TableHead>
                  <TableHead className="w-[140px]">Last Updated</TableHead>
                  <TableHead className="w-[80px] text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTickets.length === 0 && loading && (
                  <DataTableSkeleton columns={7} rows={5} />
                )}
                {visibleTickets.length === 0 && !loading && (
                  <DataTableEmptyState
                    colSpan={7}
                    title="No tickets match your criteria"
                    description="Try adjusting your keyword search or removing filters."
                    action={
                      (filters.search || filters.status || filters.category || filters.machine || filters.priority || filters.dateFrom) && (
                        <Button variant="outline" size="sm" onClick={resetFilters} icon={<RotateCcw className="h-3.5 w-3.5" />}>
                          Clear all filters
                        </Button>
                      )
                    }
                  />
                )}
                {visibleTickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer"
                    onClick={() => handleViewTicket(ticket)}
                  >
                    <TableCell className="font-semibold text-brand-primary whitespace-nowrap">
                      {ticket.id}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="truncate font-medium text-dark-slate" title={ticket.title}>{ticket.title}</div>
                      <div className="truncate max-w-[260px] text-xs text-muted-slate md:hidden" title={ticket.description}>{ticket.description}</div>
                    </TableCell>
                    <TableCell className="text-muted-slate max-w-[160px] truncate" title={ticket.equipment || ticket.category}>
                      {ticket.equipment || ticket.category || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(ticket.status)} dot>
                        {ticket.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-slate text-xs whitespace-nowrap">
                      {formatDisplayDate(ticket.date_created)}
                    </TableCell>
                    <TableCell className="text-muted-slate text-xs whitespace-nowrap">
                      {formatDisplayDate(ticket.last_updated)}
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="rounded-full p-2 text-muted-slate hover:bg-page hover:text-dark-slate transition-colors cursor-pointer"
                            aria-label="Actions"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isHistory ? (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleViewTicket(ticket)}
                                disabled={ticket.status !== 'Closed'}
                              >
                                Reopen
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                destructive
                                onClick={() => handleDeleteTicket(ticket)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              {canEditTicket(ticket) && (
                                <DropdownMenuItem onClick={() => handleEditTicket(ticket)}>
                                  Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                destructive
                                onClick={() => handleDeleteTicket(ticket)}
                              >
                                Discard
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        /* ─── My Drafts Tab (TS020) ─── */
        <div className="overflow-x-auto rounded-2xl border border-gray-150 bg-surface shadow-level-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Draft Title / Summary</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Last Saved</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.length === 0 && loadingDrafts && (
                <DataTableSkeleton columns={5} rows={3} />
              )}
              {drafts.length === 0 && !loadingDrafts && (
                <DataTableEmptyState
                  colSpan={5}
                  icon={FileText}
                  title="No saved drafts"
                  description="When creating a ticket, you can click 'Save as Draft' to continue anytime."
                  action={
                    <Button size="sm" onClick={() => navigate('/create-ticket')} icon={<Plus className="h-3.5 w-3.5" />}>
                      Create New Ticket
                    </Button>
                  }
                />
              )}
              {drafts.map((draft) => (
                <TableRow key={draft.id}>
                  <TableCell className="max-w-[280px]">
                    <div className="truncate font-semibold text-dark-slate" title={draft.title}>
                      {draft.title || 'Untitled draft'}
                    </div>
                    {draft.description && (
                      <div className="text-xs text-muted-slate truncate mt-0.5">
                        {draft.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-slate">
                    {draft.machine_ID ? `Equipment #${draft.machine_ID}` : '—'}
                  </TableCell>
                  <TableCell className="text-muted-slate">
                    {draft.problem_category_ID ? `Category #${draft.problem_category_ID}` : '—'}
                  </TableCell>
                  <TableCell className="text-muted-slate text-xs whitespace-nowrap">
                    {formatDisplayDate(draft.last_saved_at || draft.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditDraft(draft)}
                        icon={<Edit3 className="h-3.5 w-3.5" />}
                      >
                        Continue
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteDraft(draft)}
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TicketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTicket}
        openTicketsCount={customerOpenCount}
      />
      <CustomerTicketDetailModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onDiscard={(ticket) => showConfirm('Discard this ticket?', `This will mark ${ticket.id} as Discarded.`, () => handleConfirmDiscard(ticket), { confirmText: 'Discard', confirmClassName: 'bg-red-600 hover:bg-red-700' })}
        onReopen={(ticketId, reason) => handleReopenTicket(ticketId, reason)}
        onResolve={(ticketId) => handleCloseTicket(ticketId)}
        customerName={effectiveUser?.name || effectiveUser?.first_name ? `${effectiveUser.first_name}${effectiveUser.last_name ? ' ' + effectiveUser.last_name : ''}` : 'Customer'}
        allowReopen={true}
        isHistoryView={isHistory}
        onFeedbackSubmitted={() => {
          setFeedbackVersion((v) => v + 1);
          loadTickets({ forceRefresh: true });
        }}
      />

      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px] animate-in fade-in duration-200">
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-surface shadow-level-4">
            <div className="flex items-start justify-between border-b border-gray-150 px-6 py-5 shrink-0 bg-surface">
              <div>
                <h2 className="text-xl font-bold text-dark-slate">Edit Ticket</h2>
                <p className="mt-0.5 text-xs font-semibold text-brand-primary">{editingTicket.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTicket(null)}
                className="rounded-full p-2 text-muted-slate hover:bg-page hover:text-dark-slate transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 text-dark-slate">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-slate">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={(e) => { const n = normalizeCasing(e.target.value); if (n !== e.target.value) { setEditTitle(n); e.target.value = n; } }}
                  placeholder={editingTicket.title || 'Enter title'}
                  className="w-full rounded-xl border border-gray-200 bg-surface px-4 py-2.5 text-sm text-dark-slate outline-none transition-all placeholder:text-muted-slate/60 focus:border-transparent focus:ring-2 focus:ring-brand-accent"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="min-w-0 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-slate">Category</p>
                  {editOptions ? (
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      title={editingTicket.category || ''}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-surface px-3 py-2 text-sm text-dark-slate outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-brand-accent"
                    >
                      <option value="">{editingTicket.category ? `Current: ${editingTicket.category}` : 'Select category'}</option>
                      {(editOptions.problem_categories || editOptions.category_options || []).map((cat) => (
                        <option key={cat.problem_category_ID || cat.value} value={cat.problem_category_ID || cat.value} title={cat.category_name || cat.label || cat.name}>
                          {cat.category_name || cat.label || cat.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 text-sm text-dark-slate break-words">{editingTicket.category}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-slate">Status</p>
                  <p className="mt-1 text-sm font-semibold text-dark-slate">
                    {!editingTicket.assigned_to && editingTicket.status === 'In Progress' ? 'Open' : editingTicket.status}
                  </p>
                </div>
                <div className="min-w-0 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-slate">Equipment</p>
                  {editOptions ? (
                    <select
                      value={editEquipment}
                      onChange={(e) => setEditEquipment(e.target.value)}
                      title={editingTicket.equipment || ''}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-surface px-3 py-2 text-sm text-dark-slate outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-brand-accent"
                    >
                      <option value="">{editingTicket.equipment ? `Current: ${editingTicket.equipment}` : 'Select equipment'}</option>
                      {(editOptions.equipment_options || editOptions.machines || []).map((m) => {
                        const optVal = m.machine_ID || m.value || '';
                        const optLabel = m.machine_name ? `${m.machine_name}${m.serial_number ? ` - ${m.serial_number}` : ''}` : (typeof m.label === 'string' ? m.label : (m.name || `Machine #${optVal}`));
                        return (
                          <option key={optVal || optLabel} value={optVal} title={optLabel}>
                            {optLabel}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <p className="mt-1 text-sm text-dark-slate break-words">{editingTicket.equipment}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-slate">Date Created</p>
                  <p className="mt-1 text-sm text-dark-slate">{formatDate(editingTicket.date_created)}</p>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-slate">Description</label>
                <textarea
                  rows="4"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  onBlur={(e) => { const n = normalizeCasing(e.target.value); if (n !== e.target.value) { setEditDescription(n); e.target.value = n; } }}
                  placeholder={editingTicket.description || 'Enter description'}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-surface px-4 py-2.5 text-sm text-dark-slate outline-none transition-all placeholder:text-muted-slate/60 focus:border-transparent focus:ring-2 focus:ring-brand-accent"
                />
              </div>
            </div>
            <div className="border-t border-gray-150 px-6 py-4 shrink-0 flex justify-end gap-3 bg-surface">
              <Button variant="outline" onClick={() => setEditingTicket(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                Save Changes
              </Button>
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
          <div className="bg-surface rounded-2xl p-6 shadow-level-4 flex flex-col items-center gap-4 max-w-xs w-full mx-4 border border-gray-150">
            <div className="w-10 h-10 border-4 border-brand-primary/10 border-t-brand-primary rounded-full animate-spin" />
            <p className="text-sm font-semibold text-brand-primary text-center font-sans">
              {loadingText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
