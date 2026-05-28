import axios from 'axios';
import { API_BASE_URL, AUTH_ENDPOINTS } from '@/config/api.config';
import tokenStore from '@/auth/tokenStore';

let refreshInFlight = null;

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

export const refreshAccessToken = async () => {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = refreshClient
    .post(AUTH_ENDPOINTS.REFRESH_TOKEN, {})
    .then((response) => {
      const newToken = response.data?.token;
      if (newToken) {
        tokenStore.setToken(newToken);
      }
      return Boolean(newToken);
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
};
