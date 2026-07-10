import React from 'react';
import { CalendarDays, Mail, Briefcase } from 'lucide-react';

export default function ProfileHero({ profile }) {
  const initials = ((profile.firstName?.[0] || '') + (profile.lastName?.[0] || '')).toUpperCase() || 'U';
  const fullName = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
      <div className="h-24 bg-gradient-to-r from-[#252578] to-[#2E85D8]" />
      <div className="px-6 pb-6">
        <div className="flex items-end justify-between -mt-10 mb-4">
          <div className="w-20 h-20 rounded-2xl bg-[#252578] border-4 border-white flex items-center justify-center text-white text-2xl font-bold shadow-md select-none">
            {initials}
          </div>
          <span className="mb-1 text-xs font-semibold px-3 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
            ● Active
          </span>
        </div>

        <h2 className="text-lg font-bold text-gray-800">{fullName}</h2>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-2">
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <Briefcase size={14} className="text-gray-400" />
            {profile.role} · {profile.department}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <Mail size={14} className="text-gray-400" />
            {profile.email}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <CalendarDays size={14} className="text-gray-400" />
            Member since {profile.dateJoined}
          </span>
        </div>
      </div>
    </div>
  );
}
