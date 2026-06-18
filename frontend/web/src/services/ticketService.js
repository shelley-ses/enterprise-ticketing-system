import axios from 'axios';
import axiosInstance from '@/api/axiosInstance';
import { TICKET_API_URL, AUTH_ENDPOINTS } from '@/config/api.config';
import tokenStore from '@/auth/tokenStore';
import { refreshAccessToken } from '@/auth/refreshSession';

const ticketClient = axios.create({
  baseURL: TICKET_API_URL,
  withCredentials: false,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

ticketClient.interceptors.request.use((config) => {
  const token = tokenStore.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

ticketClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      const refreshed = await refreshAccessToken();
      const currentToken = tokenStore.getToken();
      if (refreshed && currentToken) {
        originalRequest.headers.Authorization = `Bearer ${currentToken}`;
        return ticketClient(originalRequest);
      }

      tokenStore.clearToken();
      localStorage.removeItem('user');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }

    return Promise.reject(error);
  }
);

let optionsCache = null;
let optionsCacheAt = 0;
let optionsInFlight = null;
const OPTIONS_CACHE_TTL_MS = 5 * 60 * 1000;

let dashboardCache = null;
let dashboardCacheAt = 0;
let dashboardInFlight = null;
const DASHBOARD_CACHE_TTL_MS = 30 * 1000;
const CUSTOMER_TICKET_OVERRIDES_KEY = 'customer_ticket_overrides';
const CUSTOMER_TICKET_DETAILS_KEY = 'customer_ticket_details';

let csDashboardCache = null;
let csDashboardCacheAt = 0;
let csDashboardInFlight = null;
const CS_DASHBOARD_CACHE_TTL_MS = 15 * 1000;

export const CS_TICKET_REFRESH_EVENT = 'cs:tickets-changed';

const notifyCsTicketRefresh = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(CS_TICKET_REFRESH_EVENT));
};

let incomingTicketsCache = null;
let incomingTicketsCacheAt = 0;
let incomingTicketsInFlight = null;
const INCOMING_TICKETS_CACHE_TTL_MS = 10 * 1000;

let employeesCache = {};
let employeesCacheAt = {};
let employeesInFlight = {};
const EMPLOYEES_CACHE_TTL_MS = 5 * 60 * 1000;

let departmentsCache = null;
let departmentsCacheAt = 0;
let departmentsInFlight = null;
const DEPARTMENTS_CACHE_TTL_MS = 5 * 60 * 1000;

let employeeTicketsCache = {};
let employeeTicketsCacheAt = {};
let employeeTicketsInFlight = {};
const EMPLOYEE_TICKETS_CACHE_TTL_MS = 30 * 1000;

export const clearEmployeeTicketsCache = () => {
  employeeTicketsCache = {};
  employeeTicketsCacheAt = {};
  employeeTicketsInFlight = {};
};

const isCacheFresh = () => optionsCache && (Date.now() - optionsCacheAt) < OPTIONS_CACHE_TTL_MS;
const isDashboardCacheFresh = () => dashboardCache && (Date.now() - dashboardCacheAt) < DASHBOARD_CACHE_TTL_MS;

const readJsonStore = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;

  try {
    return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

const writeJsonStore = (key, value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const getTicketOverrides = () => readJsonStore(CUSTOMER_TICKET_OVERRIDES_KEY, {});
const getLocalTicketDetailsStore = () => readJsonStore(CUSTOMER_TICKET_DETAILS_KEY, {});

const normalizeCustomerTicket = (ticket = {}) => {
  const overrides = getTicketOverrides()[ticket.id] || {};
  const details = getLocalTicketDetailsStore()[ticket.id] || {};
  const status = overrides.status || ticket.status || 'Open';
  const now = new Date().toISOString();
  const assigned_to = ticket.assigned_to || details.assigned_to || null;

  return {
    ticket_ID: ticket.ticket_ID || details.ticket_ID || Number(String(ticket.id || '').replace(/\D/g, '')) || null,
    id: ticket.id,
    title: ticket.title || details.title || 'Untitled ticket',
    category: ticket.category || details.category || 'General',
    status,
    equipment: ticket.equipment || details.equipment || 'Unspecified equipment',
    description: ticket.description || details.description || '',
    date_created: ticket.date_created || details.date_created || now,
    last_updated: overrides.last_updated || ticket.last_updated || details.last_updated || ticket.date_created || now,
    can_discard: status === 'Open' && !assigned_to,
    assigned_to,
  };
};

export const saveCustomerTicketDetail = (ticket = {}) => {
  if (!ticket.id) return;

  const details = getLocalTicketDetailsStore();
  details[ticket.id] = {
    ...(details[ticket.id] || {}),
    ...ticket,
    last_updated: ticket.last_updated || new Date().toISOString(),
  };
  writeJsonStore(CUSTOMER_TICKET_DETAILS_KEY, details);
};

export const discardCustomerTicket = async (ticketId) => {
  const response = await ticketClient.delete(`/tickets/${ticketId}`);
  return response.data;
};

const fetchTicketFormOptions = async () => {
  const response = await ticketClient.get('/ticket-form-options');
  optionsCache = response.data;
  optionsCacheAt = Date.now();
  return response.data;
};

export const getTicketFormOptions = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && isCacheFresh()) {
    return optionsCache;
  }

  if (!forceRefresh && optionsInFlight) {
    return optionsInFlight;
  }

  optionsInFlight = fetchTicketFormOptions().finally(() => {
    optionsInFlight = null;
  });

  return optionsInFlight;
};

