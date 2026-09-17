import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FilePreviewModal from './FilePreviewModal';
import FeedbackModal from './feedback/FeedbackModal';
import TicketFeedbackSection from './feedback/TicketFeedbackSection';
import ReassignmentDisapprovalBanner from './employee/ReassignmentDisapprovalBanner';
import { statusColors, priorityColors } from '@/constants/employeeTickets';
import { formatDisplayDate } from '@/utils/dateUtils';
import { hasFeedbackBeenSubmitted } from '@/data/mockFeedbackData';
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

  const isExternalClosed = ticket?.status === 'Closed' && !ticket?.is_internal && ticket?.ticket_type !== 'Internal';
  const feedbackAlreadySubmitted = hasFeedbackBeenSubmitted(ticket?.id);

  useEffect(() => {
    if (isExternalClosed && !feedbackAlreadySubmitted && !feedbackSubmitted) {
      setShowFeedbackModal(true);
    }
  }, [isExternalClosed, feedbackAlreadySubmitted, feedbackSubmitted, ticket?.id]);

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
  const isReopenableStandard = ticket.status === 'Closed'
    && resolvedAt
    && !Number.isNaN(resolvedAt.getTime())
    && (new Date() - resolvedAt) < (48 * 60 * 60 * 1000);
  const isReopenableHistory = isHistoryView && ticket.status === 'Closed';
  const isReopenable = isReopenableHistory || isReopenableStandard;
  const canShowReopenAction = allowReopen && isReopenable && typeof onReopen === 'function';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between border-b border-gray-150 px-6 py-5 shrink-0 bg-white">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[#252578]">{ticket.id}</span>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[ticket.status] || 'bg-gray-100 text-gray-700'}`}>
                {ticket.status}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityColors[ticket.priority] || 'bg-gray-100 text-gray-700'}`}>
                {ticket.priority}
              </span>
              {ticket.is_internal && (
                <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700">
                  Internal
                </span>
              )}
              {ticket.slaStatus && (
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  ticket.slaStatus === 'Violated' ? 'bg-red-100 text-red-800' :
                  ticket.slaStatus === 'Near Violation' ? 'bg-amber-100 text-amber-800' :
                  ticket.slaStatus === 'Achieved' ? 'bg-green-100 text-green-800' :
                  'bg-blue-50 text-[#252578]'
                }`}>
                  {ticket.slaStatus}
                </span>
              )}
            </div>
            <h2 className="mt-1 text-xl font-bold text-gray-900">{ticket.title}</h2>
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

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <ReassignmentDisapprovalBanner ticket={ticket} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 min-w-0">
              <p className="text-field-label uppercase text-gray-400">Description</p>
              <p className="mt-1 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700 break-words whitespace-normal overflow-hidden break-all max-h-[180px] overflow-y-auto">
                {ticket.description || 'No description available.'}
              </p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Requestor</p>
              <p className="mt-1 text-field-value text-gray-800">{ticket.customer || ticket.requestor || ticket.created_by_name || customerName || '—'}</p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Equipment / Machine</p>
              <p className="mt-1 text-field-value text-gray-800">{ticket.equipment || ticket.machine_name || ticket.machine?.machine_name || '—'}</p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Equipment Type</p>
              <p className="mt-1 text-field-value text-gray-800">
                {ticket.equipment_type || ticket.equipmentType || ticket.machine_category || ticket.machine?.category_name || (ticket.category ? `${ticket.category} Equipment` : 'Medical Equipment')}
              </p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Assigned Employee</p>
              <p className="mt-1 text-field-value text-gray-800">
                {ticket.assigned_employee || ticket.assigned_employee_name || ticket.assigned_to_name || (ticket.assigned_employees?.[0]?.name) || (typeof ticket.assigned_to === 'string' ? ticket.assigned_to : null) || 'Unassigned'}
              </p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Category</p>
              <p className="mt-1 text-field-value text-gray-800">{ticket.category || '—'}</p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Date Filed</p>
              <p className="mt-1 text-field-value text-gray-800">{formatDisplayDate(ticket.date_created || ticket.created_at || ticket.date)}</p>
            </div>
            <div>
              <p className="text-field-label uppercase text-gray-400">Last Updated</p>
              <p className="mt-1 text-field-value text-gray-800">{formatDisplayDate(ticket.last_updated || ticket.updated_at || ticket.lastUpdate)}</p>
            </div>
            {(ticket.resolved_at || ticket.closed_at) && (
              <div>
                <p className="text-field-label uppercase text-gray-400">Date Resolved</p>
                <p className="mt-1 text-field-value text-green-700 font-semibold">
                  {formatDisplayDate(ticket.resolved_at || ticket.closed_at)}
                </p>
              </div>
            )}

            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="md:col-span-2">
                <p className="text-field-label uppercase text-gray-400">Attachments ({ticket.attachments.length})</p>
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

            {((ticket.proofAttachments && ticket.proofAttachments.length > 0) || (ticket.proofFiles && ticket.proofFiles.length > 0)) && (
              <div className="md:col-span-2">
                <p className="text-field-label uppercase text-green-700 font-bold">Proof of Completion Files</p>
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
                        className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-badge text-green-700 hover:text-green-900 hover:underline cursor-pointer"
                      >
                        <svg className="h-4 w-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
                    Remarks History ({remarksList.length})
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

            <div className="md:col-span-2 border-t border-gray-150 pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-field-label uppercase text-gray-400">
                  Ticket Timeline &amp; History
                </h3>
                <button
                  type="button"
                  onClick={() => setTimelineSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-button text-gray-600 transition-colors hover:bg-gray-100"
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

            {isExternalClosed && (
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

        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 shrink-0">
          {showReopenForm ? (
            <div className="w-full text-left flex flex-col gap-2">
              <label htmlFor="reopen-reason-input" className="text-field-label uppercase text-gray-600">
                Reason for Reopening * (Required)
              </label>
              <textarea
                id="reopen-reason-input"
                placeholder="Please provide a mandatory reason for reopening this ticket..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="min-h-16 w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-xs font-sans text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/25"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReopenForm(false);
                    setReopenReason('');
                  }}
                  className="rounded-xl px-3 py-1.5 text-button text-gray-600 transition-colors hover:bg-gray-200"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={!reopenReason.trim()}
                  onClick={() => {
                    setPendingReason(reopenReason.trim());
                    setShowReopenConfirm(true);
                  }}
                  className="rounded-xl bg-[#252578] px-3 py-1.5 text-button text-white transition-colors hover:bg-[#1f1f66] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirm Reopen
                </button>
              </div>
            </div>
          ) : (
            <div className="flex w-full justify-end gap-3">
              {(isCS || onAssign || onViewTicket) ? (
                !isAlreadyAssigned ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onAssign) {
                        onAssign(ticket);
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
                        onViewTicket(ticket);
                      } else {
                        onClose();
                        const ticketId = ticket.ticket_ID || Number(String(ticket.id).replace(/\D/g, ''));
                        navigate(`/cs/history/${ticketId}`, { state: { ticket, backPath: window.location.pathname } });
                      }
                    }}
                    className="rounded-xl bg-[#252578] px-5 py-2 text-button text-white transition-colors hover:bg-[#1f1f66] cursor-pointer"
                  >
                    View Ticket
                  </button>
                )
              ) : (
                isEmployee && ticket?.status !== 'Closed' && ticket?.status !== 'Resolved' && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate('/employee/ticket-update', { state: { ticket } });
                    }}
                    className="rounded-xl bg-[#252578] px-5 py-2 text-button text-white transition-colors hover:bg-[#1f1f66] cursor-pointer"
                  >
                    Update Ticket
                  </button>
                )
              )}
              {canShowReopenAction && (
                <button
                  type="button"
                  onClick={() => setShowReopenForm(true)}
                  className="rounded-xl bg-[#252578] px-4 py-2 text-button text-white transition-colors hover:bg-[#1f1f66]"
                >
                  Re-open Ticket
                </button>
              )}
              {!isCS && !allowReopen && ticket.status === 'Closed' && (
                <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                  Pending Evaluation
                </span>
              )}
              {ticket.can_discard && ticket.status === 'Open' && (
                <button
                  type="button"
                  onClick={() => onDiscard?.(ticket)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-button text-white transition-colors hover:bg-red-700"
                >
                  Discard Ticket
                </button>
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
          }}
        />
      )}
      {showReopenConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900">Reopen Ticket?</h2>
            <p className="mt-2 text-sm text-gray-600 break-words whitespace-normal">Are you sure you want to reopen <span className="font-semibold text-[#252578]">{ticket.id}</span>? This will change its status to Reopened.</p>
            {pendingReason && <p className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-700 break-words whitespace-normal"><span className="font-semibold">Reason:</span> {pendingReason}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowReopenConfirm(false); setPendingReason(''); }} className="rounded-xl px-4 py-2 text-button text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={() => { onReopen?.(ticket.ticket_ID || ticket.id, pendingReason); setShowReopenConfirm(false); setShowReopenForm(false); setReopenReason(''); setPendingReason(''); }} className="rounded-xl bg-[#252578] px-4 py-2 text-button text-white hover:bg-[#1f1f66]">Confirm Reopen</button>
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
