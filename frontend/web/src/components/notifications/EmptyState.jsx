import React from 'react';

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-3 border border-gray-100">
        <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
      <h3 className="text-sm font-bold text-gray-800">You're all caught up!</h3>
      <p className="text-xs text-gray-500 mt-1 text-center">No new notifications at the moment.</p>
    </div>
  );
}
