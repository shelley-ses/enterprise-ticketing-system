import React from 'react';
import { formatRelativeTime } from '@/utils/dateUtils';
import { Clock } from 'lucide-react';

export default function NotificationItem({ notification, onClick, isLast }) {
  const title = notification.title || '';
  const description = notification.message || notification.desc || '';
  const time = formatRelativeTime(notification.created_at) || notification.time || '';
  const isUnread = notification.unread !== undefined ? notification.unread : !notification.is_read;
  const isAutoClose = /auto-close|auto close|inactivity/i.test(title + ' ' + description);

  return (
    <button
      onClick={() => onClick(notification)}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors duration-150 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 ${
        isAutoClose
          ? (isUnread ? 'bg-amber-50/50' : 'bg-amber-50/20')
          : (isUnread ? 'bg-blue-50/40' : 'bg-white')
      } ${!isLast ? 'border-b border-gray-100' : ''}`}
      role="menuitem"
      aria-current={isUnread ? 'true' : undefined}
    >
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isAutoClose
            ? 'bg-amber-100 text-amber-700'
            : isUnread
            ? 'bg-blue-100 text-blue-600'
            : 'bg-gray-100 text-gray-400'
        }`}
      >
        {isAutoClose ? (
          <Clock size={16} />
        ) : (
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <span className={`text-xs leading-snug truncate ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
              {title}
            </span>
            {isAutoClose && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 shrink-0">
                Auto-Close
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 mt-0.5">{time}</span>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5 line-clamp-2">{description}</p>
      </div>

      {isUnread && (
        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
      )}
    </button>
  );
}
