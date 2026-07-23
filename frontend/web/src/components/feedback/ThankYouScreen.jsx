import React from 'react';

export default function ThankYouScreen({ onDone }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="mt-5 text-xl font-bold text-gray-900">Thank You for Your Feedback!</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
        Your ratings help us recognize excellent support and continuously improve our customer service.
      </p>
      <button
        type="button"
        onClick={onDone}
        className="mt-6 rounded-xl bg-[#252578] px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1f1f66] focus:outline-none focus:ring-2 focus:ring-[#252578]/30"
      >
        Done
      </button>
    </div>
  );
}
