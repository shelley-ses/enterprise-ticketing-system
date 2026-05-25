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

export default function CustomerTicketDetailModal({ ticket, onClose, onDiscard }) {
  if (!ticket) return null;

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
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400">Discard Availability</p>
            <p className="mt-1 text-sm text-gray-800">
              {ticket.can_discard ? 'Available before acceptance or delegation' : 'Unavailable after acceptance or delegation'}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs font-semibold uppercase text-gray-400">Description</p>
            <p className="mt-1 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
              {ticket.description || 'No description available.'}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
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
