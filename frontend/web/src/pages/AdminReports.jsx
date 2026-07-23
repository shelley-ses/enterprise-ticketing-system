import React from 'react';
import { BarChart3, Construction } from 'lucide-react';

export default function AdminReports() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 max-w-lg w-full">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-6">
          <BarChart3 className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Reports</h2>
        <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-4 py-2 mb-4">
          <Construction className="w-4 h-4" />
          <span className="text-sm font-medium">Coming Soon</span>
        </div>
        <p className="text-gray-500 text-sm leading-relaxed">
          Generate and export detailed reports on ticket trends, SLA compliance, employee performance,
          and customer satisfaction. This feature is currently under development.
        </p>
      </div>
    </div>
  );
}
