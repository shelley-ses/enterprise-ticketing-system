import React from 'react';

export default function SkeletonLoader({ className = '', variant = 'default' }) {
  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fadeIn">
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl w-155 max-w-full max-h-[90vh] flex flex-col relative shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-6">
          {/* Header skeleton */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="h-6 bg-gray-200 rounded-lg w-1/3 mb-3 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded-lg w-1/4 animate-pulse" />
            </div>
            <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
          </div>

          {/* Content skeletons */}
          <div className="space-y-4 flex-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-4">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-3 animate-pulse" />
                <div className="h-6 bg-gray-200 rounded w-2/3 animate-pulse" />
              </div>
            ))}
          </div>

          {/* Footer buttons skeleton */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <div className="h-10 bg-gray-200 rounded-xl w-24 animate-pulse" />
            <div className="h-10 bg-gray-200 rounded-xl w-24 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'ticket-card') {
    return (
      <div className="bg-white rounded-2xl shadow-md p-6 animate-pulse">
        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="h-6 bg-gray-200 rounded-full w-20 animate-pulse" />
          <div className="h-6 bg-gray-200 rounded-full w-24 animate-pulse" />
          <div className="h-6 bg-gray-200 rounded-full w-20 animate-pulse" />
        </div>

        {/* Title */}
        <div className="mb-4">
          <div className="h-7 bg-gray-200 rounded-lg w-3/4 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded-lg w-1/2 animate-pulse" />
        </div>

        {/* Content rows */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex justify-between">
                <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <tr className="border-b border-gray-50 animate-pulse">
        <td className="py-4 px-4">
          <div className="h-4 bg-gray-200 rounded w-20" />
        </td>
        <td className="py-4 px-4">
          <div className="h-4 bg-gray-200 rounded w-32" />
        </td>
        <td className="py-4 px-4">
          <div className="h-4 bg-gray-200 rounded w-40" />
        </td>
        <td className="py-4 px-4">
          <div className="h-4 bg-gray-200 rounded w-24" />
        </td>
        <td className="py-4 px-4">
          <div className="h-4 bg-gray-200 rounded w-24" />
        </td>
        <td className="py-4 px-4">
          <div className="h-4 bg-gray-200 rounded w-20" />
        </td>
        <td className="py-4 px-4">
          <div className="h-4 bg-gray-200 rounded w-20" />
        </td>
      </tr>
    );
  }

  // Default line skeleton
  return (
    <div className={`bg-gray-200 rounded-lg animate-pulse ${className}`} />
  );
}
