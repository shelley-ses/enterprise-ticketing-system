import React, { useState, useMemo, useEffect } from 'react';

/* ─────────────────────────────────────────────
   CONFIRMATION DIALOG
───────────────────────────────────────────── */
export function ConfirmDialog({ onConfirm, onCancel, isSaving = false, title = "Update this ticket?", message = "Are you sure you want to save the changes to this ticket?", confirmText = "Yes, Update" }) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-105 max-w-full shadow-2xl p-7 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-[#252578]/10 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-[#252578]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h4 className="text-lg font-bold text-gray-800 mb-2">
          {title}
        </h4>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3 w-full">
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
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#252578] hover:bg-[#1e1e60] rounded-xl transition-colors shadow-lg shadow-[#252578]/30"
          >
            {isSaving ? 'Saving...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TICKET SUMMARY VIEW (post-save / already assigned)
───────────────────────────────────────────── */
export function TicketSummary({ ticket, employees, onClose, onEdit, onStatusUpdate }) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Reassignment specific states
  const [showReassignDeny, setShowReassignDeny] = useState(false);
  const [showReassignApprove, setShowReassignApprove] = useState(false);
  const [reassignDenyReason, setReassignDenyReason] = useState('');

  const assignedEmployees = employees.filter((e) =>
    (ticket.assigned || []).includes(e.id)
  );

  const priorityColors = {
    Critical: 'bg-red-100 text-red-700',
    High: 'bg-orange-100 text-orange-700',
    Medium: 'bg-yellow-100 text-yellow-700',
    Low: 'bg-green-100 text-green-700',
  };

  const getRequestingEmployeeName = () => {
    // Attempt to find the employee who requested this, could be based on a field in ticket
    // Or just "Employee" if not provided directly
    if (ticket.reassignmentRequestedBy) {
        const emp = employees.find(e => e.id === ticket.reassignmentRequestedBy);
        return emp ? emp.name : `Employee ID: ${ticket.reassignmentRequestedBy}`;
    }
    return 'Assigned Employee';
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
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">
                {ticket.status === 'Pending Validation' ? 'Proof Submitted' : 'Ticket Assigned'}
              </span>
            </div>

            <h3 className="text-xl font-bold text-[#252578] mb-5">
              Ticket Summary
            </h3>

            {/* Reassignment Request Approval/Denial Panel */}
            {ticket.reassignmentRequested && typeof onStatusUpdate === 'function' && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 text-xs text-amber-800 space-y-3">
                <div className="border-b border-amber-200/50 pb-3 mb-3">
                  <h4 className="font-bold uppercase tracking-wider text-[11px] text-amber-900 mb-2 flex items-center gap-1.5">
                    <span className="text-amber-600">⚠️</span> Immediate Action Required: Reassignment Request
                  </h4>
                  <div className="bg-white rounded-lg p-3 border border-amber-100 shadow-sm">
                    <div className="mb-2">
                      <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wide">Requesting Employee</span>
                      <p className="text-gray-800 font-semibold">{getRequestingEmployeeName()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wide">Reason Provided</span>
                      <p className="text-gray-700 font-medium leading-relaxed italic mt-0.5">&quot;{ticket.reassignmentReason || 'No reason provided'}&quot;</p>
                    </div>
                  </div>
                </div>
                
                {showReassignDeny ? (
                    <div className="space-y-2 bg-white p-3 rounded-lg border border-red-200">
                      <label className="block text-[10px] font-bold text-red-600 uppercase tracking-wide">Reason for Disapproval *</label>
                      <textarea
                        placeholder="Explain why this reassignment request is disapproved..."
                        value={reassignDenyReason}
                        onChange={(e) => setReassignDenyReason(e.target.value)}
                        className="w-full text-xs border border-red-200 rounded-lg p-2 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-red-500/25 min-h-[3rem]"
                        required
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setShowReassignDeny(false)}
                          className="px-2.5 py-1.5 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg font-bold transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (!reassignDenyReason.trim()) return;
                            const timestamp = new Date().toLocaleString('en-US');
                            const updated = {
                              id: ticket.id,
                              reassignmentRequested: false,
                              reassignmentStatus: 'Denied',
                              reassignmentDenyReason: reassignDenyReason.trim(),
                              status: 'Open',
                              accepted: false,
                              timeline: [
                                {
                                  id: `reassign-deny-${Date.now()}`,
                                  type: 'reassign',
                                  text: `Reassignment request denied by CS. Reason: "${reassignDenyReason.trim()}". Ticket status reverted to Open.`,
                                  timestamp,
                                }
                              ]
                            };
                            await onStatusUpdate(updated);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                          Confirm Disapproval
                        </button>
                      </div>
                    </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowReassignDeny(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                    >
                      Disapprove
                    </button>
                    <button
                      onClick={() => setShowReassignApprove(true)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                    >
                      Approve Request
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Proof of Completion Validation Panel */}
            {ticket.status === 'Pending Validation' && typeof onStatusUpdate === 'function' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5 text-xs text-blue-800 space-y-3">
                <div>
                  <p className="font-bold uppercase tracking-wider text-[10px] text-blue-900 mb-1.5">Review Proof of Completion Documentation</p>
                  {ticket.proofAttachments && ticket.proofAttachments.length > 0 ? (
                    <div className="bg-white border border-gray-100 rounded-lg p-2.5 max-h-36 overflow-y-auto space-y-2">
                      {ticket.proofAttachments.map((f, i) => (
                        <div key={i} className="text-gray-600 font-medium truncate flex justify-between items-center bg-gray-50 p-2 rounded-xl border border-gray-100 hover:bg-gray-100/50 transition-colors">
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 min-w-0"
                          >
                            <svg className="w-3.5 h-3.5 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="truncate">{f.name}</span>
                          </a>
                          <span className="text-[10px] text-gray-400 font-medium shrink-0">
                            {f.size ? `${(f.size / (1024 * 1024)).toFixed(2)} MB` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 italic">No files uploaded.</p>
                  )}
                </div>
                
                {showRejectInput ? (
                  <div className="space-y-2">
                    <label htmlFor="summary-rejection-reason" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Reason for rejection *</label>
                    <textarea
                      id="summary-rejection-reason"
                      placeholder="Provide a reason for proof rejection (e.g. signature missing, document blurry)..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/25 min-h-[3rem]"
                      required
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowRejectInput(false)}
                        className="px-2.5 py-1 text-xs border border-gray-200 text-gray-600 rounded-lg font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={isProcessing}
                        onClick={async () => {
                          if (!rejectionReason.trim()) return;
                          setIsProcessing(true);
                          try {
                            const timestamp = new Date().toLocaleString('en-US');
                            const updated = {
                              id: ticket.id,
                              status: 'In Progress',
                              proofRejected: true,
                              rejectionReason: rejectionReason.trim(),
                              timeline: [
                                {
                                  id: `proof-reject-${Date.now()}`,
                                  type: 'proof',
                                  text: `Proof rejected by CS. Reason: "${rejectionReason.trim()}". Status returned to In Progress.`,
                                  timestamp,
                                }
                              ]
                            };
                            await onStatusUpdate(updated);
                            onClose();
                          } catch (err) {
                            console.error(err);
                            setIsProcessing(false);
                          }
                        }}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? 'Processing...' : 'Confirm Rejection'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      disabled={isProcessing}
                      onClick={() => setShowRejectInput(true)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                    >
                      Reject Proof
                    </button>
                    <button
                      disabled={isProcessing}
                      onClick={async () => {
                        if (!ticket.department) {
                          window.alert('Cannot resolve ticket: Department is not set.');
                          return;
                        }
                        if (!ticket.assigned || ticket.assigned.length === 0) {
                          window.alert('Cannot resolve ticket: No employees are assigned.');
                          return;
                        }
                        setIsProcessing(true);
                        try {
                          const timestamp = new Date().toLocaleString('en-US');
                          const updated = {
                            id: ticket.id,
                            status: 'Resolved',
                            proofRejected: false,
                            rejectionReason: null,
                            timeline: [
                              {
                                id: `proof-approve-${Date.now()}`,
                                type: 'proof',
                                text: 'Proof of Completion approved by CS. Ticket Resolved successfully.',
                                timestamp,
                              }
                            ]
                          };
                          await onStatusUpdate(updated);
                          onClose();
                        } catch (err) {
                          console.error(err);
                          setIsProcessing(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Processing...' : 'Approve & Resolve'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Ticket card */}
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
              {/* Status */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-xs font-medium text-gray-500">Status</span>
                <span className="text-xs font-semibold px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                  {ticket.status || 'Pending'}
                </span>
              </div>

              {/* Department */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-xs font-medium text-gray-500">Department</span>
                <span className="text-xs font-semibold text-gray-800">
                  {ticket.department || '—'}
                </span>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-xs font-medium text-gray-500">Priority</span>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${priorityColors[ticket.priority] || 'bg-gray-100 text-gray-600'}`}>
                  {ticket.priority || '—'}
                </span>
              </div>

              {/* Assigned Employees */}
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <div className="text-xs font-medium text-gray-500 mb-2">
                  Assigned Employee(s)
                </div>
                {assignedEmployees.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">None assigned</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {assignedEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="text-xs font-medium text-gray-700">{emp.name}</span>
                        <span className="text-[10px] text-gray-400">{emp.department}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Remarks History Log */}
              {ticket.remarks && ticket.remarks.length > 0 && (
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">
                    Remarks History
                  </div>
                  <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                    {ticket.remarks.map((rem) => (
                      <div key={rem.id} className="bg-white border border-gray-100 rounded-lg p-2.5 shadow-xs">
                        <div className="flex justify-between items-start mb-1 text-[10px]">
                          <span className="font-bold text-[#252578]">{rem.author}</span>
                          <span className="text-gray-400">
                            {new Date(rem.timestamp).toLocaleDateString()} at {new Date(rem.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed font-semibold italic">
                          &quot;{rem.remark}&quot;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">
                    Attachments
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {ticket.attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg p-2.5 shadow-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-700 truncate">{file.name}</p>
                            <p className="text-[10px] text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        {file.url && (
                          <a
                            href={file.url}
                            download={file.name}
                            className="text-xs text-[#252578] hover:text-[#1e1e60] font-semibold px-2 py-1 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                          >
                            Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Proof of Completion Attachments */}
              {ticket.proofAttachments && ticket.proofAttachments.length > 0 && (
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">
                    Proof of Completion Documents
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {ticket.proofAttachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg p-2.5 shadow-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-700 truncate">{file.name}</p>
                            {file.size && <p className="text-[10px] text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>}
                          </div>
                        </div>
                        {file.url && (
                          <a
                            href={file.url}
                            download={file.name}
                            className="text-xs text-green-700 hover:text-green-900 font-semibold px-2 py-1 hover:bg-green-50 rounded transition-colors flex-shrink-0"
                          >
                            Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Close
            </button>
            {!ticket.reassignmentRequested && onEdit && (
              <button
                onClick={onEdit}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-[#252578] text-white text-xs font-semibold rounded-xl hover:bg-[#1e1e60] transition-colors shadow-lg shadow-[#252578]/30 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {showReassignApprove && (
        <ConfirmDialog
          title="Approve Reassignment?"
          message={`Are you sure you want to approve the reassignment for ticket ${ticket.id}? This will allow you to assign it to a different employee.`}
          confirmText="Yes, Approve"
          onCancel={() => setShowReassignApprove(false)}
          onConfirm={async () => {
            const timestamp = new Date().toLocaleString('en-US');
            const updated = {
              id: ticket.id,
              reassignmentRequested: false,
              reassignmentStatus: 'Approved',
              timeline: [
                {
                  id: `reassign-approve-${Date.now()}`,
                  type: 'reassign',
                  text: 'Reassignment request approved by CS.',
                  timestamp,
                }
              ]
            };
            await onStatusUpdate(updated);
            setShowReassignApprove(false);
            onEdit(); // Opens AssignModal immediately
          }}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────
   ASSIGN MODAL
───────────────────────────────────────────── */
export function AssignModal({ ticket, employees, departments, priorityOptions, onClose, onSave }) {
  const [title, setTitle] = useState(ticket?.title || '');
  const [priority, setPriority] = useState(ticket?.priority || 'Low');
  const [department, setDepartment] = useState(ticket?.department || '');
  const [selectedEmployees, setSelectedEmployees] = useState(ticket?.assigned || []);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Lock background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!ticket) return null;

  const employeesInDept = useMemo(() => {
    const list = employees.filter((e) =>
      department ? e.department === department : true
    );
    list.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [department, employees]);

  const toggleEmp = (id) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAcceptClick = () => {
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (isSaving) return;

    const updated = {
      ...ticket,
      title,
      priority,
      department: department || null,
      assigned: selectedEmployees,
      status: department ? 'Assigned' : ticket.status,
    };

    setIsSaving(true);
    try {
      const saved = await onSave(updated);
      if (saved) {
        setShowConfirm(false);
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl w-155 max-w-full max-h-[90vh] flex flex-col relative shadow-[0_8px_32px_rgba(0,0,0,0.08)]">

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 p-6">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-[#252578] transition-colors text-sm"
            >
              ✕
            </button>

            <h3 className="text-xl font-bold text-[#252578] mb-4">
              {ticket.status === 'Assigned' || ticket.reassignmentStatus === 'Approved' ? 'Reassign Ticket' : 'Assign Ticket'}
            </h3>

            {/* Ticket Info */}
            <div className="bg-[#252578] text-white rounded-2xl p-4 mb-4 flex items-center justify-between">
              <div className="flex-1 mr-4">
                <div className="text-xs opacity-80">{ticket.id}</div>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-transparent border-b border-white/30 text-sm font-semibold mt-0.5 outline-none focus:border-white transition-colors py-1"
                />
                <div className="text-xs opacity-70 mt-1">{ticket.category}</div>
              </div>
              <span className="bg-white text-[#252578] text-xs px-3 py-1 rounded-full font-medium shrink-0">
                {ticket.sla}
              </span>
            </div>

            {/* Department */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setSelectedEmployees([]);
                }}
                className="w-full px-3 py-2.5 text-sm bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm"
              >
                <option value="">Select department...</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Priority
              </label>
              <div className="flex gap-2 flex-wrap">
                {priorityOptions.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`px-4 py-1.5 rounded-xl transition-all text-xs font-medium ${
                      priority === p
                        ? 'bg-[#252578] text-white shadow-lg'
                        : 'bg-white hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Employees */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Assign Employee(s)
                {selectedEmployees.length > 0 && (
                  <span className="ml-2 text-[#252578] font-semibold">
                    ({selectedEmployees.length} selected)
                  </span>
                )}
              </label>

              {/* Selected employee chips */}
              {selectedEmployees.length > 0 && (
               <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedEmployees.map((id) => {
                    const emp = employees.find((e) => e.id === id);
                    if (!emp) return null;
                    return (
                      <span
                        key={id}
                        className="flex items-center gap-1 bg-[#252578]/10 text-[#252578] text-[11px] font-medium px-2.5 py-1 rounded-full"
                      >
                        {emp.name}
                        <button
                          type="button"
                          onClick={() => toggleEmp(id)}
                          disabled={isSaving}
                          className="ml-0.5 font-bold hover:text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="max-h-44 overflow-auto bg-gray-50 rounded-2xl p-2">
                {employeesInDept.length === 0 ? (
                  <div className="text-xs text-gray-500 p-2">
                    Select a department to see employees
                  </div>
                ) : (
                  employeesInDept.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-center justify-between gap-2 px-2 py-2 hover:bg-white rounded-xl transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(emp.id)}
                          onChange={() => toggleEmp(emp.id)}
                          className="w-3.5 h-3.5 accent-[#252578]"
                        />
                        <div>
                          <div className="text-xs font-medium text-gray-800">{emp.name}</div>
                          <div className="text-[11px] text-gray-500">{emp.department} • {emp.status}</div>
                        </div>
                      </div>
                      <div className={`text-[11px] px-2 py-0.5 rounded-full ${
                        emp.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {emp.status === 'active' ? 'Active' : 'Inactive'}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAcceptClick}
              disabled={isSaving}
              className="px-7 py-2.5 bg-[#252578] text-white text-xs font-semibold rounded-xl hover:bg-[#1e1e60] transition-colors shadow-lg shadow-[#252578]/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : (ticket.status === 'Assigned' || ticket.reassignmentStatus === 'Approved') ? 'Save Changes' : 'Assign Ticket'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation dialog layered on top */}
      {showConfirm && (
        <ConfirmDialog
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
          isSaving={isSaving}
        />
      )}
    </>
  );
}
