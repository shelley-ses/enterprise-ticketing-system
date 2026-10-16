import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import axiosInstance from '@/api/axiosInstance';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
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
  const { user, setUser } = useAuth();
  const [freshProfile, setFreshProfile] = useState(null);
  const effectiveUser = freshProfile || user || getStoredUser();

  useEffect(() => {
    let isMounted = true;
    const fetchFresh = async () => {
      try {
        const res = await axiosInstance.get('/profile');
        if (res.data?.user && isMounted) {
          setFreshProfile(res.data.user);
        }
      } catch (err) {
        // Fallback to existing user object
      }
    };
    fetchFresh();
    return () => { isMounted = false; };
  }, []);

  const basePath = location.pathname.startsWith('/cs')
    ? '/cs'
    : location.pathname.startsWith('/employee')
      ? '/employee'
      : '';

  const dashboardUrl = basePath ? `${basePath}/dashboard` : '/customer-dashboard';

  const profile = {
    id: effectiveUser?.id || effectiveUser?.emp_id || 'CUST-001',
    firstName: effectiveUser?.first_name || '',
    middleName: effectiveUser?.middle_name || '',
    lastName: effectiveUser?.last_name || '',
    name: effectiveUser?.client_name || effectiveUser?.name || `${effectiveUser?.first_name || ''} ${effectiveUser?.last_name || ''}`.trim() || 'Jane Doe',
    email: effectiveUser?.email || '',
    phone: effectiveUser?.phone || effectiveUser?.contact_number || '',
    address: effectiveUser?.address || '',
    role: effectiveUser?.role || 'Customer',
    department: effectiveUser?.department || 'General',
    is_readonly_cms: effectiveUser?.is_readonly_cms ?? true,
    dateJoined: effectiveUser?.created_at
      ? new Date(effectiveUser.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'January 5, 2025',
  };

  const handleProfileUpdated = (updatedUser) => {
    setFreshProfile(updatedUser);
    if (setUser) setUser(updatedUser);
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="My Profile"
        subtitle="Manage your account details and preferences."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(dashboardUrl)}
            className="cursor-pointer gap-1.5 text-muted-slate hover:text-dark-slate"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        }
      />

      <ProfileHero profile={profile} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PersonalInfoCard profile={profile} onProfileUpdated={handleProfileUpdated} />
        <PreferencesCard role={profile.role} />
      </div>

      <SecurityCard />
    </div>
  );
}

