import React from 'react';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';

export default function ResponsiveModal({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-lg' }) {
  useLockBodyScroll(isOpen);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[1.5px] p-0 sm:p-4" onClick={onClose}>
      <div
        className={`bg-white shadow-2xl w-full ${maxWidth} flex flex-col overflow-hidden max-h-[100vh] sm:max-h-[85vh] sm:rounded-xl rounded-t-2xl sm:rounded-xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
            <h2 className="text-modal-title text-gray-900">{title}</h2>
            <button onClick={onClose} className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#252578]">✕</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 overscroll-contain">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-100 shrink-0 bg-gray-50 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
