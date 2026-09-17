import React, { useState, useEffect, useRef } from 'react';
import EmployeeFeedbackCard from './EmployeeFeedbackCard';
import ThankYouScreen from './ThankYouScreen';
import { getEmployeeById, saveFeedback } from '@/data/mockFeedbackData';

export default function FeedbackModal({ ticket, onClose }) {
  const [step, setStep] = useState('form');
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState({});
  const [overallComment, setOverallComment] = useState('');
  const [validationError, setValidationError] = useState('');
  const modalRef = useRef(null);

  useEffect(() => {
    modalRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && step !== 'thankyou') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, step]);

  const employees = (ticket.assignedEmployees || []).map((id) => getEmployeeById(id)).filter(Boolean);

  const handleRatingChange = (employeeId, rating) => {
    setRatings((prev) => ({ ...prev, [employeeId]: rating }));
    setValidationError('');
  };

  const handleCommentChange = (employeeId, comment) => {
    setComments((prev) => ({ ...prev, [employeeId]: comment }));
  };

  const allRated = employees.every((emp) => ratings[emp.id] && ratings[emp.id] > 0);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!allRated) {
      setValidationError('Please provide a rating for all assigned support personnel.');
      return;
    }
    setIsSubmitting(true);
    try {
      await saveFeedback(ticket.id, ratings, comments, overallComment, ticket.customer_id || ticket.customer);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setIsSubmitting(false);
      setStep('thankyou');
    }
  };

  if (step === 'thankyou') {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 sm:p-6 backdrop-blur-[1.5px]">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <ThankYouScreen onDone={onClose} />
        </div>
      </div>
    );
  }

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 sm:p-6 backdrop-blur-[1.5px]">
      <div
        ref={modalRef}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="border-b border-gray-150 px-7 py-6 sm:px-8 shrink-0 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">How was your support experience?</h2>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
                Your feedback helps us recognize excellent support and improve our customer service.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0 cursor-pointer"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg font-bold text-[#252578] bg-blue-50 border border-blue-100">
              {ticket.id}
            </span>
            {(ticket.title || ticket.subject) && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-gray-700 bg-gray-100 font-medium max-w-xs truncate">
                {ticket.title || ticket.subject}
              </span>
            )}
            {(ticket.closed_at || ticket.resolved_at) && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-gray-500 bg-gray-50 border border-gray-200">
                Closed: {formatDisplayDate(ticket.closed_at || ticket.resolved_at)}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6 sm:px-8 sm:py-7 space-y-6">
          <div className="space-y-4">
            {employees.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-5 py-5 text-center">
                <p className="text-sm font-medium text-gray-500">No assigned support personnel to rate for this ticket.</p>
              </div>
            ) : (
              employees.map((emp) => (
                <EmployeeFeedbackCard
                  key={emp.id}
                  employee={emp}
                  rating={ratings[emp.id] || 0}
                  onRatingChange={(r) => handleRatingChange(emp.id, r)}
                  comment={comments[emp.id] || ''}
                  onCommentChange={(c) => handleCommentChange(emp.id, c)}
                />
              ))
            )}
          </div>

          <div className="pt-2">
            <label className="text-sm font-bold text-gray-800 block mb-2">Overall Experience (Optional)</label>
            <textarea
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              placeholder="Is there anything else you'd like to share about your overall support experience?"
              rows={4}
              maxLength={1000}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50/60 p-4 text-sm text-gray-800 outline-none transition-colors focus:border-[#252578]/40 focus:bg-white focus:ring-2 focus:ring-[#252578]/15 placeholder:text-gray-400"
            />
            <div className="mt-1.5 flex justify-end">
              <span className="text-xs text-gray-400 font-medium">{overallComment.length}/1000</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-150 px-7 py-5 sm:px-8 shrink-0 bg-gray-50/50">
          {validationError && (
            <p className="mb-3 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{validationError}</p>
          )}
          <div className="flex justify-end items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-200/70 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allRated || isSubmitting}
              className="rounded-xl bg-[#252578] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1f1f66] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
