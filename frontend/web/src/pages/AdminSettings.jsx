import React from 'react';
import { Settings, Construction } from 'lucide-react';

export default function AdminSettings() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 max-w-lg w-full">
        <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-6">
          <Settings className="w-8 h-8 text-violet-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Settings</h2>
        <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-4 py-2 mb-4">
          <Construction className="w-4 h-4" />
          <span className="text-sm font-medium">Coming Soon</span>
        </div>
        <p className="text-gray-500 text-sm leading-relaxed">
          Configure system preferences, notification settings, SLA thresholds, and integration options.
          This feature is currently under development.
        </p>
      </div>
    </div>
  );
}
