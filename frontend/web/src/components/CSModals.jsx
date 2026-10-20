import React, { useState, useMemo, useEffect } from 'react';
import {
  HelpCircle,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Pencil,
  Paperclip,
  Loader2,
  Eye,
  Clock,
  User,
  Building2,
  Tag,
  Shield,
  ShieldAlert,
  Check,
} from 'lucide-react';
import { formatDisplayDate } from '@/utils/dateUtils';
import { formatProperSentenceCase } from '@/utils/titleCaseUtils';
import FilePreviewModal from './FilePreviewModal';
import { useAuth } from '@/context/AuthContext';
import {
  updateEmployeeTicketOverride,
  holdTicket,
  resumeTicket,
  reclassifyTicket,
  getTicketFormOptions,
} from '@/services/ticketService';
import InternalNotesSection, { NoteList } from './InternalNotesSection';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/* Helper functions for robust file attachment handling */
const isQuarantinedFile = (file) => {
  if (!file || typeof file !== 'object') return false;
  return Boolean(file.is_quarantined || file.quarantined || file.status === 'quarantined' || file.virus_detected);
};

const getFileUrl = (file) => {
  if (!file) return '';
  if (typeof file === 'string') return file;
  if (file.url) return file.url;
  if (file.file_path) {
    return file.file_path.startsWith('/') ? file.file_path : `/storage/${file.file_path}`;
  }
  if (file.path) return file.path;
  return '';
};

const getFileName = (file) => {
  if (!file) return 'Attachment';
  if (typeof file === 'string') return file.split('/').pop() || 'Attachment';
  return file.name || file.file_name || 'Attachment';
};

/* ─────────────────────────────────────────────
   CONFIRMATION DIALOG
───────────────────────────────────────────── */
export function ConfirmDialog({ onConfirm, onCancel, isSaving = false, title = "Update this ticket?", message = "Are you sure you want to save the changes to this ticket?", confirmText = "Yes, Update" }) {
  useLockBodyScroll(true);
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-modal p-6 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
          <HelpCircle className="w-6 h-6" />
        </div>

        <h4 className="text-lg font-bold text-slate-dark mb-2">
          {title}
        </h4>
        <p className="text-sm text-slate-muted mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1"
          >
            Go Back
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onConfirm}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </span>
            ) : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   HOLD TICKET DIALOG
───────────────────────────────────────────── */
export function HoldTicketDialog({ isOpen, onClose, onConfirm, isSaving = false }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError('A reason of at least 3 characters is required to place a ticket on hold.');
      return;
    }
    setError('');
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-120 max-w-full shadow-2xl p-6 sm:p-7 relative flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-base sm:text-lg font-bold text-gray-800">Place Ticket On Hold</h4>
            <p className="text-xs text-gray-500">Temporarily pause progress while awaiting external information</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800 leading-relaxed">
          Placing this ticket on hold will pause its SLA clock and alert relevant stakeholders. You can resume this ticket at any time once external info is received.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Reason for Hold <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error && e.target.value.trim().length >= 3) setError('');
              }}
              rows={4}
              maxLength={1000}
              placeholder="Explain why this ticket is being placed on hold (e.g., Awaiting customer network diagnostic logs or vendor replacement parts)..."
              className="w-full text-xs sm:text-sm border border-gray-200 rounded-xl p-3 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none"
              required
            />
            <div className="flex justify-between items-center text-[11px] text-gray-400 mt-1">
              <span>Minimum 3 characters</span>
              <span>{reason.length}/1000</span>
            </div>
            {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-2.5 text-xs sm:text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || reason.trim().length < 3}
              className="flex-1 py-2.5 text-xs sm:text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-lg shadow-amber-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? 'Placing on Hold...' : 'Confirm Place on Hold'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   RECLASSIFY EDIT MODAL
