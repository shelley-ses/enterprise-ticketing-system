import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import loginImage from '@/assets/login.png';
import emailIcon from '@/assets/email.png';
import lockIcon from '@/assets/lock.png';
import eyeIcon from '@/assets/eyetoggle.png';
import otpEmailIcon from '@/assets/otp-email.png';
import otpLockIcon from '@/assets/otp-lock.png';
import './Loginpage.css';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;
const OTP_SECONDS = 210; // 3:30
const LOCKOUT_STORAGE_KEY_PREFIX = 'login_lockout_until_';

const lockKeyFor = (email) => `${LOCKOUT_STORAGE_KEY_PREFIX}${email}`;

// ─── Forgot Password Modal ────────────────────────────────────────────────────
function ForgotPasswordModal({ onClose }) {
  const [step, setStep] = useState(1);
  const [fpEmail, setFpEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(OTP_SECONDS);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const otpRefs = [useRef(), useRef(), useRef(), useRef()];

  // OTP countdown
  useEffect(() => {
    if (step !== 2) return;
    if (otpTimer <= 0) return;
    const t = setTimeout(() => setOtpTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, otpTimer]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const handleOtpChange = (val, idx) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 3) otpRefs[idx + 1].current?.focus();
  };

  const handleOtpKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs[idx - 1].current?.focus();
    }
  };

  const handleResend = () => {
    setOtp(['', '', '', '']);
    setOtpTimer(OTP_SECONDS);
    otpRefs[0].current?.focus();
  };

  // Password validation
  const hasMinLength = newPassword.length >= 12;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSymbol;

  const stepTitle = {
    1: 'Forgot Password?',
    2: 'Password Recovery',
    3: 'Reset your password',
    4: 'Password changed successfully!',
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label={stepTitle[step]}>

        {/* Close */}
        <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>

        {/* ── Step 1: Email Entry ── */}
        {step === 1 && (
          <div className="modal-content">
            <h2 className="modal-title">{stepTitle[1]}</h2>
            <p className="modal-subtitle">Enter your registered email address and we'll send you a verification code.</p>
            <input
              id="fp-email"
              type="email"
              className="modal-input"
              placeholder="Email address"
              value={fpEmail}
              onChange={(e) => setFpEmail(e.target.value)}
            />
            <button
              id="fp-send-code"
              className="modal-btn"
              onClick={() => { if (fpEmail) setStep(2); }}
            >
              Send Code
            </button>
          </div>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 2 && (
          <div className="modal-content">
            <h2 className="modal-title">{stepTitle[2]}</h2>
            <p className="modal-subtitle">
              A 4-digit verification code has been sent to<br />
              <strong>{fpEmail}</strong>.<br />
              <em>Enter the code below to continue.</em>
            </p>

            {/* Envelope icon */}
            <div className="otp-icon-wrap">
              <img src={otpEmailIcon} alt="Email OTP" className="otp-icon-img" />
            </div>

            {/* OTP boxes */}
            <div className="otp-boxes">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-box-${i}`}
                  ref={otpRefs[i]}
                  className="otp-box"
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(e.target.value, i)}
                  onKeyDown={(e) => handleOtpKeyDown(e, i)}
                />
              ))}
            </div>

            {/* Timer */}
            <p className="otp-timer">
              {otpTimer > 0
                ? `Code expires in ${formatTime(otpTimer)}`
                : 'Code expired. Please resend.'}
            </p>

            <button
              id="fp-verify"
              className="modal-btn"
              onClick={() => { if (otp.every((d) => d)) setStep(3); }}
            >
              Verify
            </button>

            <button className="modal-btn-outline" onClick={handleResend}>
              Resend Code
            </button>

            <p className="otp-note">
              Didn't receive the email?<br />
              Check your spam folder or resend the code.
            </p>
          </div>
        )}

        {/* ── Step 3: Reset Password ── */}
        {step === 3 && (
          <div className="modal-content">
            <h2 className="modal-title">{stepTitle[3]}</h2>
            <p className="modal-subtitle">Please enter your new password</p>

            {/* Lock icon */}
            <div className="otp-icon-wrap">
              <img src={otpLockIcon} alt="Lock" className="otp-icon-img" />
            </div>

            {/* New password */}
            <label className="modal-label">New Password</label>
            <div className="modal-input-wrap">
              <input
                id="fp-new-password"
                type={showNew ? 'text' : 'password'}
                className="modal-input"
                placeholder=""
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className="modal-eye"
                onClick={() => setShowNew((p) => !p)}
                aria-label="Toggle new password visibility"
              >
                <img src={eyeIcon} alt="" />
              </button>
            </div>

            {/* Confirm password */}
            <label className="modal-label">Confirm password</label>
            <div className="modal-input-wrap">
              <input
                id="fp-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                className="modal-input"
                placeholder=""
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className="modal-eye"
                onClick={() => setShowConfirm((p) => !p)}
                aria-label="Toggle confirm password visibility"
              >
                <img src={eyeIcon} alt="" />
              </button>
            </div>

            <button
              id="fp-done"
              className="modal-btn"
              onClick={() => {
                if (isPasswordValid && newPassword === confirmPassword) {
                  setStep(4);
                }
              }}
            >
              Done
            </button>

            {/* Validation hints */}
            <div className="pw-hints">
              <div className="pw-hint">
                <span className={`pw-dot ${hasMinLength ? 'valid' : 'invalid'}`} />
                Minimum of 12 characters
              </div>
              <div className="pw-hint">
                <span className={`pw-dot ${hasUppercase ? 'valid' : 'invalid'}`} />
                Uppercase letter
              </div>
              <div className="pw-hint">
                <span className={`pw-dot ${hasNumber ? 'valid' : 'invalid'}`} />
                Number
              </div>
              <div className="pw-hint">
                <span className={`pw-dot ${hasSymbol ? 'valid' : 'invalid'}`} />
                Symbol
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Success ── */}
        {step === 4 && (
          <div className="modal-content modal-content--success">
            <h2 className="modal-title">{stepTitle[4]}</h2>
            <p className="modal-subtitle">
              You can now go back to the login page and sign in with your new password.
            </p>
            <div className="success-actions">
              <button id="fp-login" className="modal-btn modal-btn--right" onClick={onClose}>
                Log In
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Main Login Page ─────────────────────────────────────────────────────────
function Loginpage() {
  const navigate = useNavigate();
  const { login, clearError } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rate limiting state 
  const [attempts, setAttempts] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);
  const [lockTimer, setLockTimer] = useState(LOCKOUT_SECONDS);
  const [loginError, setLoginError] = useState('');

  // Forgot password modal
  const [showForgot, setShowForgot] = useState(false);

  // Lockout per-email handling
  const [lockedEmail, setLockedEmail] = useState('');

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
  }, [email, lockedOut, lockTimer]);

  const formatLock = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  //Login Function
  const handleLogin = async (e) => {
    e.preventDefault();

    if (lockedOut || isSubmitting) return;

    setLoginError('');
    clearError();
    setIsSubmitting(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        setLoginError('');
        setAttempts(0);
        navigate('/customer-dashboard', { replace: true });
      } else {
        // Rate Limit
        if (result.retryAfter) {
          const seconds = Number(result.retryAfter);
          if (!Number.isNaN(seconds) && seconds > 0) {
            setLockedOut(true);
            const lockUntilMs = Date.now() + seconds * 1000;
            localStorage.setItem(LOCKOUT_STORAGE_KEY, String(lockUntilMs));
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
          const lockUntilMs = result.lockedUntil ? new Date(result.lockedUntil).getTime() : Date.now() + LOCKOUT_SECONDS * 1000;
          // store lockout keyed to the email/account
          localStorage.setItem(lockKeyFor(email), String(lockUntilMs));
          setLockedEmail(email);
          setLockTimer(Math.max(1, Math.ceil((lockUntilMs - Date.now()) / 1000)));
        } else {
          setLockedOut(false);
          localStorage.removeItem(lockKeyFor(email));
        }

        setLoginError(
          result.lockedUntil
            ? `${result.error} Account is locked temporarily.`
            : `${result.error} ${remainingAttempts} attempt(s) remaining.`
        );
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="login-container">

        {/* LEFT SIDE IMAGE */}
        <div className="left-panel">
          <img className="bg-image" src={loginImage} alt="Login background" />
          <div className="overlay" />
          <div className="left-text">
            <h1>25 Years of Innovating Diagnostics Solutions</h1>
            <p>ISO 9001:2015 Certified</p>
          </div>
        </div>

        {/* RIGHT SIDE FORM */}
        <div className="right-panel">
          <form className="form-box" onSubmit={handleLogin}>

            <h2 className="title">Welcome Back!</h2>
            <p className="subtitle">Sign in to the Ticketing Management System</p>

            {/* Lockout banner */}
            {lockedOut && (
              <div className="lockout-banner" role="alert">
                ⚠ Too many failed attempts. Account temporarily locked.
              </div>
            )}

            {/* Inline error */}
            {loginError && !lockedOut && (
              <div className="login-error" role="alert">{loginError}</div>
            )}

            {/* EMAIL */}
            <div className="input-wrapper">
              <img src={emailIcon} alt="Email" className="input-icon" />
              <input
                id="login-email"
                type="email"
                placeholder="Email"
                className="input-field"
                value={email}
                onChange={(e) => {
                  const v = e.target.value;
                  setEmail(v);
                  // if user types a different email, clear the lock UI for this input
                  if (lockedOut && lockedEmail && v !== lockedEmail) {
                    setLockedOut(false);
                    setLockedEmail('');
                    setLoginError('');
                  }
                }}
                disabled={false}
                required
              />
            </div>

            {/* PASSWORD */}
            <div className="input-wrapper">
              <img src={lockIcon} alt="Lock" className="input-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={false}
                required
              />
              <button
                type="button"
                className="eye-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label="Toggle password visibility"
              >
                <img src={eyeIcon} alt="Toggle visibility" />
              </button>
            </div>

            {/* SUBMIT */}
            <button
              id="login-submit"
              type="submit"
              className={`login-btn ${(lockedOut && lockedEmail === email) || isSubmitting ? 'login-btn--disabled' : ''}`}
              disabled={(lockedOut && lockedEmail === email) || isSubmitting}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing In...
                </span>
              ) : (
                'Sign In'
              )}
            </button>

            {/* Lockout countdown */}
            {lockedOut && (
              <p className="lockout-timer">
                Too many failed attempts. Please try again in {formatLock(lockTimer)}
              </p>
            )}

            {/* FORGOT PASSWORD */}
            <div className="forgot-row">
              <button
                type="button"
                className="forgot-link"
                onClick={() => setShowForgot(true)}
              >
                Forgot Password?
              </button>
            </div>

          </form>
        </div>

      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </>
  );
}

export default Loginpage;
