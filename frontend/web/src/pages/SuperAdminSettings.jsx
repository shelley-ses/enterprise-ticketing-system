import React, { useState, useRef } from 'react';
import {
  Building2,
  Phone,
  Mail,
  Globe,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  Terminal,
  AlertCircle,
  Activity,
  Layers,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  Eye,
  EyeOff,
  RefreshCw,
  Send,
  ShieldCheck,
  Lock,
  KeyRound,
  Check
} from 'lucide-react';
import NotificationModal from '@/components/NotificationModal';

// =========================================================================
// TS097 Initial Baseline Data
// =========================================================================
const INITIAL_COMPANY_INFO = {
  address: 'SBSI Building, 28 East Capitol Drive, Kapitolyo, Pasig City, Metro Manila, Philippines 1603',
  contactNumber: '+63 2 8635 9999',
  contactEmail: 'support@sbsi.com.ph',
  socialLinks: [
    { id: 'soc-1', platform: 'LinkedIn', url: 'https://www.linkedin.com/company/scientific-biotech-specialties-inc' },
    { id: 'soc-2', platform: 'Facebook', url: 'https://www.facebook.com/ScientificBiotechSpecialties' },
    { id: 'soc-3', platform: 'Twitter / X', url: 'https://x.com/sbsi_ph' },
  ],
};

const SOCIAL_PLATFORMS = ['LinkedIn', 'Facebook', 'Twitter / X', 'YouTube', 'Instagram', 'Other'];

const LOG_LEVELS = [
  {
    level: 'Error',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    description: 'Captures fatal application errors, unhandled exceptions, and service outages only.',
  },
  {
    level: 'Warning',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Captures non-fatal warnings, deprecated API calls, and soft degradation events.',
  },
  {
    level: 'Info',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Standard production baseline. Logs routine operations, logins, and ticket state transitions.',
  },
  {
    level: 'Debug',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Verbose diagnostic mode. Logs complete request payloads, database queries, and stack traces.',
  },
];

// =========================================================================
// TS102 Initial Baseline Data (Email Templates + Account Settings)
// =========================================================================
const INITIAL_EMAIL_TEMPLATES = [
  {
    id: 'ticket_notification',
    name: 'Ticket Notification',
    category: 'Ticket Lifecycle',
    description: 'Dispatched to assigned support engineers and customers upon ticket creation, updates, and SLA status changes.',
    subject: '[Update] {{notification_title}} - {{ticket_ref}}',
    body: `Hello,

You have an update regarding ticket {{ticket_ref}}: {{ticket_title}}.

Notification Details:
{{notification_message}}

Ticket Summary:
- Category: {{category}}
- Priority: {{priority}}

View the full ticket history and updates online:
{{ticket_link}}

Regards,
Enterprise Support Desk`,
    placeholders: [
      { tag: '{{notification_title}}', desc: 'Title/headline of the notification' },
      { tag: '{{notification_message}}', desc: 'Detailed message body or event details' },
      { tag: '{{ticket_ref}}', desc: 'Ticket reference ID (e.g. TKT-0042)' },
      { tag: '{{ticket_title}}', desc: 'Subject line of the ticket' },
      { tag: '{{category}}', desc: 'Assigned equipment or department category' },
      { tag: '{{priority}}', desc: 'Ticket priority tier (e.g. High, Urgent)' },
      { tag: '{{ticket_link}}', desc: 'Direct URL to view the ticket in portal' },
    ],
    requiredPlaceholders: [],
  },
  {
    id: 'password_reset_otp',
    name: 'Password Reset OTP',
    category: 'Authentication',
    description: 'Dispatched to customers or staff requesting a 6-digit one-time code to reset their account password.',
    subject: 'Your Password Reset Verification Code',
    body: `Hello {{client_name}},

We received a request to reset the password for your Enterprise Support account.

Use this 6-digit verification code to proceed:
{{otp}}

This code will expire in {{expires_minutes}} minutes. If you did not request this password reset, please disregard this email or contact support.`,
    placeholders: [
      { tag: '{{client_name}}', desc: 'Full name of customer or employee' },
      { tag: '{{otp}}', desc: '6-digit one-time security passcode', isRequired: true },
      { tag: '{{expires_minutes}}', desc: 'Code validity window in minutes' },
    ],
    requiredPlaceholders: ['{{otp}}'],
  },
  {
    id: 'first_login_otp',
    name: 'First Login OTP',
    category: 'Account Activation',
    description: 'Sent to new users upon their first login verification challenge before establishing permanent credentials.',
    subject: 'Verify Your Account - First Login Code',
    body: `Hello {{name}},

Welcome to the Enterprise Ticketing Platform. Use this 6-digit verification code to complete your initial login and set your new password:

{{otp}}

This verification code expires in {{expires_minutes}} minutes.

If you were not expecting this invitation, please contact your administrator.`,
    placeholders: [
      { tag: '{{name}}', desc: 'Display name of user' },
      { tag: '{{otp}}', desc: '6-digit initial activation passcode', isRequired: true },
      { tag: '{{expires_minutes}}', desc: 'Code validity window in minutes' },
    ],
    requiredPlaceholders: ['{{otp}}'],
  },
  {
    id: 'customer_provisioned',
    name: 'Customer Provisioned',
    category: 'Onboarding',
    description: 'Automated welcome message sent when an administrator provisions a new customer account with temporary credentials.',
    subject: 'Your Enterprise Support Account Has Been Provisioned',
    body: `Hello {{client_name}},

Your account on the Enterprise Ticketing System has been successfully created. You can log in using the credentials below:

Email / Username: {{email}}
Temporary Password: {{temporary_password}}

Note: You will be prompted to verify your account with an OTP code and change your password upon your first login.

Thank you,
Scientific Biotech Specialties, Inc.`,
    placeholders: [
      { tag: '{{client_name}}', desc: 'Customer company or contact name' },
      { tag: '{{email}}', desc: 'Registered primary login email' },
      { tag: '{{temporary_password}}', desc: 'System-generated temporary password', isRequired: true },
    ],
    requiredPlaceholders: ['{{temporary_password}}'],
  },
];

