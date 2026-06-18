import React from 'react';

export default function SuperAdminHistory() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-[#252578]">History</h1>
        <p className="mt-1 text-sm text-gray-500">Historical record of all configurations and changes.</p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
        <p className="text-gray-500">History records will be available here.</p>
      </div>
    </div>
  );
}
