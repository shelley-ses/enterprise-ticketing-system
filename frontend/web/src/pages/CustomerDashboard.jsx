import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Notifications from '@/components/Notifications';
import QuickActions from '@/components/QuickActions';
import TicketModal from '@/components/TicketModal';
import { createTicket, getCustomerDashboard, prefetchTicketFormOptions } from '@/services/ticketService';
import { useAuth } from '@/context/AuthContext';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

export default function CustomerDashboard() {
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [summary, setSummary] = useState({
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  });
  const [recentTickets, setRecentTickets] = useState([]);
  const { user } = useAuth();
  const effectiveUser = user || getStoredUser();
  const customerName = effectiveUser?.name || 'Customer';
  const customerId = effectiveUser?.id || 1;

  const statusColorByName = {
    Open: 'bg-amber-100 text-amber-700',
    'In Progress': 'bg-blue-100 text-blue-700',
    Resolved: 'bg-green-100 text-green-700',
    Closed: 'bg-gray-100 text-gray-700',
  };

  const loadDashboardData = async ({ forceRefresh = false } = {}) => {
    setDashboardLoading(true);
    setDashboardError('');

    try {
      const data = await getCustomerDashboard({ createdBy: customerId, limit: 5, forceRefresh });
      setSummary(data?.summary || {
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
      });
      setRecentTickets((data?.recent_tickets || []).map((ticket) => ({
        ...ticket,
        statusColor: statusColorByName[ticket.status] || 'bg-gray-100 text-gray-700',
      })));
    } catch (error) {
      setDashboardError(error?.response?.data?.message || 'Failed to load dashboard data.');
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    prefetchTicketFormOptions().catch(() => {
      // Modal handles display error if options cannot be fetched.
    });

    loadDashboardData().catch(() => {
      // State handled in loadDashboardData.
    });
  }, [customerId]);

  const dateStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());

  const summaryData = [
    { title: 'Open Tickets', count: summary.open, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
    { title: 'In Progress', count: summary.in_progress, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
    { title: 'Resolved', count: summary.resolved, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' },
    { title: 'Closed', count: summary.closed, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
  ];

  const notifications = [
    { title: 'Engineer Assigned', desc: 'James Reyes has been assigned to your ticket TKT-001 (MRI Machine Not Powering On).', time: '3d ago', unread: true },
    { title: 'Ticket Resolved', desc: 'Your ticket TKT-003 (CT Scan Gantry Rotation Error) has been marked as Resolved.', time: '7d ago', unread: false },
  ];

  const handleCreateTicket = async (payload) => {
    const response = await createTicket({
      machine_ID: Number(payload.machine_ID),
      problem_category_ID: Number(payload.problem_category_ID),
      created_by: Number(payload.created_by || customerId),
      ticket_status_ID: 1,
      title: payload.title,
      description: payload.description,
      attachments: payload.attachments || [],
    });

    if (response?.dashboard_ticket) {
      const newTicket = {
        ...response.dashboard_ticket,
        statusColor: statusColorByName[response.dashboard_ticket.status] || 'bg-gray-100 text-gray-700',
      };

      setSummary((current) => ({
        ...current,
        open: current.open + 1,
      }));
      setRecentTickets((current) => [newTicket, ...current].slice(0, 5));
    }

    loadDashboardData({ forceRefresh: true }).catch(() => {
      // UI already updated optimistically from create response.
    });

    setIsTicketModalOpen(false);
    window.alert('Ticket created successfully.');
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8">
      
      {/* Left Column */}
      <div className="flex-1 flex flex-col gap-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-gray-500 text-sm font-medium">{dateStr}</p>
            <h1 className="text-3xl font-bold text-[#252578] mt-1">Welcome back, {customerName}!</h1>
            <p className="text-gray-500 mt-2 text-sm">Here's a summary of your equipment support tickets.</p>
          </div>

          {/* AI Support Glassmorphism Card */}
          <button className="flex items-center gap-3 px-6 py-3 bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] rounded-2xl hover:bg-white/60 transition-all duration-300 group">
            <svg className="w-6 h-6 text-[#252578] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <div className="text-left">
              <div className="text-sm font-bold text-[#252578]">AI Support</div>
              <div className="text-xs text-gray-500">Quick FAQ lookup</div>
            </div>
            <svg className="w-5 h-5 text-[#252578] ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>

        {/* Summary Cards */}
        {dashboardError && <p className="text-sm text-red-500">{dashboardError}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summaryData.map((card, idx) => (
            <div key={idx} className={`p-6 rounded-3xl bg-white border ${card.border} shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group`}>
               <div className={`absolute top-4 right-4 w-8 h-8 rounded-full ${card.bg} flex items-center justify-center`}>
                  <div className={`w-3 h-3 rounded-sm border-2 ${card.color}`}></div>
               </div>
               <div className={`text-4xl font-bold ${card.color}`}>{dashboardLoading ? '-' : card.count}</div>
               <div className={`text-sm font-medium mt-2 ${card.color} opacity-80`}>{card.title}</div>
            </div>
          ))}
        </div>

        {/* Recent Tickets Table */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/50 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Recent Tickets</h2>
              <p className="text-sm text-gray-500">Latest submitted support tickets</p>
            </div>
            <button className="text-sm font-semibold text-[#252578] flex items-center gap-1 hover:underline">
              View All <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-3">
              <thead>
                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                  <th className="px-4 pb-2">Ticket ID</th>
                  <th className="px-4 pb-2">Title</th>
                  <th className="px-4 pb-2">Status</th>
                  <th className="px-4 pb-2 text-center">View</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-4 py-6 text-center text-sm text-gray-500">
                      {dashboardLoading ? 'Loading recent tickets...' : 'No tickets yet.'}
                    </td>
                  </tr>
                )}
                {recentTickets.map((t, idx) => (
                  <tr key={idx} className="bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl group">
                    <td className="px-4 py-4 rounded-l-2xl text-sm font-medium text-gray-800 border-y border-l border-gray-100">{t.id}</td>
                    <td className="px-4 py-4 border-y border-gray-100">
                      <div className="text-sm font-semibold text-gray-800">{t.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{t.equipment}</div>
                    </td>
                    <td className="px-4 py-4 border-y border-gray-100">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full flex w-fit items-center gap-1.5 ${t.statusColor}`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 rounded-r-2xl border-y border-r border-gray-100 text-center">
                      <button className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Right Column - Notifications & Quick Actions */}
      <div className="w-full xl:w-96 flex flex-col gap-6">
        <Notifications notifications={notifications} />
        <QuickActions onOpenTicketModal={() => setIsTicketModalOpen(true)} />
      </div>

      {/* Ticket Modal */}
      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        onSubmit={handleCreateTicket}
      />
    </div>
  );
}
