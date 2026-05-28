import React from 'react';

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

export default function CustomerTicketDetailModal({ ticket, onClose, onDiscard, onReopen }) {
  if (!ticket) return null;

  const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
  const isReopenable = (ticket.status === 'Resolved' || ticket.status === 'Closed') && resolvedAt && !isNaN(resolvedAt.getTime()) && (new Date() - resolvedAt) < (48 * 60 * 60 * 1000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-[#252578]">{ticket.id}</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">{ticket.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400">Category</p>
            <p className="mt-1 text-sm text-gray-800">{ticket.category}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400">Status</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">{ticket.status}</p>
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
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl bg-gray-50 border border-gray-150 px-3 py-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
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
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 hover:text-green-900 hover:underline"
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
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          {isReopenable && (
            <button
              type="button"
              onClick={() => onReopen?.(ticket.ticket_ID || ticket.id)}
              className="rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1f1f66]"
            >
              Re-open Ticket
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Close
          </button>
          {ticket.can_discard && (
            <button
              type="button"
              onClick={() => onDiscard?.(ticket)}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              Discard Ticket
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
