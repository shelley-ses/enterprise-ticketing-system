import React, { useState, useMemo } from 'react';
import { formatDisplayDate } from '@/utils/dateUtils';
import { validateNoteText, NOTE_MAX_LENGTH } from '@/utils/noteValidation';

const TRUNCATE_CHAR_LIMIT = 350;

/**
 * Individual note card with structured display and character truncation toggle.
 */
export function NoteItem({
  id,
  author,
  timestamp,
  text = '',
  truncateLimit = TRUNCATE_CHAR_LIMIT,
  className = '',
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text.length > truncateLimit;
  const displayText = isLong && !isExpanded ? `${text.slice(0, truncateLimit)}...` : text;

  return (
    <div className={`bg-white border border-gray-100 rounded-xl p-3 shadow-xs text-field-value leading-relaxed min-w-0 max-w-full overflow-hidden ${className}`}>
      <div className="flex justify-between items-center text-timestamp text-gray-400 mb-1">
        <span className="text-badge text-[#252578] font-semibold">{author || 'Staff Member'}</span>
        <span className="text-timestamp">{formatDisplayDate(timestamp)}</span>
      </div>
      <p
        className="text-field-value text-gray-700 break-words whitespace-pre-wrap max-w-full overflow-hidden"
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {displayText}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="text-xs text-[#252578] hover:underline font-semibold mt-1 inline-block cursor-pointer"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

/**
 * Reusable list container for internal notes or remarks with bounded vertical scroll.
 */
export function NoteList({
  notes = [],
  emptyMessage = 'No internal notes added yet.',
  maxHeightClass = 'max-h-48',
  truncateLimit = TRUNCATE_CHAR_LIMIT,
}) {
  if (!notes || notes.length === 0) {
    return (
      <div className="py-2">
        <p className="text-xs text-gray-400 italic p-1">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${maxHeightClass} overflow-y-auto pr-1`}>
      {notes.map((note, index) => (
        <NoteItem
          key={note.id || `note-${index}`}
          id={note.id || index}
          author={note.author}
          timestamp={note.timestamp || note.created_at || note.date}
          text={note.text || note.remark || ''}
          truncateLimit={truncateLimit}
        />
      ))}
    </div>
  );
}

/**
 * Complete Staff-Only Internal Notes section with:
 * 1. Structured chronological display
 * 2. Overflow protection & truncation
 * 3. Soft gibberish warning & confirmation flow
 * 4. Max length enforcement with live counter
 */
export default function InternalNotesSection({
  notes = [],
  onAddNote,
  isAdding = false,
  title = 'Internal Notes',
  badgeText = 'Staff-Only',
  subtitle = 'Hidden from customer',
  emptyMessage = 'No internal notes added yet.',
  maxListHeight = 'max-h-48',
  readOnly = false,
}) {
  const [noteText, setNoteText] = useState('');
  const [warnPending, setWarnPending] = useState(false);

  const validation = useMemo(() => validateNoteText(noteText), [noteText]);

  const handleTextChange = (e) => {
    setNoteText(e.target.value);
    if (warnPending) {
      setWarnPending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = noteText.trim();
    if (!trimmed || isAdding || validation.isOverLimit) return;

    // Soft check: if gibberish detected and not yet confirmed, ask user to confirm
    if (validation.warning && !warnPending) {
      setWarnPending(true);
      return;
    }

    if (typeof onAddNote === 'function') {
      await onAddNote(trimmed);
      setNoteText('');
      setWarnPending(false);
    }
  };

  return (
    <div className="border border-gray-100 rounded-2xl p-5 bg-gray-50/50 space-y-4 text-left">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-field-label uppercase text-gray-800 flex items-center gap-1.5">
          <span>{title}</span>
          {badgeText && (
            <span className="text-badge bg-red-100 text-red-800 px-2 py-0.5 rounded-full uppercase border border-red-200">
              {badgeText}
            </span>
          )}
        </h4>
        {subtitle && (
          <span className="text-timestamp text-gray-400 italic">{subtitle}</span>
        )}
      </div>

      {/* Chronological Notes List */}
      <NoteList
        notes={notes}
        emptyMessage={emptyMessage}
        maxHeightClass={maxListHeight}
      />

      {/* Input Form */}
      {!readOnly && typeof onAddNote === 'function' && (
        <form onSubmit={handleSubmit} className="space-y-2 pt-1 border-t border-gray-200/60">
          <div className="relative">
            <textarea
              id="internal-note-input"
              rows={2}
              maxLength={NOTE_MAX_LENGTH}
              placeholder="Write an internal note..."
              value={noteText}
              disabled={isAdding}
              onChange={handleTextChange}
              className="w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#252578]/20 disabled:opacity-50 resize-y min-h-[44px]"
            />
          </div>

          {/* Always-visible maximum character limit indication & live counter */}
          <div className="flex justify-between items-center text-[11px] text-gray-400 px-0.5">
            <span className="font-medium text-gray-500">Max {NOTE_MAX_LENGTH.toLocaleString()} characters</span>
            <span
              className={
                validation.isOverLimit
                  ? 'text-red-500 font-bold'
                  : validation.charsRemaining <= 100
                  ? 'text-amber-600 font-semibold'
                  : 'text-gray-400'
              }
            >
              {noteText.length} / {NOTE_MAX_LENGTH.toLocaleString()}
            </span>
          </div>

          {/* Inline Soft Gibberish Warning */}
          {validation.warning && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-800 animate-fadeIn">
              <svg
                className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1 leading-snug">
                <p className="font-semibold">{validation.warning}</p>
                {warnPending ? (
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Click &ldquo;Add Note&rdquo; again to submit anyway, or review your note above.
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-600 mt-0.5">
                    Please double-check before submitting.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            {warnPending && (
              <button
                type="button"
                onClick={() => setWarnPending(false)}
                className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
              >
                Review Note
              </button>
            )}
            <button
              type="submit"
              disabled={isAdding || !noteText.trim() || validation.isOverLimit}
              className={`px-4 py-2 text-white text-button rounded-xl shrink-0 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                warnPending
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-[#252578] hover:bg-[#1a1a5c]'
              }`}
            >
              {isAdding
                ? 'Adding...'
                : warnPending
                ? 'Submit Anyway'
                : 'Add Note'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
