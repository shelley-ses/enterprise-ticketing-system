import React, { useState } from 'react';
import { User } from 'lucide-react';

export default function PersonalInfoCard({ profile }) {
  const [form, setForm] = useState({
    firstName: profile.firstName || '',
    middleName: profile.middleName || '',
    lastName: profile.lastName || '',
    email: profile.email || '',
    phone: profile.phone || '',
  });

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <User size={16} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">Personal Information</h3>
          <p className="text-xs text-gray-500">Update your personal details.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="px-6 py-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">First Name</label>
            <input
              type="text"
              value={form.firstName}
              onChange={handleChange('firstName')}
              placeholder="First name"
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10 transition"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Middle Name</label>
            <input
              type="text"
              value={form.middleName}
              onChange={handleChange('middleName')}
              placeholder="Middle name"
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10 transition"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Last Name</label>
            <input
              type="text"
              value={form.lastName}
              onChange={handleChange('lastName')}
              placeholder="Last name"
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10 transition"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              placeholder="Email address"
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10 transition"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="Phone number"
              className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-[#252578] focus:ring-2 focus:ring-[#252578]/10 transition"
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            type="submit"
            className="h-9 px-5 text-sm font-semibold bg-[#252578] hover:bg-[#1f1f66] text-white rounded-xl transition-colors"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