export const prefetchTicketFormOptions = async () => getTicketFormOptions();

export const getCachedTicketFormOptions = () => {
  if (!isCacheFresh()) {
    return null;
  }

  return optionsCache;
};

export const clearTicketFormOptionsCache = () => {
  optionsCache = null;
  optionsCacheAt = 0;
  optionsInFlight = null;
};

const fetchCustomerDashboard = async ({ createdBy = 1, limit = 5 } = {}) => {
  const response = await ticketClient.get('/customer-dashboard', {
    params: {
      created_by: createdBy,
      limit,
    },
  });

  dashboardCache = response.data;
  dashboardCacheAt = Date.now();
  return response.data;
};

export const getCustomerDashboard = async ({ createdBy = 1, limit = 5, forceRefresh = false } = {}) => {
  if (!forceRefresh && isDashboardCacheFresh()) {
    return dashboardCache;
  }

  if (!forceRefresh && dashboardInFlight) {
    return dashboardInFlight;
  }

  dashboardInFlight = fetchCustomerDashboard({ createdBy, limit }).finally(() => {
    dashboardInFlight = null;
  });

  return dashboardInFlight;
};

export const getCustomerTickets = async ({ createdBy = 1, limit = 20, forceRefresh = false } = {}) => {
  const data = await getCustomerDashboard({ createdBy, limit, forceRefresh });
  return (data?.recent_tickets || []).map(normalizeCustomerTicket);
};

export const clearCustomerDashboardCache = () => {
  dashboardCache = null;
  dashboardCacheAt = 0;
  dashboardInFlight = null;
};

const fetchCSDashboard = async ({ limit = 10 } = {}) => {
  const response = await ticketClient.get('/cs-dashboard', {
    params: { limit },
  });

  csDashboardCache = response.data;
  csDashboardCacheAt = Date.now();
  return response.data;
};

const fetchIncomingTickets = async ({ limit = 50, page = 1 } = {}) => {
  const response = await ticketClient.get('/cs-incoming', {
    params: { limit, page },
  });
  const data = response.data?.incoming_tickets ?? [];
  const pagination = response.data?.pagination ?? null;
  incomingTicketsCache = { list: data, pagination };
  incomingTicketsCacheAt = Date.now();
  return { list: data, pagination };
};

