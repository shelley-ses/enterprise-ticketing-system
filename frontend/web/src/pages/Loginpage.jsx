import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import loginImage from '@/assets/login.png';
import { Mail, Lock, Eye, EyeOff, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSystemStatus } from '@/services/configurationService';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;
const LOCKOUT_STORAGE_KEY_PREFIX = 'login_lockout_until_';

const lockKeyFor = (email) => `${LOCKOUT_STORAGE_KEY_PREFIX}${email}`;

const checkIsCS = (user) => {
  if (!user) return false;
  const dept = (user.department || user.profile?.department?.name || '').toLowerCase();
  const role = (user.role || user.profile?.role?.name || '').toLowerCase();
  
  if (dept.includes('customer service') || dept.includes('customer support') || dept === 'cs') {
    return true;
  }
  return role.includes('customer service') || role.includes('customer-service') || role === 'cs';
};

const checkIsSuperAdmin = (user) => {
  if (!user) return false;
  const role = (user.role || user.profile?.role?.name || '').toLowerCase();
  const dept = (user.department || user.profile?.department?.name || '').toLowerCase();
  return role === 'superadmin' || role === 'super admin' || dept === 'superadmin' || dept === 'super admin';
};

const checkIsAdmin = (user) => {
  if (!user) return false;
  const role = (user.role || user.profile?.role?.name || '').toLowerCase();
  const dept = (user.department || user.profile?.department?.name || '').toLowerCase();
  return role === 'admin' || role === 'it admin' || (dept === 'admin' && role !== 'superadmin' && role !== 'super admin');
};

const checkIsEmployee = (user) => {
  if (!user) return false;
  if (checkIsCS(user)) return false;
  if (checkIsAdmin(user)) return false;
  if (checkIsSuperAdmin(user)) return false;
  
  const dept = (user.department || user.profile?.department?.name || '').toLowerCase();
  const role = (user.role || user.profile?.role?.name || '').toLowerCase();
  
  if (dept === 'service' || dept.includes('engineer')) {
    return true;
  }
  return role === 'employee' || role.includes('service') || role.includes('engineer');
};

