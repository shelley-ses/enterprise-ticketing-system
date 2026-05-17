import axios from 'axios';
import { API_BASE_URL, AUTH_ENDPOINTS } from '@/config/api.config';
import tokenStore from '@/auth/tokenStore';

/**
  - CSRF token injection for stateful requests
  - Bearer token injection for token-based requests
  - Credentials (cookies) for cross-origin requests
  - Error handling and token refresh
 */
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // for refresh tokens (httpOnly cookies)
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: {
    'X-Requested-With': 'XMLHttpRequest', 
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

const AUTH_PATH_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/forgot-password/verify',
  '/reset-password',
  '/sanctum/csrf-cookie',
  AUTH_ENDPOINTS.REFRESH_TOKEN,
];

const isAuthEndpoint = (url = '') => AUTH_PATH_PREFIXES.some((path) => url.includes(path));

// Attach token to every request

axiosInstance.interceptors.request.use(
  (config) => {
    const token = tokenStore.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Global Error

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url ?? '';

    if (error.response?.status === 403) {
      console.error('Access forbidden:', error.response.data);
    }

    if (error.response?.status === 429) {
      const retryAfter = error.response.headers?.['retry-after'];
      console.warn('Too many requests, retry after:', retryAfter);
      error.isTooManyRequests = true;
      error.retryAfter = retryAfter;
      return Promise.reject(error);
    }

    if (error.response?.status === 422) {
      console.error('Validation errors:', error.response.data.errors);
    }

    // Auto refresh token system
    if (
      error.response?.status === 401 &&
      !isAuthEndpoint(requestUrl) &&
      originalRequest &&
      !originalRequest._retry
    ) {

      // Retry original request
      originalRequest._retry = true;
      try {
        const refreshResp = await axiosInstance.post(
          AUTH_ENDPOINTS.REFRESH_TOKEN,
          {},
          { withCredentials: true }
        );
        const newToken = refreshResp.data?.token;
        if (newToken) {
          tokenStore.setToken(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        }
      } catch {
        // fall through to clear auth
      }

      tokenStore.clearToken();
      localStorage.removeItem('user');
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