export const getCSIncomingTickets = async ({ limit = 50, page = 1, paginate = false, forceRefresh = false } = {}) => {
  let result = { list: [], pagination: null };
  try {
    if (!forceRefresh && incomingTicketsCache && (Date.now() - incomingTicketsCacheAt) < INCOMING_TICKETS_CACHE_TTL_MS) {
      result = incomingTicketsCache;
    } else if (!forceRefresh && incomingTicketsInFlight) {
      result = await incomingTicketsInFlight;
    } else {
      incomingTicketsInFlight = fetchIncomingTickets({ limit, page }).finally(() => {
        incomingTicketsInFlight = null;
      });
      result = await incomingTicketsInFlight;
    }
  } catch (e) {
    console.warn("Failed to fetch incoming tickets from service, using dummy data fallback:", e);
    const dummyTickets = [
      {
        isMock: true,
        id: 'TKT-2001',
        title: 'Ventilator Pressure Alarm Fault',
        customer: "St. Luke's Medical Center",
        equipment: 'PB980 Ventilator - SN-883921',
        category: 'Ventilator',
        sla: 'On Track',
        date: '2026-05-26',
        status: 'New',
        priority: 'Critical',
        department: 'Biomedical',
        reassignmentRequested: false,
        reassignmentRequestedBy: null,
        reassignmentReason: null,
        assigned: [],
      },
      {
        isMock: true,
        id: 'TKT-2002',
        title: 'MRI Scanner Image Artifacts',
        customer: 'Philippine General Hospital',
        equipment: 'Signa 1.5T MRI - SN-992100',
        category: 'MRI',
        sla: 'Near Breach',
        date: '2026-05-25',
        status: 'Pending',
        priority: 'High',
        department: 'Radiology',
        reassignmentRequested: true,
        reassignmentRequestedBy: 42,
        reassignmentReason: 'Need specialist with MRI certification',
        assigned: [],
      },
    ];
    if (paginate) {
      return { tickets: dummyTickets, pagination: { total: 2, per_page: limit, current_page: 1, last_page: 1 } };
    }
    return dummyTickets;
  }

  const rawList = Array.isArray(result) ? result : (result?.list ?? []);
  const pagination = Array.isArray(result) ? null : (result?.pagination ?? null);

  const overrides = getEmployeeOverrides();
  const list = rawList.map((t) => {
    const { status: _overrideStatus, ...overrideFields } = overrides[t.id] || {};

    return {
      ...t,
      ...overrideFields,
    };
  });

  if (paginate) {
    return { tickets: list, pagination };
  }
  return list;
};

export const clearIncomingTicketsCache = () => {
  incomingTicketsCache = null;
  incomingTicketsCacheAt = 0;
  incomingTicketsInFlight = null;
};

const getDeptKey = (dept) => dept || '_all_';

const fetchAssignableEmployees = async ({ department } = {}) => {
  const key = getDeptKey(department);
  const response = await axiosInstance.get('/employee-statuses', {
    params: department ? { department } : {},
  });
  const data = response.data?.employees ?? [];
  employeesCache[key] = data;
  employeesCacheAt[key] = Date.now();
  return data;
};

export const getAssignableEmployees = async ({ department, forceRefresh = false } = {}) => {
  const key = getDeptKey(department);
  if (!forceRefresh && employeesCache[key] && (Date.now() - employeesCacheAt[key]) < EMPLOYEES_CACHE_TTL_MS) {
    return employeesCache[key];
  }

  if (!forceRefresh && employeesInFlight[key]) {
    return employeesInFlight[key];
  }

  const promise = fetchAssignableEmployees({ department }).finally(() => {
    delete employeesInFlight[key];
  });
  employeesInFlight[key] = promise;

  return promise;
};

export const clearAssignableEmployeesCache = () => {
  employeesCache = {};
  employeesCacheAt = {};
  employeesInFlight = {};
};

const fetchDepartments = async () => {
  const response = await ticketClient.get('/departments');
  const data = response.data?.departments ?? [];
  departmentsCache = data;
  departmentsCacheAt = Date.now();
  return data;
};

export const getDepartments = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && departmentsCache && (Date.now() - departmentsCacheAt) < DEPARTMENTS_CACHE_TTL_MS) {
    return departmentsCache;
  }

  if (!forceRefresh && departmentsInFlight) {
    return departmentsInFlight;
  }

  departmentsInFlight = fetchDepartments().finally(() => {
    departmentsInFlight = null;
  });

  return departmentsInFlight;
};

export const clearDepartmentsCache = () => {
  departmentsCache = null;
  departmentsCacheAt = 0;
  departmentsInFlight = null;
};

export const assignTicketToEmployees = async ({ ticketId, employeeIds, assignedByEmail, priorityId } = {}) => {
  const response = await ticketClient.post(`/tickets/${ticketId}/assign`, {
    employee_ids: employeeIds,
    assigned_by_email: assignedByEmail,
    priority_ID: priorityId,
  });
  clearCSDashboardCache();
  notifyCsTicketRefresh();
  return response.data;
};

export const acceptTicket = async ({ ticketId, employeeIds, assignedByEmail, priorityId } = {}) => {
  const response = await ticketClient.patch(`/tickets/${ticketId}/accept`, {
    employee_ids: employeeIds,
    assigned_by_email: assignedByEmail,
    priority_ID: priorityId,
  });
  // The save changes the ticket row, assignment rows, and audit log entries.
  clearIncomingTicketsCache();
  clearCSDashboardCache();
  clearEmployeeTicketsCache();
  notifyCsTicketRefresh();
  return response.data;
};