export function Loginpage({ mode = 'customer' }) {
  const navigate = useNavigate();
  const { login, clearError, isAuthenticated, user } = useAuth();
  const isEmployeeLogin = mode === 'employee';

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rate limiting state 
  const [attempts, setAttempts] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);
  const [lockTimer, setLockTimer] = useState(LOCKOUT_SECONDS);
  const [loginError, setLoginError] = useState('');
  const [lockedEmail, setLockedEmail] = useState('');

  // System maintenance status
  const [isMaintenance, setIsMaintenance] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getSystemStatus().then((status) => {
      if (isMounted && status === 'Under Maintenance') {
        setIsMaintenance(true);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Prevent browsing back to login if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const isCS = checkIsCS(user);
      const isEmployee = checkIsEmployee(user);
      const isSuperAdmin = checkIsSuperAdmin(user);
      const isAdmin = checkIsAdmin(user);
      const isCustomerSite = import.meta.env.VITE_APP_MODE === 'customer';

      if (isSuperAdmin) {
        navigate('/superadmin/ticket-config', { replace: true });
      } else if (isAdmin) {
        navigate('/admin/dashboard', { replace: true });
      } else if (isCustomerSite) {
        if (isCS) {
          window.location.replace('/ticketing/cs/dashboard');
        } else if (isEmployee) {
          window.location.replace('/ticketing/employee/dashboard');
        } else {
          navigate('/customer-dashboard', { replace: true });
        }
      } else {
        if (isCS) {
          navigate('/cs/dashboard', { replace: true });
        } else if (isEmployee) {
          navigate('/employee/dashboard', { replace: true });
        } else {
          navigate('/customer-dashboard', { replace: true });
        }
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Lockout per-email handling
  useEffect(() => {
    const checkLockForEmail = () => {
      if (!email) return;
      const saved = Number(localStorage.getItem(lockKeyFor(email)) || 0);
      const now = Date.now();
      if (saved > now) {
        setLockedOut(true);
        setLockedEmail(email);
        setLockTimer(Math.max(1, Math.ceil((saved - now) / 1000)));
      } else {
        localStorage.removeItem(lockKeyFor(email));
        if (lockedEmail === email) {
          setLockedOut(false);
          setLockedEmail('');
          setLockTimer(LOCKOUT_SECONDS);
          setLoginError('');
        }
      }
    };

    checkLockForEmail();
    if (!lockedOut) return;
    if (lockTimer <= 0) {
      setLockedOut(false);
      setAttempts(0);
      setLockTimer(LOCKOUT_SECONDS);
      setLoginError('');
      localStorage.removeItem(lockKeyFor(lockedEmail));
      setLockedEmail('');
      return;
    }
    const t = setTimeout(() => setLockTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [email, lockedOut, lockTimer, lockedEmail]);

  const formatLock = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (lockedOut || isSubmitting) return;

    setLoginError('');
    clearError();
    setIsSubmitting(true);

    try {
      const result = await login(email, password, mode);

      if (result.success) {
        setLoginError('');
        setAttempts(0);

        const isCS = checkIsCS(result.user);
        const isEmployee = checkIsEmployee(result.user);
        const isSuperAdmin = checkIsSuperAdmin(result.user);
        const isAdmin = checkIsAdmin(result.user);
        const isCustomerSite = import.meta.env.VITE_APP_MODE === 'customer';

        if (isSuperAdmin) {
          navigate('/superadmin/ticket-config', { replace: true });
        } else if (isAdmin) {
          navigate('/admin/dashboard', { replace: true });
        } else if (isCustomerSite) {
          if (isCS) {
            window.location.replace('/ticketing/cs/dashboard');
          } else if (isEmployee) {
            window.location.replace('/ticketing/employee/dashboard');
          } else {
            navigate('/customer-dashboard', { replace: true });
          }
        } else {
          if (isCS) {
            navigate('/cs/dashboard', { replace: true });
          } else if (isEmployee) {
            navigate('/employee/dashboard', { replace: true });
          } else {
            navigate('/customer-dashboard', { replace: true });
          }
        }
      } else {
        if (result.retryAfter) {
          const seconds = Number(result.retryAfter);
          if (!Number.isNaN(seconds) && seconds > 0) {
            setLockedOut(true);
            const lockUntilMs = Date.now() + seconds * 1000;
            localStorage.setItem(lockKeyFor(email), String(lockUntilMs));
            setLockTimer(seconds);
            setLoginError(`${result.error} Try again in ${formatLock(seconds)}`);
          } else {
            setLoginError(result.error);
          }
          setIsSubmitting(false);
          return;
        }

        const remainingAttempts = result.remainingAttempts ?? Math.max(0, MAX_ATTEMPTS - (attempts + 1));
        setAttempts(MAX_ATTEMPTS - remainingAttempts);

        if (result.lockedUntil || remainingAttempts === 0) {
          setLockedOut(true);
          const lockUntilMs = Date.now() + LOCKOUT_SECONDS * 1000;
          localStorage.setItem(lockKeyFor(email), String(lockUntilMs));
          setLockedEmail(email);
          setLockTimer(LOCKOUT_SECONDS);
          setLoginError(`Account temporarily locked. Please wait ${LOCKOUT_SECONDS} seconds.`);
        } else {
          setLoginError(
            result.lockedUntil
              ? `${result.error} Account is locked temporarily.`
              : `${result.error} ${remainingAttempts} attempt(s) remaining.`
          );
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full font-sans bg-[#F8F9FA]">
      {/* LEFT SIDE BRAND IMAGE */}
      <div className="relative hidden lg:block lg:w-1/2 overflow-hidden bg-primary">
        <img
          src={loginImage}
          alt="Scientific Biotech Specialties"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#252578]/70 backdrop-blur-[1px]" />
        <div className="absolute bottom-16 left-12 text-white max-w-lg space-y-3">
          <div className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold tracking-wider uppercase mb-2">
            Ticketing System
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight">
            25 Years of Innovating Diagnostics Solutions
          </h1>
          <p className="text-sm text-white/80 font-normal">
            Scientific Biotech Specialties, Inc. — ISO 9001:2015 Certified
          </p>
        </div>
      </div>

      {/* RIGHT SIDE AUTH FORM */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-primary tracking-tight">
              {isEmployeeLogin ? 'Employee Portal' : 'Welcome Back'}
            </h2>
            <p className="text-sm text-muted-slate mt-1">
              {isEmployeeLogin
                ? 'Sign in to access your technical queues and tickets'
                : 'Sign in to the Ticketing System to manage support requests'}
            </p>
          </div>

          {/* Maintenance advisory */}
          {isMaintenance && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 font-medium flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>System Notice: Platform is currently in Maintenance Mode. Non-admin logins may be restricted.</span>
            </div>
          )}

          {/* Lockout banner */}
          {lockedOut && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-xs text-destructive font-medium flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Too many failed attempts. Try again in {formatLock(lockTimer)}.</span>
            </div>
          )}

          {/* Inline error */}
          {loginError && !lockedOut && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-destructive font-medium flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-slate" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="name@company.com"
                  className="pl-10 h-11"
                  value={email}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEmail(v);
                    if (lockedOut && lockedEmail && v !== lockedEmail) {
                      setLockedOut(false);
                      setLockedEmail('');
                      setLoginError('');
                    }
                  }}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-slate" />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  className="pl-10 pr-10 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-slate hover:text-dark-slate transition-colors"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Toggle password visibility"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              id="login-submit"
              type="submit"
              variant="default"
              className="w-full h-11 text-base font-semibold mt-2"
              disabled={(lockedOut && lockedEmail === email) || isSubmitting}
              loading={isSubmitting}
            >
              Sign In
            </Button>
          </form>

          {isEmployeeLogin ? (
            <div className="text-center pt-2">
              <a
                href="/"
                className="text-xs text-accent hover:underline font-medium"
              >
                Back to Central Portal
              </a>
            </div>
          ) : (
            <div className="text-center pt-2">
              <span className="text-xs text-muted-slate">Need technical assistance? </span>
              <a
                href="/login/employee"
                className="text-xs text-accent hover:underline font-semibold"
              >
                Employee Sign In
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Loginpage;
