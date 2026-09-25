import React from 'react';

export default function Pagination({ totalItems, itemsPerPage = 10, currentPage = 1, onPageChange = () => {} }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const handlePrev = () => onPageChange(Math.max(1, currentPage - 1));
  const handleNext = () => onPageChange(Math.min(totalPages, currentPage + 1));

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePrev}
        disabled={currentPage === 1}
        className="w-8 h-8 flex items-center justify-center rounded border disabled:opacity-50 text-sm"
        aria-label="Previous page"
      >
        {'<'}
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`w-8 h-8 flex items-center justify-center rounded ${p === currentPage ? 'bg-blue-500 text-white' : 'border'}`}
          aria-current={p === currentPage ? 'page' : undefined}
        >
          {p}
        </button>
      ))}

      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="w-8 h-8 flex items-center justify-center rounded border disabled:opacity-50 text-sm"
        aria-label="Next page"
      >
        {'>'}
      </button>
    </div>
  );
}
