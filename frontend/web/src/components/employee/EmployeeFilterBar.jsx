import React from 'react';

const selectClass = 'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer';

export default function EmployeeFilterBar({ filters, setFilters }) {
  const statuses = ['All', 'Open', 'In Progress', 'Resolved', 'Escalated', 'Closed'];
  const categories = ['All', 'MRI', 'CT Scan', 'Ultrasound', 'X-Ray', 'Ventilator', 'Defibrillator'];
  const priorities = ['All', 'Critical', 'High', 'Medium', 'Low'];

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-gray-100">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filter</span>
      <select className={selectClass} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
        {statuses.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select className={selectClass} value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select className={selectClass} value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
        {priorities.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <input
        type="date"
        className={selectClass}
        value={filters.date}
        onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
      />
      {(filters.status !== 'All' || filters.category !== 'All' || filters.priority !== 'All' || filters.date) && (
        <button
          type="button"
          onClick={() => setFilters({ status: 'All', category: 'All', priority: 'All', date: '' })}
          className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
