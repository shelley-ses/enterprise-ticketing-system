import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ProfileHero from '@/components/profile/ProfileHero';
import PersonalInfoCard from '@/components/profile/PersonalInfoCard';
import PreferencesCard from '@/components/profile/PreferencesCard';
import SecurityCard from '@/components/profile/SecurityCard';

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
  const { user } = useAuth();
  const effectiveUser = user || getStoredUser();

  const basePath = location.pathname.startsWith('/cs')
    ? '/cs'
    : location.pathname.startsWith('/employee')
      ? '/employee'
      : '';

  const dashboardUrl = basePath ? `${basePath}/dashboard` : '/customer-dashboard';

  const profile = {
    firstName: effectiveUser?.first_name || 'Jane',
    middleName: effectiveUser?.middle_name || '',
    lastName: effectiveUser?.last_name || 'Doe',
    email: effectiveUser?.email || 'jane.doe@example.com',
    phone: effectiveUser?.phone || '',
    role: effectiveUser?.role || 'Customer',
    department: effectiveUser?.department || 'General',
    dateJoined: effectiveUser?.created_at
      ? new Date(effectiveUser.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'January 5, 2025',
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <button
        onClick={() => navigate(dashboardUrl)}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-[#252578] transition-colors -mb-4"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-800">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account details and preferences.</p>
      </div>

      <ProfileHero profile={profile} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PersonalInfoCard profile={profile} />
        <PreferencesCard role={profile.role} />
      </div>

      <SecurityCard />
    </div>
  );
}
