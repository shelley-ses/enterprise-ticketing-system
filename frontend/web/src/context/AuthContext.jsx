import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosInstance from '@/api/axiosInstance';
import { AUTH_ENDPOINTS, SANCTUM_URL } from '@/config/api.config';
import tokenStore from '@/auth/tokenStore';

// GLOBAL AUTHENTICATION

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  isFirstLogin: false,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => ({ success: true }),
  updateProfile: async () => ({ success: false }),
  clearError: () => {},
  revalidateSession: async () => false,
});
const LOCKOUT_STORAGE_KEY = 'login_lockout_until';

const hasCookie = (name) => document.cookie.split('; ').some((cookie) => cookie.startsWith(`${name}=`));

const canRefreshSession = () => hasCookie('refresh_token');

const ensureCsrfCookie = async () => {
  if (hasCookie('XSRF-TOKEN')) {
    return;
  }

  await axiosInstance.get(`${SANCTUM_URL}${AUTH_ENDPOINTS.CSRF_TOKEN}`);
};

//logout cleanup 
const applyUnauthenticated = (setUser, setIsAuthenticated) => {
  tokenStore.clearToken();
  localStorage.removeItem('user');
  setUser(null);
  setIsAuthenticated(false);
};


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  useEffect(() => {
    const trapBrowserHistory = () => {
      window.history.pushState(null, '', window.location.href);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', trapBrowserHistory);

    return () => {
      window.removeEventListener('popstate', trapBrowserHistory);
    };
  }, []);

  // Verify existing token
  const revalidateSession = useCallback(async () => {
    if (window.location.pathname.startsWith('/login')) {
      applyUnauthenticated(setUser, setIsAuthenticated);
      return false;
    }

    if (tokenStore.getToken()) {
      try {
        const resp = await axiosInstance.get(AUTH_ENDPOINTS.ME);
        const userData = resp.data?.user;
        const firstLogin = Boolean(resp.data?.is_first_login);
        if (userData) {
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        }
        setIsAuthenticated(true);
        setIsFirstLogin(firstLogin);
        return true;
      } catch {
        applyUnauthenticated(setUser, setIsAuthenticated);
        return false;
      }
    }

    if (!canRefreshSession()) {
      applyUnauthenticated(setUser, setIsAuthenticated);
      return false;
    }

    try {
      const resp = await axiosInstance.post(AUTH_ENDPOINTS.REFRESH_TOKEN, {}, { withCredentials: true });
      const newToken = resp.data?.token;
      const userData = resp.data?.user;
      if (newToken) {
        tokenStore.setToken(newToken);
        setUser(userData || null);
        setIsAuthenticated(true);
        setIsFirstLogin(Boolean(resp.data?.is_first_login));
        if (userData) localStorage.setItem('user', JSON.stringify(userData));
        return true;
      }
    } catch {
      // no valid refresh
    }

    applyUnauthenticated(setUser, setIsAuthenticated);
    return false;
  }, []);

  // For refresh token
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        await revalidateSession();
      } catch (err) {
        console.error('Auth initialization error:', err);
        applyUnauthenticated(setUser, setIsAuthenticated);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [revalidateSession]);

  // For browser back and next

  useEffect(() => {
    const syncAuthWithSession = () => {
      if (!tokenStore.getToken()) {
        setIsAuthenticated((prev) => {
          if (prev) {
            setUser(null);
            localStorage.removeItem('user');
          }
          return false;
        });
      }
    };

    const onPageShow = (event) => {
      if (event.persisted) {
        revalidateSession();
      } else {
        if (canRefreshSession()) {
          revalidateSession();
        } else {
          syncAuthWithSession();
        }
      }
    };

    window.addEventListener('popstate', syncAuthWithSession);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('popstate', syncAuthWithSession);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [revalidateSession]);

  // Login with email and password
  const login = useCallback(async (email, password, mode = 'customer') => {
    try {
      setError(null);

      // For CSRF
      await ensureCsrfCookie();

      const response = await axiosInstance.post(AUTH_ENDPOINTS.LOGIN, {
        email,
        password,
        mode,
      });

      const { user: userData, token, is_first_login: firstLogin } = response.data;

      // Store auth data in memory and set user
      tokenStore.setToken(token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      setIsAuthenticated(true);
      setIsFirstLogin(Boolean(firstLogin));

      return { success: true, user: userData, isFirstLogin: Boolean(firstLogin) };
    } catch (err) {
      // IP LIMITER
      if (err.response?.status === 429) {
        const retryAfter = err.response?.headers?.['retry-after'] ?? null;
        const message = err.response?.data?.message || 'Too many requests. Please try again later.';
        setError(message);
        return { success: false, error: message, retryAfter };
      }
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
      setIsAuthenticated(false);
      return {
        success: false,
        error: errorMessage,
        remainingAttempts: err.response?.data?.remaining_attempts ?? null,
        lockedUntil: err.response?.data?.locked_until ?? null,
      };
    } finally {
      // leave app-level isLoading for global session bootstrap only
    }
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(async (userData) => {
    try {
      setError(null);

      // CSRF
      await ensureCsrfCookie();

      const response = await axiosInstance.post(AUTH_ENDPOINTS.REGISTER, userData);

      const { user: newUser, token } = response.data;

      tokenStore.setToken(token);
      localStorage.setItem('user', JSON.stringify(newUser));

      setUser(newUser);
      setIsAuthenticated(true);

      return { success: true, user: newUser };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Registration failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      // do not toggle global isLoading here; UI uses local spinners
    }
  }, []);

  //For logout
  const logout = useCallback(async () => {
    const currentToken = tokenStore.getToken();

    try {
      //logout
      await axiosInstance.post(
        AUTH_ENDPOINTS.LOGOUT,
        {},
        { withCredentials: true, headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {} }
      );
    } catch (err) {
      console.warn('Backend logout cleanup failed:', err);
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem(LOCKOUT_STORAGE_KEY);
      tokenStore.clearToken();

      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      setIsFirstLogin(false);
      setIsLoading(false);
    }

    return { success: true };
  }, []);

  // Clear error messages
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Update user profile
  const updateProfile = useCallback(async (userData) => {
    try {
      setError(null);

      const response = await axiosInstance.put('/profile', userData);

      const updatedUser = response.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      return { success: true, user: updatedUser };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to update profile';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      // profile updates use local loading indicators where needed
    }
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    isFirstLogin,
    login,
    register,
    logout,
    updateProfile,
    clearError,
    revalidateSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
