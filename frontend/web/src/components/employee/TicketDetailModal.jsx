import React, { useEffect, useState } from 'react';
import { statusColors, priorityColors } from '@/constants/employeeTickets';

const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Escalated', 'Closed'];

/** Work / update modal: status changes only (assignment Accept/Reject is a separate modal). */
export default function TicketDetailModal({
  ticket,
  onClose,
  onStatusChange,
}) {
  const [statusDraft, setStatusDraft] = useState('');

  useEffect(() => {
    setStatusDraft(ticket?.status ?? '');
  }, [ticket]);

  if (!ticket) return null;

  const showStatusControls = typeof onStatusChange === 'function';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Update ticket</p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-xs font-bold text-[#252578] bg-blue-50 px-3 py-1 rounded-full">{ticket.id}</span>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColors[ticket.status]}`}>{ticket.status}</span>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${priorityColors[ticket.priority]}`}>{ticket.priority}</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">{ticket.title}</h2>
        <p className="text-sm text-gray-500 mb-6">{ticket.equipment} · {ticket.category}</p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Requestor</p>
            <p className="text-sm font-semibold text-gray-800">{ticket.customer}</p>
            {ticket.facility && <p className="text-xs text-gray-500 mt-1">{ticket.facility}</p>}
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Date Filed</p>
            <p className="text-sm font-semibold text-gray-800">{ticket.date}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Category</p>
            <p className="text-sm font-semibold text-gray-800">{ticket.category}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Equipment</p>
            <p className="text-sm font-semibold text-gray-800">{ticket.equipment}</p>
          </div>
        </div>

        {showStatusControls && (
          <div className="mb-6">
            <label htmlFor="ticket-status-update" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Update ticket status
            </label>
            <select
              id="ticket-status-update"
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/25"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Close
          </button>
          {showStatusControls && (
            <button
              type="button"
              onClick={() => {
                onStatusChange(ticket.id, statusDraft);
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-[#252578] text-white text-sm font-semibold hover:bg-[#1a1a5c] transition-colors"
            >
              Save update
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
