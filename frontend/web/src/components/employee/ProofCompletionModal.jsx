import React, { useState, useEffect } from 'react';
import { updateEmployeeTicketOverride } from '@/services/ticketService';

export default function ProofCompletionModal({
  ticket,
  onClose,
  onStatusChange,
}) {
  const [proofFiles, setProofFiles] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setProofFiles([]);
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(false);
  }, [ticket]);

  if (!ticket) return null;

  const isProofRejected = ticket.proofRejected === true && ticket.status === 'In Progress';

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

  const handleProofSubmit = (e) => {
    e.preventDefault();
    if (proofFiles.length === 0) {
      setErrorMessage('Please select at least one proof of completion file.');
      return;
    }

    const fileError = validateFiles(proofFiles);
    if (fileError) {
      setErrorMessage(fileError);
      return;
    }

    setIsSubmitting(true);
    try {
      const timestamp = new Date().toLocaleString('en-US');
      const fileNames = proofFiles.map(f => f.name);
      
      const update = {
        status: 'Pending Validation',
        proofRejected: false,
        rejectionReason: null,
        proofAttachments: proofFiles.map(f => ({ name: f.name, size: f.size })),
        timeline: [
          {
            id: `proof-${Date.now()}`,
            type: 'proof',
            text: `${isProofRejected ? 'Re-uploaded' : 'Uploaded'} proof of completion: ${fileNames.join(', ')}`,
            timestamp,
          }
        ]
      };

      updateEmployeeTicketOverride(ticket.id, update);
      
      // Optimistic ticket object update
      ticket.status = 'Pending Validation';
      ticket.proofRejected = false;
      ticket.rejectionReason = null;
      ticket.proofAttachments = update.proofAttachments;
      
      if (typeof onStatusChange === 'function') {
        onStatusChange(ticket.id, 'Pending Validation');
      }

      setSuccessMessage('Proof of completion submitted successfully! Status updated to Pending Validation.');
      setErrorMessage('');
      setProofFiles([]);
      
      // Briefly delay closing to let user see success message
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setErrorMessage('Failed to submit proof. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-md overflow-y-auto py-10" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl mx-4 my-auto relative flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex-shrink-0 relative">
          <button type="button" onClick={onClose} className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <h2 className="text-xl font-bold text-gray-900 leading-snug">
            {isProofRejected ? 'Re-upload Proof of Completion' : 'Upload Proof of Completion'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">Ticket ID: {ticket.id} · {ticket.title}</p>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {successMessage && (
            <div className="rounded-xl bg-green-50 border border-green-200 text-green-800 p-4 text-xs font-semibold flex items-center gap-2.5">
              <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 p-4 text-xs font-semibold flex items-center gap-2.5">
              <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Proof Rejected Alert Warning Banner */}
          {isProofRejected && (
            <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl text-xs font-semibold">
              <div className="flex items-center gap-2 mb-1.5 text-orange-900">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span>Proof of Completion Rejected</span>
              </div>
              <p className="font-medium text-gray-700">Reason: &quot;{ticket.rejectionReason}&quot;</p>
              <p className="text-[10px] text-gray-500 mt-1 font-normal">Please address the feedback above and re-upload the correct documentation below.</p>
            </div>
          )}

          <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">File Upload Requirements</h3>
            <ul className="text-[11px] text-gray-500 list-disc list-inside space-y-1 leading-relaxed">
              <li>Supported Formats: Images (<span className="font-semibold text-gray-600">PNG, JPG, JPEG, GIF</span>), Documents (<span className="font-semibold text-gray-600">PDF, DOC, DOCX</span>)</li>
              <li>Size Limit: Maximum <span className="font-semibold text-gray-600">15MB</span> per file</li>
              <li>Multiple files are allowed and encouraged for complete proof</li>
            </ul>

            <form onSubmit={handleProofSubmit} className="mt-5 space-y-4">
              <div className="border-2 border-dashed border-gray-200 hover:border-[#252578] rounded-2xl p-6 transition-all bg-white text-center cursor-pointer group relative">
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx"
                  onChange={(e) => setProofFiles(Array.from(e.target.files))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  required={proofFiles.length === 0}
                  disabled={isSubmitting}
                />
                <svg className="w-8 h-8 text-gray-400 group-hover:text-[#252578] mx-auto mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
                <p className="text-xs font-semibold text-[#252578]">Click to browse files</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Multiple attachments allowed</p>
              </div>
              
              {proofFiles.length > 0 && (
                <div className="space-y-1.5 bg-white border border-gray-150 rounded-xl p-3 max-h-36 overflow-y-auto">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Files Selected ({proofFiles.length})</p>
                  {proofFiles.map((file, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] text-gray-600 font-semibold bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
                      <span className="truncate pr-4 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {file.name}
                      </span>
                      <span className="text-gray-400 font-medium shrink-0">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || proofFiles.length === 0}
                  className="flex-1 py-2.5 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-green-700/20 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Uploading...' : isProofRejected ? 'Re-upload & Submit' : 'Upload & Submit Proof'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
