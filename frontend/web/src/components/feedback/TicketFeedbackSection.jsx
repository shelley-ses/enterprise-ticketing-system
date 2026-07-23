import React from 'react';
import EmployeeFeedbackCard from './EmployeeFeedbackCard';
import { getTicketFeedback, getEmployeeById } from '@/data/mockFeedbackData';

export default function TicketFeedbackSection({ ticket, onLeaveFeedback }) {
  const feedback = getTicketFeedback(ticket.id);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  if (!feedback || !feedback.submitted) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-6 w-6 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-bold text-gray-900">We'd love your feedback</h3>
        <p className="mt-1 text-sm text-gray-500">
          Help us improve our customer support by rating the team members who assisted you.
        </p>
        <button
          type="button"
          onClick={onLeaveFeedback}
          className="mt-4 rounded-xl bg-[#252578] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1f1f66]"
        >
          Leave Feedback
        </button>
      </div>
    );
  }

  const employees = (ticket.assignedEmployees || []).map((id) => getEmployeeById(id)).filter(Boolean);

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <h3 className="text-base font-bold text-gray-900">Customer Feedback</h3>
      <p className="mt-1 text-sm text-gray-500">Ratings and comments provided for this ticket.</p>
      <div className="mt-4 space-y-4">
        {employees.map((emp) => (
          <EmployeeFeedbackCard
            key={emp.id}
            employee={emp}
            rating={feedback.ratings[emp.id] || 0}
            comment={feedback.comments?.[emp.id] || ''}
            readOnly
            submissionDate={formatDate(feedback.submittedAt)}
          />
        ))}
      </div>
      {feedback.overallComment && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Overall Experience</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">{feedback.overallComment}</p>
          <p className="mt-2 text-xs text-gray-400">Submitted on {formatDate(feedback.submittedAt)}</p>
        </div>
      )}
    </div>
  );
}
