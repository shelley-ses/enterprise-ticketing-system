import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  FileText,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Star,
  ArrowUpDown,
  RotateCcw,
  Pencil,
  Eye,
  Check,
} from 'lucide-react';
import FilePreviewModal from './FilePreviewModal';
import FeedbackModal from './feedback/FeedbackModal';
import TicketFeedbackSection from './feedback/TicketFeedbackSection';
import ReassignmentDisapprovalBanner from './employee/ReassignmentDisapprovalBanner';
import { formatDisplayDate } from '@/utils/dateUtils';
import { hasFeedbackBeenSubmitted, isFeedbackFormEnabled, setFeedbackFormEnabled } from '@/data/mockFeedbackData';
import { getFeedbackFormStatus, getWindowConfiguration, getCachedWindowConfiguration } from '@/services/configurationService';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  const [timelineSortOrder, setTimelineSortOrder] = useState('asc');
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [pendingReason, setPendingReason] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackEnabled, setFeedbackEnabled] = useState(() => isFeedbackFormEnabled());

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
      };
    }
    return { reopenEnabled: true, reopenWindowDays: 2 };
  });

  useEffect(() => {
    let isMounted = true;
    getWindowConfiguration()
      .then((cfg) => {
        if (isMounted && cfg) {
          setWindowConfig({
            reopenEnabled: Boolean(cfg.reopenEnabled ?? true),
            reopenWindowDays: Number(cfg.reopenWindowDays ?? 2),
          });
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

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
    if (!ticket) return false;
    return Boolean(
      (Array.isArray(ticket.assigned) && ticket.assigned.length > 0) ||
      (Array.isArray(ticket.assigned_employees) && ticket.assigned_employees.length > 0) ||
      ticket.assigned_to ||
      (ticket.assigned_employee && ticket.assigned_employee !== '—' && ticket.assigned_employee !== 'Unassigned')
    );
  }, [ticket]);

  const isAlreadyAssigned = useMemo(() => {
    if (!ticket) return false;
    return Boolean(
      hasAssignedEmployee ||
      (ticket.status && ['In Progress', 'Assigned', 'Pending Assignment', 'Resolved', 'Closed', 'Pending Evaluation', 'On Hold', 'Ongoing'].includes(ticket.status))
    );
  }, [ticket, hasAssignedEmployee]);

  const isExternalClosed = (ticket?.status === 'Closed' || ticket?.status === 'Resolved') &&
    !ticket?.is_internal &&
    ticket?.ticket_type !== 'Internal' &&
    ticket?.type !== 'Internal';
  const feedbackAlreadySubmitted = hasFeedbackBeenSubmitted(ticket?.id) || hasFeedbackBeenSubmitted(ticket?.ticket_ID);

  useEffect(() => {
    if (feedbackEnabled && isExternalClosed && !feedbackAlreadySubmitted && !feedbackSubmitted) {
      setShowFeedbackModal(true);
    }
  }, [feedbackEnabled, isExternalClosed, feedbackAlreadySubmitted, feedbackSubmitted, ticket?.id, ticket?.ticket_ID]);

  const remarksList = useMemo(() => {
    if (!ticket) return [];
    const list = [];
    if (Array.isArray(ticket.remarks)) {
      ticket.remarks.forEach((rem, idx) => {
        list.push({
          id: rem.id || `rem-${idx}`,
          author: rem.author || 'Staff Member',
          remark: rem.remark || rem.text,
          timestamp: rem.timestamp || rem.created_at,
        });
      });
    }
    if (Array.isArray(ticket.remarks_history)) {
      ticket.remarks_history.forEach((rem, idx) => {
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
    if (Array.isArray(ticket.timeline)) {
      ticket.timeline.forEach((evt, idx) => {
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
  }, [ticket]);

  const sortedTimelineEvents = useMemo(() => {
    if (!ticket) return [];
    const events = [];
    if (ticket.timeline && Array.isArray(ticket.timeline)) {
      events.push(...ticket.timeline.filter(evt => evt.type !== 'internal_note'));
    } else {
      events.push({
        id: 'creation',
        type: 'system',
        text: 'Ticket created.',
        timestamp: ticket.date_created || ticket.created_at,
      });
    }

    const sorted = [...events];
    sorted.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timelineSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    return sorted;
  }, [ticket, timelineSortOrder]);

  useLockBodyScroll(!!ticket);

  if (!ticket) return null;

  const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
  const reopenDurationMs = (Number(windowConfig.reopenWindowDays) || 2) * 24 * 60 * 60 * 1000;
  const isReopenableStandard = Boolean(windowConfig.reopenEnabled)
    && ticket.status === 'Closed'
    && resolvedAt
    && !Number.isNaN(resolvedAt.getTime())
    && (new Date() - resolvedAt) < reopenDurationMs;
  const isReopenableHistory = isHistoryView && ticket.status === 'Closed';
  const isReopenable = isReopenableHistory || isReopenableStandard;
  const canShowReopenAction = allowReopen && isReopenable && typeof onReopen === 'function';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-card border border-border shadow-modal animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between border-b border-border px-6 py-5 shrink-0 bg-card">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-primary font-mono">{ticket.id}</span>
              <Badge variant={ticket.status === 'Open' ? 'sky' : ticket.status === 'In Progress' ? 'amber' : (ticket.status === 'Resolved' || ticket.status === 'Closed') ? 'emerald' : 'default'}>
                {ticket.status}
              </Badge>
              <Badge variant={ticket.priority === 'Critical' ? 'destructive' : ticket.priority === 'High' ? 'amber' : 'outline'}>
                {ticket.priority}
              </Badge>
              {ticket.is_internal && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  Internal
                </Badge>
              )}
              {ticket.slaStatus && (
                <Badge variant={
                  ticket.slaStatus === 'Violated' ? 'destructive' :
                  ticket.slaStatus === 'Near Violation' ? 'amber' :
                  ticket.slaStatus === 'Achieved' ? 'emerald' :
                  'outline'
                }>
                  {ticket.slaStatus}
                </Badge>
              )}
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-dark">{ticket.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-muted hover:bg-page hover:text-slate-dark transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <ReassignmentDisapprovalBanner ticket={ticket} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-muted">Description</p>
              <p className="mt-1 rounded-xl bg-page border border-border p-4 text-sm leading-6 text-slate-dark break-words whitespace-normal overflow-hidden break-all max-h-[180px] overflow-y-auto">
                {ticket.description || 'No description available.'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-muted">Requestor</p>
              <p className="mt-1 text-sm font-semibold text-slate-dark">{ticket.customer || ticket.requestor || ticket.created_by_name || customerName || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-muted">Equipment / Machine</p>
              <p className="mt-1 text-sm font-semibold text-slate-dark">{ticket.equipment || ticket.machine_name || ticket.machine?.machine_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-muted">Equipment Type</p>
              <p className="mt-1 text-sm font-semibold text-slate-dark">
                {ticket.equipment_type || ticket.equipmentType || ticket.machine_category || ticket.machine?.category_name || (ticket.category ? `${ticket.category} Equipment` : 'Medical Equipment')}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-muted">Assigned Employee</p>
              <p className="mt-1 text-sm font-semibold text-slate-dark">
                {ticket.assigned_employee || ticket.assigned_employee_name || ticket.assigned_to_name || (ticket.assigned_employees?.[0]?.name) || (typeof ticket.assigned_to === 'string' ? ticket.assigned_to : null) || 'Unassigned'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-muted">Category</p>
              <p className="mt-1 text-sm font-semibold text-slate-dark">{ticket.category || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-muted">Date Filed</p>
              <p className="mt-1 text-sm font-semibold text-slate-dark">{formatDisplayDate(ticket.date_created || ticket.created_at || ticket.date)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-muted">Last Updated</p>
              <p className="mt-1 text-sm font-semibold text-slate-dark">{formatDisplayDate(ticket.last_updated || ticket.updated_at || ticket.lastUpdate)}</p>
            </div>
            {(ticket.resolved_at || ticket.closed_at) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-muted">Date Resolved</p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  {formatDisplayDate(ticket.resolved_at || ticket.closed_at)}
                </p>
              </div>
            )}

            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-muted">Attachments ({ticket.attachments.length})</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ticket.attachments.map((file, idx) => {
                    const fName = getFileName(file);
                    const fUrl = getFileUrl(file);
                    return (
                      <a
                        key={file.id || file.attachment_id || idx}
                        href={fUrl || '#'}
                        onClick={(e) => {
                          e.preventDefault();
                          setPreviewFile({ name: fName, url: fUrl });
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-border bg-page px-3 py-2 text-xs font-medium text-primary hover:text-accent hover:underline cursor-pointer transition-colors"
                      >
                        <Paperclip className="h-4 w-4 shrink-0 text-slate-muted" />
                        <span className="truncate max-w-[220px]">{fName}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {((ticket.proofAttachments && ticket.proofAttachments.length > 0) || (ticket.proofFiles && ticket.proofFiles.length > 0)) && (
              <div className="md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Proof of Completion Files</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(ticket.proofAttachments || ticket.proofFiles).map((file, pIdx) => {
                    const fName = getFileName(file);
                    const fUrl = getFileUrl(file);
                    return (
                      <a
                        key={file.id || file.attachment_id || pIdx}
                        href={fUrl || '#'}
                        onClick={(e) => {
                          e.preventDefault();
                          setPreviewFile({ name: fName, url: fUrl });
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer transition-colors"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="truncate max-w-[220px]">{fName}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Remarks History */}
            {remarksList && remarksList.length > 0 && (
              <div className="md:col-span-2 border-t border-border pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-dark flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                    Remarks History ({remarksList.length})
                  </h3>
                </div>
                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {remarksList.map((rem, idx) => (
                    <div key={rem.id || idx} className="rounded-xl border border-border bg-page p-3 text-xs shadow-xs">
                      <div className="flex items-center justify-between text-slate-muted mb-1">
                        <span className="font-bold text-primary text-[11px] uppercase tracking-wide">
                          {rem.author || 'Staff Member'}
                        </span>
                        <span className="text-[10px] text-slate-muted">
                          {formatDisplayDate(rem.timestamp)}
                        </span>
                      </div>
                      <p className="text-slate-dark leading-relaxed break-words whitespace-pre-wrap font-medium">
                        {rem.remark || rem.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-muted">
                  Ticket Timeline &amp; History
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTimelineSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="h-7 text-xs"
                >
                  <ArrowUpDown className="h-3 w-3 mr-1" />
                  {timelineSortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
                </Button>
              </div>

              {sortedTimelineEvents.length === 0 ? (
                <p className="text-xs italic text-slate-muted">No timeline events recorded.</p>
              ) : (
                <div className="relative ml-3 space-y-4 border-l-2 border-border py-1.5 pl-6">
                  {sortedTimelineEvents.map((evt, idx) => {
                    const dotColor =
                      evt.type === 'system'
                        ? 'bg-primary'
                        : evt.type === 'status'
                          ? 'bg-accent'
                          : evt.type === 'internal_note'
                            ? 'bg-destructive'
                            : evt.type === 'remark'
                              ? 'bg-emerald-500'
                              : evt.type === 'reassign'
                                ? 'bg-amber-500'
                                : 'bg-slate-400';

                    return (
                      <div key={evt.id || idx} className="relative text-xs">
                        <div className={`absolute top-1 h-3 w-3 rounded-full border-2 border-white shadow ${dotColor}`} style={{ left: '-31px' }} />
                        <div className="mb-0.5 flex items-center justify-between text-slate-muted">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
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
                          <span className="text-[10px] text-slate-muted">{formatDisplayDate(evt.timestamp)}</span>
                        </div>
                        <p
                          className="rounded-lg border border-border bg-page p-2.5 font-medium leading-relaxed text-slate-dark break-words whitespace-pre-wrap max-w-full overflow-hidden"
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
                  ticket={ticket}
                  onLeaveFeedback={() => setShowFeedbackModal(true)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-card px-6 py-4 shrink-0">
          {showReopenForm ? (
            <div className="w-full text-left flex flex-col gap-2">
              <label htmlFor="reopen-reason-input" className="text-xs font-semibold uppercase tracking-wider text-slate-dark">
                Reason for Reopening * (Required)
              </label>
              <textarea
                id="reopen-reason-input"
                placeholder="Please provide a mandatory reason for reopening this ticket..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="min-h-16 w-full resize-none rounded-xl border border-border bg-card p-3 text-xs font-sans text-slate-dark outline-none focus:ring-2 focus:ring-accent"
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowReopenForm(false);
                    setReopenReason('');
                  }}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={!reopenReason.trim()}
                  onClick={() => {
                    setPendingReason(reopenReason.trim());
                    setShowReopenConfirm(true);
                  }}
                >
                  Confirm Reopen
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex w-full justify-end gap-3">
              {(isCS || onAssign || onViewTicket) ? (
                !isAlreadyAssigned ? (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => {
                      if (onAssign) {
                        onAssign(ticket);
                      } else {
                        onClose();
                      }
                    }}
                  >
                    Assign
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => {
                      if (onViewTicket) {
                        onViewTicket(ticket);
                      } else {
                        onClose();
                        const ticketId = ticket.ticket_ID || Number(String(ticket.id).replace(/\D/g, ''));
                        navigate(`/cs/history/${ticketId}`, { state: { ticket, backPath: window.location.pathname } });
                      }
                    }}
                  >
                    View Ticket
                  </Button>
                )
              ) : (
                isEmployee && ticket?.status !== 'Closed' && ticket?.status !== 'Resolved' && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => {
                      onClose();
                      navigate('/employee/ticket-update', { state: { ticket } });
                    }}
                  >
                    Update Ticket
                  </Button>
                )
              )}
              {canShowReopenAction && (
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setShowReopenForm(true)}
                >
                  Re-open Ticket
                </Button>
              )}
              {isExternalClosed && !isEmployee && (
                <Button
                  type="button"
                  variant={feedbackAlreadySubmitted || feedbackSubmitted ? 'default' : 'secondary'}
                  onClick={() => setShowFeedbackModal(true)}
                  className="flex items-center gap-1.5"
                >
                  <Star className="h-4 w-4" />
                  {feedbackAlreadySubmitted || feedbackSubmitted ? 'View Feedback' : 'Give Feedback'}
                </Button>
              )}
              {ticket.can_discard && ticket.status === 'Open' && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => onDiscard?.(ticket)}
                >
                  Discard Ticket
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      {showFeedbackModal && (
        <FeedbackModal
          ticket={ticket}
          onClose={() => {
            setShowFeedbackModal(false);
            setFeedbackSubmitted(true);
            onFeedbackSubmitted?.(ticket);
          }}
        />
      )}
      {showReopenConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
          <div className="w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-modal animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-slate-dark">Reopen Ticket?</h2>
            <p className="mt-2 text-sm text-slate-muted break-words whitespace-normal">Are you sure you want to reopen <span className="font-semibold text-primary">{ticket.id}</span>? This will change its status to Reopened.</p>
            {pendingReason && <p className="mt-3 rounded-lg bg-page border border-border p-3 text-xs text-slate-dark break-words whitespace-normal"><span className="font-semibold">Reason:</span> {pendingReason}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowReopenConfirm(false); setPendingReason(''); }}>Cancel</Button>
              <Button variant="default" onClick={() => { onReopen?.(ticket.ticket_ID || ticket.id, pendingReason); setShowReopenConfirm(false); setShowReopenForm(false); setReopenReason(''); setPendingReason(''); }}>Confirm Reopen</Button>
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
