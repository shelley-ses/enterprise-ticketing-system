import React from 'react';
import { useNavigate } from 'react-router-dom';
import { statusColors, priorityColors, slaStatusColors } from '@/constants/employeeTickets';

export default function TicketInfoModal({ ticket, onClose }) {
  const navigate = useNavigate();

  if (!ticket) return null;

  const handleUpdate = () => {
    onClose();
    navigate('/employee/ticket-update', { state: { ticket } });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm py-10"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 relative flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-2 pr-8">
            <span className="text-xs font-bold text-[#252578] bg-blue-50 px-3 py-1 rounded-full">
              {ticket.id}
            </span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColors[ticket.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {ticket.status}
            </span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${priorityColors[ticket.priority] ?? 'bg-gray-100 text-gray-700'}`}>
              {ticket.priority}
            </span>
            {ticket.escalated && (
              <span className="text-xs font-bold px-3 py-1 bg-orange-100 text-orange-800 rounded-full border border-orange-200">
                Escalated
              </span>
            )}
          </div>

          <h2 className="text-xl font-bold text-gray-900 leading-snug">{ticket.title}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {ticket.equipment && `${ticket.equipment} · `}{ticket.category}
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Requestor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-0.5">Requestor</p>
              <p className="text-sm font-semibold text-gray-800">{ticket.customer || '—'}</p>
              {ticket.facility && (
                <p className="text-xs text-gray-500 mt-0.5">{ticket.facility}</p>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-0.5">Date Filed</p>
              <p className="text-sm font-semibold text-gray-800">{ticket.date || '—'}</p>
            </div>
          </div>

          {/* Meta badges */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-1">Category</p>
              <p className="text-sm font-semibold text-gray-800">{ticket.category || '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-1">Priority</p>
              <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${priorityColors[ticket.priority] ?? 'bg-gray-100 text-gray-700'}`}>
                {ticket.priority}
              </span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-1">Status</p>
              <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusColors[ticket.status] ?? 'bg-gray-100 text-gray-700'}`}>
                {ticket.status}
              </span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-1">SLA</p>
              <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${slaStatusColors[ticket.slaStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                {ticket.slaStatus ?? '—'}
              </span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 mb-0.5">Last Update</p>
            <p className="text-sm font-semibold text-gray-800">{ticket.lastUpdate ?? '—'}</p>
          </div>

          {ticket.description && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-700 leading-relaxed">{ticket.description}</p>
            </div>
          )}

          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-2">Original Ticket Attachments</p>
              <div className="flex flex-wrap gap-2">
                {ticket.attachments.map((file) => (
                  <a
                    key={file.id || file.attachment_id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-white border border-gray-150 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {file.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {ticket.proofAttachments && ticket.proofAttachments.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-2">Proof of Completion Documents</p>
              <div className="flex flex-wrap gap-2">
                {ticket.proofAttachments.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-white border border-gray-150 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:underline"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {file.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {ticket.reassignmentRequested && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
              <div>
                <span className="font-bold">Reassignment Request Pending</span>
                {ticket.reassignmentReason && `: "${ticket.reassignmentReason}"`}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex-shrink-0 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            className="px-7 py-2.5 bg-[#252578] hover:bg-[#1a1a5c] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-[#252578]/25"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
