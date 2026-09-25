import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { formatDisplayDate } from '@/utils/dateUtils';
import { statusColors, priorityColors, slaStatusColors } from '@/constants/employeeTickets';
import FilePreviewModal from '@/components/FilePreviewModal';
import ReassignmentDisapprovalBanner from '@/components/employee/ReassignmentDisapprovalBanner';
import { getTicketDetails } from '@/services/ticketService';

export default function EmployeeHistoryDetail() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { ticketId } = useParams();

  const [ticket, setTicket] = useState(state?.ticket || null);
  const [loading, setLoading] = useState(!state?.ticket);
  const [error, setError] = useState(null);
  const backPath = state?.backPath ?? '/employee/progress';
  const [previewFile, setPreviewFile] = useState(null);
  const [timelineSortOrder, setTimelineSortOrder] = useState('asc'); // 'asc' or 'desc'

  const numericId = useMemo(() => {
    if (ticketId) {
      const parsed = parseInt(String(ticketId).replace(/\D/g, ''), 10);
      if (!isNaN(parsed)) return parsed;
    }
    if (state?.ticket?.ticket_ID) return state.ticket.ticket_ID;
    if (state?.ticket?.id) {
      const parsed = parseInt(String(state.ticket.id).replace(/\D/g, ''), 10);
      if (!isNaN(parsed)) return parsed;
    }
    return null;
  }, [ticketId, state?.ticket]);

  useEffect(() => {
    if (!numericId) {
      if (!ticket) setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchDetails = async () => {
      try {
        const fullDetails = await getTicketDetails(numericId);
        if (isMounted && fullDetails) {
          setTicket((prev) => ({
            ...(prev || {}),
            ...fullDetails,
            // Preserve navigation state fields if not returned by API
            customer: fullDetails.customer || prev?.customer,
            facility: fullDetails.facility || prev?.facility,
          }));
        }
      } catch (err) {
        console.error('Failed to load full ticket history details:', err);
        if (isMounted && !ticket) {
          setError('Unable to load ticket details.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [numericId]);

  const getAbsoluteUrl = (rawUrl) => {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('blob:')) {
      return rawUrl;
    }
    const backendApiUrl = import.meta.env.VITE_TICKET_API_URL || 'http://localhost:8002/api';
    const backendHost = backendApiUrl.replace(/\/api$/, '').replace(/\/api\/$/, '');
    if (rawUrl.startsWith('/')) {
      return `${backendHost}${rawUrl}`;
    }
    return `${backendHost}/${rawUrl}`;
  };

  const remarksList = useMemo(() => {
    if (!ticket) return [];
    const fromProps = ticket.remarks || ticket.remarks_history || [];
    const list = Array.isArray(fromProps) ? [...fromProps] : [];

    if (ticket.timeline && Array.isArray(ticket.timeline)) {
      ticket.timeline.forEach((evt) => {
        if (evt.type === 'remark' || (evt.text && evt.text.toLowerCase().includes('remark'))) {
          if (!list.some((r) => (r.remark || r.text) === evt.text)) {
            list.push({
              id: evt.id,
              remark: evt.text,
              timestamp: evt.timestamp,
              author: 'Staff Member',
            });
          }
        }
      });
    }

    return list.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return dateB - dateA;
    });
  }, [ticket]);

  const timelineEvents = useMemo(() => {
    if (!ticket) return [];
    const events = [
      {
        id: 'creation',
        type: 'system',
        text: `Ticket created by ${ticket.customer || 'Customer'}.`,
        timestamp: ticket.date || ticket.created_at || ticket.date_created,
      },
    ];
    if (ticket.accepted) {
      events.push({
        id: 'acceptance',
        type: 'system',
        text: 'Assignment accepted by employee.',
        timestamp: ticket.date || ticket.created_at,
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
      ticket.timeline.forEach((item) => {
        if (!events.some((e) => e.id === item.id || (e.text === item.text && e.timestamp === item.timestamp))) {
          events.push(item);
        }
      });
    }
    return events;
  }, [ticket]);

  const sortedTimelineEvents = useMemo(() => {
    const sorted = [...timelineEvents];
    sorted.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timelineSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    return sorted;
  }, [timelineEvents, timelineSortOrder]);

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-[#252578]/20 border-t-[#252578] rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-[#252578]">Loading ticket details...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="p-6 text-center max-w-4xl mx-auto">
        <p className="text-gray-500 mb-4">{error || 'Ticket not found.'}</p>
        <button
          onClick={() => navigate(backPath)}
          className="text-[#252578] font-semibold hover:underline"
        >
          ← Back to History
        </button>
      </div>
    );
  }

  const isImage = (name) => /\.(png|jpg|jpeg|gif|webp)$/i.test(name || '');

  const equipmentTypeDisplay =
    ticket.equipment_type ||
    ticket.equipmentType ||
    ticket.machine_category ||
    ticket.machine?.category_name ||
    (ticket.category ? `${ticket.category} Equipment` : 'Medical Equipment');

  const assignedEmployeeDisplay =
    ticket.assigned_employee ||
    ticket.assigned_employee_name ||
    ticket.assigned_to_name ||
    ticket.assigned_employees?.[0]?.name ||
    (typeof ticket.assigned_to === 'string' ? ticket.assigned_to : null) ||
    'Unassigned';

  const machineDisplay =
    ticket.equipment ||
    ticket.machine_name ||
    (ticket.serial_number ? `Serial: ${ticket.serial_number}` : '—');

  const resolvedDateDisplay =
    ticket.resolved_at || ticket.closed_at ? formatDisplayDate(ticket.resolved_at || ticket.closed_at) : null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(backPath)}
        className="flex items-center gap-2 text-sm text-[#252578] font-semibold mb-6 hover:opacity-75 transition-opacity cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to History
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-bold text-[#252578] bg-blue-50 px-3 py-1 rounded-full">
            {ticket.id || (ticket.ticket_ID ? `TKT-${String(ticket.ticket_ID).padStart(4, '0')}` : 'Ticket')}
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
          {(ticket.title?.startsWith('[Internal]') || ticket.is_internal || ticket.ticket_type === 'Internal' || ticket.type === 'Internal') && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-100 text-purple-700">
              Internal
            </span>
          )}
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
        <p className="text-sm text-gray-500 mb-4">
          {machineDisplay !== '—' && `${machineDisplay} · `}
          <span className="font-medium text-gray-700">{equipmentTypeDisplay}</span>
          {ticket.category && ` · ${ticket.category}`}
        </p>

        <ReassignmentDisapprovalBanner ticket={ticket} className="mb-5" />

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Requestor</p>
            <p className="text-sm font-semibold text-gray-800">{ticket.customer || ticket.requestor || '—'}</p>
            {ticket.facility && (
              <p className="text-xs text-gray-500 mt-0.5">{ticket.facility}</p>
            )}
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Equipment / Machine</p>
            <p className="text-sm font-semibold text-gray-800 truncate" title={machineDisplay}>
              {machineDisplay}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Equipment Type</p>
            <p className="text-sm font-semibold text-gray-800 truncate" title={equipmentTypeDisplay}>
              {equipmentTypeDisplay}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Assigned Employee</p>
            <p className="text-sm font-semibold text-gray-800 truncate" title={assignedEmployeeDisplay}>
              {assignedEmployeeDisplay}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Category</p>
            <p className="text-sm font-semibold text-gray-800">{ticket.category || '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Date Filed</p>
            <p className="text-sm font-semibold text-gray-800">{ticket.date || ticket.created_at ? formatDisplayDate(ticket.date || ticket.created_at) : '—'}</p>
          </div>
          {resolvedDateDisplay ? (
            <div className="bg-green-50/70 border border-green-200/50 rounded-xl p-3">
              <p className="text-[10px] uppercase font-bold text-green-700 mb-0.5">Date Resolved</p>
              <p className="text-sm font-bold text-green-800">{resolvedDateDisplay}</p>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">SLA Status</p>
              <span
                className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  slaStatusColors[ticket.slaStatus || ticket.sla] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {ticket.slaStatus || ticket.sla || '—'}
              </span>
            </div>
          )}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Last Update</p>
            <p className="text-sm font-semibold text-gray-800">{ticket.lastUpdate || ticket.updated_at ? formatDisplayDate(ticket.lastUpdate || ticket.updated_at) : '—'}</p>
          </div>
        </div>

        {ticket.description && (
          <div className="mt-4 bg-gray-50 rounded-xl p-4">
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Description</p>
            <p className="text-sm text-gray-700 leading-relaxed break-words whitespace-pre-wrap">{ticket.description}</p>
          </div>
        )}
      </div>

      {/* Attached Files / Photos */}
      {ticket.attachments && ticket.attachments.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#252578]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Attached Files &amp; Photos ({ticket.attachments.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {ticket.attachments.map((file, idx) => {
              const fileName = typeof file === 'string' ? file.split('/').pop() : (file.name || file.file_name || `File-${idx + 1}`);
              const fileUrl = typeof file === 'string' ? file : (file.url || file.file_path || file.path || '');
              const absUrl = getAbsoluteUrl(fileUrl);

              return (
                <div
                  key={idx}
                  onClick={() => setPreviewFile({ name: fileName, url: fileUrl })}
                  className="border border-gray-150 rounded-xl overflow-hidden shadow-xs cursor-pointer hover:shadow-md transition-shadow"
                >
                  {isImage(fileName) ? (
                    <img
                      src={absUrl}
                      alt={fileName}
                      className="w-full h-36 object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`flex items-center gap-3 p-4 bg-gray-50 h-36 ${isImage(fileName) ? 'hidden' : 'flex'}`}>
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
                  <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <p className="text-[10px] text-gray-500 truncate">{fileName}</p>
                    <span className="text-[10px] text-[#252578] font-bold">Preview</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Proof of Completion (if uploaded) */}
      {((ticket.proofFiles && ticket.proofFiles.length > 0) || (ticket.proofAttachments && ticket.proofAttachments.length > 0)) && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-green-100">
          <h3 className="text-sm font-bold text-green-800 uppercase tracking-wide mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Proof of Completion Documents
          </h3>
          <p className="text-xs text-gray-400 mb-4">Completed service logs and documents submitted by the technician.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(ticket.proofFiles || ticket.proofAttachments).map((file, idx) => {
              const fileName = typeof file === 'string' ? file.split('/').pop() : (file.name || file.file_name || `Proof-${idx + 1}`);
              const fileUrl = typeof file === 'string' ? file : (file.url || file.file_path || file.path || '');
              const absUrl = getAbsoluteUrl(fileUrl);
              return (
                <div
                  key={idx}
                  onClick={() => setPreviewFile({ name: fileName, url: fileUrl })}
                  className="border border-green-200 rounded-xl overflow-hidden shadow-xs cursor-pointer hover:shadow-md transition-shadow"
                >
                  {isImage(fileName) ? (
                    <img
                      src={absUrl}
                      alt={fileName}
                      className="w-full h-36 object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`flex items-center gap-3 p-4 bg-green-50/40 h-36 ${isImage(fileName) ? 'hidden' : 'flex'}`}>
                    <div className="w-10 h-10 rounded-xl bg-green-700/10 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{fileName}</p>
                      <p className="text-[10px] text-green-600 font-medium mt-0.5">Proof Document</p>
                    </div>
                  </div>
                  <div className="px-3 py-2 border-t border-green-100 bg-green-50/30 flex items-center justify-between">
                    <p className="text-[10px] text-gray-500 truncate">{fileName}</p>
                    <span className="text-[10px] text-green-700 font-bold">Preview</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Remarks History */}
      {remarksList && remarksList.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#252578] inline-block" />
            Remarks History ({remarksList.length})
          </h3>
          <div className="space-y-3">
            {remarksList.map((rem, idx) => (
              <div
                key={rem.id || idx}
                className="rounded-xl border border-gray-150 bg-gray-55/60 p-4 text-xs shadow-xs"
              >
                <div className="flex items-center justify-between text-gray-500 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#252578] text-xs uppercase tracking-wide">
                      {rem.author || 'Staff Member'}
                    </span>
                    {rem.status && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-gray-200 text-gray-700 rounded-full">
                        {rem.status}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {formatDisplayDate(rem.timestamp)}
                  </span>
                </div>
                <p className="text-gray-800 text-sm leading-relaxed break-words whitespace-pre-wrap font-medium">
                  {rem.remark || rem.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chronological Timeline */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
            Ticket Timeline &amp; History
          </h3>
          <button
            type="button"
            onClick={() => setTimelineSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252578]/5 hover:bg-[#252578]/10 border border-[#252578]/10 rounded-xl text-xs font-bold text-[#252578] transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l-4-4m4 4l4-4" />
            </svg>
            {timelineSortOrder === 'asc' ? 'Showing: Oldest First' : 'Showing: Newest First'}
          </button>
        </div>

        {sortedTimelineEvents.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No timeline events recorded.</p>
        ) : (
          <div className="relative pl-6 space-y-4 border-l-2 border-gray-100 ml-3 py-1.5">
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
                        : evt.type === 'remark'
                        ? 'Remark'
                        : evt.type === 'reassign'
                        ? 'Reassignment'
                        : evt.type || 'Update'}
                    </span>
                    <span>{formatDisplayDate(evt.timestamp)}</span>
                  </div>
                  <p
                    className="text-gray-700 leading-relaxed font-medium bg-gray-50/50 p-2.5 rounded-lg border border-gray-100/50 break-words whitespace-pre-wrap max-w-full overflow-hidden"
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

      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
