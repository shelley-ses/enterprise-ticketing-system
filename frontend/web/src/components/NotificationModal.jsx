import React from 'react';

const icons = {
  success: (
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
      <svg className="h-6 w-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  ),
  error: (
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
      <svg className="h-6 w-6 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  ),
  confirm: (
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
      <svg className="h-6 w-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    </div>
  ),
};

export default function NotificationModal({ isOpen, type, title, message, onConfirm, onCancel, onClose, confirmText, cancelText, confirmClassName }) {
  if (!isOpen) return null;

  const isConfirm = type === 'confirm';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => { if (!isConfirm) onClose?.(); }}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {icons[type] || null}
        <h2 className="mt-4 text-lg font-bold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className={`mt-6 flex ${isConfirm ? 'justify-end gap-3' : 'justify-center'}`}>
          {isConfirm ? (
            <>
              <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100">
                {cancelText || 'Cancel'}
              </button>
              <button onClick={onConfirm} className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors ${confirmClassName || 'bg-[#252578] hover:bg-[#1f1f66]'}`}>
                {confirmText || 'Yes'}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="rounded-xl bg-[#252578] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1f1f66]">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
