import React, { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { statusColors, priorityColors } from '@/constants/employeeTickets';
import { formatDisplayDate } from '@/utils/dateUtils';
import FilePreviewModal from '@/components/FilePreviewModal';
import InternalNotesSection from '@/components/InternalNotesSection';
import ReassignmentDisapprovalBanner from '@/components/employee/ReassignmentDisapprovalBanner';
import { isReassignmentDenied } from '@/utils/reassignmentUtils';
import { getTicketDetails, acceptTicket } from '@/services/ticketService';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';

export default function TicketInfoModal({ ticket, onClose }) {
  const navigate = useNavigate();
  const [previewFile, setPreviewFile] = useState(null);
  const [ticketDetails, setTicketDetails] = useState(ticket);
  const [isAccepting, setIsAccepting] = useState(false);

  useLockBodyScroll(!!ticket);

  useEffect(() => {
    setTicketDetails(ticket);
    const numericId = Number(String(ticket?.ticket_ID || ticket?.id || '').replace(/\D/g, ''));
    if (numericId && (!ticket?.timeline || isReassignmentDenied(ticket))) {
      getTicketDetails(numericId)
        .then((full) => {
          if (full) {
            setTicketDetails((prev) => ({
              ...full,
              ...(prev || {}),
              timeline: full.timeline || prev?.timeline,
              reassignmentDenyReason: prev?.reassignmentDenyReason || full.reassignmentDenyReason,
              disapprovalReason: prev?.disapprovalReason || full.disapprovalReason,
              reassignmentStatus: prev?.reassignmentStatus || full.reassignmentStatus,
              deniedReassignment: prev?.deniedReassignment ?? full.deniedReassignment,
            }));
          }
        })
        .catch(() => {});
    }
  }, [ticket]);

  if (!ticket) return null;

  const currentTicket = ticketDetails || ticket;

  const isTicketAccepted = Boolean(
    currentTicket.accepted ||
    currentTicket.assignment_status === 'accepted' ||
    currentTicket.status === 'In Progress' ||
    currentTicket.status === 'Pending Evaluation' ||
    currentTicket.status === 'Resolved' ||
    currentTicket.status === 'Closed'
  );

  const isItCategory = Boolean(
    currentTicket.category &&
    (currentTicket.category.trim().toLowerCase() === 'it' ||
     currentTicket.category.trim().toLowerCase().startsWith('it') ||
     currentTicket.category === 'IT Support')
  );

  const handleAccept = async () => {
    const numericId = Number(String(currentTicket?.ticket_ID || currentTicket?.id || '').replace(/\D/g, ''));
    if (!numericId) return;
    setIsAccepting(true);
    try {
      await acceptTicket({ ticketId: numericId });
      setTicketDetails((prev) => ({ ...prev, accepted: true, status: 'In Progress' }));
      window.dispatchEvent(new Event('notifications:updated'));
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Failed to accept ticket.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleUpdate = () => {
    onClose();
    navigate('/employee/ticket-update', { state: { ticket: currentTicket } });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1.5px]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 relative flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex-shrink-0 relative">
          <button type="button" onClick={onClose} className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <h2 className="text-xl font-bold text-gray-900 leading-snug pr-8">{currentTicket.title}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2 pr-8">
            <span className="text-xs font-bold text-[#252578] bg-blue-50 px-3 py-1 rounded-full">{currentTicket.id}</span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColors[currentTicket.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {(currentTicket.status === 'Pending Assignment' || (!isTicketAccepted && (currentTicket.assigned_to || currentTicket.assigned))) ? 'Assigned' : currentTicket.status}
            </span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${priorityColors[currentTicket.priority] ?? 'bg-gray-100 text-gray-700'}`}>{currentTicket.priority}</span>
            {currentTicket.escalated && (
              <span className="text-xs font-bold px-3 py-1 bg-orange-100 text-orange-800 rounded-full border border-orange-200">
                Escalated
              </span>
            )}
          </div>
          {!isItCategory && currentTicket.equipment && (
            <p className="text-sm text-gray-500 mt-1">
              {currentTicket.equipment}
            </p>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Description */}
          {ticket.description && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-dark mb-1">Description</p>
              <p className="text-sm font-normal text-slate-600 leading-relaxed">{ticket.description}</p>
            </div>
          )}

          {/* Requestor / Date Filed */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-dark mb-0.5">Requestor</p>
              <p className="text-sm font-normal text-slate-600">{ticket.customer || '—'}</p>
              {ticket.facility && (
                <p className="text-xs text-slate-muted mt-0.5">{ticket.facility}</p>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-dark mb-0.5">Date Filed</p>
              <p className="text-sm font-normal text-slate-600">{ticket.date ? formatDisplayDate(ticket.date) : '—'}</p>
            </div>
          </div>

          {/* Category / Last Updated */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-dark mb-1">Category</p>
              <p className="text-sm font-normal text-slate-600">{ticket.category || '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-dark mb-0.5">Last Updated</p>
              <p className="text-sm font-normal text-slate-600">{ticket.lastUpdate ?? '—'}</p>
            </div>
          </div>

          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-2">Original Ticket Attachments</p>
              <div className="flex flex-wrap gap-2">
                {ticket.attachments.map((file, idx) => {
                  const fName = typeof file === 'string' ? file.split('/').pop() : (file.name || file.file_name || `Attachment-${idx + 1}`);
                  const fUrl = typeof file === 'string' ? file : (file.url || file.file_path || file.path || '');
                  const isQuarantined = Boolean(
                    typeof file === 'object' && (file?.is_quarantined || file?.quarantined || file?.status === 'quarantined' || file?.virus_detected)
                  );

                  if (isQuarantined) {
                    return (
                      <span
                        key={file.id || file.attachment_id || idx}
                        className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-red-600 cursor-not-allowed"
                        title="File quarantined: Threat detected by antivirus scan"
                      >
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-500" />
                        <span className="line-through">{fName}</span>
                        <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-bold uppercase">Blocked</span>
                      </span>
                    );
                  }

                  return (
                    <a
                      key={file.id || file.attachment_id || idx}
                      href={fUrl || '#'}
                      onClick={(e) => {
                        e.preventDefault();
                        setPreviewFile({ name: fName, url: fUrl });
                      }}
                      className="flex items-center gap-1.5 bg-white border border-gray-150 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {fName}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {((ticket.proofAttachments && ticket.proofAttachments.length > 0) || (ticket.proofFiles && ticket.proofFiles.length > 0)) && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-2">Proof of Completion Documents</p>
              <div className="flex flex-wrap gap-2">
                {(ticket.proofAttachments || ticket.proofFiles).map((file, idx) => {
                  const fName = typeof file === 'string' ? file.split('/').pop() : (file.name || file.file_name || `Proof-${idx + 1}`);
                  const fUrl = typeof file === 'string' ? file : (file.url || file.file_path || file.path || '');
                  const isQuarantined = Boolean(
                    typeof file === 'object' && (file?.is_quarantined || file?.quarantined || file?.status === 'quarantined' || file?.virus_detected)
                  );

                  if (isQuarantined) {
                    return (
                      <span
                        key={file.id || file.proof_ID || idx}
                        className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-red-600 cursor-not-allowed"
                        title="Proof file quarantined: Threat detected by antivirus scan"
                      >
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-500" />
                        <span className="line-through">{fName}</span>
                        <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-bold uppercase">Blocked</span>
                      </span>
                    );
                  }

                  return (
                    <a
                      key={file.id || file.proof_ID || idx}
                      href={fUrl || '#'}
                      onClick={(e) => {
                        e.preventDefault();
                        setPreviewFile({ name: fName, url: fUrl });
                      }}
                      className="flex items-center gap-1.5 bg-white border border-gray-150 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:underline cursor-pointer"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {fName}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {currentTicket.internalNotes && currentTicket.internalNotes.length > 0 && (
            <InternalNotesSection
              notes={currentTicket.internalNotes}
              readOnly={true}
              maxListHeight="max-h-36"
            />
          )}

          <ReassignmentDisapprovalBanner ticket={currentTicket} />

          {currentTicket.reassignmentRequested && !isReassignmentDenied(currentTicket) && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
              <div>
                <span className="font-bold">Reassignment Request Pending</span>
                {currentTicket.reassignmentReason && `: "${currentTicket.reassignmentReason}"`}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-150 flex-shrink-0 flex items-center justify-between gap-3">
          {!isTicketAccepted ? (
            <>
              <span className="text-xs font-semibold text-amber-800">
                Ticket must be accepted before you can update status or log work.
              </span>
              <button
                type="button"
                disabled={isAccepting}
                onClick={handleAccept}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                {isAccepting ? 'Accepting...' : 'Accept Ticket'}
              </button>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={handleUpdate}
                className="px-7 py-2.5 bg-[#252578] hover:bg-[#1a1a5c] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-[#252578]/25 cursor-pointer"
              >
                Update
              </button>
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
