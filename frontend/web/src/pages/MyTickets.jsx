import React, { useState } from 'react';
import TicketModal from '@/components/TicketModal';

export default function MyTickets() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const tickets = [
    { id: 'TKT-001', title: 'MRI Gradient Coil Noise', category: 'MRI', status: 'Open', dateSubmitted: 'March 24, 2026', lastUpdate: 'March 25, 2026', engineer: 'Unassigned' },
    { id: 'TKT-001', title: 'MRI Gradient Coil Noise', category: 'MRI', status: 'Open', dateSubmitted: 'March 24, 2026', lastUpdate: 'March 25, 2026', engineer: 'Unassigned' },
    { id: 'TKT-001', title: 'MRI Gradient Coil Noise', category: 'MRI', status: 'Open', dateSubmitted: 'March 24, 2026', lastUpdate: 'March 25, 2026', engineer: 'Unassigned' },
    { id: 'TKT-001', title: 'MRI Gradient Coil Noise', category: 'MRI', status: 'Open', dateSubmitted: 'March 24, 2026', lastUpdate: 'March 25, 2026', engineer: 'Unassigned' },
    { id: 'TKT-001', title: 'MRI Gradient Coil Noise', category: 'MRI', status: 'Open', dateSubmitted: 'March 24, 2026', lastUpdate: 'March 25, 2026', engineer: 'Unassigned' },
    { id: 'TKT-001', title: 'MRI Gradient Coil Noise', category: 'MRI', status: 'Open', dateSubmitted: 'March 24, 2026', lastUpdate: 'March 25, 2026', engineer: 'Unassigned' },
    { id: 'TKT-001', title: 'MRI Gradient Coil Noise', category: 'MRI', status: 'Open', dateSubmitted: 'March 24, 2026', lastUpdate: 'March 25, 2026', engineer: 'Unassigned' },
    { id: 'TKT-001', title: 'MRI Gradient Coil Noise', category: 'MRI', status: 'Open', dateSubmitted: 'March 24, 2026', lastUpdate: 'March 25, 2026', engineer: 'Unassigned' },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Open':
        return 'bg-amber-100 text-amber-700';
      case 'In Progress':
        return 'bg-blue-100 text-blue-700';
      case 'Resolved':
        return 'bg-green-100 text-green-700';
      case 'Closed':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTicketSubmit = (formData) => {
    alert('Ticket submitted successfully!');
    setIsModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-start md:items-center gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-3xl font-bold text-[#252578]">My Tickets</h1>
          <p className="text-gray-500 mt-1 text-sm">Track and manage all of your submitted support tickets</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#252578] to-[#3b82f6] hover:shadow-lg text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 whitespace-nowrap"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          New Ticket
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 flex-col md:flex-row">
        <div className="flex-1 relative">
          <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">Sort by</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4 text-left">Ticket ID</th>
                <th className="px-6 py-4 text-left">Title</th>
                <th className="px-6 py-4 text-left">Category</th>
                <th className="px-6 py-4 text-left">Status</th>
                <th className="px-6 py-4 text-left">Date Submitted</th>
                <th className="px-6 py-4 text-left">Last Update</th>
                <th className="px-6 py-4 text-left">Engineer</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTickets.map((ticket, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-[#252578]">{ticket.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{ticket.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{ticket.category}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{ticket.dateSubmitted}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{ticket.lastUpdate}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{ticket.engineer}</td>
                  <td className="px-6 py-4 text-center">
                    <button className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Modal */}
      <TicketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleTicketSubmit}
      />
    </div>
  );
}
