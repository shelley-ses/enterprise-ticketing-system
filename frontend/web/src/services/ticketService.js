import axios from 'axios';
import { TICKET_API_URL } from '@/config/api.config';
import tokenStore from '@/auth/tokenStore';

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

let optionsCache = null;
let optionsCacheAt = 0;
let optionsInFlight = null;
const OPTIONS_CACHE_TTL_MS = 5 * 60 * 1000;

let dashboardCache = null;
let dashboardCacheAt = 0;
let dashboardInFlight = null;
const DASHBOARD_CACHE_TTL_MS = 30 * 1000;

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

let employeesCache = null;
let employeesCacheAt = 0;
let employeesInFlight = null;
const EMPLOYEES_CACHE_TTL_MS = 5 * 60 * 1000;

let departmentsCache = null;
let departmentsCacheAt = 0;
let departmentsInFlight = null;
const DEPARTMENTS_CACHE_TTL_MS = 5 * 60 * 1000;

const isCacheFresh = () => optionsCache && (Date.now() - optionsCacheAt) < OPTIONS_CACHE_TTL_MS;
const isDashboardCacheFresh = () => dashboardCache && (Date.now() - dashboardCacheAt) < DASHBOARD_CACHE_TTL_MS;

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

const fetchIncomingTickets = async ({ limit = 50 } = {}) => {
  const response = await ticketClient.get('/cs-incoming', {
    params: { limit },
  });
  const data = response.data?.incoming_tickets ?? [];
  incomingTicketsCache = data;
  incomingTicketsCacheAt = Date.now();
  return data;
};

export const getCSIncomingTickets = async ({ limit = 50, forceRefresh = false } = {}) => {
  if (!forceRefresh && incomingTicketsCache && (Date.now() - incomingTicketsCacheAt) < INCOMING_TICKETS_CACHE_TTL_MS) {
    return incomingTicketsCache;
  }

  if (!forceRefresh && incomingTicketsInFlight) {
    return incomingTicketsInFlight;
  }

  incomingTicketsInFlight = fetchIncomingTickets({ limit }).finally(() => {
    incomingTicketsInFlight = null;
  });

  return incomingTicketsInFlight;
};

export const clearIncomingTicketsCache = () => {
  incomingTicketsCache = null;
  incomingTicketsCacheAt = 0;
  incomingTicketsInFlight = null;
};

const fetchAssignableEmployees = async ({ department } = {}) => {
  const response = await ticketClient.get('/assignable-employees', {
    params: department ? { department } : {},
  });
  const data = response.data?.employees ?? [];
  employeesCache = data;
  employeesCacheAt = Date.now();
  return data;
};

export const getAssignableEmployees = async ({ department, forceRefresh = false } = {}) => {
  if (!forceRefresh && employeesCache && (Date.now() - employeesCacheAt) < EMPLOYEES_CACHE_TTL_MS) {
    return employeesCache;
  }

  if (!forceRefresh && employeesInFlight) {
    return employeesInFlight;
  }

  employeesInFlight = fetchAssignableEmployees({ department }).finally(() => {
    employeesInFlight = null;
  });

  return employeesInFlight;
};

export const clearAssignableEmployeesCache = () => {
  employeesCache = null;
  employeesCacheAt = 0;
  employeesInFlight = null;
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
  notifyCsTicketRefresh();
  return response.data;
};

export const updateTicket = async ({ ticketId, statusId, priorityId, assignedByEmail } = {}) => {
  const response = await ticketClient.patch(`/tickets/${ticketId}`, {
    ticket_status_ID: statusId,
    priority_ID: priorityId,
    assigned_by_email: assignedByEmail,
  });
  // Clear both incoming and dashboard caches since status change affects both
  clearIncomingTicketsCache();
  clearCSDashboardCache();
  notifyCsTicketRefresh();
  return response.data;
};

export const getEmployeeAssignedTickets = async ({ employeeEmail } = {}) => {
  const response = await ticketClient.get('/employee-tickets', {
    params: {
      employee_email: employeeEmail,
    },
  });
  return response.data?.tickets ?? [];
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
    return response.data;
  }

  const response = await ticketClient.post('/tickets', payload);
  clearCustomerDashboardCache();
  clearCSDashboardCache();
  notifyCsTicketRefresh();
  return response.data;
};