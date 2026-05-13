import React from 'react';
import { Link } from 'react-router-dom';

export default function QuickActions({ onOpenTicketModal }) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100">
      <h2 className="text-lg font-bold text-gray-800 mb-4 uppercase text-sm tracking-wide">Quick Actions</h2>
      
      <div className="flex flex-col gap-3">
        <button 
          onClick={onOpenTicketModal}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#252578] to-[#3b82f6] hover:shadow-lg text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Submit New Ticket
        </button>

        <Link 
          to="/my-tickets"
          className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 px-6 rounded-2xl transition-all duration-300 border-2 border-gray-200 hover:border-gray-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          View all Tickets
        </Link>
      </div>
    </div>
  );
}
