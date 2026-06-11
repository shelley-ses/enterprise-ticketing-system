import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markNotificationsRead,
  markNotificationRead,
  getAssignableEmployees,
  getDepartments,
  getTicketDetails,
} from '@/services/ticketService';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import { AssignModal } from '@/components/CSModals';


export default function Notifications() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [assignModalData, setAssignModalData] = useState(null);

  useEffect(() => {
    if (isCS) {
      getAssignableEmployees().then(setEmployees).catch(console.error);
      getDepartments().then(setDepartments).catch(console.error);
    }
  }, [isCS]);


  const loadData = useCallback(async ({ source = 'manual' } = {}) => {
    if (source !== 'websocket' && source !== 'poll') {
      setLoading(true);
    }
    setError('');
    try {
      const data = await getNotifications();
      setNotifications(data.notifications || []);
      setShowRefreshBanner(false);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch notifications.');
    } finally {
      if (source !== 'websocket' && source !== 'poll') {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeRefresh({
    refresh: loadData,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 30000,
    deferRefresh: true,
    onRefreshAvailable: ({ source }) => {
      if (source === 'websocket') {
        setShowRefreshBanner(true);
      }
    },
  });

  const handleAction = async (requestId, ticketId, action, extraParams = {}) => {
    setActioningId(requestId);
    setError('');
    setSuccess('');
    try {
      await respondReassignment({ ticketId, action, ...extraParams });
      setSuccess(`Successfully ${action === 'approve' ? 'approved' : 'denied'} reassignment request.`);
      await loadData();
    } catch (err) {
      console.error(err);
      setError(`Failed to ${action} reassignment request.`);
    } finally {
      setActioningId(null);
    }
  };

  const handleAssignSave = async (updated) => {
    setError('');
    setSuccess('');
    try {
      const newEmpId = updated.assigned[0];
      if (!newEmpId) {
        window.alert('Please select at least one employee.');
        return false;
      }

      await respondReassignment({
        ticketId: updated.ticket_ID,
        action: 'approve',
        newEmployeeId: newEmpId,
      });

      setSuccess('Successfully approved reassignment and reassigned ticket.');
      setAssignModalData(null);
      await loadData();
      return true;
    } catch (err) {
      console.error(err);
      setError('Failed to approve and reassign ticket.');
      return false;
    }
  };


  const handleMarkAllRead = async () => {
    try {
      await markNotificationsRead();
      setSuccess('All notifications marked as read.');
      window.dispatchEvent(new Event('notifications:updated'));
      await loadData();
    } catch (err) {
      console.error(err);
      setError('Failed to mark notifications as read.');
    }
  };

  const handleMarkOneRead = async (id) => {
    try {
      await markNotificationRead(id);
      window.dispatchEvent(new Event('notifications:updated'));
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const getNotificationPath = (n) => {
    if (n.data) {
      try {
        const parsed = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
        if (parsed.link) {
          return parsed.link.startsWith('http') ? new URL(parsed.link).pathname : parsed.link;
        }
        // Handle specific notification types for employees
        const userStr = localStorage.getItem('user');
        let role = '';
        try { role = JSON.parse(userStr)?.role || ''; } catch {}
        if (role === 'employee' && parsed.type) {
          if (parsed.type === 'proof_uploaded' || parsed.type === 'proof_rejected') {
            return '/employee/machine';
          }
          if (parsed.type === 'ticket_assigned' || parsed.type === 'ticket_reassigned') {
            return '/employee/assigned';
          }
          if (parsed.type === 'reassignment_approved' || parsed.type === 'reassignment_denied') {
            return '/employee/assigned';
          }
          if (parsed.type === 'reassignment_request') {
            return '/cs/incoming';
          }
        }
      } catch { }
    }
    if (n.ticket_id) {
      const userStr = localStorage.getItem('user');
      let role = '';
      try { role = JSON.parse(userStr)?.role || ''; } catch {}
      if (role === 'customer') return '/my-tickets';
      if (role === 'employee') return '/employee/machine';
      if (role === 'cs') return '/cs/incoming';
      return '/notifications';
    }
    return null;
  };

  const handleNotificationClick = (n) => {
    if (!n.is_read) {
      handleMarkOneRead(n.id);
    }
    const path = getNotificationPath(n);
    if (path) {
      navigate(path, { state: { focusTicketId: n.ticket_id, openNotificationType: true } });
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-[#252578] tracking-tight">
            Notifications & Alerts
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Stay updated with real-time ticket status updates and remarks.
          </p>
        </div>
        {notifications.filter(n => !n.is_read).length > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors shrink-0 mb-1"
          >
            Mark all as read
          </button>
        )}
      </div>

      {showRefreshBanner && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div>
            <div className="font-semibold">Updates available</div>
            <div className="text-xs text-blue-700">New notifications or status updates are available.</div>
          </div>
          <button
            type="button"
            onClick={() => loadData({ forceRefresh: true })}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
          >
            Load latest
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-100 text-rose-800 p-4 text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="w-10 h-10 border-4 border-[#252578] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-semibold">Loading notifications...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* CS Reassignment Approval Panel */}
          {isCS && requests.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2">Pending Reassignment Requests</h2>
              <div className="space-y-4">
                {requests.map((req) => {
                  const isProcessing = actioningId === req.request_id;
                  return (
                    <div
                      key={req.request_id}
                      className="bg-white rounded-3xl border border-gray-100 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)] transition-shadow duration-300 animate-in fade-in zoom-in-95 duration-200"
                    >
                      <div className="space-y-3 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-[#252578] bg-blue-50 px-2.5 py-1 rounded-lg">
                            {req.id}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 border border-amber-200 text-amber-700 animate-pulse">
                            Reassignment Pending
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">
                            Requested on {new Date(req.requested_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900 truncate leading-snug">
                            {req.ticket_title}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5 font-medium">
                            Requested by: <strong className="text-gray-700">{req.employee_name}</strong>
                          </p>
                        </div>
                        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-800 space-y-1">
                          <p className="font-bold text-amber-900 uppercase tracking-wider text-[9px]">Reason for request:</p>
                          <p className="italic leading-relaxed font-semibold">&quot;{req.reason}&quot;</p>
                        </div>
                      </div>

                      <div className="flex sm:flex-row md:flex-col lg:flex-row gap-2 shrink-0 w-full md:w-auto">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={async () => {
                            const reason = window.prompt("Enter the reason for denying reassignment:");
                            if (reason === null) return; // cancelled
                            if (!reason.trim()) {
                              window.alert("A reason is required to deny reassignment.");
                              return;
                            }
                            await handleAction(req.request_id, req.ticket_id, 'deny', { reason: reason.trim() });
                          }}
                          className="flex-1 md:flex-none py-2.5 px-4 rounded-xl border border-rose-200 text-rose-700 font-bold hover:bg-rose-50 text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Deny Request
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={async () => {
                            setActioningId(req.request_id);
                            try {
                              const details = await getTicketDetails(req.ticket_id);
                              setAssignModalData(details);
                            } catch (err) {
                              console.error(err);
                              setError('Failed to load ticket details for assignment.');
                            } finally {
                              setActioningId(null);
                            }
                          }}
                          className="flex-1 md:flex-none py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actioningId === req.request_id ? 'Loading...' : 'Approve & Reassign'}
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unified General Notification Feed */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2">Recent Notifications</h2>
            {notifications.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-gray-100 text-gray-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800">All caught up!</h3>
                <p className="text-sm text-gray-500 mt-1">There are no recent notifications.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`bg-white rounded-3xl border border-gray-100 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-start gap-4 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-gray-200 transition-all duration-200 cursor-pointer animate-in fade-in duration-200 ${!n.is_read ? 'border-l-4 border-l-blue-600 pl-4' : ''}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${!n.is_read ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1 gap-4">
                        <h3 className="text-sm font-bold text-gray-900 leading-snug">{n.title}</h3>
                        <span className="text-[10px] text-gray-400 font-semibold whitespace-nowrap">{formatTimeAgo(n.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">{n.message}</p>
                      {n.ticket_id && (
                        <span className="inline-block text-[9px] font-extrabold text-[#252578] bg-blue-50 px-2 py-0.5 rounded-md mt-2">
                          TKT-{String(n.ticket_id).padStart(4, '0')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {assignModalData && (
        <AssignModal
          ticket={assignModalData}
          employees={employees}
          departments={departments}
          priorityOptions={['Low', 'Medium', 'High', 'Critical']}
          onClose={() => setAssignModalData(null)}
          onSave={handleAssignSave}
        />
      )}
    </div>
  );
}
