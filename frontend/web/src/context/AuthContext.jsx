import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosInstance from '@/api/axiosInstance';
import { AUTH_ENDPOINTS, SANCTUM_URL } from '@/config/api.config';
import tokenStore from '@/auth/tokenStore';

// GLOBAL AUTHENTICATION

const AuthContext = createContext({
  user: null,
  setUser: () => {},
  isAuthenticated: false,
  setIsAuthenticated: () => {},
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
const MOCK_AUTH_ENABLED = import.meta.env.VITE_MOCK_AUTH === 'true';
const MOCK_TOKEN = 'frontend-dev-token';

const getMockUser = (email = 'frontend@example.com', mode = 'customer') => {
  if (mode === 'employee') {
    return {
      id: 2,
      emp_id: 2,
      first_name: 'Frontend',
      last_name: 'Employee',
      name: 'Frontend Employee',
      email,
      role: 'employee',
    };
  }

  return {
    id: 1,
    first_name: 'Frontend',
    last_name: 'Customer',
    name: 'Frontend Customer',
    email,
    role: 'customer',
  };
};

const normalizeUser = (userData) => {
  if (!userData) return null;
  return {
    ...userData,
    role: userData.role || 'customer',
  };
};

const readStoredUser = () => {
  try {
    return normalizeUser(JSON.parse(localStorage.getItem('user')));
  } catch {
    return null;
  }
};

const ensureCsrfCookie = async () => {
  // Passport (customer portal) uses Bearer tokens 
  if (import.meta.env.VITE_APP_MODE === 'customer') return;

  const hasXsrfCookie = document.cookie.split('; ').some((cookie) => cookie.startsWith('XSRF-TOKEN='));
  if (hasXsrfCookie) {
    return;
  }

  await axiosInstance.get(`${SANCTUM_URL}${AUTH_ENDPOINTS.CSRF_TOKEN}`, {
    withCredentials: true,
    withXSRFToken: true,
  });
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
    return undefined;
  }, []);

  // Verify existing token
  const revalidateSession = useCallback(async () => {
    if (MOCK_AUTH_ENABLED) {
      const token = tokenStore.getToken();
      const storedUser = readStoredUser();

      if (token && storedUser) {
        setUser(normalizeUser(storedUser));
        setIsAuthenticated(true);
        setIsFirstLogin(false);
        return true;
      }

      applyUnauthenticated(setUser, setIsAuthenticated);
      return false;
    }

    // Skip session revalidation on guest/login pages
    const pathname = window.location.pathname;
    const isLoginPage =
      pathname === '/customer' ||
      pathname.startsWith('/customer?') ||
      pathname.includes('/login');
    if (isLoginPage) {
      applyUnauthenticated(setUser, setIsAuthenticated);
      return false;
    }

    try {
      const resp = await axiosInstance.get(AUTH_ENDPOINTS.ME);
      const userData = resp.data?.user;
      const firstLogin = Boolean(resp.data?.is_first_login);
      if (userData) {
        const normalized = normalizeUser(userData);
        setUser(normalized);
        localStorage.setItem('user', JSON.stringify(normalized));
      }
      setIsAuthenticated(true);
      setIsFirstLogin(firstLogin);
      return true;
    } catch (err) {
      if (err.response?.status === 401) {
        try {
          const resp = await axiosInstance.post(AUTH_ENDPOINTS.REFRESH_TOKEN, {}, { withCredentials: true });
          const newToken = resp.data?.token;
          const userData = resp.data?.user;
          if (newToken) {
            tokenStore.setToken(newToken);
            const normalized = normalizeUser(userData);
            setUser(normalized);
            setIsAuthenticated(true);
            setIsFirstLogin(Boolean(resp.data?.is_first_login));
            if (normalized) localStorage.setItem('user', JSON.stringify(normalized));
            return true;
          }
        } catch {
          // refresh failed
        }
        applyUnauthenticated(setUser, setIsAuthenticated);
        return false;
      }

      const storedUser = readStoredUser();
      if (storedUser) {
        setUser(normalizeUser(storedUser));
        setIsAuthenticated(true);
        return true;
      }
      return false;
    }
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
    const onPageShow = () => {
      revalidateSession();
    };

    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [revalidateSession]);

  
  useEffect(() => {
    const handleUnauthorized = () => {
      applyUnauthenticated(setUser, setIsAuthenticated);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);


  // Login with email and password
  const login = useCallback(async (email, password, mode = 'customer') => {
    if (mode === 'employee') {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
      return { success: false, error: 'Redirecting to central SSO...' };
    }
    try {
      setError(null);

      if (MOCK_AUTH_ENABLED) {
        const userData = getMockUser(email, mode);

        tokenStore.setToken(MOCK_TOKEN);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        setIsAuthenticated(true);
        setIsFirstLogin(false);

        return { success: true, user: userData, isFirstLogin: false };
      }

      // For CSRF
      await ensureCsrfCookie();

      const response = await axiosInstance.post(AUTH_ENDPOINTS.LOGIN, {
        email,
        password,
        mode,
      });

      const { user: userData, token, is_first_login: firstLogin } = response.data;

      // Store auth data in memory and set user
      const normalized = normalizeUser(userData);
      tokenStore.setToken(token);
      localStorage.setItem('user', JSON.stringify(normalized));
      setUser(normalized);
      setIsAuthenticated(true);
      setIsFirstLogin(Boolean(firstLogin));

      return { success: true, user: normalized, isFirstLogin: Boolean(firstLogin) };
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

      if (MOCK_AUTH_ENABLED) {
        const newUser = {
          id: 3,
          name: userData?.name || 'Frontend Customer',
          email: userData?.email || 'frontend@example.com',
          role: 'customer',
        };

        tokenStore.setToken(MOCK_TOKEN);
        localStorage.setItem('user', JSON.stringify(newUser));
        setUser(newUser);
        setIsAuthenticated(true);
        setIsFirstLogin(false);

        return { success: true, user: newUser };
      }

      // CSRF
      await ensureCsrfCookie();

      const response = await axiosInstance.post(AUTH_ENDPOINTS.REGISTER, userData);

      const { user: newUser, token } = response.data;

      const normalized = normalizeUser(newUser);
      tokenStore.setToken(token);
      localStorage.setItem('user', JSON.stringify(normalized));

      setUser(normalized);
      setIsAuthenticated(true);

      return { success: true, user: normalized };
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

    if (MOCK_AUTH_ENABLED) {
      localStorage.removeItem('user');
      localStorage.removeItem(LOCKOUT_STORAGE_KEY);
      tokenStore.clearToken();

      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      setIsFirstLogin(false);
      setIsLoading(false);

      return { success: true };
    }

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

      if (MOCK_AUTH_ENABLED) {
        const updatedUser = {
          ...(readStoredUser() || getMockUser()),
          ...userData,
        };

        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);

        return { success: true, user: updatedUser };
      }

      const response = await axiosInstance.put('/profile', userData);

      const updatedUser = response.data.user;
      const normalized = normalizeUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(normalized));
      setUser(normalized);

      return { success: true, user: normalized };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to update profile';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Heartbeat loop for employees
  useEffect(() => {
    if (!isAuthenticated || !user || user.role === 'customer' || user.role === 'customer service') {
      return undefined;
    }

    const sendHeartbeat = async () => {
      try {
        await axiosInstance.post('/heartbeat');
      } catch (err) {
        console.warn('Failed to send heartbeat presence ping:', err);
      }
    };

    // Send immediate heartbeat on login/mount
    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  const value = {
    user,
    setUser,
    isAuthenticated,
    setIsAuthenticated,
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
