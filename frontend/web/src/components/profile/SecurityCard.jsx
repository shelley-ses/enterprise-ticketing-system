import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function SecurityCard() {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [touched, setTouched] = useState({});
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const pwRules = {
    minLength: form.next.length >= 8,
    hasUpper: /[A-Z]/.test(form.next),
    hasNumber: /\d/.test(form.next),
    hasSpecial: /[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(form.next),
  };
  const passwordValid = Object.values(pwRules).every(Boolean);
  const passwordMismatch = form.confirm.length > 0 && form.next !== form.confirm;

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const toggleShow = (field) => () => {
    setShow((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const fieldCls = (field, invalid) => {
    const base = 'w-full h-9 rounded-lg border bg-white pl-3 pr-10 text-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 transition';
    if (touched[field] && invalid) {
      return `${base} border-red-300 focus:border-red-400 focus:ring-red-400/20 text-gray-800`;
    }
    return `${base} border-gray-200 focus:border-[#252578] focus:ring-[#252578]/10 text-gray-800`;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setTouched({ current: true, next: true, confirm: true });
    if (!form.current || !passwordValid || passwordMismatch) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await changePassword(form.current, form.next, form.confirm);
      if (res.success) {
        setSuccess('Password updated successfully.');
        setForm({ current: '', next: '', confirm: '' });
        setTouched({});
        setShow({ current: false, next: false, confirm: false });
      } else {
        setError(res.error || 'Failed to update password.');
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
        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <ShieldCheck size={16} className="text-red-500" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">Security</h3>
          <p className="text-xs text-gray-500">Change your password.</p>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
              Current Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={show.current ? 'text' : 'password'}
                value={form.current}
                onChange={handleChange('current')}
                onBlur={handleBlur('current')}
                placeholder="Current password"
                className={fieldCls('current', !form.current)}
              />
              <button
                type="button"
                onClick={toggleShow('current')}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {show.current ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {touched.current && !form.current && (
              <p className="text-[11px] text-red-500">Required.</p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={show.next ? 'text' : 'password'}
                value={form.next}
                onChange={handleChange('next')}
                onBlur={handleBlur('next')}
                placeholder="New password"
                className={fieldCls('next', touched.next && !passwordValid)}
              />
              <button
                type="button"
                onClick={toggleShow('next')}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {show.next ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {(touched.next || form.next.length > 0) && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                {Object.entries(pwRules).map(([rule, ok]) => (
                  <span
                    key={rule}
                    className={`flex items-center gap-1 text-[10px] ${ok ? 'text-emerald-600' : 'text-gray-400'}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    />
                    {rule === 'minLength' ? '8+ chars' : rule === 'hasUpper' ? 'Uppercase' : rule === 'hasNumber' ? 'One number' : 'Special char'}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={show.confirm ? 'text' : 'password'}
                value={form.confirm}
                onChange={handleChange('confirm')}
                onBlur={handleBlur('confirm')}
                placeholder="Repeat new password"
                className={fieldCls('confirm', passwordMismatch)}
              />
              <button
                type="button"
                onClick={toggleShow('confirm')}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {show.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordMismatch && (
              <p className="text-[11px] text-red-500">Passwords do not match.</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <button
            type="submit"
            disabled={saving}
            className="h-9 px-5 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? 'Updating password...' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  );
}
