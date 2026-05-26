import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { statusColors, priorityColors, slaStatusColors } from '@/constants/employeeTickets';
import { updateEmployeeTicketOverride } from '@/services/ticketService';
import ProofCompletionModal from '@/components/employee/ProofCompletionModal';
import ReassignmentModal from '@/components/employee/ReassignmentModal';

const STATUS_OPTIONS = ['In Progress', 'Pending', 'Resolved'];

export default function EmployeeTicketUpdate() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const [ticket, setTicket] = useState(state?.ticket ?? null);
  const [statusDraft, setStatusDraft] = useState(state?.ticket?.status ?? '');
  const [remarks, setRemarks] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [newInternalNote, setNewInternalNote] = useState('');
  const [showProofModal, setShowProofModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);

  useEffect(() => {
    if (!ticket) navigate('/employee/assigned', { replace: true });
  }, [ticket, navigate]);

  const isExternal = !!ticket?.customer;
  const isProofRejected =
    ticket?.proofRejected === true && ticket?.status === 'In Progress';

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
    if (ticket.timeline && Array.isArray(ticket.timeline)) {
      events.push(...ticket.timeline);
    }
    return events;
  }, [ticket]);

  const validateFiles = (files) => {
    const ALLOWED = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx'];
    const MAX = 15 * 1024 * 1024;
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!ALLOWED.includes(ext))
        return `Invalid file type: ${file.name}. Allowed: images, PDF, Word docs.`;
      if (file.size > MAX)
        return `File too large: ${file.name}. Maximum is 15MB.`;
    }
    return null;
  };

  const handleStatusSave = () => {
    if (statusDraft !== ticket.status && !remarks.trim()) {
      setErrorMessage('A remark is required when changing ticket status.');
      return;
    }
    const fileError = validateFiles(attachedFiles);
    if (fileError) {
      setErrorMessage(fileError);
      return;
    }

    const timestamp = new Date().toLocaleString('en-US');
    const fileNames = attachedFiles.map((f) => f.name);
    const update = {
      status: statusDraft,
      timeline: [
        {
          id: `status-${Date.now()}`,
          type: 'status',
          text: `Status updated to "${statusDraft}". Remarks: "${remarks.trim()}"${
            fileNames.length > 0 ? ` (Attached: ${fileNames.join(', ')})` : ''
          }`,
          timestamp,
        },
      ],
    };

    updateEmployeeTicketOverride(ticket.id, update);
    setTicket((prev) => ({ ...prev, status: statusDraft }));
    setSuccessMessage('Status updated successfully!');
    setRemarks('');
    setAttachedFiles([]);
    setErrorMessage('');
    setShowStatusConfirm(false);
  };

  const handleAddInternalNote = (e) => {
    e.preventDefault();
    if (!newInternalNote.trim()) return;

    const timestamp = new Date().toLocaleString('en-US');
    const note = {
      id: `note-${Date.now()}`,
      text: newInternalNote.trim(),
      author: 'Staff Member',
      timestamp,
    };
    const update = {
      internalNotes: [note],
      timeline: [
        {
          id: `note-timeline-${Date.now()}`,
          type: 'internal_note',
          text: `Added staff internal note: "${newInternalNote.trim()}"`,
          timestamp,
        },
      ],
    };

    updateEmployeeTicketOverride(ticket.id, update);
    setTicket((prev) => ({
      ...prev,
      internalNotes: [...(prev.internalNotes || []), note],
    }));
    setNewInternalNote('');
    setSuccessMessage('Internal note added!');
    setErrorMessage('');
  };

  if (!ticket) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/employee/assigned')}
        className="flex items-center gap-2 text-sm text-[#252578] font-semibold mb-6 hover:opacity-75 transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Assigned Tickets
      </button>

      {/* Ticket Header Card */}
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
            <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full animate-pulse border border-amber-200">
              Pending Reassign
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">{ticket.title}</h1>
        <p className="text-sm text-gray-500">
          {ticket.equipment && `${ticket.equipment} · `}
          {ticket.category}
        </p>

        {/* Info Grid */}
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

      {/* Feedback messages */}
      {successMessage && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-200 text-green-800 px-4 py-3 text-sm font-medium flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm font-medium flex items-center gap-2">
          <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {errorMessage}
        </div>
      )}

      <div className="space-y-6">
        {/* Reassignment pending banner */}
        {ticket.reassignmentRequested && (
          <div className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-3 border border-amber-100">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-bold">Reassignment Request Pending:</span>
              {ticket.reassignmentReason && ` "${ticket.reassignmentReason}"`}
            </div>
          </div>
        )}

        {/* Proof of Completion */}
        {isExternal &&
          ticket.status !== 'Resolved' &&
          ticket.status !== 'Pending Validation' && (
            <div className="bg-white rounded-2xl shadow-md p-6 flex items-center justify-between flex-wrap gap-4 border border-green-100">
              <div className="max-w-lg">
                {isProofRejected && (
                  <div className="mb-2.5 flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-800 px-3 py-1.5 rounded-xl text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shrink-0" />
                    Proof Rejected: &quot;{ticket.rejectionReason}&quot;
                  </div>
                )}
                <h3 className="text-sm font-bold text-gray-800">
                  {isProofRejected
                    ? 'Re-upload Proof of Completion'
                    : 'Proof of Completion Required'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Supporting documentation (PDF, DOC, or images up to 15MB each) must be
                  verified before the ticket can be resolved.
                </p>
              </div>
              <button
                onClick={() => setShowProofModal(true)}
                className="px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-green-700/20 flex items-center gap-2 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {isProofRejected ? 'Re-upload Proof' : 'Upload Proof Documents'}
              </button>
            </div>
          )}

        {/* Status Update */}
        {ticket.status !== 'Pending Validation' && ticket.status !== 'Resolved' && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
              Update Ticket Status
            </h3>

            {!showStatusConfirm ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Select new status
                  </label>
                  <select
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/25 font-semibold cursor-pointer"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {statusDraft !== ticket.status && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                        Remarks / Notes <span className="text-red-500">*</span>{' '}
                        <span className="text-gray-400 font-normal">(required on status change)</span>
                      </label>
                      <textarea
                        placeholder="Provide detailed notes about this status change..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={4}
                        className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/25 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                        Supporting Documentation{' '}
                        <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="file"
                        multiple
                        onChange={(e) => setAttachedFiles(Array.from(e.target.files))}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#252578]/10 file:text-[#252578] hover:file:bg-[#252578]/20 file:cursor-pointer"
                      />
                      {attachedFiles.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {attachedFiles.map((file, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center text-[10px] bg-white border border-gray-200 rounded-full px-2.5 py-0.5 font-medium text-gray-600"
                            >
                              {file.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!remarks.trim()) {
                          setErrorMessage('Remarks are required to change ticket status.');
                          return;
                        }
                        setErrorMessage('');
                        setShowStatusConfirm(true);
                      }}
                      className="w-full py-3 bg-[#252578] hover:bg-[#1a1a5c] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-[#252578]/20"
                    >
                      Save Status Change
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 border border-blue-100 rounded-xl p-5 text-center">
                <h5 className="text-sm font-bold text-gray-800 mb-2">Confirm Status Change</h5>
                <p className="text-sm text-gray-500 mb-4">
                  Are you sure you want to change the status from{' '}
                  <strong className="text-gray-700">&quot;{ticket.status}&quot;</strong> to{' '}
                  <strong className="text-gray-700">&quot;{statusDraft}&quot;</strong>?
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowStatusConfirm(false)}
                    className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleStatusSave}
                    className="flex-1 py-2.5 text-sm font-semibold bg-[#252578] hover:bg-[#1a1a5c] text-white rounded-xl shadow transition-colors"
                  >
                    Yes, Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Request Reassignment */}
        {!ticket.reassignmentRequested && (
          <div className="bg-white rounded-2xl shadow-md p-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Request Reassignment</h3>
              <p className="text-xs text-gray-500 mt-1">
                Cannot complete this ticket? Request to have it reassigned to another technician.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowReassignModal(true)}
              className="px-5 py-2.5 border border-red-200 text-red-700 hover:bg-red-50 text-sm font-semibold rounded-xl transition-colors"
            >
              Request Reassignment
            </button>
          </div>
        )}

        {/* Staff-Only Internal Notes */}
        <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              Internal Notes
              <span className="text-[9px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold uppercase border border-red-200">
                Staff-Only
              </span>
            </h3>
            <span className="text-xs text-gray-400 italic">Hidden from customer</span>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto">
            {!ticket.internalNotes || ticket.internalNotes.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">No internal notes added yet.</p>
            ) : (
              ticket.internalNotes.map((note) => (
                <div key={note.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <div className="flex justify-between items-center text-[10px] text-gray-400 mb-1">
                    <span className="font-bold text-[#252578]">{note.author}</span>
                    <span>{note.timestamp}</span>
                  </div>
                  <p className="text-sm text-gray-700 font-medium">{note.text}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddInternalNote} className="flex gap-2">
            <input
              type="text"
              placeholder="Write an internal note..."
              value={newInternalNote}
              onChange={(e) => setNewInternalNote(e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/20"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-[#252578] hover:bg-[#1a1a5c] text-white text-sm font-semibold rounded-xl shrink-0 transition-colors"
            >
              Add Note
            </button>
          </form>
        </div>

        {/* Ticket Timeline */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
            Ticket Timeline &amp; History
          </h3>
          <div className="relative pl-6 space-y-4 border-l border-gray-200 ml-3 py-1.5">
            {timelineEvents.map((evt, idx) => (
              <div key={evt.id || idx} className="relative text-sm">
                <div className="absolute -left-[30px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white bg-[#252578] shadow" />
                <div className="flex justify-between items-center text-[10px] text-gray-400 mb-0.5">
                  <span className="font-bold text-[#252578] uppercase text-[9px] tracking-wide">
                    {evt.type === 'system' ? 'System' : evt.type || 'Update'}
                  </span>
                  <span>{evt.timestamp}</span>
                </div>
                <p className="text-gray-700 leading-relaxed font-medium bg-gray-50/50 p-2 rounded-lg border border-gray-100/50">
                  {evt.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showProofModal && (
        <ProofCompletionModal
          ticket={ticket}
          onClose={() => setShowProofModal(false)}
          onStatusChange={(id, newStatus) =>
            setTicket((prev) => ({ ...prev, status: newStatus }))
          }
        />
      )}

      {showReassignModal && (
        <ReassignmentModal
          ticket={ticket}
          onClose={() => setShowReassignModal(false)}
          onReassignSuccess={(id) => {
            setTicket((prev) => ({
              ...prev,
              reassignmentRequested: true,
              reassignmentStatus: 'Pending',
            }));
            setShowReassignModal(false);
          }}
        />
      )}
    </div>
  );
}
