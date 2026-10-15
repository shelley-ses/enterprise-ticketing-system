import React, { useState, useEffect } from 'react';
import { User, AlertCircle, CheckCircle, Lock, Shield, Mail, Phone, MapPin, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function PersonalInfoCard({ profile, onProfileUpdated }) {
  const { updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const isEmployeeRole = (profile.role || '').toLowerCase() !== 'customer';

  // Track initial/saved state for Cancel / Revert
  const [savedValues, setSavedValues] = useState({
    email: profile.email || '',
    phone: profile.phone || '',
    address: profile.address || '',
  });

  const [form, setForm] = useState({
    email: profile.email || '',
    phone: profile.phone || '',
    address: profile.address || '',
  });

  useEffect(() => {
    const fresh = {
      email: profile.email || '',
      phone: profile.phone || '',
      address: profile.address || '',
    };
    setSavedValues(fresh);
    setForm(fresh);
  }, [profile]);

  const handleChange = (field) => (e) => {
    if (isEmployeeRole) return;
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear inline error on change
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};
    const emailTrimmed = (form.email || '').trim();
    const phoneTrimmed = (form.phone || '').trim();

    // Required email
    if (!emailTrimmed) {
      errors.email = 'Email address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) {
        errors.email = 'Enter a valid email address (e.g. name@example.com).';
      }
    }

    // Phone validation if entered
    if (phoneTrimmed) {
      const phoneDigits = phoneTrimmed.replace(/[^0-9]/g, '');
      const phoneRegex = /^[0-9+\-\s()]{7,20}$/;
      if (!phoneRegex.test(phoneTrimmed) || phoneDigits.length < 7 || phoneDigits.length > 20) {
        errors.phone = 'Phone number must be between 7 and 20 digits.';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenConfirmation = (e) => {
    e.preventDefault();
    if (isEmployeeRole) return;

    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    const hasChanged =
      form.email.trim() !== savedValues.email.trim() ||
      form.phone.trim() !== savedValues.phone.trim() ||
      (form.address || '').trim() !== (savedValues.address || '').trim();

    if (!hasChanged) {
      setSuccess('No changes were made to your profile.');
      return;
    }

    // Trigger confirmation modal summarizing changes
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await updateProfile({
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: (form.address || '').trim(),
      });

      if (res.success) {
        setSuccess(res.message || 'Your profile has been updated');
        const newSaved = {
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: (form.address || '').trim(),
        };
        setSavedValues(newSaved);
        if (onProfileUpdated && res.user) {
          onProfileUpdated(res.user);
        }
      } else {
        // Preserve unsaved edits in form
        setError(res.error || 'Failed to update profile.');
      }
    } catch (err) {
      setError('An unexpected error occurred while saving your profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({ ...savedValues });
    setValidationErrors({});
    setError('');
    setSuccess('');
  };

  const isEmailChanging = form.email.trim() !== savedValues.email.trim();
  const isPhoneChanging = form.phone.trim() !== savedValues.phone.trim();
  const isAddressChanging = (form.address || '').trim() !== (savedValues.address || '').trim();
  const hasUnsavedChanges = isEmailChanging || isPhoneChanging || isAddressChanging;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <User size={16} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Personal Information</h3>
            <p className="text-xs text-gray-500">
              {isEmployeeRole ? 'Your account details are managed by SSO.' : 'Update your contact and profile details.'}
            </p>
          </div>
        </div>
        {hasUnsavedChanges && !isEmployeeRole && (
          <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            Unsaved changes
          </span>
        )}
      </div>

      <form onSubmit={handleOpenConfirmation} className="px-6 py-5">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 font-semibold animate-fade-in">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
            <div>
              <p className="font-bold">Update Failed</p>
              <p className="font-normal text-red-600">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-700 font-semibold animate-fade-in">
            <CheckCircle size={16} className="shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Read-Only: Customer ID */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                Customer ID
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                <Lock size={10} /> Read-Only (CMS record)
              </span>
            </div>
            <input
              type="text"
              value={profile.id || 'CUST-001'}
              disabled
              className="w-full h-9 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 cursor-not-allowed font-mono"
            />
          </div>

          {/* Read-Only: Customer Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                Full Name / Organization
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                <Shield size={10} /> Read-Only (CMS record)
              </span>
            </div>
            <input
              type="text"
              value={profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || '—'}
              disabled
              className="w-full h-9 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 cursor-not-allowed"
            />
          </div>

          {/* Editable: Email */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                <Mail size={12} className="text-gray-400" />
                Email Address <span className="text-red-500">*</span>
              </label>
              {isEmployeeRole && (
                <span className="text-[10px] text-gray-400">Managed by SSO</span>
              )}
            </div>
            <input
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              placeholder="name@example.com"
              disabled={isEmployeeRole}
              className={`w-full h-9 rounded-lg border px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none transition disabled:bg-gray-50 disabled:text-gray-500 ${
                validationErrors.email
                  ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-red-50/20'
                  : 'border-gray-200 bg-white focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10'
              }`}
            />
            {validationErrors.email && (
              <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-0.5">
                <AlertCircle size={12} /> {validationErrors.email}
              </p>
            )}
          </div>

          {/* Editable: Phone */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                <Phone size={12} className="text-gray-400" />
                Phone Number
              </label>
              {isEmployeeRole && (
                <span className="text-[10px] text-gray-400">Managed by SSO</span>
              )}
            </div>
            <input
              type="tel"
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="e.g. +63 912 345 6789"
              disabled={isEmployeeRole}
              className={`w-full h-9 rounded-lg border px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none transition disabled:bg-gray-50 disabled:text-gray-500 ${
                validationErrors.phone
                  ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-red-50/20'
                  : 'border-gray-200 bg-white focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10'
              }`}
            />
            {validationErrors.phone && (
              <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-0.5">
                <AlertCircle size={12} /> {validationErrors.phone}
              </p>
            )}
          </div>

          {/* Editable: Address */}
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                <MapPin size={12} className="text-gray-400" />
                Mailing / Contact Address
              </label>
            </div>
            <input
              type="text"
              value={form.address}
              onChange={handleChange('address')}
              placeholder="Street address, City, Province/State, Postal code"
              disabled={isEmployeeRole}
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10 transition disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </div>

        {!isEmployeeRole && (
          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving || !hasUnsavedChanges}
              className="h-9 px-4 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !hasUnsavedChanges}
              className="h-9 px-5 text-sm font-semibold bg-[#252578] hover:bg-[#1f1f66] text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
            >
              {saving ? 'Saving changes...' : 'Save changes'}
            </button>
          </div>
        )}
      </form>

      {/* Confirmation Modal for Contact Updates (TS002) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#252578] flex items-center justify-center">
                  <AlertTriangle size={18} />
                </div>
                <h4 className="text-base font-bold text-gray-800">Confirm Profile Update</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-3.5">
              <p className="text-xs text-gray-600">
                You are about to update your profile contact information. This affects where future ticket updates and notifications will be delivered:
              </p>

              {isEmailChanging && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-800">
                    <Mail size={14} /> Email Change Confirmation
                  </p>
                  <p>
                    Update your email to <strong className="underline text-amber-950 font-bold">{form.email}</strong>? You&apos;ll use this to receive ticket updates going forward.
                  </p>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2 text-xs">
                <p className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Summary of changes:</p>
                {isEmailChanging && (
                  <div className="flex justify-between items-center text-gray-600">
                    <span className="font-medium text-gray-500">Email:</span>
                    <span className="font-bold text-gray-800">{form.email}</span>
                  </div>
                )}
                {isPhoneChanging && (
                  <div className="flex justify-between items-center text-gray-600">
                    <span className="font-medium text-gray-500">Phone:</span>
                    <span className="font-bold text-gray-800">{form.phone || '(Removed)'}</span>
                  </div>
                )}
                {isAddressChanging && (
                  <div className="flex justify-between items-center text-gray-600">
                    <span className="font-medium text-gray-500">Address:</span>
                    <span className="font-bold text-gray-800 truncate max-w-[200px]">{form.address || '(Removed)'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                Back to Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={saving}
                className="px-5 py-2 text-xs font-bold text-white bg-[#252578] hover:bg-[#1f1f66] rounded-xl transition shadow-sm cursor-pointer"
              >
                {saving ? 'Updating...' : 'Confirm & Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
