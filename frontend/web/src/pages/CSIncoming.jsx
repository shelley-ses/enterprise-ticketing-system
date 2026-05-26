import React, { useState, useMemo, useEffect } from 'react';
import actionIcon from '@/assets/action.png';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/context/AuthContext';
import { getCSIncomingTickets, getAssignableEmployees, getDepartments, acceptTicket, getTicketFormOptions, updateEmployeeTicketOverride } from '@/services/ticketService';
import { AssignModal } from '@/components/CSModals';



function ConfirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  confirmClass = 'bg-[#252578] hover:bg-[#1e1e60] shadow-[#252578]/30',
  onConfirm,
  onCancel,
  isSaving = false,
}) {
  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-96 max-w-full shadow-2xl p-7 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-[#252578]/10 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-[#252578]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h4 className="text-lg font-bold text-gray-800 mb-2">{title}</h4>
        {message && <p className="text-sm text-gray-500 mb-6 leading-relaxed">{message}</p>}
        <div className="flex gap-3 w-full mt-2">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-lg ${confirmClass}`}
          >
            {isSaving ? 'Saving...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────
   TICKET SUMMARY VIEW
   Handles:
   - Proof validation (approve / reject with reason + confirm prompt)
   - Close Ticket (only after Resolved, with confirm prompt + timestamp)
   - Reassignment request panel
───────────────────────────────────────────── */
function TicketSummary({ ticket, employees, onClose, onEdit, onStatusUpdate }) {
  // Proof rejection
  const [showRejectInput, setShowRejectInput]   = useState(false);
  const [rejectionReason, setRejectionReason]   = useState('');

  // Confirmation prompts
  const [confirmAction, setConfirmAction]       = useState(null);
  // confirmAction = null | 'approve-proof' | 'reject-proof' | 'close-ticket'
  const [isSaving, setIsSaving]                 = useState(false);

  const assignedEmployees = employees.filter((e) =>
    (ticket.assigned || []).includes(e.id)
  );

  const priorityColors = {
    Critical: 'bg-red-100 text-red-700',
    High:     'bg-orange-100 text-orange-700',
    Medium:   'bg-yellow-100 text-yellow-700',
    Low:      'bg-green-100 text-green-700',
  };

  /* ── Proof: Approve ── */
  const handleApproveProof = async () => {
    setIsSaving(true);
    const timestamp = new Date().toLocaleString('en-US');
    await onStatusUpdate({
      id: ticket.id,
      status: 'Resolved',
      proofRejected: false,
      rejectionReason: null,
      resolvedAt: timestamp,
      timeline: [{
        id: `proof-approve-${Date.now()}`,
        type: 'proof',
        text: 'Proof of Completion approved by CS. Ticket Resolved successfully.',
        timestamp,
      }],
    });
    setIsSaving(false);
    setConfirmAction(null);
  };

  /* ── Proof: Reject ── */
  const handleRejectProof = async () => {
    if (!rejectionReason.trim()) return;
    setIsSaving(true);
    const timestamp = new Date().toLocaleString('en-US');
    await onStatusUpdate({
      id: ticket.id,
      status: 'In Progress',
      proofRejected: true,
      rejectionReason: rejectionReason.trim(),
      // Pass proof files back so employee can see them and re-upload
      returnedProofAttachments: ticket.proofAttachments || [],
      timeline: [{
        id: `proof-reject-${Date.now()}`,
        type: 'proof',
        text: `Proof rejected by CS. Reason: "${rejectionReason.trim()}". Status returned to In Progress.`,
        timestamp,
      }],
    });
    setIsSaving(false);
    setConfirmAction(null);
  };

  /* ── Close Ticket ── */
  const handleCloseTicket = async () => {
    setIsSaving(true);
    const timestamp = new Date().toLocaleString('en-US');
    await onStatusUpdate({
      id: ticket.id,
      status: 'Closed',
      closedAt: timestamp,
      timeline: [{
        id: `close-${Date.now()}`,
        type: 'close',
        text: `Ticket closed by CS on ${timestamp}.`,
        timestamp,
      }],
    });
    setIsSaving(false);
    setConfirmAction(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white/95 backdrop-blur-lg rounded-3xl w-140 max-w-full max-h-[90vh] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.12)] relative">

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 p-6">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-[#252578] transition-colors text-sm"
            >
              ✕
            </button>

            {/* Header badge */}
            <div className="flex items-center gap-2 mb-5">
              <div className={`w-2 h-2 rounded-full ${
                ticket.status === 'Closed' ? 'bg-gray-400' :
                ticket.status === 'Resolved' ? 'bg-emerald-500' : 'bg-green-500'
              }`} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${
                ticket.status === 'Closed' ? 'text-gray-500' :
                ticket.status === 'Resolved' ? 'text-emerald-600' : 'text-green-600'
              }`}>
                {ticket.status === 'Pending Validation' ? 'Proof Submitted' :
                 ticket.status === 'Resolved'           ? 'Resolved — Awaiting Close' :
                 ticket.status === 'Closed'             ? 'Ticket Closed' :
                 'Ticket Assigned'}
              </span>
            </div>

            <h3 className="text-xl font-bold text-[#252578] mb-5">Ticket Summary</h3>

            {/* ── Reassignment Request Panel ── */}
            {ticket.reassignmentRequested && typeof onStatusUpdate === 'function' && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 text-xs text-amber-800 space-y-3">
                <div>
                  <p className="font-bold uppercase tracking-wider text-[10px] text-amber-900 mb-0.5">Pending Reassignment Request</p>
                  <p className="text-gray-700 font-medium leading-relaxed">&quot;{ticket.reassignmentReason}&quot;</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const timestamp = new Date().toLocaleString('en-US');
                      await onStatusUpdate({
                        id: ticket.id,
                        reassignmentRequested: false,
                        reassignmentStatus: 'Denied',
                        status: 'Open',
                        accepted: false,
                        timeline: [{
                          id: `reassign-deny-${Date.now()}`,
                          type: 'reassign',
                          text: 'Reassignment request denied by CS. Ticket status reverted to Open.',
                          timestamp,
                        }],
                      });
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
                  >
                    Deny Request
                  </button>
                  <button
                    onClick={async () => {
                      const timestamp = new Date().toLocaleString('en-US');
                      await onStatusUpdate({
                        id: ticket.id,
                        reassignmentRequested: false,
                        reassignmentStatus: 'Approved',
                        timeline: [{
                          id: `reassign-approve-${Date.now()}`,
                          type: 'reassign',
                          text: 'Reassignment request approved by CS.',
                          timestamp,
                        }],
                      });
                      onEdit();
                    }}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold"
                  >
                    Approve & Reassign
                  </button>
                </div>
              </div>
            )}

            {/* ── Proof Validation Panel (Pending Validation only) ── */}
            {ticket.status === 'Pending Validation' && typeof onStatusUpdate === 'function' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5 text-xs text-blue-800 space-y-3">
                <p className="font-bold uppercase tracking-wider text-[10px] text-blue-900">Review Proof of Completion</p>

                {/* Proof files list */}
                {ticket.proofAttachments && ticket.proofAttachments.length > 0 ? (
                  <div className="bg-white border border-gray-100 rounded-lg p-2.5 max-h-28 overflow-y-auto space-y-1">
                    {ticket.proofAttachments.map((f, i) => (
                      <div key={i} className="flex justify-between items-center text-gray-600 font-medium">
                        <span className="truncate max-w-[70%]">📎 {f.name}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{(f.size / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 italic">No files uploaded.</p>
                )}

                {/* Rejection reason input */}
                {showRejectInput ? (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                      Reason for rejection *
                    </label>
                    <textarea
                      autoFocus
                      placeholder="e.g. signature missing, document blurry..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-red-300 min-h-[3.5rem] resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowRejectInput(false); setRejectionReason(''); }}
                        className="px-2.5 py-1 text-xs border border-gray-200 text-gray-600 rounded-lg font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={!rejectionReason.trim()}
                        onClick={() => setConfirmAction('reject-proof')}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold"
                      >
                        Reject Proof
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRejectInput(true)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
                    >
                      Reject Proof
                    </button>
                    <button
                      onClick={() => setConfirmAction('approve-proof')}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold"
                    >
                      Approve & Resolve
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Ticket card ── */}
            <div className="bg-[#252578] text-white rounded-2xl p-4 mb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs opacity-70 mb-1">{ticket.id}</div>
                  <div className="text-sm font-semibold leading-snug">{ticket.title}</div>
                  <div className="text-xs opacity-60 mt-1">{ticket.category}</div>
                </div>
                <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-medium shrink-0">
                  {ticket.sla}
                </span>
              </div>
            </div>

            {/* Summary rows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-xs font-medium text-gray-500">Status</span>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  ticket.status === 'Closed'             ? 'bg-gray-100 text-gray-600' :
                  ticket.status === 'Resolved'           ? 'bg-emerald-100 text-emerald-700' :
                  ticket.status === 'Pending Validation' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {ticket.status || 'Pending'}
                </span>
              </div>

              {/* Closed timestamp */}
              {ticket.status === 'Closed' && ticket.closedAt && (
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-xs font-medium text-gray-500">Closed At</span>
                  <span className="text-xs font-semibold text-gray-800">{ticket.closedAt}</span>
                </div>
              )}

              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-xs font-medium text-gray-500">Department</span>
                <span className="text-xs font-semibold text-gray-800">{ticket.department || '—'}</span>
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-xs font-medium text-gray-500">Priority</span>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${priorityColors[ticket.priority] || 'bg-gray-100 text-gray-600'}`}>
                  {ticket.priority || '—'}
                </span>
              </div>

              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Assigned Employee(s)</div>
                {assignedEmployees.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">None assigned</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {assignedEmployees.map((emp) => (
                      <div key={emp.id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="text-xs font-medium text-gray-700">{emp.name}</span>
                        <span className="text-[10px] text-gray-400">{emp.department}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Close
            </button>

            <div className="flex gap-2">
              {/* Close Ticket button — only shown when status is Resolved */}
              {ticket.status === 'Resolved' && (
                <button
                  onClick={() => setConfirmAction('close-ticket')}
                  className="px-6 py-2.5 bg-gray-700 hover:bg-gray-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Close Ticket
                </button>
              )}

              {/* Reassign button — hidden if reassignment pending or already closed */}
              {!ticket.reassignmentRequested && ticket.status !== 'Closed' && (
                <button
                  onClick={onEdit}
                  className="px-6 py-2.5 bg-[#252578] text-white text-xs font-semibold rounded-xl hover:bg-[#1e1e60] transition-colors shadow-lg shadow-[#252578]/30 flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Reassign
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirm: Approve Proof ── */}
      {confirmAction === 'approve-proof' && (
        <ConfirmDialog
          title="Approve this proof?"
          message="This will mark the ticket as Resolved. The employee will be notified that their proof was accepted."
          confirmLabel="Yes, Approve"
          confirmClass="bg-green-600 hover:bg-green-700 shadow-green-600/30"
          isSaving={isSaving}
          onConfirm={handleApproveProof}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ── Confirm: Reject Proof ── */}
      {confirmAction === 'reject-proof' && (
        <ConfirmDialog
          title="Reject this proof?"
          message={`The ticket will be returned to In Progress. Rejection reason: "${rejectionReason}"`}
          confirmLabel="Yes, Reject"
          confirmClass="bg-red-600 hover:bg-red-700 shadow-red-600/30"
          isSaving={isSaving}
          onConfirm={handleRejectProof}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ── Confirm: Close Ticket ── */}
      {confirmAction === 'close-ticket' && (
        <ConfirmDialog
          title="Close this ticket?"
          message="This will permanently close the ticket and record the timestamp. This action cannot be undone."
          confirmLabel="Yes, Close Ticket"
          confirmClass="bg-gray-700 hover:bg-gray-800 shadow-gray-700/30"
          isSaving={isSaving}
          onConfirm={handleCloseTicket}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}


/* ─────────────────────────────────────────────
   REASSIGNMENT DETAIL MODAL
───────────────────────────────────────────── */
function ReassignDetailModal({ ticket, employees, onClose, onApprove, onDisapprove }) {
  const [view, setView]                         = useState('detail');
  const [disapproveReason, setDisapproveReason] = useState('');
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  const requestingEmployee = employees.find(e => e.id === ticket.reassignmentRequestedBy)
    || (ticket.reassignmentRequestedBy
      ? { name: `Employee #${ticket.reassignmentRequestedBy}` }
      : { name: 'Assigned Employee' });

  const assignedEmployees = employees.filter(e => (ticket.assigned || []).includes(e.id));

  const priorityColors = {
    Critical: 'bg-red-100 text-red-700',
    High:     'bg-orange-100 text-orange-700',
    Medium:   'bg-yellow-100 text-yellow-700',
    Low:      'bg-green-100 text-green-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-3xl w-[520px] max-w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">

        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 to-red-600" />

        <div className="overflow-y-auto flex-1 p-6">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 transition-colors text-lg leading-none"
          >
            ×
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Reassignment Request</h3>
              <p className="text-xs text-red-600 font-semibold">Immediate action required</p>
            </div>
          </div>

          <div className="bg-[#252578] text-white rounded-2xl p-4 mb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs opacity-70 mb-1">{ticket.id}</div>
                <div className="text-sm font-bold leading-snug">{ticket.title}</div>
                <div className="text-xs opacity-60 mt-1">{ticket.category}</div>
              </div>
              <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-medium shrink-0">
                {ticket.sla}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 mb-4">
            <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-xs font-medium text-gray-500">Status</span>
              <span className="text-xs font-semibold px-3 py-1 bg-blue-100 text-blue-700 rounded-full">{ticket.status}</span>
            </div>
            <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-xs font-medium text-gray-500">Priority</span>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${priorityColors[ticket.priority] || 'bg-gray-100 text-gray-600'}`}>
                {ticket.priority || '—'}
              </span>
            </div>
            <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-xs font-medium text-gray-500">Department</span>
              <span className="text-xs font-semibold text-gray-800">{ticket.department || '—'}</span>
            </div>
            {assignedEmployees.length > 0 && (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Currently Assigned To</div>
                <div className="flex flex-wrap gap-2">
                  {assignedEmployees.map(emp => (
                    <div key={emp.id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="text-xs font-medium text-gray-700">{emp.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700 mb-3">Reassignment Request Details</p>
            <div className="space-y-3">
              <div className="bg-white rounded-xl p-3 border border-red-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Requesting Employee</p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-3 h-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-gray-800">{requestingEmployee.name}</span>
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-red-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Reason for Request</p>
                <p className="text-sm text-gray-700 leading-relaxed italic">
                  &ldquo;{ticket.reassignmentReason || 'No reason provided.'}&rdquo;
                </p>
              </div>
            </div>
          </div>

          {view === 'disapprove-reason' && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
              <label className="block text-xs font-bold text-red-600 uppercase tracking-wide">Reason for Disapproval *</label>
              <textarea
                autoFocus
                placeholder="Explain why this reassignment request is disapproved..."
                value={disapproveReason}
                onChange={(e) => setDisapproveReason(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/25 resize-none min-h-[80px]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setView('detail')}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!disapproveReason.trim()}
                  onClick={() => onDisapprove(disapproveReason.trim())}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Disapproval
                </button>
              </div>
            </div>
          )}

          {showApproveConfirm && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-green-800">Approve this reassignment request?</p>
              <p className="text-xs text-green-700">The ticket will be opened for re-delegation. You will be taken to the assignment screen immediately.</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowApproveConfirm(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onApprove}
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Yes, Approve &amp; Reassign
                </button>
              </div>
            </div>
          )}
        </div>

        {view === 'detail' && !showApproveConfirm && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Close
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setView('disapprove-reason')}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                Disapprove
              </button>
              <button
                onClick={() => setShowApproveConfirm(true)}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                Approve &amp; Reassign
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function CSIncoming() {
  const { user } = useAuth();
  const [tickets, setTickets]               = useState([]);
  const [employees, setEmployees]           = useState([]);
  const [departments, setDepartments]       = useState([]);
  const [priorityOptions, setPriorityOptions] = useState(['Low', 'Medium', 'High', 'Critical']);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [search, setSearch]                 = useState('');
  const [category, setCategory]             = useState('All Categories');
  const [slaFilter, setSlaFilter]           = useState('All SLA');
  const [machineFilter, setMachineFilter]   = useState('All Machines');
  const [assignmentFilter, setAssignmentFilter] = useState('All Assignments');
  const [refreshKey, setRefreshKey]         = useState(0);

  // modal state: null | { mode: 'assign' | 'summary' | 'reassign-detail', ticket }
  const [modal, setModal] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const incoming = await getCSIncomingTickets({ limit: 100, forceRefresh: refreshKey > 0 });
        if (!mounted) return;
        setTickets(incoming);
      } catch {
        if (!mounted) return;
        setError('Unable to load incoming tickets from ticket-service.');
      }

      try {
        const [assignees, deps, options] = await Promise.all([
          getAssignableEmployees(),
          getDepartments(),
          getTicketFormOptions(),
        ]);
        if (!mounted) return;
        setEmployees(
          assignees.map((row) => ({
            id: Number(row.id),
            name: row.name,
            status: row.is_active ? 'active' : 'inactive',
            department: row.department || 'Unassigned',
          }))
        );
        setDepartments((deps?.departments || []).map((d) => d.name));
        setPriorityOptions((options?.ticket_priorities || []).map((p) => p.priority_name));
      } catch {
        if (!mounted) return;
        setError('Unable to load incoming tickets from ticket-service.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [refreshKey]);

  const categories = useMemo(
    () => ['All Categories', ...Array.from(new Set(tickets.map((t) => t.category)))],
    [tickets]
  );

  const machines = useMemo(
    () => ['All Machines', ...Array.from(new Set(tickets.map((t) => t.equipment).filter(Boolean)))],
    [tickets]
  );

  const slaOptions = ['All SLA', 'On Track', 'At Risk', 'Breached', 'Closed'];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (category !== 'All Categories' && t.category !== category) return false;
      if (slaFilter !== 'All SLA' && t.sla !== slaFilter) return false;
      if (machineFilter !== 'All Machines' && t.equipment !== machineFilter) return false;
      if (assignmentFilter === 'Pending Assignment') {
        const isAssigned =
          t.status === 'Assigned' ||
          t.status === 'In Progress' ||
          t.status === 'Pending Validation' ||
          t.status === 'Resolved' ||
          t.status === 'Closed';
        if (isAssigned) return false;
      }
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.equipment && t.equipment.toLowerCase().includes(q))
      );
    });
  }, [tickets, search, category, slaFilter, machineFilter, assignmentFilter]);

  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [filtered.length, totalPages, page]);

  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  /* ── Route row clicks to the correct modal ── */
  const handleRowAction = (t) => {
    if (t.reassignmentRequested) {
      setModal({ mode: 'reassign-detail', ticket: t });
    } else if (
      t.status === 'Assigned' ||
      t.status === 'In Progress' ||
      t.status === 'Pending Validation' ||
      t.status === 'Resolved' ||
      t.status === 'Closed'
    ) {
      setModal({ mode: 'summary', ticket: t });
    } else {
      setModal({ mode: 'assign', ticket: t });
    }
  };

  const reloadTickets = async () => {
    try {
      const incoming = await getCSIncomingTickets({ limit: 100, forceRefresh: true });
      setTickets(incoming);
    } catch {
      // keep existing state
    }
  };

  /* ── Status update handler ── */
  const handleStatusUpdate = async (updated) => {
    try {
      await updateEmployeeTicketOverride(updated.id, updated);
      await reloadTickets();
    } catch {
      setError('Failed to update ticket status.');
    }
  };

  const handleSave = async (updated) => {
    const priorityMap = { Low: 1, Medium: 2, High: 3, Critical: 4 };
    try {
      await acceptTicket({
        ticketId: updated.ticket_ID,
        employeeIds: updated.assigned,
        assignedByEmail: user?.email,
        priorityId: priorityMap[updated.priority] ?? 1,
      });
      await reloadTickets();
      setModal(null);
      return true;
    } catch (err) {
      setError('Failed to assign ticket. Please try again.');
      console.error(err);
      return false;
    }
  };

  return (
    <div className="p-6">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#252578]">Incoming Tickets</h1>
        <p className="text-gray-500 mt-2">Triage and assign new support tickets</p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center text-gray-500">Loading incoming tickets...</div>
      ) : (
        <>
          {/* Search & Filters */}
          <div className="mb-6 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tickets, customers..."
                className="w-full px-4 py-3 bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={assignmentFilter}
                onChange={(e) => setAssignmentFilter(e.target.value)}
                className="px-4 py-3 bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm text-sm font-medium text-gray-700 cursor-pointer"
              >
                <option value="All Assignments">All Assignments</option>
                <option value="Pending Assignment">Pending Assignment</option>
              </select>

              <select
                value={machineFilter}
                onChange={(e) => setMachineFilter(e.target.value)}
                className="px-4 py-3 bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm"
              >
                {machines.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-4 py-3 bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm"
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              <select
                value={slaFilter}
                onChange={(e) => setSlaFilter(e.target.value)}
                className="px-4 py-3 bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm text-sm font-medium text-gray-700 cursor-pointer"
              >
                {slaOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-6">

            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold text-[#252578]">Incoming Tickets</h2>
              <div className="text-sm text-gray-500">{filtered.length} tickets</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead>
                  <tr className="text-gray-500">
                    <th className="py-4 px-4">Ticket ID</th>
                    <th className="py-4 px-4">Customer</th>
                    <th className="py-4 px-4">Title</th>
                    <th className="py-4 px-4">Category</th>
                    <th className="py-4 px-4">SLA Status</th>
                    <th className="py-4 px-4">Date Submitted</th>
                    <th className="py-4 px-4">Action</th>
                  </tr>
                </thead>

                <tbody className="text-gray-700">
                  {paginated.map((t, idx) => {
                    const isReassignReq = t.reassignmentRequested;
                    const isFirstRow    = idx === 0 && page === 1;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => handleRowAction(t)}
                        className={`cursor-pointer transition-all border-b border-gray-50 ${
                          isReassignReq
                            ? 'bg-red-50 hover:bg-red-100'
                            : isFirstRow ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="py-4 px-4 font-medium">
                          <div className="flex flex-col gap-0.5">
                            <span className={isReassignReq ? 'text-red-700 font-bold' : ''}>{t.id}</span>
                            {isReassignReq && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-600 text-white shrink-0 w-max animate-pulse">
                                ⚠ Reassignment Requested
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-gray-600">{t.customer}</td>
                        <td className="py-4 px-4 text-gray-700">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">{t.title}</span>
                            {t.status === 'Pending Validation' && !isReassignReq && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 shrink-0 w-max mt-0.5 animate-pulse">
                                Pending Validation
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-3 py-1 bg-gray-100 rounded-full text-xs">{t.category}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            isReassignReq              ? 'bg-red-100 text-red-700' :
                            t.status === 'Pending Validation' ? 'bg-blue-100 text-blue-700' :
                            t.status === 'Resolved'    ? 'bg-emerald-100 text-emerald-700' :
                            t.status === 'Closed'      ? 'bg-gray-100 text-gray-600' :
                            t.status === 'Assigned' || t.status === 'In Progress'
                                                       ? 'bg-green-100 text-green-700'
                                                       : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {isReassignReq ? 'Reassignment Requested' : t.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-500">{t.date}</td>
                        <td className="py-4 px-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRowAction(t); }}
                            className={`p-2 rounded-xl transition-all ${
                              isReassignReq ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-gray-200 bg-gray-50'
                            }`}
                          >
                            <img src={actionIcon} alt="action" className="w-5 h-5 opacity-70" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing{' '}
                {filtered.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1}
                {' '}-{' '}
                {Math.min(page * ITEMS_PER_PAGE, filtered.length)}
                {' '}of {filtered.length}
              </div>
              <Pagination
                totalItems={filtered.length}
                itemsPerPage={ITEMS_PER_PAGE}
                currentPage={page}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          </div>
        </>
      )}

      {/* ── Ticket Summary Modal ── */}
      {modal?.mode === 'summary' && (
        <TicketSummary
          ticket={modal.ticket}
          employees={employees}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ mode: 'assign', ticket: modal.ticket })}
          onStatusUpdate={async (updated) => {
            await handleStatusUpdate(updated);
            setModal(null);
          }}
        />
      )}

      {/* ── Reassignment Detail Modal ── */}
      {modal?.mode === 'reassign-detail' && (
        <ReassignDetailModal
          ticket={modal.ticket}
          employees={employees}
          onClose={() => setModal(null)}
          onApprove={() => {
            const t = modal.ticket;
            updateEmployeeTicketOverride(t.id, {
              reassignmentRequested: false,
              reassignmentStatus: 'Approved',
            });
            reloadTickets();
            setModal({
              mode: 'assign',
              ticket: { ...t, reassignmentRequested: false, reassignmentStatus: 'Approved' },
            });
          }}
          onDisapprove={async (reason) => {
            const t = modal.ticket;
            await updateEmployeeTicketOverride(t.id, {
              reassignmentRequested: false,
              reassignmentStatus: 'Denied',
              reassignmentDenyReason: reason,
            });
            await reloadTickets();
            setModal(null);
          }}
        />
      )}

      {/* ── Assign Modal ── */}
      {modal?.mode === 'assign' && (
        <AssignModal
          ticket={modal.ticket}
          employees={employees}
          departments={departments}
          priorityOptions={priorityOptions}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}