const INITIAL_SMTP_CONFIG = {
  host: 'smtp.mailgun.org',
  port: '587',
  senderAddress: 'support@sbsi.com.ph',
  senderName: 'Scientific Biotech Specialties Support',
  username: 'postmaster@mg.sbsi.com.ph',
  password: 'sbsi_smtp_secret_token_123',
  encryption: 'TLS',
};

// Validation helpers
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
};

const isValidPhone = (phone) => {
  return /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]{6,15}$/.test(phone.trim());
};

const isValidUrl = (url) => {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export default function SuperAdminSettings() {
  // Navigation tabs (reusing group-pill styling pattern)
  const [activeTab, setActiveTab] = useState('all');

  // 1. Company Information State
  const [companyInfo, setCompanyInfo] = useState(INITIAL_COMPANY_INFO);
  const [companyErrors, setCompanyErrors] = useState({});

  // 2. System Status State
  const [systemStatus, setSystemStatus] = useState('Operational');

  // 3. Log Level State
  const [logLevel, setLogLevel] = useState('Info');

  // 4. TS102 Email Templates State
  const [emailTemplates, setEmailTemplates] = useState(INITIAL_EMAIL_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState(INITIAL_EMAIL_TEMPLATES[0].id);
  const [templateErrors, setTemplateErrors] = useState({});
  const [isSendingTest, setIsSendingTest] = useState(false);
  const bodyTextareaRef = useRef(null);

  // 5. TS102 Email Account (SMTP) State
  const [smtpConfig, setSmtpConfig] = useState(INITIAL_SMTP_CONFIG);
  const [savedSmtpConfig, setSavedSmtpConfig] = useState(INITIAL_SMTP_CONFIG);
  const [isAccountConfigured, setIsAccountConfigured] = useState(true); // Baseline account is already configured
  const [isPasswordSaved, setIsPasswordSaved] = useState(true); // Saved credential is fully masked
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [smtpErrors, setSmtpErrors] = useState({});
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [demoFailureMode, setDemoFailureMode] = useState(false); // Allows demonstrating failure result for PM/demo

  // Notification Modal State
  const [notification, setNotification] = useState(null);
  const closeNotif = () => setNotification(null);
  const showSuccess = (title, message) => setNotification({ type: 'success', title, message });
  const showError = (title, message) => setNotification({ type: 'error', title, message });
  const showConfirm = (title, message, onConfirm, opts = {}) =>
    setNotification({ type: 'confirm', title, message, onConfirm, onCancel: closeNotif, ...opts });

  // Currently active email template
  const currentTemplate = emailTemplates.find((t) => t.id === selectedTemplateId) || emailTemplates[0];

  // ── Company Information Handlers ──────────────────────────────────────────
  const handleCompanyFieldChange = (field, value) => {
    setCompanyInfo((prev) => ({ ...prev, [field]: value }));
    if (companyErrors[field]) {
      setCompanyErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSocialLinkChange = (id, key, value) => {
    setCompanyInfo((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.map((link) => (link.id === id ? { ...link, [key]: value } : link)),
    }));
    const errKey = `social_${id}`;
    if (companyErrors[errKey]) {
      setCompanyErrors((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
  };

  const handleAddSocialLink = () => {
    const newId = `soc-${Date.now()}`;
    setCompanyInfo((prev) => ({
      ...prev,
      socialLinks: [...prev.socialLinks, { id: newId, platform: 'LinkedIn', url: '' }],
    }));
  };

  const handleRemoveSocialLink = (id) => {
    setCompanyInfo((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((link) => link.id !== id),
    }));
    setCompanyErrors((prev) => {
      const next = { ...prev };
      delete next[`social_${id}`];
      return next;
    });
  };

  const handleSaveCompanyInfo = (e) => {
    if (e) e.preventDefault();
    const errors = {};

    if (!companyInfo.address.trim()) {
      errors.address = 'Headquarters address is required.';
    } else if (companyInfo.address.trim().length < 5) {
      errors.address = 'Please enter a complete address (minimum 5 characters).';
    }

    if (!companyInfo.contactNumber.trim()) {
      errors.contactNumber = 'Contact phone number is required.';
    } else if (!isValidPhone(companyInfo.contactNumber)) {
      errors.contactNumber = 'Please provide a valid phone number (e.g. +63 2 8635 9999 or (02) 8123-4567).';
    }

    if (!companyInfo.contactEmail.trim()) {
      errors.contactEmail = 'Contact email is required.';
    } else if (!isValidEmail(companyInfo.contactEmail)) {
      errors.contactEmail = 'Please provide a valid email address (e.g. support@sbsi.com.ph).';
    }

    companyInfo.socialLinks.forEach((link) => {
      if (!link.url.trim()) {
        errors[`social_${link.id}`] = 'URL cannot be empty.';
      } else if (!isValidUrl(link.url)) {
        errors[`social_${link.id}`] = 'Please enter a valid web URL starting with http:// or https://.';
      }
    });

    if (Object.keys(errors).length > 0) {
      setCompanyErrors(errors);
      return;
    }

    setCompanyErrors({});
    showSuccess(
      'Company Information Saved',
      'Corporate profile, contact lines, and social links updated in local state.'
    );
  };

  const handleResetCompanyInfo = () => {
    setCompanyInfo(INITIAL_COMPANY_INFO);
    setCompanyErrors({});
    showSuccess('Company Information Reset', 'Values have been restored to default.');
  };

  // ── System Status Handlers ───────────────────────────────────────────────
  const handleSelectSystemStatus = (newStatus) => {
    if (newStatus === systemStatus) return;

    if (newStatus === 'Under Maintenance') {
      showConfirm(
        'Set System to Under Maintenance?',
        'Setting status to Under Maintenance may restrict or affect access for other users. Are you sure?',
        () => {
          closeNotif();
          setSystemStatus('Under Maintenance');
          showSuccess(
            'System Status Updated',
            'Platform status set to "Under Maintenance". Advisory banners will be presented to non-admin users.'
          );
        },
        {
          confirmText: 'Set to Maintenance',
          confirmClassName: 'bg-amber-600 hover:bg-amber-700',
        }
      );
    } else {
      setSystemStatus(newStatus);
      showSuccess('System Status Restored', 'Platform status has been restored to "Operational".');
    }
  };

  // ── Log Level Handlers ───────────────────────────────────────────────────
  const handleSaveLogLevel = (newLevel) => {
    const levelToSet = newLevel || logLevel;
    setLogLevel(levelToSet);
    showSuccess(
      'Log Level Saved',
      `Diagnostic log verbosity set to "${levelToSet}" in local state.`
    );
  };

  // ── TS102 Email Templates Handlers ───────────────────────────────────────
  const handleTemplateFieldChange = (field, value) => {
    setEmailTemplates((prev) =>
      prev.map((t) => (t.id === selectedTemplateId ? { ...t, [field]: value } : t))
    );
    if (templateErrors[selectedTemplateId]) {
      setTemplateErrors((prev) => {
        const next = { ...prev };
        delete next[selectedTemplateId];
        return next;
      });
    }
  };

  const handleInsertPlaceholder = (placeholderTag) => {
    const textarea = bodyTextareaRef.current;
    const currentBody = currentTemplate.body || '';

    if (!textarea) {
      handleTemplateFieldChange('body', currentBody + ' ' + placeholderTag);
      return;
    }

    const start = textarea.selectionStart ?? currentBody.length;
    const end = textarea.selectionEnd ?? currentBody.length;
    const newBody = currentBody.substring(0, start) + placeholderTag + currentBody.substring(end);

    handleTemplateFieldChange('body', newBody);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholderTag.length, start + placeholderTag.length);
    }, 0);
  };

  const handleSaveTemplate = () => {
    if (!currentTemplate.subject.trim()) {
      setTemplateErrors((prev) => ({
        ...prev,
        [currentTemplate.id]: 'Template subject line cannot be empty.',
      }));
      return;
    }

    // Required placeholder validation: check body contains every placeholder marked "required"
    const missingRequired = (currentTemplate.requiredPlaceholders || []).filter(
      (ph) => !currentTemplate.body.includes(ph)
    );

    if (missingRequired.length > 0) {
      const missingTag = missingRequired[0];
      let contextualNote = 'Password reset emails cannot function without it.';
      if (currentTemplate.id === 'first_login_otp') {
        contextualNote = 'First login verification emails cannot function without it.';
      } else if (currentTemplate.id === 'customer_provisioned') {
        contextualNote = 'Account provisioning emails cannot function without it.';
      }

      setTemplateErrors((prev) => ({
        ...prev,
        [currentTemplate.id]: `This template is missing a required placeholder: ${missingTag}. ${contextualNote}`,
      }));
      return;
    }

    setTemplateErrors((prev) => {
      const next = { ...prev };
      delete next[currentTemplate.id];
      return next;
    });

    // Non-disruptive save per spec: no confirmation modal required
    showSuccess(
      'Template Saved',
      `"${currentTemplate.name}" template configuration updated in local state.`
    );
  };

  const handleResetCurrentTemplate = () => {
    const initialTmpl = INITIAL_EMAIL_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (!initialTmpl) return;

    setEmailTemplates((prev) =>
      prev.map((t) => (t.id === selectedTemplateId ? { ...initialTmpl } : t))
    );
    setTemplateErrors((prev) => {
      const next = { ...prev };
      delete next[selectedTemplateId];
      return next;
    });
    showSuccess('Template Reset', `"${initialTmpl.name}" has been restored to default template copy.`);
  };

  // SIMULATED: no real backend endpoint exists yet to send test emails. This must be wired to a real API before production.
  const handleSendTestEmail = () => {
    setIsSendingTest(true);
    setTimeout(() => {
      setIsSendingTest(false);
      showSuccess(
        'Test Email Dispatched',
        `Test email dispatched - a sample using the "${currentTemplate.name}" template was sent to your account email.`
      );
    }, 1000);
  };

  // ── TS102 Email Account Settings (SMTP) Handlers ─────────────────────────
  const handleSmtpFieldChange = (field, value) => {
    setSmtpConfig((prev) => ({ ...prev, [field]: value }));
    if (smtpErrors[field]) {
      setSmtpErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleStartEditingPassword = () => {
    setIsPasswordSaved(false);
    setSmtpConfig((prev) => ({ ...prev, password: '' }));
    setShowNewPassword(false);
  };

  const handleCancelEditingPassword = () => {
    setIsPasswordSaved(true);
    setSmtpConfig((prev) => ({ ...prev, password: savedSmtpConfig.password }));
    setShowNewPassword(false);
  };

  const handleSaveSmtpAccount = (e) => {
    if (e) e.preventDefault();
    const errors = {};

    if (!smtpConfig.host.trim()) errors.host = 'SMTP host/server is required.';
    if (!smtpConfig.port.trim()) errors.port = 'SMTP port is required.';
    if (!smtpConfig.senderAddress.trim()) {
      errors.senderAddress = 'Sender address is required.';
    } else if (!isValidEmail(smtpConfig.senderAddress)) {
      errors.senderAddress = 'Please provide a valid sender email address.';
    }
    if (!smtpConfig.username.trim()) errors.username = 'SMTP username is required.';
    if (!isPasswordSaved && !smtpConfig.password.trim()) {
      errors.password = 'Password cannot be empty when updating credentials.';
    }

    if (Object.keys(errors).length > 0) {
      setSmtpErrors(errors);
      return;
    }

    setSmtpErrors({});

    // Confirmation modal when changing an already-configured email account setup
    if (isAccountConfigured) {
      showConfirm(
        'Change Email Account Settings?',
        'This affects all outbound system emails going forward across the system.',
        () => {
          closeNotif();
          setSavedSmtpConfig({ ...smtpConfig });
          setIsPasswordSaved(true);
          setShowNewPassword(false);
          showSuccess(
            'Email Account Settings Saved',
            'SMTP delivery account updated in local state.'
          );
        },
        {
          confirmText: 'Apply SMTP Settings',
          confirmClassName: 'bg-[#252578] hover:bg-[#1a1a5e]',
          onCancel: () => {
            closeNotif();
            // Revert to prior values if cancelled
            setSmtpConfig({ ...savedSmtpConfig });
            setIsPasswordSaved(true);
            setShowNewPassword(false);
          },
        }
      );
    } else {
      // First-time configuration doesn't need a modal
      setSavedSmtpConfig({ ...smtpConfig });
      setIsAccountConfigured(true);
      setIsPasswordSaved(true);
      setShowNewPassword(false);
      showSuccess(
        'Email Account Configured',
        'SMTP delivery account configured in local state.'
      );
    }
  };

  // SIMULATED: no real backend endpoint exists yet to test SMTP connectivity. This must be wired to a real API before production.
  const handleTestConnection = () => {
    setIsTestingConnection(true);
    setTimeout(() => {
      setIsTestingConnection(false);
      if (demoFailureMode) {
        showError(
          'SMTP Connection Failed',
          `Connection timed out or authentication failed when communicating with ${smtpConfig.host}:${smtpConfig.port}. Please verify credentials and network firewall settings.`
        );
      } else {
        showSuccess(
          'SMTP Connection Succeeded',
          `Connected to mail server on port ${smtpConfig.port} using ${smtpConfig.encryption}.`
        );
      }
    }, 1000);
  };

  const TABS = [
    { id: 'all', label: 'All Settings', icon: <Layers size={14} /> },
    { id: 'company', label: 'Company Information', icon: <Building2 size={14} /> },
    { id: 'status', label: 'System Status', icon: <Activity size={14} /> },
    { id: 'logs', label: 'Log Level', icon: <Terminal size={14} /> },
    { id: 'email', label: 'Email & SMTP', icon: <Mail size={14} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Interactive Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-gray-500">
        <span className="text-gray-400">Super Admin</span>
        <span className="text-gray-300">/</span>
        <span className="text-[#252578] font-semibold">System Settings</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#252578]">System Settings</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200 shadow-2xs">
              <AlertCircle size={13} className="shrink-0" />
              <span>Changes are not yet saved - persistence coming soon</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Configure global corporate information, system operational state, diagnostic logging, and transactional email infrastructure.
          </p>
        </div>

        {/* Global System State Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto rounded-xl border border-gray-200 bg-white px-3.5 py-2 shadow-2xs">
          <span className="text-xs text-gray-400 font-medium">Platform:</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
              systemStatus === 'Operational'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                systemStatus === 'Operational' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {systemStatus}
          </span>
        </div>
      </div>

      {/* Navigation Pills (reusing SuperAdmin group-pill pattern) */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit flex-wrap shadow-xs">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                isActive ? 'bg-white text-[#252578] shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col gap-6">
        {/* =================================================================== */}
        {/* SECTION 1: Company Information (TS097)                              */}
        {/* =================================================================== */}
        {(activeTab === 'all' || activeTab === 'company') && (
          <section aria-labelledby="section-company-heading" className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#252578]/10 text-[#252578]">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 id="section-company-heading" className="text-base sm:text-lg font-bold text-gray-900">
                    Company Information
                  </h2>
                  <p className="text-xs text-gray-500">
                    Global company headquarters address, primary contact lines, and official social media presences.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200 self-start sm:self-auto">
                Independent Save
              </span>
            </div>

            <form onSubmit={handleSaveCompanyInfo} className="mt-6 space-y-6">
              {/* Address Field */}
              <div className="space-y-1.5">
                <label htmlFor="company-address" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Headquarters Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="company-address"
                  rows={3}
                  value={companyInfo.address}
                  onChange={(e) => handleCompanyFieldChange('address', e.target.value)}
                  placeholder="e.g. SBSI Building, 28 East Capitol Drive, Pasig City..."
                  className={`w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none transition-all resize-y ${
                    companyErrors.address
                      ? 'border-red-300 bg-red-50/40 text-red-900 focus:ring-2 focus:ring-red-400'
                      : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-[#252578]'
                  }`}
                />
                {companyErrors.address && (
                  <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle size={12} className="shrink-0" />
                    {companyErrors.address}
                  </p>
                )}
              </div>

              {/* Contact Grid: Phone and Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Contact Phone */}
                <div className="space-y-1.5">
                  <label htmlFor="company-phone" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                    Contact Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <Phone size={16} />
                    </span>
                    <input
                      id="company-phone"
                      type="text"
                      value={companyInfo.contactNumber}
                      onChange={(e) => handleCompanyFieldChange('contactNumber', e.target.value)}
                      placeholder="e.g. +63 2 8635 9999"
                      className={`w-full rounded-xl border pl-10 pr-4 py-3 text-sm font-semibold outline-none transition-all ${
                        companyErrors.contactNumber
                          ? 'border-red-300 bg-red-50/40 text-red-900 focus:ring-2 focus:ring-red-400'
                          : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-[#252578]'
                      }`}
                    />
                  </div>
                  {companyErrors.contactNumber && (
                    <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                      <AlertCircle size={12} className="shrink-0" />
                      {companyErrors.contactNumber}
                    </p>
                  )}
                </div>

                {/* Contact Email */}
                <div className="space-y-1.5">
                  <label htmlFor="company-email" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                    Contact Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <Mail size={16} />
                    </span>
                    <input
                      id="company-email"
                      type="email"
                      value={companyInfo.contactEmail}
                      onChange={(e) => handleCompanyFieldChange('contactEmail', e.target.value)}
                      placeholder="e.g. support@sbsi.com.ph"
                      className={`w-full rounded-xl border pl-10 pr-4 py-3 text-sm font-semibold outline-none transition-all ${
                        companyErrors.contactEmail
                          ? 'border-red-300 bg-red-50/40 text-red-900 focus:ring-2 focus:ring-red-400'
                          : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-[#252578]'
                      }`}
                    />
                  </div>
                  {companyErrors.contactEmail && (
                    <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                      <AlertCircle size={12} className="shrink-0" />
                      {companyErrors.contactEmail}
                    </p>
                  )}
                </div>
              </div>

              {/* Social Media Links Section */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Official Social Media Profiles</h3>
                    <p className="text-xs text-gray-400">External brand links displayed across public customer portals and footers.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSocialLink}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#252578] hover:bg-gray-50 transition-all shadow-2xs cursor-pointer"
                  >
                    <Plus size={14} />
                    Add Link
                  </button>
                </div>

                <div className="space-y-3">
                  {companyInfo.socialLinks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-500">
                      No social links configured. Click "Add Link" to register external profiles.
                    </div>
                  ) : (
                    companyInfo.socialLinks.map((link) => {
                      const linkError = companyErrors[`social_${link.id}`];
                      return (
                        <div key={link.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-xl border border-gray-200/80 bg-gray-50/50">
                          {/* Platform Selector */}
                          <div className="w-full sm:w-44 shrink-0">
                            <select
                              value={link.platform}
                              onChange={(e) => handleSocialLinkChange(link.id, 'platform', e.target.value)}
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:ring-1 focus:ring-[#252578] cursor-pointer"
                            >
                              {SOCIAL_PLATFORMS.map((plat) => (
                                <option key={plat} value={plat}>
                                  {plat}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* URL Input */}
                          <div className="flex-1 min-w-0">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <Globe size={14} />
                              </span>
                              <input
                                type="url"
                                value={link.url}
                                onChange={(e) => handleSocialLinkChange(link.id, 'url', e.target.value)}
                                placeholder="https://..."
                                className={`w-full rounded-lg border pl-9 pr-3 py-2 text-xs font-medium outline-none transition-all ${
                                  linkError
                                    ? 'border-red-300 bg-red-50/40 text-red-900 focus:ring-1 focus:ring-red-400'
                                    : 'border-gray-200 bg-white text-gray-900 focus:ring-1 focus:ring-[#252578]'
                                }`}
                              />
                            </div>
                            {linkError && (
                              <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1 mt-1">
                                <AlertCircle size={10} className="shrink-0" />
                                {linkError}
                              </p>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 self-end sm:self-center">
                            {link.url && isValidUrl(link.url) && (
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open link in new tab"
                                className="p-2 text-gray-400 hover:text-[#252578] hover:bg-white rounded-lg transition-colors cursor-pointer"
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveSocialLink(link.id)}
                              title="Delete link"
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Form Action Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleResetCompanyInfo}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                >
                  <RotateCcw size={13} />
                  Restore Defaults
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#1a1a5e] hover:shadow-md cursor-pointer ml-auto"
                >
                  <Save size={16} />
                  Save Company Info
                </button>
              </div>
            </form>
          </section>
        )}

        {/* =================================================================== */}
        {/* SECTION 2: System Status (TS097)                                    */}
        {/* =================================================================== */}
        {(activeTab === 'all' || activeTab === 'status') && (
          <section aria-labelledby="section-status-heading" className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#252578]/10 text-[#252578]">
                  <Activity size={20} />
                </div>
                <div>
                  <h2 id="section-status-heading" className="text-base sm:text-lg font-bold text-gray-900">
                    System Status
                  </h2>
                  <p className="text-xs text-gray-500">
                    Control the global operating state of the platform. Maintenance mode notifies users and may restrict interactions.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200 self-start sm:self-auto">
                Independent Save
              </span>
            </div>

            {/* Status Selectors */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Operational */}
              <div
                onClick={() => handleSelectSystemStatus('Operational')}
                className={`rounded-2xl border p-5 transition-all cursor-pointer select-none flex flex-col justify-between ${
                  systemStatus === 'Operational'
                    ? 'border-[#252578] bg-[#252578]/5 shadow-sm ring-1 ring-[#252578]'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live Status
                    </span>
                    {systemStatus === 'Operational' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#252578]">
                        <CheckCircle2 size={16} className="text-[#252578]" />
                        Active
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mt-3 flex items-center gap-2">
                    Operational
                  </h3>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    All microservices, customer portals, agent assignment queues, and email alerts are active and running normally.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <span>Standard production mode</span>
                  <span className="font-semibold text-emerald-600">Normal Access</span>
                </div>
              </div>

              {/* Option 2: Under Maintenance */}
              <div
                onClick={() => handleSelectSystemStatus('Under Maintenance')}
                className={`rounded-2xl border p-5 transition-all cursor-pointer select-none flex flex-col justify-between ${
                  systemStatus === 'Under Maintenance'
                    ? 'border-amber-400 bg-amber-50/30 shadow-sm ring-1 ring-amber-400'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Restricted Mode
                    </span>

                    <div className="flex items-center gap-2">
                      <div className="relative group inline-flex items-center">
                        <button
                          type="button"
                          aria-label="Under Maintenance warning information"
                          onClick={(e) => e.stopPropagation()}
                          className="text-amber-600 hover:text-amber-800 cursor-help p-1 rounded-full hover:bg-amber-100/50 transition-colors"
                        >
                          <Info size={16} />
                        </button>
                        <div className="pointer-events-none absolute bottom-full right-0 mb-2 hidden w-72 rounded-xl bg-gray-900 p-3 text-center text-xs text-white shadow-xl group-hover:block z-50 leading-relaxed">
                          This may restrict login access or show a maintenance banner to users - confirm the intended behavior with your team before enabling.
                          <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900" />
                        </div>
                      </div>

                      {systemStatus === 'Under Maintenance' && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                          <CheckCircle2 size={16} className="text-amber-600" />
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-gray-900 mt-3 flex items-center gap-2">
                    Under Maintenance
                    <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  </h3>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    Platform maintenance window is active. Non-admin users will be presented with advisory notifications or restricted access.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <span>Restricted maintenance state</span>
                  <span className="font-semibold text-amber-600">Requires Confirmation</span>
                </div>
              </div>
            </div>

            {/* Status Information Box */}
            <div
              className={`mt-5 rounded-xl border p-4 flex items-start gap-3 transition-colors ${
                systemStatus === 'Operational'
                  ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
                  : 'border-amber-200 bg-amber-50/50 text-amber-900'
              }`}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 mt-0.5 ${
                  systemStatus === 'Operational' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {systemStatus === 'Operational' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              </div>
              <div className="text-xs leading-relaxed">
                <span className="font-bold">Current System Condition: </span>
                {systemStatus === 'Operational' ? (
                  <span>Platform is fully healthy and operating as expected. Customer intake forms and employee queues are unobstructed.</span>
                ) : (
                  <span>
                    Platform is running in maintenance mode. Switching back to <strong>Operational</strong> takes effect immediately without requiring a confirmation dialog.
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* SECTION 3: Log Level (TS097)                                        */}
        {/* =================================================================== */}
        {(activeTab === 'all' || activeTab === 'logs') && (
          <section aria-labelledby="section-logs-heading" className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#252578]/10 text-[#252578]">
                  <Terminal size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="section-logs-heading" className="text-base sm:text-lg font-bold text-gray-900">
                      Log Level Configuration
                    </h2>
                    <div className="relative group inline-flex items-center">
                      <button
                        type="button"
                        aria-label="Log Level verbosity information"
                        className="text-gray-400 hover:text-[#252578] cursor-help p-0.5"
                      >
                        <Info size={15} />
                      </button>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-80 rounded-xl bg-gray-900 p-3 text-center text-xs text-white shadow-xl group-hover:block z-50 leading-relaxed">
                        Higher verbosity levels (like Debug) produce significantly more log data and are typically intended for troubleshooting rather than everyday operation.
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Set the minimum severity threshold for microservice and gateway log streams.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200 self-start sm:self-auto">
                Independent Save
              </span>
            </div>

            <div className="mt-6 space-y-6">
              {/* Select Dropdown & Current Level */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                <div className="space-y-1.5">
                  <label htmlFor="log-level-select" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                    Diagnostic Logging Threshold
                  </label>
                  <div className="relative">
                    <select
                      id="log-level-select"
                      value={logLevel}
                      onChange={(e) => setLogLevel(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-[#252578] cursor-pointer appearance-none pr-10 shadow-2xs"
                    >
                      {LOG_LEVELS.map((lvl) => (
                        <option key={lvl.level} value={lvl.level}>
                          {lvl.level} — {lvl.level === 'Info' ? 'Standard Default' : lvl.description.slice(0, 40) + '...'}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Current Active Badge Box */}
                <div className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-400 font-medium block">Active Verbosity</span>
                    <span className="text-sm font-bold text-gray-900 mt-0.5 block">{logLevel} Mode</span>
                  </div>
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold border ${
                      LOG_LEVELS.find((l) => l.level === logLevel)?.badgeClass || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {logLevel}
                  </span>
                </div>
              </div>

              {/* Log Level Options Visual Matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                {LOG_LEVELS.map((item) => {
                  const isSelected = item.level === logLevel;
                  return (
                    <div
                      key={item.level}
                      onClick={() => setLogLevel(item.level)}
                      className={`rounded-xl border p-4 transition-all cursor-pointer select-none flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#252578] bg-[#252578]/5 shadow-xs ring-1 ring-[#252578]'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/40 opacity-80'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border ${item.badgeClass}`}>
                            {item.level}
                          </span>
                          {isSelected && <CheckCircle2 size={14} className="text-[#252578]" />}
                        </div>
                        <p className="text-xs text-gray-600 mt-2.5 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => handleSaveLogLevel(logLevel)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#1a1a5e] hover:shadow-md cursor-pointer"
                >
                  <Save size={16} />
                  Save Log Level
                </button>
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* SECTION 4: TS102 Email Templates & Account Configuration            */}
        {/* =================================================================== */}
        {(activeTab === 'all' || activeTab === 'email') && (
          <div className="flex flex-col gap-6">
            {/* SUB-SECTION 4A: Email Templates Editor */}
            <section aria-labelledby="section-templates-heading" className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-7 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#252578]/10 text-[#252578]">
                    <Mail size={20} />
                  </div>
                  <div>
                    <h2 id="section-templates-heading" className="text-base sm:text-lg font-bold text-gray-900">
                      System Email Templates
                    </h2>
                    <p className="text-xs text-gray-500">
                      Customize subjects and body messages for transactional notifications, OTP codes, and welcome credentials.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200 self-start sm:self-auto">
                  Independent Save
                </span>
              </div>

              {/* Template Switcher Tabs */}
              <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-200 pb-3">
                {emailTemplates.map((tmpl) => {
                  const isSelected = tmpl.id === selectedTemplateId;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(tmpl.id);
                        setTemplateErrors({});
                      }}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#252578] text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900'
                      }`}
                    >
                      <span>{tmpl.name}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {tmpl.category}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Template Editor Box */}
              <div className="mt-5 space-y-5">
                {/* Header Description & Send Test Email */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200/80">
                  <div className="text-xs text-gray-600 leading-relaxed">
                    <span className="font-bold text-gray-900">{currentTemplate.name}: </span>
                    {currentTemplate.description}
                  </div>
                  {/* SIMULATED: no real backend endpoint exists yet to send test emails. This must be wired to a real API before production. */}
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={isSendingTest}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100/80 hover:text-[#252578] transition-all shadow-2xs shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingTest ? (
                      <RefreshCw size={13} className="animate-spin text-[#252578]" />
                    ) : (
                      <Send size={13} className="text-[#252578]" />
                    )}
                    <span>{isSendingTest ? 'Sending Test...' : 'Send Test Email'}</span>
                  </button>
                </div>

                {/* Subject Field */}
                <div className="space-y-1.5">
                  <label htmlFor="template-subject-input" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                    Email Subject Line <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="template-subject-input"
                    type="text"
                    value={currentTemplate.subject}
                    onChange={(e) => handleTemplateFieldChange('subject', e.target.value)}
                    placeholder="Enter email subject..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-[#252578]"
                  />
                </div>

                {/* Available Variables / Placeholder Chip Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                      Available Placeholders <span className="text-[11px] font-normal text-gray-400 lowercase">(click to insert at cursor)</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-gray-100 bg-gray-50/70">
                    {currentTemplate.placeholders.map((ph) => (
                      <button
                        key={ph.tag}
                        type="button"
                        onClick={() => handleInsertPlaceholder(ph.tag)}
                        title={`${ph.desc}${ph.isRequired ? ' (Required)' : ''}`}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition-all shadow-2xs cursor-pointer select-none ${
                          ph.isRequired
                            ? 'bg-amber-100/80 text-amber-900 border border-amber-300 hover:bg-amber-200/80'
                            : 'bg-white text-gray-700 border border-gray-200 hover:border-[#252578] hover:text-[#252578]'
                        }`}
                      >
                        <span>{ph.tag}</span>
                        {ph.isRequired && (
                          <span className="rounded bg-amber-600 px-1 py-0.2 text-[9px] font-sans font-bold text-white uppercase tracking-wider">
                            Required
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Body Textarea */}
                <div className="space-y-1.5">
                  <label htmlFor="template-body-textarea" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                    Message Body Template <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="template-body-textarea"
                    ref={bodyTextareaRef}
                    rows={9}
                    value={currentTemplate.body}
                    onChange={(e) => handleTemplateFieldChange('body', e.target.value)}
                    className={`w-full rounded-xl border px-4 py-3 text-xs sm:text-sm font-mono leading-relaxed outline-none transition-all resize-y ${
                      templateErrors[currentTemplate.id]
                        ? 'border-red-300 bg-red-50/40 text-red-900 focus:ring-2 focus:ring-red-400'
                        : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-[#252578]'
                    }`}
                  />
                  {templateErrors[currentTemplate.id] && (
                    <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                      <AlertCircle size={13} className="shrink-0" />
                      {templateErrors[currentTemplate.id]}
                    </p>
                  )}
                </div>

                {/* Template Action Bar */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleResetCurrentTemplate}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    Restore Default Template
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#1a1a5e] hover:shadow-md cursor-pointer ml-auto"
                  >
                    <Save size={16} />
                    Save Template
                  </button>
                </div>
              </div>
            </section>

            {/* SUB-SECTION 4B: Email Account Settings (SMTP) */}
            <section aria-labelledby="section-smtp-heading" className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-7 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#252578]/10 text-[#252578]">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h2 id="section-smtp-heading" className="text-base sm:text-lg font-bold text-gray-900">
                      Email Account Settings (SMTP)
                    </h2>
                    <p className="text-xs text-gray-500">
                      Outbound SMTP mailer host, port, authentication credentials, and default sender identity.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200 self-start sm:self-auto">
                  Independent Save
                </span>
              </div>

              {/* Informational Security Notice */}
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/70 p-4 flex items-start gap-3 text-blue-900 shadow-2xs">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 shrink-0 mt-0.5">
                  <ShieldCheck size={18} />
                </div>
                <div className="text-xs leading-relaxed">
                  <span className="font-bold">Security & Encryption Notice: </span>
                  All credentials will be encrypted at rest and all SMTP communication encrypted in transit once backend persistence is implemented.
                </div>
              </div>

              {/* SMTP Form */}
              <form onSubmit={handleSaveSmtpAccount} className="mt-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* SMTP Server / Host */}
                  <div className="space-y-1.5">
                    <label htmlFor="smtp-host-input" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                      SMTP Server / Host <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="smtp-host-input"
                      type="text"
                      value={smtpConfig.host}
                      onChange={(e) => handleSmtpFieldChange('host', e.target.value)}
                      placeholder="e.g. smtp.mailgun.org"
                      className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold outline-none transition-all ${
                        smtpErrors.host
                          ? 'border-red-300 bg-red-50/40 text-red-900 focus:ring-2 focus:ring-red-400'
                          : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-[#252578]'
                      }`}
                    />
                    {smtpErrors.host && (
                      <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                        <AlertCircle size={12} className="shrink-0" />
                        {smtpErrors.host}
                      </p>
                    )}
                  </div>

                  {/* Port */}
                  <div className="space-y-1.5">
                    <label htmlFor="smtp-port-input" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                      Port <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="smtp-port-input"
                      type="text"
                      value={smtpConfig.port}
                      onChange={(e) => handleSmtpFieldChange('port', e.target.value)}
                      placeholder="e.g. 587 or 465"
                      className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold outline-none transition-all ${
                        smtpErrors.port
                          ? 'border-red-300 bg-red-50/40 text-red-900 focus:ring-2 focus:ring-red-400'
                          : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-[#252578]'
                      }`}
                    />
                    {smtpErrors.port && (
                      <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                        <AlertCircle size={12} className="shrink-0" />
                        {smtpErrors.port}
                      </p>
                    )}
                  </div>

                  {/* Encryption */}
                  <div className="space-y-1.5">
                    <label htmlFor="smtp-encryption-select" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                      Encryption Protocol
                    </label>
                    <select
                      id="smtp-encryption-select"
                      value={smtpConfig.encryption}
                      onChange={(e) => handleSmtpFieldChange('encryption', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-[#252578] cursor-pointer"
                    >
                      <option value="TLS">TLS (Recommended - Port 587)</option>
                      <option value="SSL">SSL (Port 465)</option>
                      <option value="None">None (Unencrypted)</option>
                    </select>
                  </div>

                  {/* Sender Email Address */}
                  <div className="space-y-1.5">
                    <label htmlFor="smtp-sender-email" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                      Default Sender Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="smtp-sender-email"
                      type="email"
                      value={smtpConfig.senderAddress}
                      onChange={(e) => handleSmtpFieldChange('senderAddress', e.target.value)}
                      placeholder="support@sbsi.com.ph"
                      className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold outline-none transition-all ${
                        smtpErrors.senderAddress
                          ? 'border-red-300 bg-red-50/40 text-red-900 focus:ring-2 focus:ring-red-400'
                          : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-[#252578]'
                      }`}
                    />
                    {smtpErrors.senderAddress && (
                      <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                        <AlertCircle size={12} className="shrink-0" />
                        {smtpErrors.senderAddress}
                      </p>
                    )}
                  </div>

                  {/* SMTP Username */}
                  <div className="space-y-1.5">
                    <label htmlFor="smtp-username-input" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                      SMTP Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="smtp-username-input"
                      type="text"
                      value={smtpConfig.username}
                      onChange={(e) => handleSmtpFieldChange('username', e.target.value)}
                      placeholder="postmaster@mg.sbsi.com.ph"
                      className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold outline-none transition-all ${
                        smtpErrors.username
                          ? 'border-red-300 bg-red-50/40 text-red-900 focus:ring-2 focus:ring-red-400'
                          : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-[#252578]'
                      }`}
                    />
                    {smtpErrors.username && (
                      <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                        <AlertCircle size={12} className="shrink-0" />
                        {smtpErrors.username}
                      </p>
                    )}
                  </div>

                  {/* SMTP Password with Masking Adjustment */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="smtp-password-input" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                        SMTP Password / Token <span className="text-red-500">*</span>
                      </label>
                      {isPasswordSaved ? (
                        <button
                          type="button"
                          onClick={handleStartEditingPassword}
                          className="text-xs font-semibold text-[#252578] hover:underline cursor-pointer"
                        >
                          Change Secret
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCancelEditingPassword}
                          className="text-xs font-semibold text-gray-500 hover:text-gray-800 cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      {isPasswordSaved ? (
                        // Saved state: fully masked dots with NO reveal toggle
                        <div className="flex items-center">
                          <input
                            id="smtp-password-input"
                            type="password"
                            value="••••••••••••••••"
                            readOnly
                            disabled
                            className="w-full rounded-xl border border-gray-200 bg-gray-100/70 px-4 py-2.5 text-sm font-mono tracking-widest text-gray-500 cursor-not-allowed select-none"
                          />
                          <Lock size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      ) : (
                        // Active editing state: eye-icon reveal toggle applies
                        <div className="relative">
                          <input
                            id="smtp-password-input"
                            type={showNewPassword ? 'text' : 'password'}
                            value={smtpConfig.password}
                            onChange={(e) => handleSmtpFieldChange('password', e.target.value)}
                            placeholder="Enter new password or API token..."
                            autoFocus
                            className={`w-full rounded-xl border pr-10 pl-4 py-2.5 text-sm font-semibold outline-none transition-all ${
                              smtpErrors.password
                                ? 'border-red-300 bg-red-50/40 text-red-900 focus:ring-2 focus:ring-red-400'
                                : 'border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-[#252578]'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                            aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                          >
                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      )}
                    </div>

                    {isPasswordSaved ? (
                      <p className="text-[11px] text-gray-500 italic mt-1 leading-normal">
                        For security, saved credentials cannot be viewed - re-enter to change.
                      </p>
                    ) : (
                      smtpErrors.password && (
                        <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                          <AlertCircle size={12} className="shrink-0" />
                          {smtpErrors.password}
                        </p>
                      )
                    )}
                  </div>
                </div>

                {/* SMTP Action Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-4 border-t border-gray-100 gap-3">
                  {/* Left: Test Connection action & failure mode toggle */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* SIMULATED: no real backend endpoint exists yet to test SMTP connectivity. This must be wired to a real API before production. */}
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-[#252578] transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      {isTestingConnection ? (
                        <RefreshCw size={15} className="animate-spin text-[#252578]" />
                      ) : (
                        <Check size={15} className="text-green-600" />
                      )}
                      <span>{isTestingConnection ? 'Testing...' : 'Test Connection'}</span>
                    </button>

                    {/* Simulation toggle for evaluators / demo testing */}
                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={demoFailureMode}
                        onChange={(e) => setDemoFailureMode(e.target.checked)}
                        className="rounded border-gray-300 text-[#252578] focus:ring-[#252578]"
                      />
                      <span>Simulate connection failure for demo</span>
                    </label>
                  </div>

                  {/* Right: Reset & Save Account Settings */}
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSmtpConfig(INITIAL_SMTP_CONFIG);
                        setSavedSmtpConfig(INITIAL_SMTP_CONFIG);
                        setIsPasswordSaved(true);
                        setSmtpErrors({});
                        showSuccess('SMTP Reset', 'Account settings restored to baseline.');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      Restore Defaults
                    </button>

                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#1a1a5e] hover:shadow-md cursor-pointer"
                    >
                      <Save size={16} />
                      Save Account Settings
                    </button>
                  </div>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>

      {/* Global Notification Modal */}
      <NotificationModal
        isOpen={!!notification}
        type={notification?.type}
        title={notification?.title}
        message={notification?.message}
        onClose={closeNotif}
        onConfirm={notification?.onConfirm}
        onCancel={notification?.onCancel}
        confirmText={notification?.confirmText}
        confirmClassName={notification?.confirmClassName}
      />
    </div>
  );
}
