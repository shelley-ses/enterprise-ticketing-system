import React from 'react';

export default function LoadingState() {
  return (
    <div className="p-3 space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3 p-3 animate-pulse">
          <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-2.5 bg-gray-100 rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