export const updateTicket = async ({ ticketId, statusId, priorityId, assignedByEmail, proof_rejected, rejection_reason, title, description, machine_ID, problem_category_ID } = {}) => {
  const payload = {};
  if (statusId !== undefined) payload.ticket_status_ID = statusId;
  if (priorityId !== undefined) payload.priority_ID = priorityId;
  if (assignedByEmail !== undefined) payload.assigned_by_email = assignedByEmail;
  if (proof_rejected !== undefined) payload.proof_rejected = proof_rejected;
  if (rejection_reason !== undefined) payload.rejection_reason = rejection_reason;
  if (title !== undefined) payload.title = title;
  if (description !== undefined) payload.description = description;
  if (machine_ID !== undefined) payload.machine_ID = machine_ID;
  if (problem_category_ID !== undefined) payload.problem_category_ID = problem_category_ID;

  const response = await ticketClient.patch(`/tickets/${ticketId}`, payload);
  // Clear both incoming and dashboard caches since status change affects both
  clearIncomingTicketsCache();
  clearCSDashboardCache();
  clearEmployeeTicketsCache();
  notifyCsTicketRefresh();
  return response.data;
};

const fetchEmployeeAssignedTickets = async ({ employeeEmail }) => {
  const dummyTickets = [
    {
      isMock: true,
      id: 'TKT-9001',
      title: 'Patient Monitor Connection Drop',
      customer: "St. Luke's Medical Center",
      facility: 'Global City - ICU Room 402',
      equipment: 'PB980 Ventilator - SN-883921',
      status: 'In Progress',
      priority: 'Critical',
      category: 'Ventilator',
      date: '2026-05-26',
      slaStatus: 'Near Breach',
      lastUpdate: 'May 26, 2026',
      accepted: true,
      escalated: true,
    },
    {
      isMock: true,
      id: 'TKT-9002',
      title: 'MRI Scanner Image Artifacts',
      customer: 'Philippine General Hospital',
      facility: 'Taft Ave - Radiology Room B',
      equipment: 'Signa 1.5T MRI - SN-992100',
      status: 'Open',
      priority: 'High',
      category: 'MRI',
      date: '2026-05-25',
      slaStatus: 'On Track',
      lastUpdate: 'May 25, 2026',
      accepted: false,
      escalated: false,
    },
    {
      isMock: true,
      id: 'TKT-9003',
      title: 'Ventilator Pressure Alarm Fault',
      customer: 'Makati Medical Center',
      facility: 'Makati - ER Room 1',
      equipment: 'PB980 Ventilator - SN-774211',
      status: 'Escalated',
      priority: 'Critical',
      category: 'Ventilator',
      date: '2026-05-26',
      slaStatus: 'Breached',
      lastUpdate: 'May 26, 2026',
      accepted: true,
      escalated: true,
    }
  ];

  try {
    const response = await ticketClient.get('/employee-tickets', {
      params: {
        employee_email: employeeEmail,
      },
    });
    const tickets = response.data?.tickets ?? [];

    const overrides = getEmployeeOverrides();
    return tickets.map((t) => {
      const { status: _overrideStatus, ...overrideFields } = overrides[t.id] || {};

      return {
        ...t,
        ...overrideFields,
      };
    });
  } catch (error) {
    console.warn('Failed to fetch from ticket-service, using dummy data fallback:', error);
    const overrides = getEmployeeOverrides();
    return dummyTickets.map((t) => {
      const { status: _overrideStatus, ...overrideFields } = overrides[t.id] || {};

      return {
        ...t,
        ...overrideFields,
      };
    });
  }
};

export const getEmployeeAssignedTickets = async ({ employeeEmail, forceRefresh = false } = {}) => {
  const emailKey = employeeEmail || 'default';

  if (!forceRefresh && employeeTicketsCache[emailKey] && (Date.now() - employeeTicketsCacheAt[emailKey]) < EMPLOYEE_TICKETS_CACHE_TTL_MS) {
    return employeeTicketsCache[emailKey];
  }

  if (!forceRefresh && employeeTicketsInFlight[emailKey]) {
    return employeeTicketsInFlight[emailKey];
  }

  employeeTicketsInFlight[emailKey] = fetchEmployeeAssignedTickets({ employeeEmail }).then((data) => {
    employeeTicketsCache[emailKey] = data;
    employeeTicketsCacheAt[emailKey] = Date.now();
    return data;
  }).finally(() => {
    employeeTicketsInFlight[emailKey] = null;
  });

  return employeeTicketsInFlight[emailKey];
};

