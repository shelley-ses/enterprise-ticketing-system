import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, RefreshCw, AlertTriangle, AlertCircle, WifiOff, CheckCircle } from 'lucide-react';
import axiosInstance from '@/api/axiosInstance';
import { useAuth } from '@/context/AuthContext';
import ProfileHero from '@/components/profile/ProfileHero';
import PersonalInfoCard from '@/components/profile/PersonalInfoCard';
import PreferencesCard from '@/components/profile/PreferencesCard';
import SecurityCard from '@/components/profile/SecurityCard';
import SkeletonLoader from '@/components/SkeletonLoader';
import { formatDisplayDate } from '@/utils/dateUtils';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const [freshProfile, setFreshProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isStale, setIsStale] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => {
    return localStorage.getItem('profile_last_synced') || new Date().toISOString();
  });

  const effectiveUser = freshProfile || user || getStoredUser();

  const fetchFresh = useCallback(async (isManualRetry = false) => {
    if (isManualRetry) setLoading(true);
    setError('');
    try {
      const res = await axiosInstance.get('/profile');
      if (res.data?.user) {
        setFreshProfile(res.data.user);
        const now = new Date().toISOString();
        setLastSyncedAt(now);
        localStorage.setItem('profile_last_synced', now);
        setIsStale(false);
      }
    } catch (err) {
      console.warn('Failed to refresh profile from auth service:', err);
      // If we already have a user in session or localStorage, degrade gracefully to stale data
      if (effectiveUser) {
        setIsStale(true);
      } else {
        setError('Unable to load employee profile from the corporate authentication service. Please check your network connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveUser]);

  useEffect(() => {
    fetchFresh();
  }, [fetchFresh]);

  const basePath = location.pathname.startsWith('/cs')
    ? '/cs'
    : location.pathname.startsWith('/employee')
      ? '/employee'
      : '';

  const dashboardUrl = basePath ? `${basePath}/dashboard` : '/customer-dashboard';

  const profile = {
    id: effectiveUser?.id || effectiveUser?.emp_id || 'EMP-001',
    emp_id: effectiveUser?.emp_id || effectiveUser?.id || 'EMP-001',
    firstName: effectiveUser?.first_name || '',
    middleName: effectiveUser?.middle_name || '',
    lastName: effectiveUser?.last_name || '',
    name: effectiveUser?.client_name || effectiveUser?.name || `${effectiveUser?.first_name || ''} ${effectiveUser?.last_name || ''}`.trim() || 'Jane Doe',
    email: effectiveUser?.email || '',
    phone: effectiveUser?.phone || effectiveUser?.contact_number || '',
    address: effectiveUser?.address || '',
    role: effectiveUser?.role || 'Employee',
    department: effectiveUser?.department || 'Engineering',
    facility: effectiveUser?.facility || effectiveUser?.branch || 'Headquarters',
    is_readonly_cms: effectiveUser?.is_readonly_cms ?? true,
    lastSynced: lastSyncedAt ? formatDisplayDate(lastSyncedAt) : 'Just now',
    dateJoined: effectiveUser?.created_at
      ? new Date(effectiveUser.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'January 5, 2025',
  };

  const handleProfileUpdated = (updatedUser) => {
    setFreshProfile(updatedUser);
    if (setUser) setUser(updatedUser);
  };

  // Full-page error state when no profile data can be loaded
  if (error && !effectiveUser) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 text-center bg-white rounded-3xl border border-red-100 shadow-sm p-8">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Profile Synchronization Failed</h2>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          {error}
        </p>
        <button
          type="button"
          onClick={() => fetchFresh(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#252578] hover:bg-[#1f1f66] rounded-xl transition shadow-sm cursor-pointer"
        >
          <RefreshCw size={16} />
          Retry Synchronization
        </button>
      </div>
    );
  }

  // Initial loading skeleton if no cached profile exists
  if (loading && !effectiveUser) {
    return (
      <div className="p-8 space-y-6 max-w-5xl mx-auto">
        <SkeletonLoader className="h-8 w-40" />
        <SkeletonLoader className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SkeletonLoader className="h-96 w-full rounded-2xl" />
          <SkeletonLoader className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      <button
        onClick={() => navigate(dashboardUrl)}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-[#252578] transition-colors -mb-4 cursor-pointer"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Identity and account information synced from central corporate authentication.
          </p>
        </div>

        {/* Sync Status Badge / Manual Refresh */}
        <button
          type="button"
          onClick={() => fetchFresh(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#252578] bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition cursor-pointer self-start sm:self-auto disabled:opacity-50"
          title="Refresh profile data from Auth system"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
          {loading ? 'Syncing...' : 'Sync with Auth'}
        </button>
      </div>

      {/* Graceful Degradation / Stale Data State Banner */}
      {isStale && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start justify-between gap-3 text-xs text-amber-900 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <WifiOff size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">Viewing Cached Profile Information</p>
              <p className="text-amber-700 mt-0.5 leading-relaxed">
                We are currently displaying your cached identity profile synced on {formatDisplayDate(lastSyncedAt)}. Updates from corporate Auth will be synchronized automatically when the connection is refreshed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchFresh(true)}
            className="shrink-0 px-3 py-1 font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      <ProfileHero profile={profile} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PersonalInfoCard profile={profile} onProfileUpdated={handleProfileUpdated} />
        <PreferencesCard role={profile.role} />
      </div>

      <SecurityCard />
    </div>
  );
}
