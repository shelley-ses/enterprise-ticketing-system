import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, AlertCircle, CheckCircle, X, Clock, ShieldAlert } from 'lucide-react';
import FilePreviewModal from './FilePreviewModal';
import FeedbackModal from './feedback/FeedbackModal';
import TicketFeedbackSection from './feedback/TicketFeedbackSection';
import ReassignmentDisapprovalBanner from './employee/ReassignmentDisapprovalBanner';
import { statusColors, priorityColors } from '@/constants/employeeTickets';
import { formatDisplayDate } from '@/utils/dateUtils';
import { hasFeedbackBeenSubmitted, isFeedbackFormEnabled, setFeedbackFormEnabled } from '@/data/mockFeedbackData';
import { getFeedbackFormStatus, getWindowConfiguration, getCachedWindowConfiguration } from '@/services/configurationService';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';

const getFileName = (file, fallback = 'Attachment') => {
  if (!file) return fallback;
  if (typeof file === 'string') return file.split('/').pop() || fallback;
  return file.name || file.file_name || fallback;
};

const getFileUrl = (file) => {
  if (!file) return '';
  if (typeof file === 'string') return file;
  return file.url || file.file_path || file.path || '';
};

export default function CustomerTicketDetailModal({
  ticket,
  onClose,
  onDiscard,
  onReopen,
  onResolve,
  allowReopen = true,
  customerName,
  isHistoryView = false,
  onAssign,
  onViewTicket,
  onFeedbackSubmitted,
}) {
  const navigate = useNavigate();
  const [currentTicket, setCurrentTicket] = useState(ticket);
  const [timelineSortOrder, setTimelineSortOrder] = useState('asc');
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenValidationError, setReopenValidationError] = useState('');
  const [reopenError, setReopenError] = useState('');
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const [reopenSuccessNotice, setReopenSuccessNotice] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackEnabled, setFeedbackEnabled] = useState(() => isFeedbackFormEnabled());

  useEffect(() => {
    setCurrentTicket(ticket);
    setReopenSuccessNotice('');
  }, [ticket]);

  const effectiveTicket = currentTicket || ticket;

  useEffect(() => {
    let isMounted = true;
    getFeedbackFormStatus().then((res) => {
      if (isMounted && res && (res.is_enabled !== undefined || res.isEnabled !== undefined)) {
        const isMasterOn = Boolean(res.is_enabled ?? res.isEnabled);
        setFeedbackEnabled(isMasterOn);
        setFeedbackFormEnabled(isMasterOn);
      }
    }).catch(() => {});

    const handleToggleChange = () => {
      setFeedbackEnabled(isFeedbackFormEnabled());
    };
    window.addEventListener('storage', handleToggleChange);
    window.addEventListener('feedback_master_toggle_changed', handleToggleChange);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleToggleChange);
      window.removeEventListener('feedback_master_toggle_changed', handleToggleChange);
    };
  }, []);

  const [windowConfig, setWindowConfig] = useState(() => {
    const cached = getCachedWindowConfiguration();
    if (cached && typeof cached.reopenWindowDays !== 'undefined') {
      return {
        reopenEnabled: Boolean(cached.reopenEnabled ?? true),
        reopenWindowDays: Number(cached.reopenWindowDays ?? 2),
        autoCloseEnabled: Boolean(cached.autoCloseEnabled ?? true),
        autoCloseWindowDays: Number(cached.autoCloseWindowDays ?? 2),
      };
    }
    return { reopenEnabled: true, reopenWindowDays: 2, autoCloseEnabled: true, autoCloseWindowDays: 2 };
  });

  useEffect(() => {
    let isMounted = true;
    getWindowConfiguration()
      .then((cfg) => {
        if (isMounted && cfg) {
          setWindowConfig({
            reopenEnabled: Boolean(cfg.reopenEnabled ?? true),
            reopenWindowDays: Number(cfg.reopenWindowDays ?? 2),
            autoCloseEnabled: Boolean(cfg.autoCloseEnabled ?? true),
            autoCloseWindowDays: Number(cfg.autoCloseWindowDays ?? 2),
          });
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const [modalNow, setModalNow] = useState(Date.now());
  const isResolvedModal = effectiveTicket?.status === 'Resolved';
  const resolvedDateModal = effectiveTicket?.resolved_at || effectiveTicket?.lastUpdate || effectiveTicket?.updated_at;

  useEffect(() => {
    if (!isResolvedModal) return;
    const interval = setInterval(() => setModalNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isResolvedModal]);

  const { modalRemainingSeconds, isModalAutoCloseExpired } = useMemo(() => {
    if (!isResolvedModal || !resolvedDateModal || !windowConfig.autoCloseEnabled) {
      return { modalRemainingSeconds: null, isModalAutoCloseExpired: false };
    }
    const resolvedMs = new Date(resolvedDateModal).getTime();
    if (isNaN(resolvedMs)) return { modalRemainingSeconds: null, isModalAutoCloseExpired: false };
    const windowMs = (windowConfig.autoCloseWindowDays || 2) * 24 * 60 * 60 * 1000;
    const deadlineMs = resolvedMs + windowMs;
    const diffSec = Math.floor((deadlineMs - modalNow) / 1000);
    return {
      modalRemainingSeconds: diffSec,
      isModalAutoCloseExpired: diffSec <= 0,
    };
  }, [isResolvedModal, resolvedDateModal, windowConfig, modalNow]);

  useEffect(() => {
    if (isResolvedModal && isModalAutoCloseExpired && windowConfig.autoCloseEnabled) {
      const nowIso = new Date().toISOString();
      setCurrentTicket((prev) => {
        if (!prev || prev.status === 'Closed') return prev;
        const priorTimeline = prev.timeline || [];
        return {
          ...prev,
          status: 'Closed',
          closed_at: nowIso,
          auto_closed: true,
          closed_by: 'system',
          timeline: [
            ...priorTimeline,
            {
              id: `auto-close-${Date.now()}`,
              type: 'system_autoclose',
              text: 'Closed automatically by system due to inactivity following resolution window.',
              timestamp: nowIso,
            },
          ],
        };
      });
    }
  }, [isResolvedModal, isModalAutoCloseExpired, windowConfig.autoCloseEnabled]);

  const isAutoClosedModal = useMemo(() => {
    if (!effectiveTicket || effectiveTicket.status !== 'Closed') return false;
    if (effectiveTicket.auto_closed || effectiveTicket.autoClosed) return true;
    if (effectiveTicket.closed_by === 'system' || effectiveTicket.actor_type === 'system') return true;
    const timeline = effectiveTicket.timeline || [];
    const hasAutoEvent = timeline.some((t) =>
      /auto-close|closed automatically|system due to inactivity/i.test(t.text || '')
    );
    const audit = effectiveTicket.audit_logs || effectiveTicket.auditLogs || [];
    const hasAutoAudit = audit.some((a) =>
      a.actor_type === 'system' || /auto-close/i.test(a.details || '')
    );
    return hasAutoEvent || hasAutoAudit;
  }, [effectiveTicket]);

  const formatCountdown = (totalSec) => {
    if (totalSec === null || totalSec < 0) return '00:00:00';
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) {
      return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  const formatRemainingText = (totalSec) => {
    if (totalSec === null || totalSec <= 0) return 'less than a minute';
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d} day${d > 1 ? 's' : ''}`);
    if (h > 0) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
    if (m > 0 && d === 0) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
    return parts.join(' and ') || 'less than a minute';
  };

  const isCS = useMemo(() => {
    try {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/cs')) return true;
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const dept = (user.department || user.profile?.department?.name || '').toLowerCase();
      const role = (user.role || user.profile?.role?.name || '').toLowerCase();
      return (
        dept.includes('customer service') ||
        dept.includes('customer support') ||
        dept === 'cs' ||
        role.includes('customer service') ||
        role.includes('customer-service') ||
        role === 'cs'
      );
    } catch {
      return false;
    }
  }, []);

  const isEmployee = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const role = String(user?.role || '').toLowerCase();
      return role === 'employee' || role.includes('engineer') || role.includes('technician') || import.meta.env.VITE_APP_MODE === 'employee';
    } catch {
      return false;
    }
  }, []);

  const hasAssignedEmployee = useMemo(() => {
    if (!effectiveTicket) return false;
    return Boolean(
      (Array.isArray(effectiveTicket.assigned) && effectiveTicket.assigned.length > 0) ||
      (Array.isArray(effectiveTicket.assigned_employees) && effectiveTicket.assigned_employees.length > 0) ||
      effectiveTicket.assigned_to ||
      (effectiveTicket.assigned_employee && effectiveTicket.assigned_employee !== '—' && effectiveTicket.assigned_employee !== 'Unassigned')
    );
  }, [effectiveTicket]);

  const isAlreadyAssigned = useMemo(() => {
    if (!effectiveTicket) return false;
    return Boolean(
      hasAssignedEmployee ||
      (effectiveTicket.status && ['In Progress', 'Assigned', 'Pending Assignment', 'Resolved', 'Closed', 'Pending Evaluation', 'On Hold', 'Ongoing'].includes(effectiveTicket.status))
    );
  }, [effectiveTicket, hasAssignedEmployee]);

  const isExternalClosed = (effectiveTicket?.status === 'Closed' || effectiveTicket?.status === 'Resolved') &&
    !effectiveTicket?.is_internal &&
    effectiveTicket?.ticket_type !== 'Internal' &&
    effectiveTicket?.type !== 'Internal';
  const feedbackAlreadySubmitted = hasFeedbackBeenSubmitted(effectiveTicket?.id) || hasFeedbackBeenSubmitted(effectiveTicket?.ticket_ID);

  useEffect(() => {
    if (feedbackEnabled && isExternalClosed && !feedbackAlreadySubmitted && !feedbackSubmitted) {
      setShowFeedbackModal(true);
    }
  }, [feedbackEnabled, isExternalClosed, feedbackAlreadySubmitted, feedbackSubmitted, effectiveTicket?.id, effectiveTicket?.ticket_ID]);

  const remarksList = useMemo(() => {
    if (!effectiveTicket) return [];
    const list = [];
    if (Array.isArray(effectiveTicket.remarks)) {
      effectiveTicket.remarks.forEach((rem, idx) => {
        list.push({
          id: rem.id || `rem-${idx}`,
          author: rem.author || 'Staff Member',
          remark: rem.remark || rem.text,
          timestamp: rem.timestamp || rem.created_at,
        });
      });
    }
    if (Array.isArray(effectiveTicket.remarks_history)) {
      effectiveTicket.remarks_history.forEach((rem, idx) => {
        if (!list.some(r => r.remark === (rem.remark || rem.text))) {
          list.push({
            id: rem.id || `rem-hist-${idx}`,
            author: rem.author || 'Staff Member',
            remark: rem.remark || rem.text,
            timestamp: rem.timestamp || rem.created_at,
          });
        }
      });
    }
    if (Array.isArray(effectiveTicket.timeline)) {
      effectiveTicket.timeline.forEach((evt, idx) => {
        if (evt.type === 'remark' && evt.text) {
          const cleanText = evt.text.replace(/^Remark added by [^:]+:\s*"?/, '').replace(/"?$/, '');
          if (!list.some(r => r.remark === cleanText || r.remark === evt.text)) {
            list.push({
              id: evt.id || `timeline-rem-${idx}`,
              author: evt.author || 'Staff Member',
              remark: cleanText || evt.text,
              timestamp: evt.timestamp,
            });
          }
        }
      });
    }
    return list;
  }, [effectiveTicket]);

  const sortedTimelineEvents = useMemo(() => {
    if (!effectiveTicket) return [];
    const events = [];
    if (effectiveTicket.timeline && Array.isArray(effectiveTicket.timeline)) {
      events.push(...effectiveTicket.timeline.filter(evt => evt.type !== 'internal_note'));
    } else {
      events.push({
        id: 'creation',
        type: 'system',
        text: 'Ticket created.',
        timestamp: effectiveTicket.date_created || effectiveTicket.created_at,
      });
    }

    const sorted = [...events];
    sorted.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timelineSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    return sorted;
  }, [effectiveTicket, timelineSortOrder]);

  useLockBodyScroll(!!effectiveTicket);

  if (!effectiveTicket) return null;

  // Window Calculation Logic
  const isClosedTicket = effectiveTicket.status === 'Closed';
  const closedDate = effectiveTicket.closed_at || effectiveTicket.resolved_at;
  const resolvedAt = closedDate ? new Date(closedDate) : null;
  const reopenWindowDays = Number(windowConfig.reopenWindowDays) || 2;
  const reopenDurationMs = reopenWindowDays * 24 * 60 * 60 * 1000;
  const hasValidDate = resolvedAt && !Number.isNaN(resolvedAt.getTime());
  const isWindowExpired = hasValidDate && (Date.now() - resolvedAt.getTime()) >= reopenDurationMs;
  const isReopenPolicyDisabled = !windowConfig.reopenEnabled;

  const isReopenable = isClosedTicket && Boolean(windowConfig.reopenEnabled) && (!hasValidDate || !isWindowExpired);
  const canShowReopenAction = allowReopen && isReopenable && typeof onReopen === 'function';
  const isReopenExpired = allowReopen && isClosedTicket && (isWindowExpired || isReopenPolicyDisabled) && typeof onReopen === 'function';

  const handleExecuteReopen = async () => {
    const trimmed = reopenReason.trim();
    if (!trimmed || trimmed.length < 3) {
      setReopenValidationError('Please provide a reason for reopening (at least 3 characters).');
      return;
    }
    if (trimmed.length > 1000) {
      setReopenValidationError('The reason cannot exceed 1000 characters.');
      return;
    }

    setReopenSubmitting(true);
    setReopenError('');

    try {
      const res = await onReopen(effectiveTicket.ticket_ID || effectiveTicket.id, trimmed);

      // Immediately update ticket detail view state
      const nowIso = new Date().toISOString();
      const newTimelineEvent = {
        id: `timeline-reopen-${Date.now()}`,
        type: 'status',
        text: `Ticket reopened by customer. Reason: "${trimmed}"`,
        timestamp: nowIso,
      };
      const newRemark = {
        id: `rem-reopen-${Date.now()}`,
        author: customerName || 'Customer',
        remark: `Reopen Reason: ${trimmed}`,
        timestamp: nowIso,
      };

      const updatedTicket = {
        ...effectiveTicket,
        ...(res?.ticket || {}),
        status: 'Reopened',
        last_updated: nowIso,
        timeline: [...(effectiveTicket.timeline || []), newTimelineEvent],
        remarks: [...(effectiveTicket.remarks || []), newRemark],
      };

      setCurrentTicket(updatedTicket);
      setShowReopenModal(false);
      setReopenReason('');
      setReopenSuccessNotice('Ticket successfully reopened. Our support team has been notified and the ticket status is now Reopened.');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to reopen ticket. Please try again.';
      setReopenError(msg);
    } finally {
      setReopenSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-gray-150 px-6 py-5 shrink-0 bg-white">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[#252578]">{effectiveTicket.id}</span>
              {effectiveTicket.status === 'Closed' ? (
                isAutoClosedModal ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                    <Clock size={11} className="text-slate-500" />
                    Closed automatically
                  </span>
                ) : (
                  <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700">
                    {effectiveTicket.closed_by ? `Closed by ${effectiveTicket.closed_by}` : 'Closed'}
                  </span>
                )
              ) : (
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[effectiveTicket.status] || 'bg-gray-100 text-gray-700'}`}>
                  {effectiveTicket.status}
                </span>
              )}
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityColors[effectiveTicket.priority] || 'bg-gray-100 text-gray-700'}`}>
                {effectiveTicket.priority}
              </span>
              {effectiveTicket.is_internal && (
                <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700">
                  Internal
                </span>
              )}
              {effectiveTicket.slaStatus && (
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  effectiveTicket.slaStatus === 'Violated' ? 'bg-red-100 text-red-800' :
                  effectiveTicket.slaStatus === 'Near Violation' ? 'bg-amber-100 text-amber-800' :
                  effectiveTicket.slaStatus === 'Achieved' ? 'bg-green-100 text-green-800' :
                  'bg-blue-50 text-[#252578]'
                }`}>
                  {effectiveTicket.slaStatus}
                </span>
              )}
            </div>
            <h2 className="mt-1 text-xl font-bold text-gray-900">{effectiveTicket.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Remaining-Time-to-Auto-Close Indicator (Resolved Tickets) */}
          {isResolvedModal && windowConfig.autoCloseEnabled && modalRemainingSeconds !== null && (
            <div
              role="region"
              aria-live="polite"
              className={`rounded-2xl border p-4 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                modalRemainingSeconds <= 7200
                  ? 'bg-rose-50/90 border-rose-200 text-rose-900'
                  : modalRemainingSeconds <= 86400
                  ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                  : 'bg-blue-50/90 border-blue-200 text-[#252578]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    modalRemainingSeconds <= 7200
                      ? 'bg-rose-100 text-rose-700'
                      : modalRemainingSeconds <= 86400
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-[#252578]'
                  }`}
                >
                  <Clock size={16} className={modalRemainingSeconds <= 7200 ? 'animate-pulse' : ''} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider">Auto-Close Countdown</h3>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        modalRemainingSeconds <= 7200
                          ? 'bg-rose-200/80 text-rose-900'
                          : modalRemainingSeconds <= 86400
                          ? 'bg-amber-200/80 text-amber-900'
                          : 'bg-blue-200/80 text-[#252578]'
                      }`}
                    >
                      {modalRemainingSeconds <= 7200 ? 'Expiring Soon' : 'Active'}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 opacity-90">
                    Will auto-close in <strong className="font-semibold">{formatRemainingText(modalRemainingSeconds)}</strong> without response.
                  </p>
                </div>
              </div>
              <div className="shrink-0 font-mono font-bold text-xs px-3 py-1.5 rounded-lg border bg-white shadow-xs">
                {formatCountdown(modalRemainingSeconds)}
              </div>
            </div>
          )}

          {/* Reopen Success Alert Banner */}
          {reopenSuccessNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2.5 text-xs text-emerald-800 font-semibold animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="shrink-0 text-emerald-600" />
                <span>{reopenSuccessNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setReopenSuccessNotice('')}
                className="text-emerald-700 hover:text-emerald-900 p-0.5 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <ReassignmentDisapprovalBanner ticket={effectiveTicket} />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 min-w-0">
              <p className="text-field-label uppercase text-gray-400">Description</p>
              <p className="mt-1 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700 break-words whitespace-normal overflow-hidden break-all max-h-[180px] overflow-y-auto">
                {effectiveTicket.description || 'No description available.'}
              </p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Requestor</p>
              <p className="mt-1 text-field-value text-gray-800">{effectiveTicket.customer || effectiveTicket.requestor || effectiveTicket.created_by_name || customerName || '—'}</p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Equipment / Machine</p>
              <p className="mt-1 text-field-value text-gray-800">{effectiveTicket.equipment || effectiveTicket.machine_name || effectiveTicket.machine?.machine_name || '—'}</p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Equipment Type</p>
              <p className="mt-1 text-field-value text-gray-800">
                {effectiveTicket.equipment_type || effectiveTicket.equipmentType || effectiveTicket.machine_category || effectiveTicket.machine?.category_name || (effectiveTicket.category ? `${effectiveTicket.category} Equipment` : 'Medical Equipment')}
              </p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Assigned Employee</p>
              <p className="mt-1 text-field-value text-gray-800">
                {effectiveTicket.assigned_employee || effectiveTicket.assigned_employee_name || effectiveTicket.assigned_to_name || (effectiveTicket.assigned_employees?.[0]?.name) || (typeof effectiveTicket.assigned_to === 'string' ? effectiveTicket.assigned_to : null) || 'Unassigned'}
              </p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Category</p>
              <p className="mt-1 text-field-value text-gray-800">{effectiveTicket.category || '—'}</p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Date Filed</p>
              <p className="mt-1 text-field-value text-gray-800">{formatDisplayDate(effectiveTicket.date_created || effectiveTicket.created_at || effectiveTicket.date)}</p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Last Updated</p>
              <p className="mt-1 text-field-value text-gray-800">{formatDisplayDate(effectiveTicket.last_updated || effectiveTicket.updated_at || effectiveTicket.lastUpdate)}</p>
            </div>
            {(effectiveTicket.resolved_at || effectiveTicket.closed_at) && (
              <div>
                <p className="text-field-label uppercase text-gray-400">Date Resolved / Closed</p>
                <p className="mt-1 text-field-value text-green-700 font-semibold">
                  {formatDisplayDate(effectiveTicket.resolved_at || effectiveTicket.closed_at)}
                </p>
              </div>
            )}

            {effectiveTicket.attachments && effectiveTicket.attachments.length > 0 && (
              <div className="md:col-span-2">
                <p className="text-field-label uppercase text-gray-400">Attachments ({effectiveTicket.attachments.length})</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {effectiveTicket.attachments.map((file, idx) => {
                    const fName = getFileName(file);
                    const fUrl = getFileUrl(file);
                    const isQuarantined = Boolean(
                      file.is_quarantined ||
                      file.quarantined ||
                      file.status === 'quarantined' ||
                      file.virus_detected
                    );

                    if (isQuarantined) {
                      return (
                        <div
                          key={file.id || file.attachment_id || idx}
                          className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 select-none cursor-not-allowed"
                          title="This file was flagged by security scanning and quarantined. Binary download is blocked."
                        >
                          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                          <span className="truncate max-w-[200px] line-through text-gray-500">{fName}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Blocked</span>
                        </div>
                      );
                    }

                    return (
                      <a
                        key={file.id || file.attachment_id || idx}
                        href={fUrl || '#'}
                        onClick={(e) => {
                          e.preventDefault();
                          setPreviewFile({ name: fName, url: fUrl });
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-gray-150 bg-gray-50 px-3 py-2 text-badge text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        <svg className="h-4 w-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="truncate max-w-[220px]">{fName}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Remarks History */}
            {remarksList && remarksList.length > 0 && (
              <div className="md:col-span-2 border-t border-gray-150 pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-field-label uppercase text-gray-500 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#252578] inline-block" />
                    Remarks &amp; Reason History ({remarksList.length})
                  </h3>
                </div>
                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {remarksList.map((rem, idx) => (
                    <div key={rem.id || idx} className="rounded-xl border border-gray-200/80 bg-gray-50/80 p-3 text-xs shadow-xs">
                      <div className="flex items-center justify-between text-gray-500 mb-1">
                        <span className="font-bold text-[#252578] text-[11px] uppercase tracking-wide">
                          {rem.author || 'Staff Member'}
                        </span>
                        <span className="text-timestamp text-gray-400">
                          {formatDisplayDate(rem.timestamp)}
                        </span>
                      </div>
                      <p className="text-gray-700 leading-relaxed break-words whitespace-pre-wrap font-medium">
                        {rem.remark || rem.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="md:col-span-2 border-t border-gray-150 pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-field-label uppercase text-gray-400">
                  Ticket Timeline &amp; History
                </h3>
                <button
                  type="button"
                  onClick={() => setTimelineSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-button text-gray-600 transition-colors hover:bg-gray-100 cursor-pointer"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                  {timelineSortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
                </button>
              </div>

              {sortedTimelineEvents.length === 0 ? (
                <p className="text-xs italic text-gray-400">No timeline events recorded.</p>
              ) : (
                <div className="relative ml-3 space-y-4 border-l-2 border-gray-100 py-1.5 pl-6">
                  {sortedTimelineEvents.map((evt, idx) => {
                    const dotColor =
                      evt.type === 'system'
                        ? 'bg-[#252578]'
                        : evt.type === 'status'
                          ? 'bg-blue-500'
                          : evt.type === 'internal_note'
                            ? 'bg-red-400'
                            : evt.type === 'remark'
                              ? 'bg-green-500'
                              : evt.type === 'reassign'
                                ? 'bg-amber-500'
                                : 'bg-gray-400';

                    return (
                      <div key={evt.id || idx} className="relative text-xs">
                        <div className={`absolute top-1 h-3 w-3 rounded-full border-2 border-white shadow ${dotColor}`} style={{ left: '-31px' }} />
                        <div className="mb-0.5 flex items-center justify-between text-timestamp text-gray-400">
                          <span className="text-timestamp uppercase tracking-wide text-[#252578]">
                            {evt.type === 'system'
                              ? 'System'
                              : evt.type === 'status'
                                ? 'Status Update'
                                : evt.type === 'internal_note'
                                  ? 'Internal Note'
                                  : evt.type === 'remark'
                                    ? 'Remark'
                                    : evt.type === 'reassign'
                                      ? 'Reassignment'
                                      : evt.type || 'Update'}
                          </span>
                          <span>{formatDisplayDate(evt.timestamp)}</span>
                        </div>
                        <p
                          className="rounded-lg border border-gray-100/50 bg-gray-50/50 p-2.5 font-semibold leading-relaxed text-gray-700 break-words whitespace-pre-wrap max-w-full overflow-hidden"
                          style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                        >
                          {evt.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {isExternalClosed && (feedbackAlreadySubmitted || feedbackSubmitted || feedbackEnabled) && (
              <div className="md:col-span-2">
                <TicketFeedbackSection
                  key={feedbackSubmitted ? 'submitted' : 'pending'}
                  ticket={effectiveTicket}
                  onLeaveFeedback={() => setShowFeedbackModal(true)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 shrink-0 space-y-3">
          {/* Explanatory banner if reopen window is expired */}
          {isReopenExpired && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-800 flex items-start gap-2.5 animate-fade-in">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-amber-900">Reopen Window Expired</p>
                <p className="mt-0.5 leading-relaxed">
                  {isReopenPolicyDisabled
                    ? 'Ticket reopening is disabled by administrative operational policy. If you need further assistance, please create a new support ticket.'
                    : `The allowed reopen window for this ticket has expired (tickets may be reopened within ${reopenWindowDays} days of resolution). If your issue is not fully resolved, please submit a new ticket.`}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {(isCS || onAssign || onViewTicket) ? (
              !isAlreadyAssigned ? (
                <button
                  type="button"
                  onClick={() => {
                    if (onAssign) {
                      onAssign(effectiveTicket);
                    } else {
                      onClose();
                    }
                  }}
                  className="rounded-xl bg-[#252578] px-5 py-2 text-button text-white transition-colors hover:bg-[#1f1f66] cursor-pointer"
                >
                  Assign
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (onViewTicket) {
                      onViewTicket(effectiveTicket);
                    } else {
                      onClose();
                      const ticketId = effectiveTicket.ticket_ID || Number(String(effectiveTicket.id).replace(/\D/g, ''));
                      navigate(`/cs/history/${ticketId}`, { state: { ticket: effectiveTicket, backPath: window.location.pathname } });
                    }
                  }}
                  className="rounded-xl bg-[#252578] px-5 py-2 text-button text-white transition-colors hover:bg-[#1f1f66] cursor-pointer"
                >
                  View Ticket
                </button>
              )
            ) : (
              isEmployee && effectiveTicket?.status !== 'Closed' && effectiveTicket?.status !== 'Resolved' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/employee/ticket-update', { state: { ticket: effectiveTicket } });
                  }}
                  className="rounded-xl bg-[#252578] px-5 py-2 text-button text-white transition-colors hover:bg-[#1f1f66] cursor-pointer"
                >
                  Update Ticket
                </button>
              )
            )}

            {/* Active Reopen Button (within allowed window) */}
            {canShowReopenAction && (
              <button
                type="button"
                onClick={() => {
                  setReopenValidationError('');
                  setReopenError('');
                  setShowReopenModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#252578] hover:bg-[#1f1f66] px-4 py-2 text-button text-white transition-all shadow-sm cursor-pointer"
              >
                <RotateCcw size={14} />
                Reopen Ticket
              </button>
            )}

            {/* Disabled Reopen Button (window expired) */}
            {isReopenExpired && (
              <button
                type="button"
                disabled
                title={isReopenPolicyDisabled ? 'Reopen disabled by policy' : 'Reopen window expired'}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gray-200 px-4 py-2 text-button text-gray-400 cursor-not-allowed border border-gray-300/50"
              >
                <RotateCcw size={14} />
                Reopen Expired
              </button>
            )}

            {isExternalClosed && !isEmployee && (
              <button
                type="button"
                onClick={() => setShowFeedbackModal(true)}
                className={`rounded-xl px-4 py-2 text-button text-white transition-colors cursor-pointer flex items-center gap-1.5 ${
                  feedbackAlreadySubmitted || feedbackSubmitted
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-[#252578] hover:bg-[#1f1f66]'
                }`}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {feedbackAlreadySubmitted || feedbackSubmitted ? 'View Feedback' : 'Give Feedback'}
              </button>
            )}

            {effectiveTicket.can_discard && effectiveTicket.status === 'Open' && (
              <button
                type="button"
                onClick={() => onDiscard?.(effectiveTicket)}
                className="rounded-xl bg-red-600 px-4 py-2 text-button text-white transition-colors hover:bg-red-700 cursor-pointer"
              >
                Discard Ticket
              </button>
            )}
          </div>
        </div>
      </div>

      {showFeedbackModal && (
        <FeedbackModal
          ticket={effectiveTicket}
          onClose={() => {
            setShowFeedbackModal(false);
            setFeedbackSubmitted(true);
            onFeedbackSubmitted?.(effectiveTicket);
          }}
        />
      )}

      {/* Confirmation Modal for Reopening with Required Reason */}
      {showReopenModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#252578] flex items-center justify-center">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-800">Reopen Ticket</h3>
                  <p className="text-xs text-gray-500 font-mono">{effectiveTicket.id}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={reopenSubmitting}
                onClick={() => {
                  setShowReopenModal(false);
                  setReopenValidationError('');
                  setReopenError('');
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-3.5">
              <p className="text-xs text-gray-600 leading-relaxed">
                Reopening will transition this ticket back to active status for customer support intervention. Please describe what issue remains unresolved:
              </p>

              {/* Error Message if Reopen Action Fails */}
              {reopenError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700 font-semibold animate-fade-in">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
                  <span className="leading-relaxed">{reopenError}</span>
                </div>
              )}

              {/* Required Reason Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="reopen-reason-textarea" className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                    Reason for Reopening <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {reopenReason.trim().length} / 1000
                  </span>
                </div>
                <textarea
                  id="reopen-reason-textarea"
                  value={reopenReason}
                  onChange={(e) => {
                    setReopenReason(e.target.value);
                    if (reopenValidationError) setReopenValidationError('');
                    if (reopenError) setReopenError('');
                  }}
                  disabled={reopenSubmitting}
                  placeholder="Explain why this ticket needs to be reopened (minimum 3 characters)..."
                  rows={4}
                  className={`w-full rounded-xl border p-3 text-xs text-gray-800 placeholder:text-gray-400 outline-none transition resize-none disabled:bg-gray-50 ${
                    reopenValidationError
                      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-red-50/20'
                      : 'border-gray-200 focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10 bg-white'
                  }`}
                />
                {reopenValidationError && (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1 animate-fade-in">
                    <AlertCircle size={12} /> {reopenValidationError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                disabled={reopenSubmitting}
                onClick={() => {
                  setShowReopenModal(false);
                  setReopenValidationError('');
                  setReopenError('');
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reopenSubmitting}
                onClick={handleExecuteReopen}
                className="px-5 py-2 text-xs font-bold text-white bg-[#252578] hover:bg-[#1f1f66] rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <RotateCcw size={13} className={reopenSubmitting ? 'animate-spin' : ''} />
                {reopenSubmitting ? 'Reopening...' : 'Confirm Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
