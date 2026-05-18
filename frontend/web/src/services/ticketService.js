import axios from 'axios';
import { TICKET_API_URL } from '@/config/api.config';

const ticketClient = axios.create({
  baseURL: TICKET_API_URL,
  withCredentials: false,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

let optionsCache = null;
let optionsCacheAt = 0;
let optionsInFlight = null;
const OPTIONS_CACHE_TTL_MS = 5 * 60 * 1000;

let dashboardCache = null;
let dashboardCacheAt = 0;
let dashboardInFlight = null;
const DASHBOARD_CACHE_TTL_MS = 30 * 1000;

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
    return response.data;
  }

  const response = await ticketClient.post('/tickets', payload);
  clearCustomerDashboardCache();
  return response.data;
};