import React, { useEffect, useState, useMemo } from 'react';
import { statusColors, priorityColors } from '@/constants/employeeTickets';
import { updateEmployeeTicketOverride } from '@/services/ticketService';
import ProofCompletionModal from './ProofCompletionModal';

const STATUS_OPTIONS = ['In Progress', 'Pending', 'Resolved'];

export default function TicketDetailModal({
  ticket,
  onClose,
  onStatusChange,
  onAccept,
  onRequestReassign,
  isAccepting = false,
}) {
  const [statusDraft, setStatusDraft] = useState('');
  const [remarks, setRemarks] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Status change confirmation prompt
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  
  // Internal Notes State
  const [newInternalNote, setNewInternalNote] = useState('');

  // Sub-modal state for Proof of Completion (Modal 2)
  const [showProofModal, setShowProofModal] = useState(false);

  useEffect(() => {
    setStatusDraft(ticket?.status ?? '');
    setRemarks('');
    setAttachedFiles([]);
    setErrorMessage('');
    setSuccessMessage('');
    setShowStatusConfirm(false);
    setNewInternalNote('');
    setShowProofModal(false);
    setTimelineSortOrder('asc');
  }, [ticket]);

  if (!ticket) return null;

  const isAccepted = ticket.accepted === true;
  const isInternal = ticket?.title?.startsWith('[Internal]') || ticket?.is_internal || ticket?.ticket_type === 'Internal' || ticket?.type === 'Internal';
  const isExternal = !isInternal;
  const isProofRejected = ticket.proofRejected === true && ticket.status === 'In Progress';

  // Chronological timeline view
  const timelineEvents = useMemo(() => {
    const events = [
      {
        id: 'creation',
        type: 'system',
        text: `Ticket created by ${ticket.customer || 'Customer'}.`,
        timestamp: ticket.date,
      }
    ];

    if (ticket.accepted) {
      events.push({
        id: 'acceptance',
        type: 'system',
        text: 'Assignment accepted by employee.',
        timestamp: ticket.date,
      });
    }

    if (ticket.timeline && Array.isArray(ticket.timeline)) {
      events.push(...ticket.timeline);
    }

    return events;
  }, [ticket]);

  const [timelineSortOrder, setTimelineSortOrder] = useState('asc'); // 'asc' or 'desc'

  const sortedTimelineEvents = useMemo(() => {
    const sorted = [...timelineEvents];
    sorted.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timelineSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    return sorted;
  }, [timelineEvents, timelineSortOrder]);

  // Handle file validation (max 15MB each, allowed image/pdf/doc)
  const validateFiles = (files) => {
    const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx'];
    const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop().toLowerCase();
      
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        return `Invalid file type: ${file.name}. Only images, PDFs, and Word documents are allowed.`;
      }
      if (file.size > MAX_SIZE_BYTES) {
        return `File too large: ${file.name}. Maximum size is 15MB.`;
      }
    }
    return null;
  };

  // Submit Status Update
  const handleStatusSave = () => {
    if (statusDraft !== ticket.status && !remarks.trim()) {
      setErrorMessage('A note/remarks is required when changing ticket status.');
      return;
    }

    const fileError = validateFiles(attachedFiles);
    if (fileError) {
      setErrorMessage(fileError);
      return;
    }

    const timestamp = new Date().toLocaleString('en-US');
    const fileNames = attachedFiles.map(f => f.name);
    
    const update = {
      status: statusDraft,
      timeline: [
        {
          id: `status-${Date.now()}`,
          type: 'status',
          text: `Status updated to "${statusDraft}". Remarks: "${remarks.trim()}" ${
            fileNames.length > 0 ? `(Attached: ${fileNames.join(', ')})` : ''
          }`,
          timestamp,
        }
      ]
    };

    updateEmployeeTicketOverride(ticket.id, update);
    ticket.status = statusDraft;
    
    if (typeof onStatusChange === 'function') {
      onStatusChange(ticket.id, statusDraft);
    }

    setSuccessMessage('Status updated successfully!');
    setRemarks('');
    setAttachedFiles([]);
    setErrorMessage('');
    setShowStatusConfirm(false);
  };

  // Add Staff-Only Internal Note
  const handleAddInternalNote = (e) => {
    e.preventDefault();
    if (!newInternalNote.trim()) return;

    const timestamp = new Date().toLocaleString('en-US');
    const update = {
      internalNotes: [
        {
          id: `note-${Date.now()}`,
          text: newInternalNote.trim(),
          author: 'Staff Member',
          timestamp,
        }
      ],
      timeline: [
        {
          id: `note-timeline-${Date.now()}`,
          type: 'internal_note',
          text: `Added staff internal note: "${newInternalNote.trim()}"`,
          timestamp,
        }
      ]
    };

    updateEmployeeTicketOverride(ticket.id, update);
    
    // Optimistic local state update
    if (!ticket.internalNotes) ticket.internalNotes = [];
    ticket.internalNotes.push({
      id: `note-${Date.now()}`,
      text: newInternalNote.trim(),
      author: 'Staff Member',
      timestamp,
    });

    setNewInternalNote('');
    setSuccessMessage('Internal note added successfully!');
    setErrorMessage('');
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-10" onClick={onClose}>
        <div
          className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 my-auto relative flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex-shrink-0">
            <button type="button" onClick={onClose} className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <div className="flex flex-wrap items-center gap-2 mb-2 pr-8">
              <span className="text-xs font-bold text-[#252578] bg-blue-50 px-3 py-1 rounded-full">{ticket.id}</span>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColors[ticket.status]}`}>
                {ticket.status}
              </span>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${priorityColors[ticket.priority]}`}>
                {ticket.priority}
              </span>
              {ticket.reassignmentRequested && (
                <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full animate-pulse border border-amber-200">
                  Pending Reassign
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 leading-snug">{ticket.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{ticket.equipment} · {ticket.category}</p>
          </div>

          {/* Content Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Notifications / Feedback */}
            {successMessage && (
              <div className="rounded-xl bg-green-50 border border-green-200 text-green-800 px-4 py-3 text-sm font-medium flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm font-medium flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Ticket Information Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 text-sm">
                <p className="text-xs text-gray-400 mb-0.5">Requestor</p>
                <p className="font-semibold text-gray-800">{ticket.customer || 'Unknown Customer'}</p>
                {ticket.facility && <p className="text-xs text-gray-500 mt-0.5">{ticket.facility}</p>}
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-sm">
                <p className="text-xs text-gray-400 mb-0.5">Date Filed</p>
                <p className="font-semibold text-gray-800">{ticket.date}</p>
              </div>
            </div>

            {/* ────────────────────────────────────────────────────────
                UNACCEPTED STATE PANEL (Accept / Request Reassignment)
               ──────────────────────────────────────────────────────── */}
            {!isAccepted ? (
              ticket.reassignmentRequested ? (
                <div className="border border-amber-100 rounded-2xl p-6 bg-amber-50/30 text-center space-y-3">
                  <h4 className="text-sm font-bold text-amber-900">Reassignment Request Pending</h4>
                  <p className="text-xs text-amber-800 leading-relaxed max-w-md mx-auto">
                    You have requested reassignment for this ticket with the reason:<br/>
                    <strong className="italic">&quot;{ticket.reassignmentReason || ticket.reassignment_reason}&quot;</strong><br/>
                    Awaiting CS coordinator review and action.
                  </p>
                </div>
              ) : (
                <div className="border border-gray-150 rounded-2xl p-6 bg-slate-50 text-center space-y-4">
                  <h4 className="text-sm font-bold text-gray-800">Pending Assignment Action</h4>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
                    You are currently assigned to this ticket. Please accept this assignment to begin work, or request a reassignment if you cannot complete it.
                  </p>
                  <div className="flex gap-3 justify-center pt-2">
                    <button
                      type="button"
                      disabled={isAccepting}
                      onClick={() => {
                        if (typeof onRequestReassign === 'function') {
                          onRequestReassign(ticket);
                        }
                      }}
                      className="px-6 py-2.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Request Reassignment
                    </button>
                    <button
                      type="button"
                      disabled={isAccepting}
                      onClick={() => {
                        if (typeof onAccept === 'function') {
                          onAccept(ticket.id);
                        }
                      }}
                      className="px-8 py-2.5 bg-[#252578] hover:bg-[#1a1a5c] text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-[#252578]/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAccepting ? 'Accepting...' : 'Accept'}
                    </button>
                  </div>
                </div>
              )
            ) : (
              // ────────────────────────────────────────────────────────
              // ACCEPTED FULL MANAGEMENT PANEL
              // ────────────────────────────────────────────────────────
              <div className="space-y-6">
                
                {/* 1. Reassignment request pending banner (if reassignment requested post-accept) */}
                {ticket.reassignmentRequested && (
                  <div className="flex items-center gap-3 bg-amber-50/70 border border-amber-100 rounded-xl p-3.5 text-xs text-amber-800">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    <div>
                      <span className="font-bold">Reassignment Request Pending:</span> &quot;{ticket.reassignmentReason}&quot;
                    </div>
                  </div>
                )}

                {/* 2. Proof of Completion triggering button (all tickets) */}
                {ticket.status !== 'Resolved' && ticket.status !== 'Pending Evaluation' && (
                  <div className="border border-gray-150 rounded-2xl p-5 bg-green-50/30 border-green-100 flex items-center justify-between flex-wrap gap-4">
                    <div className="max-w-md text-left">
                      {isProofRejected && (
                        <div className="mb-2.5 flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-800 px-3 py-1.5 rounded-xl text-[11px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 animate-pulse" />
                          <span>Proof Rejected: &quot;{ticket.rejectionReason}&quot;</span>
                        </div>
                      )}
                      <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                        {isProofRejected ? 'Re-upload Proof of Completion' : 'Proof of Completion Required'}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Supporting documentation (PDF, DOC, or images up to 15MB each) must be verified before the ticket can be resolved.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowProofModal(true)}
                      className="px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-green-700/20 flex items-center gap-1.5 shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      {isProofRejected ? 'Re-upload Proof' : 'Upload Proof Documents'}
                    </button>
                  </div>
                )}

                {/* 3. Ticket Status updates (In Progress, Pending, Resolved) */}
                {ticket.status !== 'Pending Evaluation' && ticket.status !== 'Resolved' && (
                  <div className="border border-gray-100 rounded-2xl p-5 bg-gray-50/70 text-left">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Update Ticket Status</h4>
                    
                    {!showStatusConfirm ? (
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="modal-status-select" className="block text-[11px] font-semibold text-gray-500 mb-1">Select new status</label>
                          <select
                            id="modal-status-select"
                            value={statusDraft}
                            onChange={(e) => setStatusDraft(e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/25 cursor-pointer font-semibold"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        {statusDraft !== ticket.status && (
                          <div className="space-y-4">
                            {statusDraft !== 'Resolved' && (
                              <>
                                <div>
                                  <label htmlFor="status-remarks" className="block text-[11px] font-semibold text-gray-500 mb-1">Remarks/Notes * (Required on status change)</label>
                                  <textarea
                                    id="status-remarks"
                                    placeholder="Provide detailed notes regarding the status change..."
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    className="w-full text-xs border border-gray-200 rounded-xl p-3 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/25 min-h-[4rem] resize-none"
                                    required
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Supporting Documentation (Optional file upload)</label>
                                  <input
                                    type="file"
                                    multiple
                                    onChange={(e) => setAttachedFiles(Array.from(e.target.files))}
                                    className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#252578]/10 file:text-[#252578] hover:file:bg-[#252578]/20 file:cursor-pointer"
                                  />
                                  {attachedFiles.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      {attachedFiles.map((file, idx) => (
                                        <span key={idx} className="inline-flex items-center text-[9px] bg-white border border-gray-200 rounded-full px-2.5 py-0.5 font-medium text-gray-600">
                                          {file.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                if (statusDraft !== 'Resolved' && !remarks.trim()) {
                                  setErrorMessage('Remarks are required to change ticket status.');
                                  return;
                                }
                                setErrorMessage('');
                                setShowStatusConfirm(true);
                              }}
                              className="w-full py-2.5 bg-[#252578] hover:bg-[#1a1a5c] text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-[#252578]/20"
                            >
                              Save Status Change
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white border border-blue-100 rounded-xl p-4 text-center">
                        <h5 className="text-xs font-bold text-gray-800 mb-1.5">Confirm Status Change</h5>
                        <p className="text-[11px] text-gray-500 mb-4">
                          Are you sure you want to change the ticket status from <strong className="text-gray-700">&quot;{ticket.status}&quot;</strong> to <strong className="text-gray-700">&quot;{statusDraft}&quot;</strong>?
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowStatusConfirm(false)}
                            className="flex-1 py-2 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleStatusSave}
                            className="flex-1 py-2 text-xs font-semibold bg-[#252578] hover:bg-[#1a1a5c] text-white rounded-lg shadow"
                          >
                            Yes, Save Changes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Staff-Only Internal Notes */}
                <div className="border border-gray-100 rounded-2xl p-5 bg-gray-50/50 space-y-4 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                      <span>Internal Notes</span>
                      <span className="text-[9px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold uppercase border border-red-200">
                        Staff-Only
                      </span>
                    </h4>
                    <span className="text-[10px] text-gray-400 italic">Hidden from customer</span>
                  </div>

                  {/* Notes List */}
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {!ticket.internalNotes || ticket.internalNotes.length === 0 ? (
                      <p className="text-xs text-gray-400 italic p-1">No internal notes added yet.</p>
                    ) : (
                      ticket.internalNotes.map((note) => (
                        <div key={note.id} className="bg-white border border-gray-100 rounded-xl p-3 text-xs leading-relaxed">
                          <div className="flex justify-between items-center text-[10px] text-gray-400 mb-1">
                            <span className="font-bold text-[#252578]">{note.author}</span>
                            <span>{note.timestamp}</span>
                          </div>
                          <p className="text-gray-700 font-medium">{note.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Note Input */}
                  <form onSubmit={handleAddInternalNote} className="flex gap-2">
                    <input
                      id="internal-note-input"
                      type="text"
                      placeholder="Write an internal note..."
                      value={newInternalNote}
                      onChange={(e) => setNewInternalNote(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/20"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#252578] hover:bg-[#1a1a5c] text-white text-xs font-semibold rounded-xl shrink-0 transition-colors"
                    >
                      Add Note
                    </button>
                  </form>
                </div>

                {/* 5. Chronological History Timeline */}
                <div className="space-y-3 text-left">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Ticket Timeline & History</h4>
                    <button
                      type="button"
                      onClick={() => setTimelineSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-[#252578]/5 hover:bg-[#252578]/10 border border-[#252578]/10 rounded-xl text-[10px] font-bold text-[#252578] transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l-4-4m4 4l4-4" />
                      </svg>
                      {timelineSortOrder === 'asc' ? 'Oldest' : 'Newest'}
                    </button>
                  </div>
                  <div className="relative pl-6 space-y-4 border-l border-gray-200 ml-3 py-1.5">
                    {sortedTimelineEvents.map((evt, idx) => (
                      <div key={evt.id || idx} className="relative text-xs">
                        {/* Circle dot marker */}
                        <div className="absolute -left-[30px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white bg-[#252578] shadow" />
                        <div className="flex justify-between items-center text-[10px] text-gray-400 mb-0.5">
                          <span className="font-bold text-[#252578] uppercase text-[9px] tracking-wide">
                            {evt.type === 'system' ? 'System' : evt.type || 'Update'}
                          </span>
                          <span>{evt.timestamp}</span>
                        </div>
                        <p className="text-gray-700 leading-relaxed font-semibold bg-gray-50/50 p-2 rounded-lg border border-gray-100/50">
                          {evt.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 flex-shrink-0 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Close Modal
            </button>
          </div>
        </div>
      </div>

      {showProofModal && (
        <ProofCompletionModal
          ticket={ticket}
          onClose={() => setShowProofModal(false)}
          onStatusChange={onStatusChange}
        />
      )}
    </>
  );
}
