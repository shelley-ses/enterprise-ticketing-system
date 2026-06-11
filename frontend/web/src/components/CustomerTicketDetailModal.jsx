import React, { useState, useMemo } from 'react';
import FilePreviewModal from './FilePreviewModal';

const formatDate = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

export default function CustomerTicketDetailModal({
  ticket,
  onClose,
  onDiscard,
  onReopen,
  onResolve,
  allowReopen = true,
}) {
  const [timelineSortOrder, setTimelineSortOrder] = useState('asc');
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const sortedTimelineEvents = useMemo(() => {
    if (!ticket) return [];
    const events = [];
    if (ticket.timeline && Array.isArray(ticket.timeline)) {
      events.push(...ticket.timeline);
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

  if (!ticket) return null;

  const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
  const isReopenable = ticket.status === 'Closed'
    && resolvedAt
    && !Number.isNaN(resolvedAt.getTime())
    && (new Date() - resolvedAt) < (48 * 60 * 60 * 1000);
  const canShowReopenAction = allowReopen && isReopenable && typeof onReopen === 'function';
  const statusLabel = !allowReopen && ticket.status === 'Closed' ? 'Pending Evaluation' : ticket.status;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 shrink-0">
          <div>
            <p className="text-sm font-semibold text-[#252578]">{ticket.id}</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">{ticket.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">Category</p>
              <p className="mt-1 text-sm text-gray-800">{ticket.category}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">Status</p>
              <p className="mt-1 text-sm font-semibold text-gray-800">{statusLabel}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">Equipment</p>
              <p className="mt-1 text-sm text-gray-800">{ticket.equipment}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">Date Created</p>
              <p className="mt-1 text-sm text-gray-800">{formatDate(ticket.date_created)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">Last Updated</p>
              <p className="mt-1 text-sm text-gray-800">{formatDate(ticket.last_updated)}</p>
            </div>
            {(ticket.status === 'Resolved' || ticket.status === 'Closed') && ticket.resolved_at ? (
              <div>
                <p className="text-xs font-semibold uppercase text-gray-400">Resolved At</p>
                <p className="mt-1 text-sm text-gray-800">{formatDate(ticket.resolved_at)}</p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold uppercase text-gray-400">Discard Availability</p>
                <p className="mt-1 text-sm text-gray-800">
                  {ticket.can_discard ? 'Available before acceptance or delegation' : 'Unavailable after acceptance or delegation'}
                </p>
              </div>
            )}
            <div className="md:col-span-2">
              <p className="text-xs font-semibold uppercase text-gray-400">Description</p>
              <p className="mt-1 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                {ticket.description || 'No description available.'}
              </p>
            </div>

            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase text-gray-400">Attachments</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ticket.attachments.map((file) => (
                    <a
                      key={file.id || file.attachment_id}
                      href={file.url}
                      onClick={(e) => {
                        e.preventDefault();
                        setPreviewFile({ name: file.name, url: file.url });
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-gray-150 bg-gray-50 px-3 py-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      <svg className="h-4 w-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {file.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {ticket.proofAttachments && ticket.proofAttachments.length > 0 && (
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase text-gray-400">Proof of Completion Files</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ticket.proofAttachments.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      onClick={(e) => {
                        e.preventDefault();
                        setPreviewFile({ name: file.name, url: file.url });
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:text-green-900 hover:underline cursor-pointer"
                    >
                      <svg className="h-4 w-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {file.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="md:col-span-2 border-t border-gray-150 pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Ticket Timeline &amp; History
                </h3>
                <button
                  type="button"
                  onClick={() => setTimelineSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-600 transition-colors hover:bg-gray-100"
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
                        <div className="mb-0.5 flex items-center justify-between text-[10px] text-gray-400">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-[#252578]">
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
                          <span>{formatDate(evt.timestamp)}</span>
                        </div>
                        <p className="rounded-lg border border-gray-100/50 bg-gray-50/50 p-2.5 font-semibold leading-relaxed text-gray-700">
                          {evt.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 shrink-0">
          {showReopenForm ? (
            <div className="w-full text-left flex flex-col gap-2">
              <label htmlFor="reopen-reason-input" className="text-xs font-bold uppercase tracking-wide text-gray-600">
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
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-250"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={!reopenReason.trim()}
                  onClick={() => {
                    onReopen?.(ticket.ticket_ID || ticket.id, reopenReason.trim());
                    setShowReopenForm(false);
                    setReopenReason('');
                  }}
                  className="rounded-xl bg-[#252578] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1f1f66] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirm Reopen
                </button>
              </div>
            </div>
          ) : (
            <div className="flex w-full justify-end gap-3">
              {allowReopen && ticket.status === 'Closed' && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
                >
                  Close
                </button>
              )}
              {canShowReopenAction && (
                <button
                  type="button"
                  onClick={() => setShowReopenForm(true)}
                  className="rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1f1f66]"
                >
                  Re-open Ticket
                </button>
              )}
              {onResolve && ticket.status !== 'Closed' && ticket.status !== 'Discarded' && (
                <button
                  type="button"
                  onClick={() => onResolve(ticket.ticket_ID || ticket.id)}
                  className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                >
                  Close Ticket
                </button>
              )}
              {(!allowReopen || ticket.status !== 'Closed') && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
                >
                  Close
                </button>
              )}
              {!allowReopen && ticket.status === 'Closed' && (
                <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                  Pending Evaluation
                </span>
              )}
              {ticket.can_discard && ticket.status === 'Open' && (
                <button
                  type="button"
                  onClick={() => onDiscard?.(ticket)}
                  className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                >
                  Discard Ticket
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
