import React, { useState, useMemo } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { formatDisplayDate } from '@/utils/dateUtils';
import { validateNoteText, NOTE_MAX_LENGTH } from '@/utils/noteValidation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
    <div className={`bg-card border border-border rounded-xl p-3 shadow-xs text-field-value leading-relaxed min-w-0 max-w-full overflow-hidden font-sans ${className}`}>
      <div className="flex justify-between items-center text-timestamp text-muted-slate mb-1">
        <span className="text-badge text-primary font-semibold">{author || 'Staff Member'}</span>
        <span className="text-timestamp">{formatDisplayDate(timestamp)}</span>
      </div>
      <p
        className="text-field-value text-dark-slate break-words whitespace-pre-wrap max-w-full overflow-hidden"
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {displayText}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="text-xs text-primary hover:text-accent font-semibold mt-1 inline-block cursor-pointer transition-colors"
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
        <p className="text-xs text-muted-slate italic p-1">{emptyMessage}</p>
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
    <div className="border border-border rounded-xl p-5 bg-slate-50/50 space-y-4 text-left font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-field-label uppercase text-dark-slate flex items-center gap-1.5 font-bold">
          <span>{title}</span>
          {badgeText && (
            <Badge variant="destructive" className="uppercase text-[10px]">
              {badgeText}
            </Badge>
          )}
        </h4>
        {subtitle && (
          <span className="text-timestamp text-muted-slate italic">{subtitle}</span>
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
        <form onSubmit={handleSubmit} className="space-y-2 pt-1 border-t border-border">
          <div className="relative">
            <textarea
              id="internal-note-input"
              rows={2}
              maxLength={NOTE_MAX_LENGTH}
              placeholder="Write an internal note..."
              value={noteText}
              disabled={isAdding}
              onChange={handleTextChange}
              className="w-full text-xs border border-border rounded-xl p-2.5 bg-card text-dark-slate outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:opacity-50 resize-y min-h-[44px]"
            />
          </div>

          {/* Always-visible maximum character limit indication & live counter */}
          <div className="flex justify-between items-center text-[11px] text-muted-slate px-0.5">
            <span className="font-medium text-muted-slate">Max {NOTE_MAX_LENGTH.toLocaleString()} characters</span>
            <span
              className={
                validation.isOverLimit
                  ? 'text-red-500 font-bold'
                  : validation.charsRemaining <= 100
                  ? 'text-amber-600 font-semibold'
                  : 'text-muted-slate'
              }
            >
              {noteText.length} / {NOTE_MAX_LENGTH.toLocaleString()}
            </span>
          </div>

          {/* Inline Soft Gibberish Warning */}
          {validation.warning && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-800 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWarnPending(false)}
                className="cursor-pointer"
              >
                Review Note
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={isAdding || !noteText.trim() || validation.isOverLimit}
              variant={warnPending ? 'warning' : 'default'}
              className="cursor-pointer"
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Adding...
                </>
              ) : warnPending ? (
                'Submit Anyway'
              ) : (
                'Add Note'
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

