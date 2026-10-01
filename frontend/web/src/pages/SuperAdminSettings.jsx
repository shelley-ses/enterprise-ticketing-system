import React, { useState, useEffect } from 'react';
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
  RefreshCw,
  Database
} from 'lucide-react';
import NotificationModal from '@/components/NotificationModal';
import {
  getAllSystemConfigurations,
  saveSystemConfiguration,
  resetSystemConfiguration,
} from '@/services/configurationService';

// =========================================================================
// Initial Baseline Data
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
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('all');

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingLogLevel, setIsSavingLogLevel] = useState(false);

  // 1. Company Information State
  const [companyInfo, setCompanyInfo] = useState(INITIAL_COMPANY_INFO);
  const [companyErrors, setCompanyErrors] = useState({});

  // 2. System Status State
  const [systemStatus, setSystemStatus] = useState('Operational');

  // 3. Log Level State
  const [logLevel, setLogLevel] = useState('Info');

  // Notification Modal State
  const [notification, setNotification] = useState(null);
  const closeNotif = () => setNotification(null);
  const showSuccess = (title, message) => setNotification({ type: 'success', title, message });
  const showError = (title, message) => setNotification({ type: 'error', title, message });
  const showConfirm = (title, message, onConfirm, opts = {}) =>
    setNotification({ type: 'confirm', title, message, onConfirm, onCancel: closeNotif, ...opts });

  // ── Fetch from Database on Mount ──────────────────────────────────────────
  const loadSystemConfig = async () => {
    setIsLoading(true);
    try {
      const data = await getAllSystemConfigurations();
      if (data) {
        if (data.company_info) {
          setCompanyInfo(data.company_info);
        }
        if (data.system_status?.status) {
          setSystemStatus(data.system_status.status);
        }
        if (data.log_level?.level) {
          setLogLevel(data.log_level.level);
        }
      }
    } catch (err) {
      console.error('Failed to load system configurations from database:', err);
      showError(
        'Failed to Load Configurations',
        'Could not retrieve system configuration from the database. Default values are shown.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSystemConfig();
  }, []);

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

  const handleSaveCompanyInfo = async (e) => {
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
    setIsSavingCompany(true);
    try {
      const res = await saveSystemConfiguration('company_info', companyInfo);
      if (res.value) {
        setCompanyInfo(res.value);
      }
      showSuccess(
        'Company Information Saved',
        'Corporate profile, contact lines, and social links have been saved to the database.'
      );
    } catch (err) {
      console.error('Failed to save company information:', err);
      showError(
        'Save Failed',
        err.response?.data?.message || 'Failed to save company information to the database.'
      );
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleResetCompanyInfo = async () => {
    setIsSavingCompany(true);
    try {
      const res = await resetSystemConfiguration('company_info');
      if (res.value) {
        setCompanyInfo(res.value);
      } else {
        setCompanyInfo(INITIAL_COMPANY_INFO);
      }
      setCompanyErrors({});
      showSuccess('Company Information Reset', 'Values have been restored to system baseline in the database.');
    } catch (err) {
      console.error('Failed to reset company information:', err);
      showError('Reset Failed', 'Failed to reset company information in the database.');
    } finally {
      setIsSavingCompany(false);
    }
  };

  // ── System Status Handlers ───────────────────────────────────────────────
  const persistSystemStatus = async (statusValue) => {
    setIsSavingStatus(true);
    try {
      await saveSystemConfiguration('system_status', { status: statusValue });
      setSystemStatus(statusValue);
      if (statusValue === 'Under Maintenance') {
        showSuccess(
          'System Status Updated',
          'Platform status set to "Under Maintenance" in the database. Advisory banners will be presented to non-admin users.'
        );
      } else {
        showSuccess('System Status Restored', 'Platform status has been restored to "Operational" in the database.');
      }
    } catch (err) {
      console.error('Failed to save system status:', err);
      showError('Status Update Failed', 'Failed to persist system status to the database.');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleSelectSystemStatus = (newStatus) => {
    if (newStatus === systemStatus) return;

    if (newStatus === 'Under Maintenance') {
      showConfirm(
        'Set System to Under Maintenance?',
        'Setting status to Under Maintenance may restrict or affect access for other users. Are you sure?',
        () => {
          closeNotif();
          persistSystemStatus('Under Maintenance');
        },
        {
          confirmText: 'Set to Maintenance',
          confirmClassName: 'bg-amber-600 hover:bg-amber-700',
        }
      );
    } else {
      persistSystemStatus('Operational');
    }
  };

  // ── Log Level Handlers ───────────────────────────────────────────────────
  const handleSaveLogLevel = async (newLevel) => {
    const levelToSet = newLevel || logLevel;
    setIsSavingLogLevel(true);
    try {
      await saveSystemConfiguration('log_level', { level: levelToSet });
      setLogLevel(levelToSet);
      showSuccess(
        'Log Level Saved',
        `Diagnostic log verbosity set to "${levelToSet}" and saved to the database.`
      );
    } catch (err) {
      console.error('Failed to save log level:', err);
      showError('Save Failed', 'Failed to save log level to the database.');
    } finally {
      setIsSavingLogLevel(false);
    }
  };

  const TABS = [
    { id: 'all', label: 'All Settings', icon: <Layers size={14} /> },
    { id: 'company', label: 'Company Information', icon: <Building2 size={14} /> },
    { id: 'status', label: 'System Status', icon: <Activity size={14} /> },
    { id: 'logs', label: 'Log Level', icon: <Terminal size={14} /> },
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 shadow-2xs">
              <Database size={13} className="shrink-0 text-emerald-600" />
              <span>Database Connected</span>
            </span>
            {isLoading && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-medium">
                <RefreshCw size={12} className="animate-spin" />
                Syncing settings...
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Configure global corporate information, system operational state, and diagnostic logging thresholds.
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

      {/* Navigation Pills */}
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
        {/* SECTION 1: Company Information                                      */}
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
                Persisted to Database
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
                  disabled={isSavingCompany}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw size={13} />
                  Restore Defaults
                </button>

                <button
                  type="submit"
                  disabled={isSavingCompany}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#1a1a5e] hover:shadow-md cursor-pointer ml-auto disabled:opacity-50"
                >
                  {isSavingCompany ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  <span>{isSavingCompany ? 'Saving...' : 'Save Company Info'}</span>
                </button>
              </div>
            </form>
          </section>
        )}

        {/* =================================================================== */}
        {/* SECTION 2: System Status                                            */}
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
                Persisted to Database
              </span>
            </div>

            {/* Status Selectors */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Operational */}
              <div
                onClick={() => !isSavingStatus && handleSelectSystemStatus('Operational')}
                className={`rounded-2xl border p-5 transition-all cursor-pointer select-none flex flex-col justify-between ${
                  systemStatus === 'Operational'
                    ? 'border-[#252578] bg-[#252578]/5 shadow-sm ring-1 ring-[#252578]'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                } ${isSavingStatus ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                onClick={() => !isSavingStatus && handleSelectSystemStatus('Under Maintenance')}
                className={`rounded-2xl border p-5 transition-all cursor-pointer select-none flex flex-col justify-between ${
                  systemStatus === 'Under Maintenance'
                    ? 'border-amber-400 bg-amber-50/30 shadow-sm ring-1 ring-amber-400'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                } ${isSavingStatus ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                          This may restrict login access or show a maintenance banner to users.
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
                    Platform is running in maintenance mode. Switching back to <strong>Operational</strong> updates the database immediately.
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* SECTION 3: Log Level                                                */}
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
                Persisted to Database
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
                  disabled={isSavingLogLevel}
                  onClick={() => handleSaveLogLevel(logLevel)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#1a1a5e] hover:shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSavingLogLevel ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  <span>{isSavingLogLevel ? 'Saving...' : 'Save Log Level'}</span>
                </button>
              </div>
            </div>
          </section>
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
