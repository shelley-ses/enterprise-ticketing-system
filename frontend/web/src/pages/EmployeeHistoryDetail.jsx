import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { statusColors, priorityColors, slaStatusColors } from '@/constants/employeeTickets';

export default function EmployeeHistoryDetail() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const ticket = state?.ticket;

  const timelineEvents = useMemo(() => {
    if (!ticket) return [];
    const events = [
      {
        id: 'creation',
        type: 'system',
        text: `Ticket created by ${ticket.customer || 'Customer'}.`,
        timestamp: ticket.date,
      },
    ];
    if (ticket.accepted) {
      events.push({
        id: 'acceptance',
        type: 'system',
        text: 'Assignment accepted by employee.',
        timestamp: ticket.date,
      });
    }
    if (ticket.reassignmentRequested) {
      events.push({
        id: 'reassignment',
        type: 'reassign',
        text: `Reassignment requested by employee.${
          ticket.reassignmentReason ? ` Reason: "${ticket.reassignmentReason}"` : ''
        }`,
        timestamp: ticket.lastUpdate ?? ticket.date,
      });
    }
    if (ticket.timeline && Array.isArray(ticket.timeline)) {
      events.push(...ticket.timeline);
    }
    return events;
  }, [ticket]);

  if (!ticket) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 mb-4">Ticket not found.</p>
        <button
          onClick={() => navigate('/employee/progress')}
          className="text-[#252578] font-semibold hover:underline"
        >
          ← Back to History
        </button>
      </div>
    );
  }

  const isImage = (name) => /\.(png|jpg|jpeg|gif|webp)$/i.test(name);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/employee/progress')}
        className="flex items-center gap-2 text-sm text-[#252578] font-semibold mb-6 hover:opacity-75 transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to History
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-bold text-[#252578] bg-blue-50 px-3 py-1 rounded-full">
            {ticket.id}
          </span>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              statusColors[ticket.status] ?? 'bg-gray-100 text-gray-700'
            }`}
          >
            {ticket.status}
          </span>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              priorityColors[ticket.priority] ?? 'bg-gray-100 text-gray-700'
            }`}
          >
            {ticket.priority}
          </span>
          {ticket.escalated && (
            <span className="text-xs font-bold px-3 py-1 bg-orange-100 text-orange-800 rounded-full border border-orange-200">
              Escalated
            </span>
          )}
          {ticket.reassignmentRequested && (
            <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
              Reassigned
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">{ticket.title}</h1>
        <p className="text-sm text-gray-500">
          {ticket.equipment && `${ticket.equipment} · `}
          {ticket.category}
        </p>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
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
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 mb-0.5">SLA</p>
            <span
              className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                slaStatusColors[ticket.slaStatus] ?? 'bg-gray-100 text-gray-700'
              }`}
            >
              {ticket.slaStatus ?? '—'}
            </span>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 mb-0.5">Last Update</p>
            <p className="text-sm font-semibold text-gray-800">{ticket.lastUpdate ?? '—'}</p>
          </div>
        </div>

        {ticket.description && (
          <div className="mt-4 bg-gray-50 rounded-xl p-4">
            <p className="text-[10px] text-gray-400 mb-1">Description</p>
            <p className="text-sm text-gray-700 leading-relaxed">{ticket.description}</p>
          </div>
        )}
      </div>

      {/* Attached Files / Photos */}
      {ticket.attachments && ticket.attachments.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
            Attached Files &amp; Photos
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {ticket.attachments.map((file, idx) => {
              const fileName = typeof file === 'string' ? file : file.name;
              const fileUrl = typeof file === 'string' ? file : file.url;

              return (
                <div
                  key={idx}
                  className="border border-gray-100 rounded-xl overflow-hidden shadow-sm"
                >
                  {isImage(fileName) ? (
                    <img
                      src={fileUrl}
                      alt={fileName}
                      className="w-full h-36 object-cover"
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-gray-50 h-36">
                      <div className="w-10 h-10 rounded-xl bg-[#252578]/10 flex items-center justify-center shrink-0">
                        <svg
                          className="w-5 h-5 text-[#252578]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">{fileName}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Document</p>
                      </div>
                    </div>
                  )}
                  <div className="px-3 py-2 border-t border-gray-100">
                    <p className="text-[10px] text-gray-500 truncate">{fileName}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Proof of Completion (if uploaded) */}
      {ticket.proofFiles && ticket.proofFiles.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6 border border-green-100">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Proof of Completion
          </h3>
          <p className="text-xs text-gray-400 mb-4">Documents submitted by the technician.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {ticket.proofFiles.map((file, idx) => {
              const fileName = typeof file === 'string' ? file : file.name;
              const fileUrl = typeof file === 'string' ? file : file.url;
              return (
                <div
                  key={idx}
                  className="border border-green-100 rounded-xl overflow-hidden shadow-sm"
                >
                  {isImage(fileName) ? (
                    <img src={fileUrl} alt={fileName} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-green-50 h-36">
                      <div className="w-10 h-10 rounded-xl bg-green-700/10 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">{fileName}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Proof Document</p>
                      </div>
                    </div>
                  )}
                  <div className="px-3 py-2 border-t border-green-100">
                    <p className="text-[10px] text-gray-500 truncate">{fileName}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chronological Timeline */}
      <div className="bg-white rounded-2xl shadow-md p-6">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
          Ticket Timeline &amp; History
        </h3>

        {timelineEvents.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No timeline events recorded.</p>
        ) : (
          <div className="relative pl-6 space-y-4 border-l-2 border-gray-100 ml-3 py-1.5">
            {timelineEvents.map((evt, idx) => {
              const dotColor =
                evt.type === 'system'
                  ? 'bg-[#252578]'
                  : evt.type === 'status'
                  ? 'bg-blue-500'
                  : evt.type === 'internal_note'
                  ? 'bg-red-400'
                  : evt.type === 'reassign'
                  ? 'bg-amber-500'
                  : 'bg-gray-400';

              return (
                <div key={evt.id || idx} className="relative text-sm">
                  <div
                    className={`absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 border-white shadow ${dotColor}`}
                  />
                  <div className="flex justify-between items-center text-[10px] text-gray-400 mb-0.5">
                    <span className="font-bold text-[#252578] uppercase text-[9px] tracking-wide">
                      {evt.type === 'system'
                        ? 'System'
                        : evt.type === 'status'
                        ? 'Status Update'
                        : evt.type === 'internal_note'
                        ? 'Internal Note'
                        : evt.type === 'reassign'
                        ? 'Reassignment'
                        : evt.type || 'Update'}
                    </span>
                    <span>{evt.timestamp}</span>
                  </div>
                  <p className="text-gray-700 leading-relaxed font-medium bg-gray-50/50 p-2.5 rounded-lg border border-gray-100/50">
                    {evt.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
