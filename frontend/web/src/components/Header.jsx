import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Header() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/cs')
    ? '/cs'
    : location.pathname.startsWith('/employee')
      ? '/employee'
      : '';

  const handleLogout = () => {
    navigate('/');
  };

  return (
    <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-10 px-6 py-4 flex items-center justify-between shadow-sm">
      {/* Logo & Title */}
      <div className="flex items-center gap-4 pl-24">
         <div className="flex items-center gap-3">
           <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm border border-gray-300">[ LOGO ]</span>
           <div className="hidden md:flex flex-col text-sm leading-tight">
             <span className="text-[#252578] font-semibold">SCIENTIFIC BIOTECH</span>
             <span className="text-xs text-gray-500 font-normal">SPECIALTIES, INC.</span>
           </div>
         </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-6">
        <div className="relative hidden md:block">
          <input 
            type="text" 
            placeholder="Search..." 
            className="pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#252578]"
          />
          <svg className="w-5 h-5 text-gray-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <button onClick={() => navigate(`${basePath}/notifications`)} className="relative p-2 text-[#252578] hover:bg-gray-100 rounded-full transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </button>

        <div className="relative">
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="p-2 text-[#252578] hover:bg-gray-100 rounded-full transition-colors flex items-center gap-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white/90 backdrop-blur-lg border border-gray-100 rounded-2xl shadow-xl py-2 z-50">
              <button onClick={() => { setDropdownOpen(false); navigate(`${basePath}/profile`); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors">Profile</button>
              <button onClick={() => { setDropdownOpen(false); navigate(`${basePath}/notifications`); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors">Notifications</button>
              <div className="h-px bg-gray-100 my-1"></div>
              <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm font-medium transition-colors">Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
