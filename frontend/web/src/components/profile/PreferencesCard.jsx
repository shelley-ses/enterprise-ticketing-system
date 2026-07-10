import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between px-6 py-3">
      <div>
        <p className="text-sm font-semibold text-gray-700">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#252578]/20 ${
          checked ? 'bg-[#252578]' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function PreferencesCard({ role }) {
  const [prefs, setPrefs] = useState({
    emailNotifications: true,
    systemAlerts: true,
    loginAlerts: true,
  });

  const toggle = (key) => () => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = (e) => {
    e.preventDefault();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <SlidersHorizontal size={16} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">Preferences</h3>
          <p className="text-xs text-gray-500">Notifications and display settings.</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="pt-4 pb-1 px-6">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notifications</p>
        </div>
        <div className="divide-y divide-gray-50">
          <ToggleRow
            label="Email notifications"
            description="Receive alerts via email"
            checked={prefs.emailNotifications}
            onChange={toggle('emailNotifications')}
          />
          <ToggleRow
            label="System alerts"
            description="In-app notifications and banners"
            checked={prefs.systemAlerts}
            onChange={toggle('systemAlerts')}
          />
          {role === 'Admin' && (
            <ToggleRow
              label="Login alerts"
              description="Email me when a new login is detected"
              checked={prefs.loginAlerts}
              onChange={toggle('loginAlerts')}
            />
          )}
        </div>

        <div className="px-6 pb-5 pt-2">
          <button
            type="submit"
            className="h-9 px-5 text-sm font-semibold bg-[#252578] hover:bg-[#1f1f66] text-white rounded-xl transition-colors"
          >
            Save preferences
          </button>
        </div>
      </form>
    </div>
  );
}
