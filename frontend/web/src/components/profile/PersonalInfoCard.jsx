import React, { useState, useEffect } from 'react';
import { User, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function PersonalInfoCard({ profile }) {
  const { updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isReadOnly = (profile.role || '').toLowerCase() !== 'customer';

  const [form, setForm] = useState({
    firstName: profile.firstName || '',
    middleName: profile.middleName || '',
    lastName: profile.lastName || '',
    email: profile.email || '',
    phone: profile.phone || '',
  });

  useEffect(() => {
    setForm({
      firstName: profile.firstName || '',
      middleName: profile.middleName || '',
      lastName: profile.lastName || '',
      email: profile.email || '',
      phone: profile.phone || '',
    });
  }, [profile]);

  const handleChange = (field) => (e) => {
    if (isReadOnly) return;
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
      });

      if (res.success) {
        setSuccess('Profile updated successfully.');
      } else {
        setError(res.error || 'Failed to update profile.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <User size={16} className="text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-800">Personal Information</h3>
          <p className="text-xs text-gray-500">
            {isReadOnly ? 'Your account details are managed by SSO.' : 'Update your personal details.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="px-6 py-5">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2.5 text-xs text-red-600 font-semibold animate-fade-in">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2.5 text-xs text-emerald-600 font-semibold animate-fade-in">
            <CheckCircle size={14} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">First Name</label>
            <input
              type="text"
              value={form.firstName}
              onChange={handleChange('firstName')}
              placeholder="First name"
              disabled={isReadOnly}
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10 transition disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Middle Name</label>
            <input
              type="text"
              value={form.middleName}
              onChange={handleChange('middleName')}
              placeholder="Middle name"
              disabled={isReadOnly}
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10 transition disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Last Name</label>
            <input
              type="text"
              value={form.lastName}
              onChange={handleChange('lastName')}
              placeholder="Last name"
              disabled={isReadOnly}
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10 transition disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              placeholder="Email address"
              disabled={isReadOnly}
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10 transition disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="Phone number"
              disabled={isReadOnly}
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10 transition disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </div>

        {!isReadOnly && (
          <div className="mt-4">
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-5 text-sm font-semibold bg-[#252578] hover:bg-[#1f1f66] text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving changes...' : 'Save changes'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
