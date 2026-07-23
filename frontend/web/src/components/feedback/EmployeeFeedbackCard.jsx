import React from 'react';
import StarRating from './StarRating';

const MAX_COMMENT_LENGTH = 500;

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-cyan-500',
];

function getAvatarColor(id) {
  return AVATAR_COLORS[(id - 1) % AVATAR_COLORS.length];
}

function getInitials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function EmployeeFeedbackCard({
  employee,
  rating,
  onRatingChange,
  comment,
  onCommentChange,
  readOnly = false,
  submissionDate,
}) {
  if (readOnly) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${getAvatarColor(employee.id)}`}>
            {getInitials(employee.name)}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{employee.name}</p>
            <p className="text-xs text-gray-500">{employee.jobTitle}</p>
          </div>
        </div>
        <div className="mt-3">
          <StarRating value={rating} readOnly size="lg" />
        </div>
        {comment && (
          <p className="mt-2 text-sm leading-relaxed text-gray-700">{comment}</p>
        )}
        {submissionDate && (
          <p className="mt-2 text-xs text-gray-400">Submitted on {submissionDate}</p>
        )}
      </div>
    );
  }

  const remaining = MAX_COMMENT_LENGTH - (comment?.length || 0);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${getAvatarColor(employee.id)}`}>
          {getInitials(employee.name)}
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">{employee.name}</p>
          <p className="text-xs text-gray-500">{employee.jobTitle}</p>
        </div>
      </div>

      <div className="mt-3">
        <StarRating value={rating} onChange={onRatingChange} />
      </div>

      <div className="mt-3">
        <textarea
          value={comment || ''}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Tell us about this employee's support experience..."
          maxLength={MAX_COMMENT_LENGTH}
          rows={3}
          className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 outline-none transition-colors focus:border-[#252578]/30 focus:bg-white focus:ring-2 focus:ring-[#252578]/15 placeholder:text-gray-400"
        />
        <div className="mt-1 flex justify-end">
          <span className={`text-xs ${remaining < 50 ? 'font-semibold text-red-500' : 'text-gray-400'}`}>
            {remaining}/{MAX_COMMENT_LENGTH}
          </span>
        </div>
      </div>
    </div>
  );
}