export const getCSDashboard = async ({ limit = 10, forceRefresh = false } = {}) => {
  if (!forceRefresh && csDashboardCache && (Date.now() - csDashboardCacheAt) < CS_DASHBOARD_CACHE_TTL_MS) {
    return csDashboardCache;
  }

  if (!forceRefresh && csDashboardInFlight) {
    return csDashboardInFlight;
  }

  csDashboardInFlight = fetchCSDashboard({ limit }).finally(() => {
    csDashboardInFlight = null;
  });

  return csDashboardInFlight;
};

export const clearCSDashboardCache = () => {
  csDashboardCache = null;
  csDashboardCacheAt = 0;
  csDashboardInFlight = null;
};

export const createTicket = async (payload) => {
  const hasFiles = payload instanceof FormData || Boolean(payload?.attachments?.length) || Boolean(payload?.file);

  if (hasFiles) {
    const formData = payload instanceof FormData ? payload : new FormData();

    if (!(payload instanceof FormData)) {
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'attachments' && Array.isArray(value)) {
          value.forEach((file) => formData.append('attachments[]', file));
          return;
        }

        if (key === 'file' && value) {
          formData.append('attachments[]', value);
          return;
        }

        if (value !== null && value !== undefined && value !== '') {
          formData.append(key, value);
        }
      });
    }

    const response = await ticketClient.post('/tickets', formData, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data',
      },
    });

    clearCustomerDashboardCache();
    clearCSDashboardCache();
    notifyCsTicketRefresh();
    if (response.data?.dashboard_ticket) {
      saveCustomerTicketDetail({
        ...response.data.dashboard_ticket,
        ticket_ID: response.data.ticket?.ticket_ID,
        description: response.data.ticket?.description,
        date_created: response.data.ticket?.created_at,
        last_updated: response.data.ticket?.updated_at,
      });
    }
    return response.data;
  }

  const response = await ticketClient.post('/tickets', payload);
  clearCustomerDashboardCache();
  clearCSDashboardCache();
  notifyCsTicketRefresh();
  if (response.data?.dashboard_ticket) {
    saveCustomerTicketDetail({
      ...response.data.dashboard_ticket,
      ticket_ID: response.data.ticket?.ticket_ID,
      description: response.data.ticket?.description,
      date_created: response.data.ticket?.created_at,
      last_updated: response.data.ticket?.updated_at,
    });
  }
  return response.data;
};

export const createInternalTicket = async (payload) => {
  const hasFiles = payload instanceof FormData || Boolean(payload?.attachments?.length) || Boolean(payload?.file);

  if (hasFiles) {
    const formData = payload instanceof FormData ? payload : new FormData();

    if (!(payload instanceof FormData)) {
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'attachments' && Array.isArray(value)) {
          value.forEach((file) => formData.append('attachments[]', file));
          return;
        }

        if (key === 'file' && value) {
          formData.append('attachments[]', value);
          return;
        }

        if (value !== null && value !== undefined && value !== '') {
          formData.append(key, value);
        }
      });
    }

    const response = await ticketClient.post('/tickets/internal', formData, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data',
      },
    });

    clearIncomingTicketsCache();
    clearCSDashboardCache();
    clearEmployeeTicketsCache();
    notifyCsTicketRefresh();
    return response.data;
  }

  const response = await ticketClient.post('/tickets/internal', payload);
  clearIncomingTicketsCache();
  clearCSDashboardCache();
  clearEmployeeTicketsCache();
  notifyCsTicketRefresh();
  return response.data;
};
/**
 * Fetch all internal tickets created by the logged-in employee from the backend.
 * Route: GET /employee/tickets/internal  (auth.subsystem required)
 */
export const getEmployeeInternalTickets = async () => {
  const response = await ticketClient.get('/employee/tickets/internal');
  return response.data; // { tickets: [...] }
};

// Local Storage Helper functions for Employee Actions
const EMPLOYEE_OVERRIDE_KEY = 'employee_ticket_overrides_v1';

export const getEmployeeOverrides = () => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(EMPLOYEE_OVERRIDE_KEY) || '{}');
  } catch {
    return {};
  }
};

