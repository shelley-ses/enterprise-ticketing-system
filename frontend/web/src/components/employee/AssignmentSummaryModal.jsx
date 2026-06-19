import React from 'react';
import { statusColors, priorityColors } from '@/constants/employeeTickets';

/**
 * First step when opening an assignment: summary + Accept / Reject (not shown in the table).
 */
export default function AssignmentSummaryModal({ ticket, onClose }) {
  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px]" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">New assignment</p>
        <h2 className="text-xl font-bold text-gray-900 mb-1 pr-8">Ticket summary</h2>
        <p className="text-sm text-gray-500 mb-6">Review the ticket details.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs font-bold text-[#252578] bg-blue-50 px-3 py-1 rounded-full">{ticket.id}</span>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColors[ticket.status]}`}>{ticket.status}</span>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${priorityColors[ticket.priority]}`}>{ticket.priority}</span>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 mb-6 space-y-3 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Title</p>
            <p className="font-semibold text-gray-900">{ticket.title}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Requestor</p>
            <p className="font-semibold text-gray-900">{ticket.customer}</p>
            {ticket.facility && <p className="text-xs text-gray-500 mt-0.5">{ticket.facility}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Equipment</p>
              <p className="font-medium text-gray-800">{ticket.equipment}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Category</p>
              <p className="font-medium text-gray-800">{ticket.category}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Date filed</p>
            <p className="font-medium text-gray-800">{ticket.date}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#252578] text-white text-sm font-semibold hover:bg-[#1a1a5c]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
