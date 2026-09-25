import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import axiosInstance from '@/api/axiosInstance';
import eyeIcon from '@/assets/eyetoggle.png';
import './ForceChangePasswordModal.css';

/**
 * Blocking modal shown when the backend flags `is_first_login`.
 * Calls POST /change-password (auth:sanctum) with current + new password.
 * The modal cannot be closed / dismissed – navigation is blocked until the
 * password is successfully changed.
 */
export default function ForceChangePasswordModal() {
  const { user, revalidateSession, logout } = useAuth();

  const isEmployeePortal = import.meta.env.VITE_APP_MODE !== 'customer';
  const [step, setStep] = useState(isEmployeePortal ? 2 : 1); // 1: Verify OTP, 2: Change Password
  const [otp, setOtp] = useState(isEmployeePortal ? '000000' : '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Password strength validations
  const hasMinLength = newPassword.length >= 12;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSymbol;
  const isOtpValid = /^\d{6}$/.test(otp);

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');

    if (!isOtpValid) {
      setError('Please enter a valid 6-digit OTP code.');
      return;
    }

    setBusy(true);
    try {
      await axiosInstance.post('/forgot-password/verify', {
        email: user?.email,
        otp: otp,
      });
      setStep(2);
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid or expired OTP code.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitPassword = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (!isPasswordValid) {
      setError('New password must meet all requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from current password.');
      return;
    }

    setBusy(true);

    try {
      await axiosInstance.post('/change-password', {
        otp: otp,
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });

      setSuccess(true);

      // Log out on success to force user redirection back to the login page
      setTimeout(async () => {
        await logout();
      }, 1800);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        (err.response?.data?.errors
          ? Object.values(err.response.data.errors).flat()[0]
          : 'Failed to change password. Please try again.');
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fcp-backdrop">
      <div className="fcp-modal" role="dialog" aria-modal="true" aria-label="Change your password">
        {/* Decorative top bar */}
        <div className="fcp-accent-bar" />

        {!success ? (
          step === 1 ? (
            <form className="fcp-body" onSubmit={handleVerifyOtp} autoComplete="off">
              {/* Icon */}
              <div className="fcp-icon-circle">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#252578" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>

              <h2 className="fcp-title">Verification Required</h2>
              <p className="fcp-subtitle">
                Please enter the 6-digit OTP code sent to your email to verify your identity.
                {user?.name ? ` Welcome, ${user.name}.` : ''}
              </p>

              {/* Error */}
              {error && (
                <div className="fcp-error" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {error}
                </div>
              )}

              {/* OTP Code */}
              <label className="fcp-label" htmlFor="fcp-otp">OTP Code</label>
              <div className="fcp-input-wrap">
                <input
                  id="fcp-otp"
                  type="text"
                  className="fcp-input"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP code"
                  autoComplete="one-time-code"
                  disabled={busy}
                />
              </div>

              {/* Actions */}
              <div className="fcp-actions">
                <button
                  type="button"
                  className="fcp-btn-logout"
                  onClick={logout}
                  disabled={busy}
                >
                  Log Out
                </button>
                <button
                  type="submit"
                  className="fcp-btn-submit"
                  disabled={busy || !isOtpValid}
                >
                  {busy ? (
                    <span className="fcp-spinner-wrap">
                      <span className="fcp-spinner" />
                      Verifying...
                    </span>
                  ) : (
                    'Verify Code'
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form className="fcp-body" onSubmit={handleSubmitPassword} autoComplete="off">
              {/* Icon */}
              <div className="fcp-icon-circle">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#252578" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>

              <h2 className="fcp-title">Set New Password</h2>
              <p className="fcp-subtitle">
                Your code has been verified successfully. Choose a strong new password below.
              </p>

              {/* Error */}
              {error && (
                <div className="fcp-error" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {error}
                </div>
              )}

              {/* OTP Code (Display Only) */}
              <label className="fcp-label" htmlFor="fcp-otp-verified">OTP Code (Verified)</label>
              <div className="fcp-input-wrap">
                <input
                  id="fcp-otp-verified"
                  type="text"
                  className="fcp-input"
                  style={{ backgroundColor: '#eefcf5', color: '#1e7e34', borderColor: '#c3e6cb' }}
                  value={`${otp} (Verified ✓)`}
                  disabled
                />
              </div>

              {/* Current Password */}
              <label className="fcp-label" htmlFor="fcp-current">Current Password</label>
              <div className="fcp-input-wrap">
                <input
                  id="fcp-current"
                  type={showCurrent ? 'text' : 'password'}
                  className="fcp-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                  disabled={busy}
                />
                <button
                  type="button"
                  className="fcp-eye"
                  onClick={() => setShowCurrent((p) => !p)}
                  aria-label="Toggle current password visibility"
                  tabIndex={-1}
                >
                  <img src={eyeIcon} alt="" />
                </button>
              </div>

              {/* New Password */}
              <label className="fcp-label" htmlFor="fcp-new">New Password</label>
              <div className="fcp-input-wrap">
                <input
                  id="fcp-new"
                  type={showNew ? 'text' : 'password'}
                  className="fcp-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter a strong new password"
                  autoComplete="new-password"
                  disabled={busy}
                />
                <button
                  type="button"
                  className="fcp-eye"
                  onClick={() => setShowNew((p) => !p)}
                  aria-label="Toggle new password visibility"
                  tabIndex={-1}
                >
                  <img src={eyeIcon} alt="" />
                </button>
              </div>

              {/* Confirm Password */}
              <label className="fcp-label" htmlFor="fcp-confirm">Confirm New Password</label>
              <div className="fcp-input-wrap">
                <input
                  id="fcp-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  className="fcp-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  disabled={busy}
                />
                <button
                  type="button"
                  className="fcp-eye"
                  onClick={() => setShowConfirm((p) => !p)}
                  aria-label="Toggle confirm password visibility"
                  tabIndex={-1}
                >
                  <img src={eyeIcon} alt="" />
                </button>
              </div>

              {/* Password hints */}
              <div className="fcp-hints">
                <div className="fcp-hint">
                  <span className={`fcp-dot ${hasMinLength ? 'valid' : 'invalid'}`} />
                  Minimum of 12 characters
                </div>
                <div className="fcp-hint">
                  <span className={`fcp-dot ${hasUppercase ? 'valid' : 'invalid'}`} />
                  Uppercase letter
                </div>
                <div className="fcp-hint">
                  <span className={`fcp-dot ${hasNumber ? 'valid' : 'invalid'}`} />
                  Number
                </div>
                <div className="fcp-hint">
                  <span className={`fcp-dot ${hasSymbol ? 'valid' : 'invalid'}`} />
                  Symbol
                </div>
              </div>

              {/* Actions */}
              <div className="fcp-actions">
                <button
                  type="button"
                  className="fcp-btn-logout"
                  onClick={logout}
                  disabled={busy}
                >
                  Log Out
                </button>
                <button
                  type="submit"
                  className="fcp-btn-submit"
                  disabled={busy || !isPasswordValid || newPassword !== confirmPassword || !currentPassword}
                >
                  {busy ? (
                    <span className="fcp-spinner-wrap">
                      <span className="fcp-spinner" />
                      Changing...
                    </span>
                  ) : (
                    'Change Password'
                  )}
                </button>
              </div>
            </form>
          )
        ) : (
          /* ── Success state ── */
          <div className="fcp-body fcp-success-body">
            <div className="fcp-success-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#27ae60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="fcp-title fcp-title--success">Password Changed!</h2>
            <p className="fcp-subtitle">
              Your password has been updated successfully. Redirecting you now…
            </p>
            <div className="fcp-progress-bar">
              <div className="fcp-progress-fill" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
