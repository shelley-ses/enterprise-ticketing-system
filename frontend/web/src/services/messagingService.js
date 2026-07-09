import axios from 'axios';
import tokenStore from '@/auth/tokenStore';
import { refreshAccessToken } from '@/auth/refreshSession';

const messagingClient = axios.create({
  baseURL: '/api/ticketing/messaging',
  withCredentials: false,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

messagingClient.interceptors.request.use((config) => {
  const token = tokenStore.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

messagingClient.interceptors.response.use(
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
        return messagingClient(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);

export const getTicketMessages = async (ticketId) => {
  const response = await messagingClient.get(`/tickets/${ticketId}/messages`);
  const messages = response.data?.messages ?? [];
  return messages.map(msg => ({
    ...msg,
    id: msg.id || msg._id,
    _id: msg.id || msg._id
  }));
};

export const sendTicketMessage = async (ticketId, messageText) => {
  const response = await messagingClient.post(`/tickets/${ticketId}/messages`, {
    message: messageText,
  });
  const data = response.data?.data;
  if (data) {
    data.id = data.id || data._id;
    data._id = data.id || data._id;
  }
  return data;
};

export const editTicketMessage = async (ticketId, messageId, messageText) => {
  const response = await messagingClient.put(`/tickets/${ticketId}/messages/${messageId}`, {
    message: messageText,
  });
  const data = response.data?.data;
  if (data) {
    data.id = data.id || data._id;
    data._id = data.id || data._id;
  }
  return data;
};

export const deleteTicketMessage = async (ticketId, messageId) => {
  const response = await messagingClient.delete(`/tickets/${ticketId}/messages/${messageId}`);
  return response.data;
};
