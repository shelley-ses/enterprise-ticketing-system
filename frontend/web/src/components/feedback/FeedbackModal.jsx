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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
        <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div
        ref={modalRef}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="border-b border-gray-100 px-6 py-5 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">How was your support experience?</h2>
              <p className="mt-1 text-sm text-gray-500">
                Your feedback helps us recognize excellent support and improve our customer service.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
            <span className="font-semibold text-[#252578]">{ticket.id}</span>
            <span>{ticket.title || ticket.subject}</span>
            <span>Closed: {formatDisplayDate(ticket.closed_at || ticket.resolved_at)}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            {employees.length === 0 ? (
              <p className="text-sm text-gray-500">No assigned employees to rate.</p>
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

          <div className="mt-5">
            <label className="text-sm font-bold text-gray-700">Overall Experience (Optional)</label>
            <textarea
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              placeholder="Is there anything else you'd like to share about your overall support experience?"
              rows={3}
              maxLength={1000}
              className="mt-2 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 outline-none transition-colors focus:border-[#252578]/30 focus:bg-white focus:ring-2 focus:ring-[#252578]/15 placeholder:text-gray-400"
            />
            <div className="mt-1 flex justify-end">
              <span className="text-xs text-gray-400">{overallComment.length}/1000</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 px-6 py-4 shrink-0">
          {validationError && (
            <p className="mb-3 text-sm font-semibold text-red-500">{validationError}</p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allRated || isSubmitting}
              className="rounded-xl bg-[#252578] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1f1f66] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