export const updateEmployeeTicketOverride = (ticketId, override) => {
  if (typeof window === 'undefined') return;
  try {
    const all = getEmployeeOverrides();
    const existing = all[ticketId] || {};

    // Merge internal notes
    let mergedNotes = existing.internalNotes || [];
    if (override.internalNotes) {
      mergedNotes = [...mergedNotes, ...override.internalNotes];
    }

    // Merge timeline
    let mergedTimeline = existing.timeline || [];
    if (override.timeline) {
      mergedTimeline = [...mergedTimeline, ...override.timeline];
    }

    all[ticketId] = {
      ...existing,
      ...override,
      internalNotes: mergedNotes,
      timeline: mergedTimeline,
    };

    window.localStorage.setItem(EMPLOYEE_OVERRIDE_KEY, JSON.stringify(all));
    notifyCsTicketRefresh();
  } catch (err) {
    console.error('Failed to update employee override:', err);
  }
};

export const requestReassignment = async ({ ticketId, reason }) => {
  const response = await ticketClient.post(`/tickets/${ticketId}/reassign-request`, {
    reason,
  });
  clearEmployeeTicketsCache();
  clearIncomingTicketsCache();
  clearCSDashboardCache();
  notifyCsTicketRefresh();
  return response.data;
};

export const respondReassignment = async ({ ticketId, action, newEmployeeId, reason }) => {
  const body = { action };
  if (newEmployeeId !== undefined) body.new_employee_id = newEmployeeId;
  if (reason !== undefined) body.reason = reason;
  const response = await ticketClient.post(`/tickets/${ticketId}/reassign-respond`, body);
  clearEmployeeTicketsCache();
  clearIncomingTicketsCache();
  clearCSDashboardCache();
  notifyCsTicketRefresh();
  return response.data;
};

export const getReassignmentRequests = async (params = {}) => {
  const response = await ticketClient.get('/reassignment-requests', {
    params,
  });
  return response.data?.requests ?? [];
};

export const getTicketDetails = async (ticketId) => {
  const response = await ticketClient.get(`/tickets/${ticketId}`);
  return response.data;
};

export const updateEmployeeTicket = async (ticketId, formData) => {
  const response = await ticketClient.post(`/tickets/${ticketId}/employee-update`, formData, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'multipart/form-data',
    },
  });
  clearEmployeeTicketsCache();
  clearIncomingTicketsCache();
  clearCSDashboardCache();
  notifyCsTicketRefresh();
  return response.data;
};



export const getInternalTickets = async () => {
  const response = await ticketClient.get('/employee/tickets/internal');
  return response.data?.tickets ?? [];
};

export const getEmployeeProfile = async () => {
  const response = await ticketClient.get('/employee/profile');
  return response.data;
};

export const getNotifications = async () => {
  const response = await ticketClient.get('/notifications');
  return response.data;
};

export const markNotificationsRead = async () => {
  const response = await ticketClient.patch('/notifications/read-all');
  return response.data;
};

export const markNotificationRead = async (id) => {
  const response = await ticketClient.patch(`/notifications/${id}/read`);
  return response.data;
};

export const getSuperAdminConfig = async () => {
  const response = await ticketClient.get('/superadmin/config');
  return response.data;
};

export const createSuperAdminEquipment = async (payload) => {
  const response = await ticketClient.post('/superadmin/equipment', payload);
  return response.data;
};

export const updateSuperAdminEquipment = async (id, payload) => {
  const response = await ticketClient.put(`/superadmin/equipment/${id}`, payload);
  return response.data;
};

export const deleteSuperAdminEquipment = async (id) => {
  const response = await ticketClient.delete(`/superadmin/equipment/${id}`);
  return response.data;
};

export const createSuperAdminPriority = async (payload) => {
  const response = await ticketClient.post('/superadmin/priority', payload);
  return response.data;
};

export const updateSuperAdminPriority = async (id, payload) => {
  const response = await ticketClient.put(`/superadmin/priority/${id}`, payload);
  return response.data;
};

export const deleteSuperAdminPriority = async (id) => {
  const response = await ticketClient.delete(`/superadmin/priority/${id}`);
  return response.data;
};

export const getSuperAdminAuditLogs = async () => {
  const response = await ticketClient.get('/superadmin/audit-logs');
  return response.data;
};

export const getSuperAdminHistory = async () => {
  const response = await ticketClient.get('/superadmin/history');
  return response.data;
};