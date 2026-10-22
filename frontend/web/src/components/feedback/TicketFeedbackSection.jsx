import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, X, AlertCircle, Clock, CheckCircle2, Star, HelpCircle, Loader2 } from 'lucide-react';
import EmployeeFeedbackCard from './EmployeeFeedbackCard';
import { getTicketFeedback, getTicketEmployees, deleteFeedback, fetchFeedbackForTicket } from '@/data/mockFeedbackData';

export default function TicketFeedbackSection({ ticket, onLeaveFeedback, onEditFeedback, readOnly = false }) {
  const ticketId = ticket?.id || ticket?.ticket_ID;
  const [feedback, setFeedback] = useState(() => getTicketFeedback(ticketId));
  const [isDismissed, setIsDismissed] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [actionNotice, setActionNotice] = useState('');

  // Sync feedback on prop change, backend fetch, or custom events
  useEffect(() => {
    let isMounted = true;
    const local = getTicketFeedback(ticketId);
    if (local) setFeedback(local);

    if (typeof fetchFeedbackForTicket === 'function') {
      fetchFeedbackForTicket(ticketId)
        ?.then((fb) => {
          if (isMounted && fb) {
            setFeedback(fb);
          }
        })
        ?.catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [ticketId]);

  useEffect(() => {
    const handleUpdate = () => {
      setFeedback(getTicketFeedback(ticketId));
      setIsDismissed(false);
    };
    window.addEventListener('customer_feedback_submitted', handleUpdate);
    window.addEventListener('customer_feedback_updated', handleUpdate);
    window.addEventListener('customer_feedback_deleted', handleUpdate);
    return () => {
      window.removeEventListener('customer_feedback_submitted', handleUpdate);
      window.removeEventListener('customer_feedback_updated', handleUpdate);
      window.removeEventListener('customer_feedback_deleted', handleUpdate);
    };
  }, [ticketId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // 48-hour edit window calculation
  const submissionTime = feedback?.submittedAt ? new Date(feedback.submittedAt).getTime() : 0;
  const editWindowMs = 48 * 60 * 60 * 1000;
  const timeSinceSubmission = Date.now() - submissionTime;
  const isWithinEditWindow = submissionTime > 0 && timeSinceSubmission < editWindowMs;
  const hoursRemaining = isWithinEditWindow ? Math.max(1, Math.round((editWindowMs - timeSinceSubmission) / (60 * 60 * 1000))) : 0;

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteFeedback(ticketId);
      setFeedback(null);
      setShowDeleteModal(false);
      setActionNotice('Your feedback was successfully deleted.');
      setTimeout(() => setActionNotice(''), 5000);
    } catch (err) {
      console.error('Failed to delete feedback:', err);
      const msg = err.response?.data?.message || 'Failed to delete feedback. Please try again.';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // In readOnly mode without feedback, show clean informative placeholder
  if (readOnly && (!feedback || !feedback.submitted)) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-page p-4 text-center">
        <p className="text-xs font-medium text-slate-muted">
          No customer feedback submitted yet for this ticket.
        </p>
      </div>
    );
  }

  // If dismissed and no feedback submitted, show minimal banner
  if (isDismissed && (!feedback || !feedback.submitted)) {
    return (
      <div className="rounded-xl border border-border bg-page p-4 flex items-center justify-between text-xs text-slate-muted">
        <span>Feedback prompt dismissed. You can share your feedback whenever you are ready.</span>
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="font-bold text-primary hover:text-accent underline cursor-pointer ml-3"
        >
          Rate Experience
        </button>
      </div>
    );
  }

  // Not yet submitted state: Rate Your Experience prompt (customer mode only)
  if (!feedback || !feedback.submitted) {
    return (
      <div className="relative rounded-xl border border-border bg-card p-6 shadow-xs text-center animate-in fade-in duration-200">
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="absolute top-4 right-4 text-slate-muted hover:text-slate-dark transition-colors p-1 rounded-md cursor-pointer"
          aria-label="Dismiss feedback prompt"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {actionNotice && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-lg flex items-center gap-2 text-left">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
        </div>
        <h3 className="mt-3 text-base font-bold text-slate-dark">Rate Your Experience</h3>
        <p className="mt-1 text-sm text-slate-muted max-w-md mx-auto leading-relaxed">
          Your feedback is optional but greatly appreciated. Help us improve our customer support by rating the team members who assisted you.
        </p>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-slate-muted hover:text-slate-dark hover:bg-muted transition-colors cursor-pointer"
          >
            Not Now
          </button>
          <button
            type="button"
            onClick={onLeaveFeedback}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 cursor-pointer shadow-xs"
          >
            Leave Feedback
          </button>
        </div>
      </div>
    );
  }

  const employees = getTicketEmployees(ticket);

  return (
    <div className="rounded-xl border border-border bg-page p-6 shadow-xs space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-dark">Customer Feedback</h3>
          <p className="text-xs text-slate-muted mt-0.5">
            Submitted on {formatDate(feedback.submittedAt)}
            {feedback.updatedAt && ` · Edited on ${formatDate(feedback.updatedAt)}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!readOnly && isWithinEditWindow && (
            <>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                <Clock className="w-3 h-3 text-amber-600" />
                Editable for {hoursRemaining}h
              </span>
              <button
                type="button"
                onClick={() => (onEditFeedback ? onEditFeedback(feedback) : onLeaveFeedback('edit', feedback))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-slate-dark hover:bg-muted transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-primary" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                Delete
              </button>
            </>
          )}
          {!readOnly && !isWithinEditWindow && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-muted bg-card border border-border px-2.5 py-1 rounded-lg">
              Feedback locked (48h edit window closed)
            </span>
          )}
          {readOnly && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Verified Customer Submission
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {employees.map((emp) => {
          const empRating = feedback.ratings?.[emp.id] ?? feedback.ratings?.[String(emp.id)] ?? feedback.ratings?.[Number(emp.id)] ?? (employees.length === 1 && Object.values(feedback.ratings || {})[0]) ?? (feedback.overallRating || 0);
          const empComment = feedback.comments?.[emp.id] ?? feedback.comments?.[String(emp.id)] ?? feedback.comments?.[Number(emp.id)] ?? (employees.length === 1 && Object.values(feedback.comments || {})[0]) ?? '';
          return (
            <EmployeeFeedbackCard
              key={emp.id}
              employee={emp}
              rating={Number(empRating) || 0}
              comment={empComment || ''}
              readOnly
              submissionDate={formatDate(feedback.submittedAt)}
            />
          );
        })}
      </div>

      {feedback.overallComment && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-muted">Overall Experience Feedback</p>
          <p className="mt-1.5 text-sm text-slate-dark leading-relaxed whitespace-pre-wrap">{feedback.overallComment}</p>
        </div>
      )}

      {feedback.categoryQuestionsSnapshot && feedback.categoryQuestionsSnapshot.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-muted">Category Service Evaluation</p>
          <div className="divide-y divide-border">
            {feedback.categoryQuestionsSnapshot.map((q) => {
              const answer = feedback.questionAnswers?.[q.id] ?? feedback.questionAnswers?.[String(q.id)] ?? feedback.questionAnswers?.[Number(q.id)];
              return (
                <div key={q.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-xs font-medium text-slate-muted">{q.text}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-dark">
                    {answer !== undefined && answer !== null && answer !== '' ? String(answer) : '—'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px] animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-modal p-6 flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-dark">Delete Feedback?</h4>
                <p className="text-xs text-slate-muted">This action will remove your rating and comments.</p>
              </div>
            </div>

            <p className="text-sm text-slate-muted mb-4 leading-relaxed">
              Are you sure you want to permanently delete your submitted experience feedback for this ticket? You may resubmit new feedback anytime within the resolution window.
            </p>

            {deleteError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteError(''); }}
                disabled={isDeleting}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-slate-muted hover:text-slate-dark hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Delete Feedback</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