───────────────────────────────────────────── */
export function ReclassifyEditModal({
  isOpen,
  onClose,
  currentCategory,
  currentPriority,
  categories = [],
  priorities = ['Low', 'Medium', 'High', 'Critical'],
  onReviewChanges,
}) {
  const [selectedCategory, setSelectedCategory] = useState(currentCategory || '');
  const [selectedPriority, setSelectedPriority] = useState(currentPriority || 'Low');
  const [error, setError] = useState('');
  useLockBodyScroll(isOpen);

  useEffect(() => {
    setSelectedCategory(currentCategory || '');
    setSelectedPriority(currentPriority || 'Low');
    setError('');
  }, [currentCategory, currentPriority, isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (selectedCategory === currentCategory && selectedPriority === currentPriority) {
      setError('Please change at least one value (Category or Priority) to proceed.');
      return;
    }
    setError('');
    onReviewChanges({
      newCategory: selectedCategory,
      newPriority: selectedPriority,
    });
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-115 max-w-full shadow-2xl p-6 sm:p-7 relative flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#252578]/10 text-[#252578] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h4 className="text-base sm:text-lg font-bold text-gray-800">Edit Category & Priority</h4>
            <p className="text-xs text-gray-500">Correct classification after initial assignment</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Problem Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setError('');
              }}
              className="w-full text-xs sm:text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/30"
            >
              {categories.map((c) => {
                const name = typeof c === 'string' ? c : (c.category_name || c.label || c.name);
                return (
                  <option key={name} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Priority Level
            </label>
            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setError('');
              }}
              className="w-full text-xs sm:text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/30"
            >
              {priorities.map((p) => {
                const name = typeof p === 'string' ? p : (p.priority_name || p.label || p.name);
                return (
                  <option key={name} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs sm:text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#252578] hover:bg-[#1e1e60] rounded-xl transition-colors shadow-lg shadow-[#252578]/30 cursor-pointer"
            >
              Review Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   RECLASSIFY CONFIRMATION MODAL (OLD VS NEW)
───────────────────────────────────────────── */
export function ReclassifyConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  oldCategory,
  newCategory,
  oldPriority,
  newPriority,
  isSaving = false,
  error = '',
}) {
  useLockBodyScroll(isOpen);
  if (!isOpen) return null;

  const categoryChanged = oldCategory !== newCategory;
  const priorityChanged = oldPriority !== newPriority;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-120 max-w-full shadow-2xl p-6 sm:p-7 relative flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h4 className="text-base sm:text-lg font-bold text-gray-800">Confirm Ticket Reclassification</h4>
            <p className="text-xs text-gray-500">Review Old vs. New values before applying</p>
          </div>
        </div>

        {/* Comparison card */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-xs">
            <span className="font-semibold text-gray-500">Field</span>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-gray-500">Current</span>
              <span className="text-gray-400">➔</span>
              <span className="font-semibold text-gray-800">Proposed</span>
            </div>
          </div>

          {/* Category comparison */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-600">Category</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{oldCategory || '—'}</span>
              <span className="text-gray-400">➔</span>
              <span className={`px-2 py-0.5 rounded font-semibold ${categoryChanged ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'text-gray-500'}`}>
                {newCategory || '—'}
              </span>
            </div>
          </div>

          {/* Priority comparison */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-600">Priority</span>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorityColors[oldPriority] ?? 'bg-gray-100 text-gray-700'}`}>
                {oldPriority || '—'}
              </span>
              <span className="text-gray-400">➔</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorityChanged ? (priorityColors[newPriority] ?? 'bg-blue-100 text-blue-800') + ' ring-2 ring-blue-400' : (priorityColors[newPriority] ?? 'bg-gray-100 text-gray-700')}`}>
                {newPriority || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Notices */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800 space-y-1 leading-relaxed">
          <p className="font-semibold text-amber-900 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Important Reclassification Impacts:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800 pl-1">
            <li>SLA response and resolution target deadlines will automatically recalculate.</li>
            <li>If this ticket is already assigned, manual technician reassignment may be needed to align with the new category.</li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 py-2.5 text-xs sm:text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="flex-1 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#252578] hover:bg-[#1e1e60] rounded-xl transition-colors shadow-lg shadow-[#252578]/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSaving ? 'Updating...' : 'Confirm & Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TICKET SUMMARY VIEW (post-save / already assigned)
───────────────────────────────────────────── */
export function TicketSummary({ ticket, employees, onClose, onEdit, onStatusUpdate, readOnly = false }) {
  useLockBodyScroll(!!ticket);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReassignDeny, setShowReassignDeny] = useState(false);
  const [reassignDenyReason, setReassignDenyReason] = useState('');
  const [showReassignApprove, setShowReassignApprove] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const { user } = useAuth();
  const [internalNotesList, setInternalNotesList] = useState(ticket?.internalNotes || []);

  // Dynamic ticket classification & status states for instant in-place reflection
  const [currentCategory, setCurrentCategory] = useState(ticket?.category || '');
  const [currentPriority, setCurrentPriority] = useState(ticket?.priority || 'Low');
  const [currentStatus, setCurrentStatus] = useState(ticket?.status || 'Pending');
  const [currentHoldReason, setCurrentHoldReason] = useState(ticket?.hold_reason || '');

  // Hold action state
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [isHolding, setIsHolding] = useState(false);

  // Reclassification state
  const [formOptions, setFormOptions] = useState({ categories: [], priorities: [] });
  const [showReclassifyEdit, setShowReclassifyEdit] = useState(false);
  const [reclassifyPendingValues, setReclassifyPendingValues] = useState(null);
  const [showReclassifyConfirm, setShowReclassifyConfirm] = useState(false);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [reclassifyError, setReclassifyError] = useState('');
  const [reassignmentNotice, setReassignmentNotice] = useState('');
  const [actionSuccessNotice, setActionSuccessNotice] = useState('');

  useEffect(() => {
    setInternalNotesList(ticket?.internalNotes || []);
    setCurrentCategory(ticket?.category || '');
    setCurrentPriority(ticket?.priority || 'Low');
    setCurrentStatus(ticket?.status || 'Pending');
    setCurrentHoldReason(ticket?.hold_reason || '');
  }, [ticket]);

  // Load available category and priority options dynamically
  useEffect(() => {
    let active = true;
    getTicketFormOptions().then((opts) => {
      if (active && opts) {
        setFormOptions({
          categories: (opts.problem_categories || []).map((c) => c.category_name || c.name || c),
          rawCategories: opts.problem_categories || [],
          priorities: (opts.ticket_priorities || []).map((p) => p.priority_name || p.name || p),
          rawPriorities: opts.ticket_priorities || [],
        });
      }
    }).catch((err) => {
      console.warn('Failed to load form options in TicketSummary:', err);
    });
    return () => { active = false; };
  }, []);

  // Handle placing ticket on hold
  const handleConfirmHold = async (reason) => {
    setIsHolding(true);
    try {
      const ticketId = ticket.ticket_ID || ticket.id;
      await holdTicket(ticketId, reason);
      const timestamp = new Date().toISOString();
      const holdTimelineEvent = {
        id: `hold-${Date.now()}`,
        type: 'status',
        text: `Ticket placed on hold by CS. Reason: "${reason}". SLA clock paused.`,
        timestamp,
      };

      setCurrentStatus('On Hold');
      setCurrentHoldReason(reason);
      ticket.status = 'On Hold';
      ticket.hold_reason = reason;
      if (!ticket.timeline) ticket.timeline = [];
      ticket.timeline.push(holdTimelineEvent);

      const updated = {
        ...ticket,
        status: 'On Hold',
        hold_reason: reason,
        timeline: [...ticket.timeline],
      };

      if (typeof onStatusUpdate === 'function') {
        await onStatusUpdate(updated);
      }

      setShowHoldModal(false);
      setActionSuccessNotice('Ticket successfully placed on hold. The SLA clock is paused.');
      setTimeout(() => setActionSuccessNotice(''), 6000);
    } catch (err) {
      console.error('Failed to place ticket on hold:', err);
      const msg = err.response?.data?.message || 'Failed to place ticket on hold. Please check your network and try again.';
      window.alert(msg);
    } finally {
      setIsHolding(false);
    }
  };

  // Handle resuming ticket from on hold
  const handleResumeTicket = async () => {
    setIsProcessing(true);
    try {
      const ticketId = ticket.ticket_ID || ticket.id;
      await resumeTicket(ticketId);
      const timestamp = new Date().toISOString();
      const nextStatus = (ticket.assigned && ticket.assigned.length > 0) ? 'In Progress' : 'Pending Assignment';
      const resumeTimelineEvent = {
        id: `resume-${Date.now()}`,
        type: 'status',
        text: `Ticket resumed from On Hold by CS. Status changed to ${nextStatus}. SLA clock resumed.`,
        timestamp,
      };

      setCurrentStatus(nextStatus);
      setCurrentHoldReason('');
      ticket.status = nextStatus;
      ticket.hold_reason = null;
      if (!ticket.timeline) ticket.timeline = [];
      ticket.timeline.push(resumeTimelineEvent);

      const updated = {
        ...ticket,
        status: nextStatus,
        hold_reason: null,
        timeline: [...ticket.timeline],
      };

      if (typeof onStatusUpdate === 'function') {
        await onStatusUpdate(updated);
      }

      setActionSuccessNotice(`Ticket successfully resumed. Current status is now ${nextStatus}.`);
      setTimeout(() => setActionSuccessNotice(''), 6000);
    } catch (err) {
      console.error('Failed to resume ticket:', err);
      window.alert(err.response?.data?.message || 'Failed to resume ticket from on hold.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle reclassification
  const handleReviewReclassify = ({ newCategory, newPriority }) => {
    setReclassifyPendingValues({ newCategory, newPriority });
    setShowReclassifyEdit(false);
    setShowReclassifyConfirm(true);
    setReclassifyError('');
  };

  const handleConfirmReclassify = async () => {
    if (!reclassifyPendingValues) return;
    setIsReclassifying(true);
    setReclassifyError('');

    try {
      const ticketId = ticket.ticket_ID || ticket.id;
      const rawCats = formOptions.rawCategories || [];
      const rawPriorities = formOptions.rawPriorities || [];

      const matchedCat = rawCats.find(c => (c.category_name || c.name) === reclassifyPendingValues.newCategory);
      const matchedPriority = rawPriorities.find(p => (p.priority_name || p.name) === reclassifyPendingValues.newPriority);

      const priorityMap = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };

      const payload = {
        ticketId,
        problem_category_ID: matchedCat ? (matchedCat.problem_category_ID || matchedCat.id) : undefined,
        priority_ID: matchedPriority ? (matchedPriority.priority_ID || matchedPriority.id) : priorityMap[reclassifyPendingValues.newPriority],
      };

      const res = await reclassifyTicket(payload);
      const timestamp = new Date().toISOString();

      const oldCat = currentCategory;
      const oldPri = currentPriority;

      setCurrentCategory(reclassifyPendingValues.newCategory);
      setCurrentPriority(reclassifyPendingValues.newPriority);
      ticket.category = reclassifyPendingValues.newCategory;
      ticket.priority = reclassifyPendingValues.newPriority;

      if (res?.data?.sla?.target_resolution) {
        ticket.sla = res.data.sla.target_resolution;
      }

      const timelineText = `Ticket classification updated: Category changed from "${oldCat}" to "${reclassifyPendingValues.newCategory}", Priority changed from "${oldPri}" to "${reclassifyPendingValues.newPriority}".`;
      const reclassifyTimelineEvent = {
        id: `reclassify-${Date.now()}`,
        type: 'status',
        text: timelineText,
        timestamp,
      };

      if (!ticket.timeline) ticket.timeline = [];
      ticket.timeline.push(reclassifyTimelineEvent);

      const updated = {
        ...ticket,
        category: reclassifyPendingValues.newCategory,
        priority: reclassifyPendingValues.newPriority,
        timeline: [...ticket.timeline],
      };

      if (typeof onStatusUpdate === 'function') {
        await onStatusUpdate(updated);
      }

      setShowReclassifyConfirm(false);
      setReclassifyPendingValues(null);

      if (res?.data?.reassignment_needed) {
        setReassignmentNotice('Notice: Ticket classification updated. As this ticket is already assigned, manual reassignment may be needed to align with the new category or priority.');
      } else {
        setActionSuccessNotice('Ticket category and priority updated successfully. SLA targets recalculated.');
        setTimeout(() => setActionSuccessNotice(''), 6000);
      }
    } catch (err) {
      console.error('Failed to reclassify ticket:', err);
      setReclassifyError(err.response?.data?.message || 'Failed to update ticket classification. Please try again.');
    } finally {
      setIsReclassifying(false);
    }
  };

  const handleAddInternalNote = (noteText) => {
    const trimmed = (noteText || '').trim();
    if (!trimmed || !ticket?.id) return;

    const timestamp = new Date().toISOString();
    const authorName = user?.name || (user?.first_name ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` : 'CSR');
    const newNote = {
      id: `note-${Date.now()}`,
      text: trimmed,
      author: authorName,
      timestamp,
    };

    const update = {
      internalNotes: [newNote],
      timeline: [
        {
          id: `note-timeline-${Date.now()}`,
          type: 'internal_note',
          text: `Added staff internal note: "${trimmed}"`,
          timestamp,
        }
      ]
    };

    updateEmployeeTicketOverride(ticket.id, update);

    if (!ticket.internalNotes) ticket.internalNotes = [];
    ticket.internalNotes.push(newNote);
    setInternalNotesList([...ticket.internalNotes]);
  };

  // Track whether CS has opened the proof documents (required for external ticket resolution)
  const [proofOpened, setProofOpened] = useState(false);
  // Track whether CS has accepted the proof documents (required before resolving external tickets)
  const [proofAccepted, setProofAccepted] = useState(false);
  const [showTimelineDropdown, setShowTimelineDropdown] = useState(false);

  const isExternal = !ticket.is_internal && ticket.ticket_type !== 'Internal' && ticket.type !== 'Internal';
  const hasProof = (ticket.proofAttachments && ticket.proofAttachments.length > 0) || (ticket.proofFiles && ticket.proofFiles.length > 0);

  const openProofPreview = (file) => {
    const fileName = getFileName(file);
    const fileUrl = getFileUrl(file);
    setPreviewFile({ name: fileName, url: fileUrl });
    setProofOpened(true);
  };

  const assignedEmployees = employees.filter((e) =>
    (ticket.assigned || []).includes(e.id)
  );

  const assignedEmployeesList = useMemo(() => {
    if (assignedEmployees.length > 0) return assignedEmployees;
    if (ticket.assigned_employees && Array.isArray(ticket.assigned_employees) && ticket.assigned_employees.length > 0) {
      return ticket.assigned_employees;
    }
    const singleName = ticket.assigned_employee || ticket.assigned_employee_name || ticket.assigned_to_name || (typeof ticket.assigned_to === 'string' ? ticket.assigned_to : null);
    if (singleName) {
      return [{ id: 'assigned-1', name: singleName, department: ticket.department || 'Service Engineer', status: 'active' }];
    }
    return [];
  }, [assignedEmployees, ticket]);

  const equipmentTypeDisplay =
    ticket.equipment_type ||
    ticket.equipmentType ||
    ticket.machine_category ||
    (ticket.category ? `${ticket.category} Equipment` : 'Medical Equipment');

  const summaryRemarksList = useMemo(() => {
    const raw = ticket.remarks || ticket.remarks_history || [];
    return Array.isArray(raw) ? raw : [];
  }, [ticket.remarks, ticket.remarks_history]);

  const getRequestingEmployeeName = () => {
    if (ticket.reassignmentRequestedBy) {
      const emp = employees.find(e => e.id === ticket.reassignmentRequestedBy);
      return emp ? emp.name : `Employee ID: ${ticket.reassignmentRequestedBy}`;
    }
    return 'Assigned Employee';
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
        <div className="bg-card border border-border rounded-xl w-140 max-w-full max-h-[90vh] flex flex-col shadow-modal relative animate-in fade-in zoom-in-95 duration-200">

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 p-6">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-muted hover:text-slate-dark transition-colors p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>

            {readOnly ? (
              <>
                {/* Ticket card at top for read-only */}
                <div className="bg-primary text-white rounded-xl p-5 mb-5 shadow-sm space-y-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white/90">TKT No.</span>
                    <p className="text-xs font-normal font-mono text-white/80 mt-0.5">{ticket.id}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white/90">Ticket Title</span>
                    <p className="text-base font-normal leading-snug text-white mt-0.5">{ticket.title}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white/90">Description</span>
                    <p className="text-sm font-normal text-white/80 leading-relaxed mt-0.5">{ticket.description || 'No description available.'}</p>
                  </div>
                </div>

                {/* Summary rows */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Requestor</span>
                    <span className="text-xs font-normal text-slate-600">{ticket.customer || ticket.requestor || ticket.created_by_name || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Status</span>
                    <Badge variant={ticket.status === 'Open' ? 'sky' : ticket.status === 'In Progress' ? 'amber' : (ticket.status === 'Resolved' || ticket.status === 'Closed') ? 'emerald' : 'default'}>
                      {ticket.reassignmentRequested ? 'Pending Reassignment' : ((ticket.status === 'Pending Assignment' || (!ticket.accepted && (ticket.assigned?.length > 0 || ticket.assigned_to))) ? 'Assigned' : (ticket.status || 'Pending'))}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Department</span>
                    <span className="text-xs font-normal text-slate-600">{ticket.department || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Priority</span>
                    <Badge variant={ticket.priority === 'Critical' ? 'destructive' : ticket.priority === 'High' ? 'amber' : 'outline'}>
                      {ticket.priority || '—'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Category</span>
                    <span className="text-xs font-normal text-slate-600">{ticket.category || '—'}</span>
                  </div>
                  {(() => {
                    const isIt = Boolean(
                      ticket.category &&
                      (ticket.category.trim().toLowerCase() === 'it' ||
                       ticket.category.trim().toLowerCase().startsWith('it') ||
                       ticket.category === 'IT Support')
                    );
                    if (isIt) return null;
                    return (
                      <>
                        <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                          <span className="text-xs font-bold text-slate-dark">Equipment/Machine</span>
                          <span className="text-xs font-normal text-slate-600">{ticket.equipment || ticket.machine_name || (ticket.serial_number ? `Serial: ${ticket.serial_number}` : '—')}</span>
                        </div>
                        <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                          <span className="text-xs font-bold text-slate-dark">Equipment Type</span>
                          <span className="text-xs font-normal text-slate-600">{equipmentTypeDisplay}</span>
                        </div>
                      </>
                    );
                  })()}
                  <div className="bg-page border border-border rounded-xl px-4 py-3">
                    <div className="text-xs font-bold text-slate-dark mb-2">Assigned Employee</div>
                    {assignedEmployeesList.length === 0 ? (
                      <div className="text-xs text-slate-muted italic font-normal">None assigned</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {assignedEmployeesList.map((emp) => (
                          <div key={emp.id} className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2.5 py-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            <span className="text-xs font-normal text-slate-600">{emp.name}</span>
                            <span className="text-[10px] text-slate-muted">{emp.department}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Date Filed</span>
                    <span className="text-xs font-normal text-slate-600">{ticket.date ? formatDisplayDate(ticket.date) : '—'}</span>
                  </div>
                  {(ticket.resolved_at || ticket.closed_at) && (
                    <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200/50 rounded-xl px-4 py-3">
                      <span className="text-xs font-bold text-emerald-800">Date Resolved</span>
                      <span className="text-xs font-normal text-emerald-900">{formatDisplayDate(ticket.resolved_at || ticket.closed_at)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Last Updated</span>
                    <span className="text-xs font-normal text-slate-600">{ticket.lastUpdate || ticket.updated_at ? formatDisplayDate(ticket.lastUpdate || ticket.updated_at) : '—'}</span>
                  </div>

                  {ticket.attachments && ticket.attachments.length > 0 && (
                    <div className="bg-gray-50 rounded-xl px-4 py-3">
                      <div className="text-xs font-medium text-gray-500 mb-2">Attachments</div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {ticket.attachments.map((file, idx) => {
                          const fileName = getFileName(file);
                          const fileUrl = getFileUrl(file);
                          const isQuarantined = isQuarantinedFile(file);

                          if (isQuarantined) {
                            return (
                              <div key={idx} className="flex items-center justify-between bg-red-50/50 border border-red-200 rounded-lg p-2.5 shadow-xs">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                                  <p className="text-xs font-semibold text-red-700 truncate line-through" title="Attachment quarantined: Malware threat detected">
                                    {fileName}
                                  </p>
                                </div>
                                <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase">
                                  Blocked
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div key={idx} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg p-2.5 shadow-xs">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p onClick={() => setPreviewFile({ name: fileName, url: fileUrl })} className="text-xs font-medium text-gray-700 truncate cursor-pointer hover:text-blue-600 hover:underline">
                                  {fileName}
                                </p>
                              </div>
                              {fileUrl && (
                                <a href={fileUrl} onClick={(e) => { e.preventDefault(); setPreviewFile({ name: fileName, url: fileUrl }); }} className="text-xs text-[#252578] hover:text-[#1e1e60] font-semibold px-2 py-1 hover:bg-blue-50 rounded transition-colors flex-shrink-0 cursor-pointer">
                                  View
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {((ticket.proofAttachments && ticket.proofAttachments.length > 0) || (ticket.proofFiles && ticket.proofFiles.length > 0)) && (
                    <div className="bg-gray-50 rounded-xl px-4 py-3">
                      <div className="text-xs font-medium text-green-700 font-semibold mb-2">Proof of Completion Documents</div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {(ticket.proofAttachments || ticket.proofFiles).map((file, idx) => {
                          const fileName = getFileName(file);
                          const fileUrl = getFileUrl(file);
                          const isQuarantined = isQuarantinedFile(file);

                          if (isQuarantined) {
                            return (
                              <div key={idx} className="flex items-center justify-between bg-red-50/50 border border-red-200 rounded-lg p-2.5 shadow-xs">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                                  <p className="text-xs font-semibold text-red-700 truncate line-through" title="Proof quarantined: Malware threat detected">
                                    {fileName}
                                  </p>
                                </div>
                                <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase">
                                  Blocked
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div key={idx} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg p-2.5 shadow-xs">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p onClick={() => openProofPreview(file)} className="text-xs font-medium text-gray-700 truncate cursor-pointer hover:text-green-700 hover:underline">
                                  {fileName}
                                </p>
                              </div>
                              {fileUrl && (
                                <a href={fileUrl} onClick={(e) => { e.preventDefault(); openProofPreview(file); }} className="text-xs text-green-700 hover:text-green-900 font-semibold px-2 py-1 hover:bg-green-50 rounded transition-colors flex-shrink-0 cursor-pointer">
                                  View
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {summaryRemarksList && summaryRemarksList.length > 0 && (
                    <div className="bg-gray-50 rounded-xl px-4 py-3">
                      <div className="text-xs font-medium text-gray-700 font-bold mb-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#252578] inline-block" />
                        Remarks History ({summaryRemarksList.length})
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {summaryRemarksList.map((rem, idx) => (
                          <div key={rem.id || idx} className="bg-white border border-gray-100 rounded-lg p-2.5 text-xs shadow-xs">
                            <div className="flex items-center justify-between text-gray-400 mb-1">
                              <span className="font-bold text-[#252578]">{rem.author || 'Staff Member'}</span>
                              <span className="text-[10px]">{formatDisplayDate(rem.timestamp)}</span>
                            </div>
                            <p className="text-gray-700 break-words whitespace-pre-wrap">{rem.remark || rem.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Header badge */}
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={ticket.reassignmentRequested ? 'amber' : (currentStatus === 'On Hold' ? 'amber' : (ticket.status === 'Pending Evaluation' ? 'sky' : 'emerald'))}>
                    {ticket.reassignmentRequested ? 'Pending Reassignment' : (currentStatus === 'On Hold' ? 'Ticket On Hold' : (ticket.status === 'Pending Evaluation' ? 'Proof Submitted' : 'Ticket Assigned'))}
                  </Badge>
                </div>

                {/* Success feedback alert */}
                {actionSuccessNotice && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{actionSuccessNotice}</span>
                  </div>
                )}

                {/* Reassignment needed alert notice */}
                {reassignmentNotice && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 mb-4 text-xs text-amber-900 flex items-start justify-between gap-3 shadow-xs">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-900 mb-0.5">Classification Updated</p>
                        <p className="text-amber-800 leading-relaxed">{reassignmentNotice}</p>
                      </div>
                    </div>
                    {onEdit && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={onEdit}
                        className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 h-8"
                      >
                        Reassign
                      </Button>
                    )}
                  </div>
                )}

                {/* On Hold banner */}
                {currentStatus === 'On Hold' && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 mb-4 text-xs text-amber-900 flex items-start gap-2.5 shadow-xs">
                    <div className="w-6 h-6 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-amber-900 mb-0.5">Ticket is Currently On Hold</p>
                      <p className="text-amber-800 leading-relaxed">
                        The SLA timer is temporarily paused while awaiting external information.
                        {currentHoldReason ? ` Reason: "${currentHoldReason}"` : ''}
                      </p>
                    </div>
                  </div>
                )}

                <h3 className="text-xl font-bold text-slate-dark mb-4">
                  Ticket Summary
                </h3>

                {/* Ticket card */}
                <div className="bg-primary text-white rounded-xl p-5 mb-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-white/90">TKT No.</span>
                      <p className="text-xs font-normal font-mono text-white/80 mt-0.5">{ticket.id}</p>
                    </div>
                    <Badge variant="outline" className="border-white/30 text-white bg-white/10 shrink-0">
                      {currentStatus === 'On Hold' ? 'SLA Paused' : (ticket.sla || 'Standard')}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white/90">Ticket Title</span>
                    <p className="text-base font-normal leading-snug text-white mt-0.5">{ticket.title}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white/90">Description</span>
                    <p className="text-sm font-normal text-white/80 leading-relaxed mt-0.5">{ticket.description || 'No description available.'}</p>
                  </div>
                </div>

                {/* Summary rows */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Requestor</span>
                    <span className="text-xs font-normal text-slate-600">{ticket.customer || ticket.requestor || ticket.created_by_name || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Status</span>
                    <Badge variant={ticket.reassignmentRequested ? 'amber' : (currentStatus === 'On Hold' ? 'amber' : (currentStatus === 'Open' ? 'sky' : currentStatus === 'In Progress' ? 'amber' : (currentStatus === 'Resolved' || currentStatus === 'Closed') ? 'emerald' : 'default'))}>
                      {ticket.reassignmentRequested ? 'Pending Reassignment' : ((currentStatus === 'Pending Assignment' || (!ticket.accepted && (ticket.assigned?.length > 0 || ticket.assigned_to))) ? 'Assigned' : (currentStatus || 'Pending'))}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Department</span>
                    <span className="text-xs font-normal text-slate-600">{ticket.department || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Priority</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={currentPriority === 'Critical' ? 'destructive' : currentPriority === 'High' ? 'amber' : 'outline'}>
                        {currentPriority || '—'}
                      </Badge>
                      {currentStatus !== 'Closed' && currentStatus !== 'Resolved' && (
                        <button
                          type="button"
                          onClick={() => setShowReclassifyEdit(true)}
                          className="text-[11px] font-semibold text-primary hover:text-accent underline cursor-pointer px-1 py-0.5 transition-colors"
                        >
                          Edit Priority
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Category</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-normal text-slate-600">{currentCategory || ticket.category || '—'}</span>
                      {currentStatus !== 'Closed' && currentStatus !== 'Resolved' && (
                        <button
                          type="button"
                          onClick={() => setShowReclassifyEdit(true)}
                          className="text-[11px] font-semibold text-primary hover:text-accent underline cursor-pointer px-1 py-0.5 transition-colors"
                        >
                          Edit Category
                        </button>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const isIt = Boolean(
                      (currentCategory || ticket.category) &&
                      ((currentCategory || ticket.category).trim().toLowerCase() === 'it' ||
                       (currentCategory || ticket.category).trim().toLowerCase().startsWith('it') ||
                       (currentCategory || ticket.category) === 'IT Support')
                    );
                    if (isIt) return null;
                    return (
                      <>
                        <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                          <span className="text-xs font-bold text-slate-dark">Equipment/Machine</span>
                          <span className="text-xs font-normal text-slate-600">{ticket.equipment || ticket.machine_name || (ticket.serial_number ? `Serial: ${ticket.serial_number}` : '—')}</span>
                        </div>
                        <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                          <span className="text-xs font-bold text-slate-dark">Equipment Type</span>
                          <span className="text-xs font-normal text-slate-600">{equipmentTypeDisplay}</span>
                        </div>
                      </>
                    );
                  })()}
                  <div className="bg-page border border-border rounded-xl px-4 py-3">
                    <div className="text-xs font-bold text-slate-dark mb-2">Assigned Employee</div>
                    {assignedEmployeesList.length === 0 ? (
                      <div className="text-xs text-slate-muted italic font-normal">None assigned</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {assignedEmployeesList.map((emp) => (
                          <div key={emp.id} className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2.5 py-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            <span className="text-xs font-normal text-slate-600">{emp.name}</span>
                            <span className="text-[10px] text-slate-muted">{emp.department}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Date Filed</span>
                    <span className="text-xs font-normal text-slate-600">{ticket.date ? formatDisplayDate(ticket.date) : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between bg-page border border-border rounded-xl px-4 py-3">
                    <span className="text-xs font-bold text-slate-dark">Last Updated</span>
                    <span className="text-xs font-normal text-slate-600">{ticket.lastUpdate || ticket.updated_at ? formatDisplayDate(ticket.lastUpdate || ticket.updated_at) : '—'}</span>
                  </div>
                </div>

                {/* Reassignment Request Panel */}
                {ticket.reassignmentRequested && typeof onStatusUpdate === 'function' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-xs text-amber-800 space-y-3">
                    <div className="border-b border-amber-200/50 pb-3 mb-3">
                      <h4 className="font-bold uppercase tracking-wider text-[11px] text-amber-900 mb-2 flex items-center gap-1.5">
                        Immediate Action Required: Reassignment Request
                      </h4>
                      <div className="bg-white rounded-lg p-3 border border-amber-100 shadow-sm">
                        <div className="mb-2">
                          <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wide">Requesting Employee</span>
                          <p className="text-gray-800 font-semibold">{getRequestingEmployeeName()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wide">Reason Provided</span>
                          <p className="text-gray-700 font-medium leading-relaxed italic mt-0.5">&quot;{formatProperSentenceCase(ticket.reassignmentReason) || 'No reason provided'}&quot;</p>
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
                          maxLength={250}
                          className="w-full text-xs border border-red-200 rounded-lg p-2 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-red-500/25 min-h-[3rem]"
                          required
                        />
                        <div className="text-right text-[10px] text-gray-400 mt-0.5">{reassignDenyReason.length}/250</div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setShowReassignDeny(false)} className="px-2.5 py-1.5 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg font-bold transition-colors">Cancel</button>
                          <button
                            onClick={async () => {
                              if (!reassignDenyReason.trim()) return;
                              const timestamp = new Date().toISOString();
                              const updated = {
                                id: ticket.id,
                                ticket_ID: ticket.ticket_ID || ticket.id,
                                reassignmentRequested: false,
                                reassignmentStatus: 'Denied',
                                reassignmentDenyReason: reassignDenyReason.trim(),
                                status: 'In Progress',
                                accepted: true,
                                in_progress_owner: 'employee',
                                timeline: [
                                  {
                                    id: `reassign-deny-${Date.now()}`,
                                    type: 'reassign',
                                    text: `Reassignment request disapproved by CS. Reason: "${reassignDenyReason.trim()}". Ticket returned to In Progress under original assignee.`,
                                    timestamp,
                                  },
                                ],
                              };
                              await onStatusUpdate(updated);
                              onClose();
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Confirm Disapproval
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => setShowReassignDeny(true)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm">Disapprove</button>
                        <button onClick={() => setShowReassignApprove(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm">Approve Request</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Proof of Completion Panel */}
                {ticket.status === 'Pending Evaluation' && typeof onStatusUpdate === 'function' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-xs text-blue-800 space-y-3">
                    <div>
                      <p className="font-bold uppercase tracking-wider text-[10px] text-blue-900 mb-1.5">Review Proof of Completion Documentation</p>
                      {((ticket.proofAttachments && ticket.proofAttachments.length > 0) || (ticket.proofFiles && ticket.proofFiles.length > 0)) ? (
                        <div className="bg-white border border-gray-100 rounded-lg p-2.5 max-h-36 overflow-y-auto space-y-2">
                          {(ticket.proofAttachments || ticket.proofFiles).map((f, i) => {
                            const fileName = getFileName(f);
                            const fileUrl = getFileUrl(f);
                            return (
                              <div key={i} className="text-gray-600 font-medium truncate flex justify-between items-center bg-gray-50 p-2 rounded-xl border border-gray-100 hover:bg-gray-100/50 transition-colors">
                                <a href={fileUrl} onClick={(e) => { e.preventDefault(); openProofPreview(f); }} className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 min-w-0 cursor-pointer">
                                  <svg className="w-3.5 h-3.5 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                  <span className="truncate">{fileName}</span>
                                </a>
                                <span className="text-[10px] text-gray-400 font-medium shrink-0">{f.size ? `${(f.size / (1024 * 1024)).toFixed(2)} MB` : ''}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-400 italic">No files uploaded.</p>
                      )}
                    </div>
                    {showRejectInput ? (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Reason for rejection *</label>
                        <textarea placeholder="Provide a reason for proof rejection..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} maxLength={250} className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/25 min-h-[3rem]" required />
                        <div className="text-right text-[10px] text-gray-400 mt-0.5">{rejectionReason.length}/250</div>
                        <div className="flex gap-2">
                          <button onClick={() => setShowRejectInput(false)} className="px-2.5 py-1 text-xs border border-gray-200 text-gray-600 rounded-lg font-bold">Cancel</button>
                          <button disabled={isProcessing} onClick={async () => { if (!rejectionReason.trim()) return; setIsProcessing(true); try { const timestamp = new Date().toLocaleString('en-US'); const updated = { id: ticket.id, status: 'In Progress', proofRejected: true, rejectionReason: rejectionReason.trim(), timeline: [{ id: `proof-reject-${Date.now()}`, type: 'proof', text: `Proof rejected by CS. Reason: "${rejectionReason.trim()}". Status returned to In Progress.`, timestamp }] }; await onStatusUpdate(updated); onClose(); } catch (err) { console.error(err); setIsProcessing(false); } }} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                            {isProcessing ? 'Processing...' : 'Confirm Rejection'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button disabled={isProcessing} onClick={() => setShowRejectInput(true)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold disabled:opacity-50">Reject Proof</button>
                        <button disabled={isProcessing} onClick={async () => { if (!ticket.department) { window.alert('Cannot resolve ticket: Department is not set.'); return; } if (!ticket.assigned || ticket.assigned.length === 0) { window.alert('Cannot resolve ticket: No employees are assigned.'); return; } setIsProcessing(true); try { const timestamp = new Date().toLocaleString('en-US'); const updated = { id: ticket.id, status: 'Closed', proofRejected: false, rejectionReason: null, timeline: [{ id: `proof-approve-${Date.now()}`, type: 'proof', text: 'Proof of Completion approved by CS. Ticket Closed successfully.', timestamp }] }; await onStatusUpdate(updated); onClose(); } catch (err) { console.error(err); setIsProcessing(false); } }} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                          {isProcessing ? 'Processing...' : 'Approve & Resolve'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </>
            )}

            {/* Remarks History Log */}
            {ticket.remarks && ticket.remarks.length > 0 && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 mb-3">
                <div className="text-field-label uppercase text-gray-500 mb-2">
                  Remarks History
                </div>
                <NoteList
                  notes={ticket.remarks.map((rem) => ({
                    id: rem.id,
                    author: rem.author,
                    timestamp: rem.timestamp,
                    text: rem.remark,
                  }))}
                  maxHeightClass="max-h-40"
                />
              </div>
            )}

            {/* Staff-Only Internal Notes */}
            <div className="mb-3">
              <InternalNotesSection
                notes={internalNotesList}
                onAddNote={readOnly ? null : handleAddInternalNote}
                readOnly={readOnly}
                maxListHeight="max-h-40"
              />
            </div>

            {/* Attachments */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 mb-3">
                <div className="text-xs font-medium text-gray-500 mb-2">
                  Attachments
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {ticket.attachments.map((file, idx) => {
                    const fileName = getFileName(file);
                    const fileUrl = getFileUrl(file);
                    const isQuarantined = isQuarantinedFile(file);

                    if (isQuarantined) {
                      return (
                        <div key={idx} className="flex items-center justify-between bg-red-50/50 border border-red-200 rounded-lg p-2.5 shadow-xs">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-red-700 truncate line-through" title="Attachment quarantined: Threat detected">
                                {fileName}
                              </p>
                              <span className="text-[10px] text-red-500 font-bold uppercase">Blocked &amp; Quarantined</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase">
                            Blocked
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg p-2.5 shadow-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <p
                              onClick={() => setPreviewFile({ name: fileName, url: fileUrl })}
                              className="text-xs font-medium text-gray-700 truncate cursor-pointer hover:text-blue-600 hover:underline"
                            >
                              {fileName}
                            </p>
                            {file.size && <p className="text-[10px] text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>}
                          </div>
                        </div>
                        {fileUrl && (
                          <a
                            href={fileUrl}
                            onClick={(e) => {
                              e.preventDefault();
                              setPreviewFile({ name: fileName, url: fileUrl });
                            }}
                            className="text-xs text-[#252578] hover:text-[#1e1e60] font-semibold px-2 py-1 hover:bg-blue-50 rounded transition-colors flex-shrink-0 cursor-pointer"
                          >
                            View
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Proof of Completion Attachments */}
            {((ticket.proofAttachments && ticket.proofAttachments.length > 0) || (ticket.proofFiles && ticket.proofFiles.length > 0)) && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 mb-3">
                <div className="text-xs font-medium text-gray-500 mb-2">
                  Proof of Completion Documents
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                  {(ticket.proofAttachments || ticket.proofFiles).map((file, idx) => {
                    const fileName = getFileName(file);
                    const fileUrl = getFileUrl(file);
                    const isQuarantined = isQuarantinedFile(file);

                    if (isQuarantined) {
                      return (
                        <div key={idx} className="flex items-center justify-between bg-red-50/50 border border-red-200 rounded-lg p-2.5 shadow-xs">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-red-700 truncate line-through" title="Proof quarantined: Threat detected">
                                {fileName}
                              </p>
                              <span className="text-[10px] text-red-500 font-bold uppercase">Blocked &amp; Quarantined</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase">
                            Blocked
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg p-2.5 shadow-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <p
                              onClick={() => openProofPreview(file)}
                              className="text-xs font-medium text-gray-700 truncate cursor-pointer hover:text-green-700 hover:underline"
                            >
                              {fileName}
                            </p>
                            {file.size && <p className="text-[10px] text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>}
                          </div>
                        </div>
                        {fileUrl && (
                          <a
                            href={fileUrl}
                            onClick={(e) => {
                              e.preventDefault();
                              openProofPreview(file);
                            }}
                            className="text-xs text-green-700 hover:text-green-900 font-semibold px-2 py-1 hover:bg-green-50 rounded transition-colors flex-shrink-0 cursor-pointer"
                          >
                            View
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Proof of Completion Acceptance requirement for external tickets */}
                {isExternal && (
                  <div className="pt-2 border-t border-gray-200">
                    {!proofOpened ? (
                      <div className="text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 mb-2 leading-relaxed">
                        Please open and review the proof of completion documents before accepting.
                      </div>
                    ) : !proofAccepted ? (
                      <div className="text-[11px] text-blue-800 bg-blue-50/80 border border-blue-200 rounded-lg p-2.5 mb-2 leading-relaxed">
                        Please accept the proof of completion to enable ticket resolution.
                      </div>
                    ) : (
                      <div className="text-[11px] text-green-800 bg-green-50/80 border border-green-200 rounded-lg p-2.5 mb-2 leading-relaxed font-medium">
                        Proof of completion accepted. You may now resolve this ticket.
                      </div>
                    )}
                    <label className={`flex items-center gap-2 cursor-pointer select-none text-xs font-medium ${!proofOpened ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-gray-700'}`}>
                      <input
                        type="checkbox"
                        checked={proofAccepted}
                        disabled={!proofOpened}
                        onChange={(e) => setProofAccepted(e.target.checked)}
                        className="w-4 h-4 rounded text-[#252578] focus:ring-[#252578] border-gray-300 disabled:cursor-not-allowed"
                      />
                      <span>I have reviewed and accept the proof of completion</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Collapsible Timeline Dropdown */}
            <div className="bg-gray-50 rounded-xl mb-3 border border-gray-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTimelineDropdown(!showTimelineDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-gray-700 hover:bg-gray-100/70 transition-colors"
              >
                <span>Ticket Timeline & History ({ticket.timeline?.length || 0})</span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showTimelineDropdown ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showTimelineDropdown && (
                <div className="px-4 pb-4 pt-1 space-y-2 border-t border-gray-200/50 max-h-52 overflow-y-auto">
                  {(!ticket.timeline || ticket.timeline.length === 0) ? (
                    <div className="text-xs text-gray-400 italic py-2">No timeline events recorded.</div>
                  ) : (
                    ticket.timeline.map((event, idx) => (
                      <div key={event.id || idx} className="bg-white border border-gray-100 rounded-lg p-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-gray-800 uppercase text-[10px] tracking-wide">
                            {event.type || 'Event'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {event.timestamp ? new Date(event.timestamp).toLocaleString() : ''}
                          </span>
                        </div>
                        <p className="text-gray-700 leading-relaxed">{event.text}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">

            {/* Resolve Ticket — only for In Progress / Pending Evaluation (not Pending Assignment) */}
            {ticket.status !== 'Resolved' && ticket.status !== 'Closed' &&
              ticket.status !== 'Pending Assignment' &&
              ticket.assigned && ticket.assigned.length > 0 && (
                <>
                  {isExternal && hasProof && !proofOpened && (
                    <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl font-medium">
                      Please open the proof of completion documents before accepting.
                    </span>
                  )}
                  {isExternal && hasProof && proofOpened && !proofAccepted && (
                    <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl font-medium">
                      Please accept the proof of completion before resolving.
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="default"
                    onClick={async () => {
                      if (isExternal && hasProof) {
                        if (!proofOpened) {
                          window.alert('Please open and review the proof of completion documents before accepting.');
                          return;
                        }
                        if (!proofAccepted) {
                          window.alert('Please accept the proof of completion before resolving this ticket.');
                          return;
                        }
                      }
                      setIsProcessing(true);
                      try {
                        const timestamp = new Date().toISOString();
                        await onStatusUpdate({
                          id: ticket.id,
                          status: 'Closed',
                          timeline: [
                            {
                              id: `status-closed-${Date.now()}`,
                              type: 'status',
                              text: 'Ticket resolved and closed by CS Representative.',
                              timestamp,
                            }
                          ]
                        });
                        onClose();
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    disabled={isProcessing || (isExternal && hasProof && (!proofOpened || !proofAccepted))}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                    Resolve Ticket
                  </Button>
                </>
              )}

            {ticket.status === 'Resolved' && (
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  setIsProcessing(true);
                  try {
                    const timestamp = new Date().toLocaleString('en-US');
                    await onStatusUpdate({
                      id: ticket.id,
                      status: 'Closed',
                      timeline: [
                        {
                          id: `status-closed-${Date.now()}`,
                          type: 'status',
                          text: 'Ticket closed by CS Representative.',
                          timestamp,
                        }
                      ]
                    });
                    onClose();
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Close Ticket
              </Button>
            )}

            {(() => {
              const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
              const isReopenable = ticket.status === 'Closed' &&
                resolvedAt && !isNaN(resolvedAt.getTime()) &&
                (new Date() - resolvedAt) < (48 * 60 * 60 * 1000);

              if (isReopenable) {
                return (
                  <Button
                    type="button"
                    variant="default"
                    onClick={async () => {
                      setIsProcessing(true);
                      try {
                        const timestamp = new Date().toLocaleString('en-US');
                        await onStatusUpdate({
                          id: ticket.id,
                          status: 'Reopened',
                          timeline: [
                            {
                              id: `status-reopened-${Date.now()}`,
                              type: 'status',
                              text: 'Ticket reopened by CS Representative.',
                              timestamp,
                            }
                          ]
                        });
                        onClose();
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                    Reopen Ticket
                  </Button>
                );
              }
              return null;
            })()}

            {/* Place on Hold button */}
            {currentStatus !== 'Closed' && currentStatus !== 'Resolved' && currentStatus !== 'On Hold' && typeof onStatusUpdate === 'function' && (
              <button
                type="button"
                onClick={() => setShowHoldModal(true)}
                disabled={isProcessing || isHolding}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Place on Hold
              </button>
            )}

            {/* Resume Ticket button */}
            {currentStatus === 'On Hold' && typeof onStatusUpdate === 'function' && (
              <button
                type="button"
                onClick={handleResumeTicket}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-[#252578] hover:bg-[#1e1e60] text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-[#252578]/30 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Resume Ticket
              </button>
            )}

            {!ticket.reassignmentRequested && ticket.status !== 'Closed' && ticket.status !== 'Resolved' && onEdit && (
              <Button
                variant="outline"
                onClick={onEdit}
                disabled={isProcessing}
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Reassign
              </Button>
            )}
          </div>
        </div>
      </div>

      {showHoldModal && (
        <HoldTicketDialog
          isOpen={showHoldModal}
          onClose={() => setShowHoldModal(false)}
          onConfirm={handleConfirmHold}
          isSaving={isHolding}
        />
      )}

      {showReclassifyEdit && (
        <ReclassifyEditModal
          isOpen={showReclassifyEdit}
          onClose={() => setShowReclassifyEdit(false)}
          currentCategory={currentCategory}
          currentPriority={currentPriority}
          categories={formOptions.categories}
          priorities={formOptions.priorities}
          onReviewChanges={handleReviewReclassify}
        />
      )}

      {showReclassifyConfirm && reclassifyPendingValues && (
        <ReclassifyConfirmModal
          isOpen={showReclassifyConfirm}
          onClose={() => {
            setShowReclassifyConfirm(false);
            setShowReclassifyEdit(true);
          }}
          onConfirm={handleConfirmReclassify}
          oldCategory={currentCategory}
          newCategory={reclassifyPendingValues.newCategory}
          oldPriority={currentPriority}
          newPriority={reclassifyPendingValues.newPriority}
          isSaving={isReclassifying}
          error={reclassifyError}
        />
      )}

      {showReassignApprove && (
        <ConfirmDialog
          title="Approve Reassignment?"
          message={`Are you sure you want to approve the reassignment for ticket ${ticket.id}? This will allow you to assign it to a different employee.`}
          confirmText="Yes, Approve"
          onCancel={() => setShowReassignApprove(false)}
          onConfirm={async () => {
            setShowReassignApprove(false);
            onEdit(); // Opens AssignModal immediately
          }}
        />
      )}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
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
  const [deptAutoNotice, setDeptAutoNotice] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState(ticket?.assigned || []);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [showValidationError, setShowValidationError] = useState(false);


  useLockBodyScroll(!!ticket);

  if (!ticket) return null;

  const filteredDepartments = useMemo(() => {
    return (departments || []).filter(
      (d) => !['customer service', 'customer support', 'cs'].includes(d.toLowerCase().trim())
    );
  }, [departments]);

  const employeesInDept = useMemo(() => {
    const list = employees.filter((e) => {
      const empDept = (e.department || '').toLowerCase().trim();
      const empRole = (e.role || '').toLowerCase().trim();
      if (['customer service', 'customer support', 'cs'].includes(empDept) || ['customer service', 'customer support', 'cs'].includes(empRole)) {
        return false;
      }
      return department ? e.department === department : true;
    });
    list.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [department, employees]);

  const toggleEmp = (id) => {
    const isAdding = !selectedEmployees.includes(id);
    if (isAdding && !department) {
      const emp = employees.find((e) => e.id === id);
      if (emp && emp.department) {
        setDepartment(emp.department);
        setDeptAutoNotice(`You didn't select a department, so we've automatically selected ${emp.department} for this employee.`);
      }
    }
    setSelectedEmployees((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length > 0) {
        setShowValidationError(false);
      }
      return next;
    });
  };

  const handleAcceptClick = () => {
    if (selectedEmployees.length === 0) {
      setShowValidationError(true);
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (isSaving) return;

    let finalDept = department;
    if (!finalDept && selectedEmployees.length > 0) {
      const firstEmp = employees.find(e => e.id === selectedEmployees[0]);
      if (firstEmp) {
        finalDept = firstEmp.department;
      }
    }

    const updated = {
      ...ticket,
      title,
      priority,
      department: finalDept || null,
      assigned: selectedEmployees,
      status: 'Pending Assignment',
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
        <div className="bg-card border border-border rounded-xl w-155 max-w-full max-h-[90vh] flex flex-col relative shadow-modal animate-in fade-in zoom-in-95 duration-200">

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 p-6">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-muted hover:text-slate-dark transition-colors p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-slate-dark mb-4">
              {ticket.status === 'Pending Assignment' || ticket.reassignmentStatus === 'Approved' ? 'Reassign Ticket' : 'Assign Ticket'}
            </h3>

            {/* Ticket Info */}
            <div className="bg-primary text-white rounded-xl p-4 mb-4 flex items-center justify-between shadow-sm">
              <div className="flex-1 mr-4">
                <div className="text-xs text-white/70 font-mono">{ticket.id}</div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-transparent border-b border-white/30 text-sm font-semibold mt-0.5 outline-none focus:border-white transition-colors py-1 text-white"
                />
                <div className="text-xs text-white/70 mt-1">{ticket.category}</div>
              </div>
              <Badge variant="outline" className="border-white/30 text-white bg-white/10 shrink-0">
                {ticket.sla}
              </Badge>
            </div>

            {/* Department */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-dark mb-1.5">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setDeptAutoNotice('');
                  setSelectedEmployees([]);
                  setShowValidationError(false);
                }}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-slate-dark focus:ring-2 focus:ring-accent outline-none transition-all shadow-xs"
              >
                <option value="">Select department...</option>
                {filteredDepartments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {deptAutoNotice && (
                <div className="mt-2 text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded-lg p-2.5 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{deptAutoNotice}</span>
                </div>
              )}
            </div>

            {/* Priority */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-dark mb-2">
                Priority
              </label>
              <div className="flex gap-2 flex-wrap">
                {priorityOptions.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={priority === p ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPriority(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            {/* Employees */}
            <div>
              <label className="block text-xs font-medium text-slate-dark mb-1.5">
                Assign Employee(s)
                {selectedEmployees.length > 0 && (
                  <span className="ml-2 text-primary font-semibold">
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
                        className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 text-xs font-medium px-2.5 py-1 rounded-full"
                      >
                        {emp.name}
                        <button
                          type="button"
                          onClick={() => toggleEmp(id)}
                          disabled={isSaving}
                          className="ml-0.5 font-bold hover:text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="max-h-44 overflow-auto bg-page border border-border rounded-xl p-2 space-y-1">
                {employeesInDept.length === 0 ? (
                  <div className="text-xs text-slate-muted p-2">
                    Select a department to see employees
                  </div>
                ) : (
                  employeesInDept.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-card rounded-lg transition-all cursor-pointer border border-transparent hover:border-border"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(emp.id)}
                          onChange={() => toggleEmp(emp.id)}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-accent"
                        />
                        <div>
                          <div className="text-xs font-medium text-slate-dark">{emp.name}</div>
                          <div className="text-[11px] text-slate-muted">{emp.department} • {emp.status}</div>
                        </div>
                      </div>
                      <Badge variant={emp.status === 'active' ? 'emerald' : 'secondary'} className="text-[10px]">
                        {emp.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </label>
                  ))
                )}
              </div>

              {showValidationError && selectedEmployees.length === 0 && (
                <p className="mt-2 text-xs font-semibold text-destructive flex items-center gap-1.5 bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
                  <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
                  At least one employee must be selected.
                </p>
              )}
            </div>

            {/* Attachments */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="bg-page border border-border rounded-xl px-4 py-3 mt-4">
                <div className="text-xs font-medium text-slate-muted mb-2">
                  Attachments
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {ticket.attachments.map((file, idx) => {
                    const fileName = getFileName(file);
                    const fileUrl = getFileUrl(file);
                    const isQuarantined = isQuarantinedFile(file);

                    if (isQuarantined) {
                      return (
                        <div key={idx} className="flex items-center justify-between bg-red-50/50 border border-red-200 rounded-lg p-2.5 shadow-xs">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-red-700 truncate line-through" title="Attachment quarantined: Threat detected">
                                {fileName}
                              </p>
                              <span className="text-[10px] text-red-500 font-bold uppercase">Blocked &amp; Quarantined</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase">
                            Blocked
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="flex items-center justify-between bg-card border border-border rounded-lg p-2.5 shadow-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Paperclip className="w-4 h-4 text-slate-muted shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p
                              onClick={() => setPreviewFile({ name: fileName, url: fileUrl })}
                              className="text-xs font-medium text-slate-dark truncate cursor-pointer hover:text-accent hover:underline"
                            >
                              {fileName}
                            </p>
                            {file.size && <p className="text-[10px] text-slate-muted">{(file.size / 1024).toFixed(1)} KB</p>}
                          </div>
                        </div>
                        {fileUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              setPreviewFile({ name: fileName, url: fileUrl });
                            }}
                            className="h-7 text-xs text-primary"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Proof of Completion Attachments */}
            {((ticket.proofAttachments && ticket.proofAttachments.length > 0) || (ticket.proofFiles && ticket.proofFiles.length > 0)) && (
              <div className="bg-page border border-border rounded-xl px-4 py-3 mt-4">
                <div className="text-xs font-semibold text-emerald-800 mb-2">
                  Proof of Completion Documents
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(ticket.proofAttachments || ticket.proofFiles).map((file, idx) => {
                    const fileName = getFileName(file);
                    const fileUrl = getFileUrl(file);
                    const isQuarantined = isQuarantinedFile(file);

                    if (isQuarantined) {
                      return (
                        <div key={idx} className="flex items-center justify-between bg-red-50/50 border border-red-200 rounded-lg p-2.5 shadow-xs">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-red-700 truncate line-through" title="Proof quarantined: Threat detected">
                                {fileName}
                              </p>
                              <span className="text-[10px] text-red-500 font-bold uppercase">Blocked &amp; Quarantined</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase">
                            Blocked
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="flex items-center justify-between bg-card border border-border rounded-lg p-2.5 shadow-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p
                              onClick={() => setPreviewFile({ name: fileName, url: fileUrl })}
                              className="text-xs font-medium text-slate-dark truncate cursor-pointer hover:text-emerald-700 hover:underline"
                            >
                              {fileName}
                            </p>
                            {file.size && <p className="text-[10px] text-slate-muted">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>}
                          </div>
                        </div>
                        {fileUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              setPreviewFile({ name: fileName, url: fileUrl });
                            }}
                            className="h-7 text-xs text-emerald-700 hover:text-emerald-900"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Sticky footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0 bg-card">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleAcceptClick}
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </span>
              ) : (ticket.status === 'Pending Assignment' || ticket.reassignmentStatus === 'Approved') ? 'Save Changes' : 'Assign Ticket'}
            </Button>
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
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </>
  );
}
