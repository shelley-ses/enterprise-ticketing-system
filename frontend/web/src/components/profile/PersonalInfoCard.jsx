import React, { useState, useEffect } from 'react';
import {
  User,
  AlertCircle,
  CheckCircle,
  Lock,
  Shield,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  X,
  AlertTriangle,
  Edit3,
  Check,
  HelpCircle,
  Briefcase,
  Building,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function PersonalInfoCard({ profile, onProfileUpdated }) {
  const { updateProfile } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
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
    // Only overwrite form if not actively editing
    if (!isEditMode) {
      setForm(fresh);
    }
  }, [profile, isEditMode]);

  const validateField = (field, val = form[field]) => {
    let err = '';
    const trimmed = (val || '').trim();
    if (field === 'email') {
      if (!trimmed) {
        err = 'Email address is required.';
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
          err = 'Enter a valid email address (e.g. name@example.com).';
        }
      }
    } else if (field === 'phone') {
      if (trimmed) {
        const phoneDigits = trimmed.replace(/[^0-9]/g, '');
        const phoneRegex = /^[0-9+\-\s()]{7,20}$/;
        if (!phoneRegex.test(trimmed) || phoneDigits.length < 7 || phoneDigits.length > 20) {
          err = 'Phone number must be between 7 and 20 digits.';
        }
      }
    }
    setValidationErrors((prev) => ({ ...prev, [field]: err }));
    return !err;
  };

  const handleBlur = (field) => () => {
    validateField(field);
  };

  const handleChange = (field) => (e) => {
    if (isEmployeeRole) return;
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    // If error was active, re-validate dynamically
    if (validationErrors[field]) {
      validateField(field, value);
    }
  };

  const validateForm = () => {
    const errors = {};
    const emailTrimmed = (form.email || '').trim();
    const phoneTrimmed = (form.phone || '').trim();

    // Required email validation
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

  const handleStartEdit = () => {
    if (isEmployeeRole) return;
    setError('');
    setSuccess('');
    setValidationErrors({});
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setForm({ ...savedValues });
    setValidationErrors({});
    setError('');
    setSuccess('');
    setIsEditMode(false);
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
      setIsEditMode(false);
      return;
    }

    // Open confirmation modal summarizing changes
    setShowConfirmModal(true);
  };

  const isEmailChanging = form.email.trim() !== savedValues.email.trim();
  const isPhoneChanging = form.phone.trim() !== savedValues.phone.trim();
  const isAddressChanging = (form.address || '').trim() !== (savedValues.address || '').trim();
  const hasUnsavedChanges = isEmailChanging || isPhoneChanging || isAddressChanging;

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const emailWasChanged = isEmailChanging;
      const res = await updateProfile({
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: (form.address || '').trim(),
      });

      if (res.success) {
        // Required email verification notice if email changed
        if (emailWasChanged) {
          setSuccess("We've sent a confirmation link to your new email, please verify to complete the update.");
        } else {
          setSuccess(res.message || 'Your profile has been updated successfully.');
        }

        const newSaved = {
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: (form.address || '').trim(),
        };
        setSavedValues(newSaved);
        setIsEditMode(false);

        if (onProfileUpdated && res.user) {
          onProfileUpdated(res.user);
        }
      } else {
        // Save failed: preserve unsaved edits in form state
        setError(res.error || 'Failed to update profile.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'An unexpected error occurred while saving your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (isEmployeeRole) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all">
        {/* Card Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <User size={16} className="text-[#252578]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Corporate Identity Information</h3>
              <p className="text-xs text-gray-500">
                Core profile fields provisioned and synced from enterprise authentication.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <ShieldCheck size={13} className="text-emerald-600" />
            Auth-Synced (Read-Only)
          </span>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Field 1: Full Name */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                  <User size={12} className="text-gray-400" /> Full Name
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400">
                  <Lock size={10} /> Central SSO
                </span>
              </div>
              <div className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/80 px-3 flex items-center text-sm text-slate-800 font-semibold select-all">
                {profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || '—'}
              </div>
            </div>

            {/* Field 2: Employee ID */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                  <BadgeCheck size={12} className="text-gray-400" /> Employee ID
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400">
                  <Lock size={10} /> Core Identity
                </span>
              </div>
              <div className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/80 px-3 flex items-center text-sm text-slate-800 font-mono font-semibold">
                {profile.emp_id || profile.id || 'EMP-001'}
              </div>
            </div>

            {/* Field 3: Corporate Email */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                  <Mail size={12} className="text-gray-400" /> Corporate Email
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400">
                  <Lock size={10} /> SSO Primary
                </span>
              </div>
              <div className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/80 px-3 flex items-center text-sm text-slate-800 font-medium truncate select-all">
                {profile.email || '—'}
              </div>
            </div>

            {/* Field 4: Role */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                  <Briefcase size={12} className="text-gray-400" /> System Role
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400">
                  <Lock size={10} /> RBAC
                </span>
              </div>
              <div className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/80 px-3 flex items-center text-sm text-slate-800 font-semibold">
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-bold">
                  {profile.role}
                </span>
              </div>
            </div>

            {/* Field 5: Department */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                  <Building size={12} className="text-gray-400" /> Department
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400">
                  <Lock size={10} /> Org Unit
                </span>
              </div>
              <div className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/80 px-3 flex items-center text-sm text-slate-800 font-medium">
                {profile.department || 'Engineering'}
              </div>
            </div>

            {/* Field 6: Facility / Location */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin size={12} className="text-gray-400" /> Assigned Facility / Office
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400">
                  <Lock size={10} /> Facility Ops
                </span>
              </div>
              <div className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/80 px-3 flex items-center text-sm text-slate-800 font-medium">
                {profile.facility || profile.address || 'Enterprise Headquarters'}
              </div>
            </div>
          </div>

          {/* Guidance & Contact Card for Correcting Inaccurate Data */}
          <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <HelpCircle size={16} className="text-[#252578]" />
              Need to update your Auth-sourced details?
            </div>
            <p className="leading-relaxed text-slate-600">
              Your core identity, email address, role, and department are provisioned directly by central enterprise authentication. To request changes or correct inaccurate information, please contact the IT Administration Service Desk or submit an internal support request.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="mailto:it-support@example.com?subject=Employee%20Profile%20Update%20Request"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#252578] bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition cursor-pointer shadow-xs"
              >
                <Mail size={13} />
                Contact IT Support
              </a>
              <span className="text-gray-400 text-[11px]">
                Support Hours: Mon–Fri, 8AM–6PM
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all">
      {/* Card Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <User size={16} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Personal Information</h3>
            <p className="text-xs text-gray-500">
              {isEmployeeRole
                ? 'Your account details are managed by corporate SSO.'
                : 'View and update your contact information for ticket notifications.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && isEditMode && !isEmployeeRole && (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              Unsaved changes
            </span>
          )}

          {!isEmployeeRole && !isEditMode && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#252578] bg-blue-50/80 hover:bg-blue-100/80 rounded-xl transition-colors cursor-pointer border border-blue-200/60"
            >
              <Edit3 size={13} />
              Edit Profile
            </button>
          )}

          {isEditMode && (
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              Edit Mode
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleOpenConfirmation} noValidate className="px-6 py-5">
        {/* Error Notification */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 font-semibold animate-fade-in">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1">
              <p className="font-bold">Update Failed</p>
              <p className="font-normal text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Success Notification */}
        {success && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 font-semibold animate-fade-in">
            <CheckCircle size={16} className="shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1">
              <p className="font-bold">Update Successful</p>
              <p className="font-normal text-emerald-700 mt-0.5 leading-relaxed">{success}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Read-Only: Full Name - Full Row & Gray Only */}
          <div className="space-y-1.5 col-span-1 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                Full Name / Organization
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                <Shield size={10} /> Read-Only (CMS record)
              </span>
            </div>
            <div className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 flex items-center text-sm text-gray-500 font-medium">
              {profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || '—'}
            </div>
          </div>

          {/* Email Address - Full Row */}
          <div className="space-y-1.5 col-span-1 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <Mail size={12} className="text-gray-400" />
                Email Address <span className="text-red-500">*</span>
              </label>
              {!isEmployeeRole ? (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                  isEditMode ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                  {isEditMode ? 'Editing' : 'Editable'}
                </span>
              ) : (
                <span className="text-[10px] text-gray-400">Managed by SSO</span>
              )}
            </div>

            {isEditMode ? (
              <>
                <input
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  onBlur={handleBlur('email')}
                  placeholder="name@example.com"
                  disabled={isEmployeeRole || saving}
                  className={`w-full h-10 rounded-xl border px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none transition ${
                    validationErrors.email
                      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-red-50/20'
                      : 'border-gray-200 bg-white focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10'
                  }`}
                />
                {validationErrors.email && (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1 animate-fade-in">
                    <AlertCircle size={12} /> {validationErrors.email}
                  </p>
                )}
              </>
            ) : (
              <div className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 flex items-center text-sm text-gray-800 font-medium">
                {savedValues.email || <span className="text-gray-400 italic">No email address provided</span>}
              </div>
            )}
          </div>

          {/* Phone Number - Full Row */}
          <div className="space-y-1.5 col-span-1 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <Phone size={12} className="text-gray-400" />
                Phone Number
              </label>
              {!isEmployeeRole ? (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                  isEditMode ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                  {isEditMode ? 'Editing' : 'Editable'}
                </span>
              ) : (
                <span className="text-[10px] text-gray-400">Managed by SSO</span>
              )}
            </div>

            {isEditMode ? (
              <>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={handleChange('phone')}
                  onBlur={handleBlur('phone')}
                  placeholder="e.g. +63 912 345 6789"
                  disabled={isEmployeeRole || saving}
                  className={`w-full h-10 rounded-xl border px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none transition ${
                    validationErrors.phone
                      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-red-50/20'
                      : 'border-gray-200 bg-white focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10'
                  }`}
                />
                {validationErrors.phone && (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1 animate-fade-in">
                    <AlertCircle size={12} /> {validationErrors.phone}
                  </p>
                )}
              </>
            ) : (
              <div className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 flex items-center text-sm text-gray-800 font-medium">
                {savedValues.phone || <span className="text-gray-400 italic">No phone number provided</span>}
              </div>
            )}
          </div>

          {/* Mailing Address: Editable in Edit Mode, clearly formatted in View Mode */}
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <MapPin size={12} className="text-gray-400" />
                Mailing / Contact Address
              </label>
              {!isEmployeeRole && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                  isEditMode ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                  {isEditMode ? 'Editing' : 'Editable'}
                </span>
              )}
            </div>

            {isEditMode ? (
              <input
                type="text"
                value={form.address}
                onChange={handleChange('address')}
                placeholder="Street address, City, Province/State, Postal code"
                disabled={isEmployeeRole || saving}
                className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10 transition disabled:bg-gray-50 disabled:text-gray-500"
              />
            ) : (
              <div className="w-full min-h-10 rounded-xl border border-gray-200 bg-white px-3 py-2 flex items-center text-sm text-gray-800 font-medium">
                {savedValues.address || <span className="text-gray-400 italic">No mailing address provided</span>}
              </div>
            )}
          </div>
        </div>

        {/* Action Controls for Edit Mode */}
        {isEditMode && !isEmployeeRole && (
          <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saving}
              className="h-10 px-4 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-5 text-xs font-bold bg-[#252578] hover:bg-[#1f1f66] text-white rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
            >
              <Check size={14} />
              {saving ? 'Saving changes...' : 'Save changes'}
            </button>
          </div>
        )}
      </form>

      {/* Confirmation Modal for Contact Updates */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#252578] flex items-center justify-center">
                  <AlertTriangle size={18} />
                </div>
                <h4 className="text-base font-bold text-gray-800">Confirm Contact Update</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-3.5">
              <p className="text-xs text-gray-600 leading-relaxed">
                Please review your contact information changes before confirming. This ensures future ticket notifications and critical status alerts reach you at the right destination:
              </p>

              {isEmailChanging && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-800">
                    <Mail size={14} /> Email Change Notice
                  </p>
                  <p className="leading-relaxed">
                    Updating your email address requires email verification. We&apos;ll send a verification link to your new address <strong className="underline text-amber-950 font-bold">{form.email}</strong>.
                  </p>
                </div>
              )}

              {/* Changes Summary */}
              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 space-y-2.5 text-xs">
                <p className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Summary of changes:</p>
                
                {isEmailChanging && (
                  <div className="space-y-1">
                    <span className="font-medium text-gray-500 text-[11px]">Email:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 line-through truncate max-w-[150px]">{savedValues.email || '(Empty)'}</span>
                      <span className="text-gray-400">&rarr;</span>
                      <span className="font-bold text-gray-900">{form.email}</span>
                    </div>
                  </div>
                )}

                {isPhoneChanging && (
                  <div className="space-y-1">
                    <span className="font-medium text-gray-500 text-[11px]">Phone:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 line-through">{savedValues.phone || '(Empty)'}</span>
                      <span className="text-gray-400">&rarr;</span>
                      <span className="font-bold text-gray-900">{form.phone || '(Removed)'}</span>
                    </div>
                  </div>
                )}

                {isAddressChanging && (
                  <div className="space-y-1">
                    <span className="font-medium text-gray-500 text-[11px]">Mailing Address:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 line-through truncate max-w-[150px]">{savedValues.address || '(Empty)'}</span>
                      <span className="text-gray-400">&rarr;</span>
                      <span className="font-bold text-gray-900 truncate max-w-[180px]">{form.address || '(Removed)'}</span>
                    </div>
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
                className="px-5 py-2 text-xs font-bold text-white bg-[#252578] hover:bg-[#1f1f66] rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
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
