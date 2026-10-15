import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markNotificationsRead,
  markNotificationRead,
  getTicketDetails,
  getAssignableEmployees,
} from '@/services/ticketService';
import { useAuth } from '@/context/AuthContext';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import SkeletonLoader from '@/components/SkeletonLoader';
import { formatDisplayDate } from '@/utils/dateUtils';
import CustomerTicketDetailModal from '@/components/CustomerTicketDetailModal';
import { TicketSummary } from '@/components/CSModals';
import { respondReassignment } from '@/services/ticketService';
import { Clock, ShieldAlert } from 'lucide-react';
import SecurityIncidentModal from '@/components/security/SecurityIncidentModal';

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTicket, setActiveTicket] = useState(null);
  const [activeNotificationId, setActiveNotificationId] = useState(null);
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [activeTicketLoading, setActiveTicketLoading] = useState(false);
  const [activeSecurityIncident, setActiveSecurityIncident] = useState(null);



  const loadData = useCallback(async ({ source = 'manual' } = {}) => {
    if (source !== 'websocket' && source !== 'poll') {
      setLoading(true);
    }
    setError('');
    try {

      const data = await getNotifications();
      setNotifications(data.notifications || []);
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
  });


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
      const isAutoClose = /auto-close|auto close|inactivity/i.test((n.title || '') + ' ' + (n.message || ''));
      if (role === 'customer') return '/my-tickets';
      if (role === 'employee') return isAutoClose ? `/employee/history/${n.ticket_id}` : '/employee/machine';
      if (role === 'cs') return '/cs/incoming';
      return '/notifications';
    }
    return null;
  };

  const handleCloseActiveTicket = useCallback(async () => {
    if (activeNotificationId) {
      const nid = activeNotificationId;
      setActiveNotificationId(null);
      setActiveTicket(null);
      try {
        await markNotificationRead(nid);
        window.dispatchEvent(new Event('notifications:updated'));
        await loadData();
      } catch (err) {
        console.warn('Failed to mark notification as read on close:', err);
      }
    } else {
      setActiveTicket(null);
    }
  }, [activeNotificationId, loadData]);

  const handleNotificationClick = async (n) => {
    const parsedData = (() => {
      try { return typeof n.data === 'string' ? JSON.parse(n.data) : n.data || {}; } catch { return {}; }
    })();

    const isSecurityAlert = Boolean(
      parsedData.alert_type === 'security_alert' ||
      parsedData.event === 'malware_detected' ||
      /security alert|malware/i.test(n.title || '') ||
      /malware|quarantine/i.test(n.message || '')
    );

    if (isSecurityAlert) {
      if (!n.is_read) {
        handleMarkOneRead(n.id);
      }
      setActiveSecurityIncident({ ...n, data: parsedData });
      return;
    }

    const ticketId = n.ticket_id;
    if (!ticketId) {
      const path = getNotificationPath(n);
      if (path) navigate(path);
      return;
    }
    setActiveTicketLoading(true);
    setActiveNotificationId(n.id);
    try {
      const parsed = parsedData;
      const ticketNum = Number(String(ticketId).replace(/\D/g, ''));
      const full = await getTicketDetails(ticketNum).catch(() => null);
      const base = full || { id: `TKT-${String(ticketId).padStart(4, '0')}`, ticket_ID: ticketId, title: n.title, description: n.message, status: 'Open', priority: 'Medium', customer: '—', timeline: [{ id: 'creation', type: 'system', text: n.message, timestamp: n.created_at }] };
      const isReassignDenied = parsed.type === 'reassignment_denied' ||
        parsed.type === 'reassignment_rejected' ||
        /reassign.*(reject|deni|disapprov)/i.test(n.title || '') ||
        /reassign.*(reject|deni|disapprov)/i.test(n.message || '');

      const csrDenyReason = (isReassignDenied ? (parsed.reason || parsed.reassignmentDenyReason || parsed.denialReason) : '') ||
        (() => {
          if (!isReassignDenied) return '';
          const match = (n.message || '').match(/Reason:\s*"([^"]+)"/i) || (n.message || '').match(/Reason:\s*([^.]+)/i);
          return match && match[1] ? match[1].trim() : '';
        })();

      const merged = {
        ...base,
        id: base.id || `TKT-${String(ticketId).padStart(4, '0')}`,
        ticket_ID: base.ticket_ID || ticketId,
        reassignmentReason: isReassignDenied
          ? (base.reassignmentReason || '')
          : (base.reassignmentReason || parsed.reason || parsed.reassignmentReason || ''),
        reassignmentRequested: isReassignDenied
          ? false
          : (base.reassignmentRequested ?? (parsed.type === 'reassignment_request')),
        reassignmentRequestedBy: base.reassignmentRequestedBy ?? parsed.requested_by,
        reassignmentStatus: isReassignDenied ? 'Denied' : base.reassignmentStatus,
        reassignmentDenied: isReassignDenied || base.reassignmentDenied,
        reassignmentDisapproved: isReassignDenied || base.reassignmentDisapproved,
        deniedReassignment: isReassignDenied || base.deniedReassignment,
        reassignmentDenyReason: csrDenyReason || base.reassignmentDenyReason || base.disapprovalReason || '',
        disapprovalReason: csrDenyReason || base.disapprovalReason || base.reassignmentDenyReason || '',
        notificationMessage: n.message,
        notificationTitle: n.title,
        notificationData: parsed,
      };
      if (merged.reassignmentRequested) {
        try {
          const emps = await getAssignableEmployees({ forceRefresh: false }).catch(() => []);
          setActiveEmployees(emps.map((row) => ({ id: Number(row.id ?? row.emp_id), name: row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email, status: row.is_active ? 'active' : 'inactive', department: row.department?.trim() || 'Unassigned' })));
        } catch {}
      }
      setActiveTicket(merged);
    } catch (err) {
      console.warn('Failed to load ticket for notification:', err);
      const path = getNotificationPath(n);
      if (path) navigate(path, { state: { focusTicketId: ticketId } });
      setActiveNotificationId(null);
    } finally {
      setActiveTicketLoading(false);
    }
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
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleMarkAllRead();
            }}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors shrink-0 mb-1 cursor-pointer"
          >
            Mark all as read
          </button>
        )}
      </div>



      {success && (
        <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 p-4 text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <SkeletonLoader variant="ticket-card" />
          <SkeletonLoader variant="ticket-card" />
          <SkeletonLoader variant="ticket-card" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Unified General Notification Feed */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2">Recent Notifications</h2>
            {notifications.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
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
                {notifications.map((n) => {
                  const parsedData = (() => {
                    try { return typeof n.data === 'string' ? JSON.parse(n.data) : n.data || {}; } catch { return {}; }
                  })();
                  const isSecurityAlert = Boolean(
                    parsedData.alert_type === 'security_alert' ||
                    parsedData.event === 'malware_detected' ||
                    /security alert|malware/i.test(n.title || '') ||
                    /malware|quarantine/i.test(n.message || '')
                  );
                  const isAutoClose = !isSecurityAlert && /auto-close|auto close|inactivity/i.test((n.title || '') + ' ' + (n.message || ''));

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`bg-white rounded-3xl border p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-start gap-4 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-200 cursor-pointer animate-in fade-in duration-200 ${
                        isSecurityAlert
                          ? 'border-rose-200 bg-rose-50/20 hover:border-rose-300 hover:bg-rose-50/30 ' + (!n.is_read ? 'border-l-4 border-l-rose-600 pl-4' : 'border-l-4 border-l-rose-300 pl-4')
                          : isAutoClose
                            ? 'border-amber-200 bg-amber-50/15 ' + (!n.is_read ? 'border-l-4 border-l-blue-600 pl-4' : '')
                            : 'border-gray-100 hover:border-gray-200 ' + (!n.is_read ? 'border-l-4 border-l-blue-600 pl-4' : '')
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isSecurityAlert
                          ? 'bg-rose-100 text-rose-700'
                          : isAutoClose
                            ? 'bg-amber-100 text-amber-700'
                            : !n.is_read ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {isSecurityAlert ? (
                          <ShieldAlert size={20} className="text-rose-600" />
                        ) : isAutoClose ? (
                          <Clock size={18} />
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1 gap-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`text-sm font-bold leading-snug ${isSecurityAlert ? 'text-rose-950 font-black' : 'text-gray-900'}`}>{n.title}</h3>
                            {isSecurityAlert && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping inline-block" />
                                Security Alert
                              </span>
                            )}
                            {isAutoClose && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                Auto-Close Notice
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 font-semibold whitespace-nowrap">{formatDisplayDate(n.created_at)}</span>
                        </div>
                        <p className={`text-xs leading-relaxed font-medium ${isSecurityAlert ? 'text-rose-900 font-semibold' : 'text-gray-600'}`}>{n.message}</p>
                        {n.ticket_id && (
                          <span className="inline-block text-[9px] font-extrabold text-[#252578] bg-blue-50 px-2 py-0.5 rounded-md mt-2">
                            TKT-{String(n.ticket_id).padStart(4, '0')}
                          </span>
                        )}
                        {isSecurityAlert && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 hover:text-rose-900 mt-2 hover:underline">
                            Inspect Incident Details →
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTicket && (() => { const role = (()=>{ try{ return JSON.parse(localStorage.getItem('user')||'{}')?.role||'';}catch{return ''}})(); const isCSReassign = activeTicket.reassignmentRequested && role==='cs'; return isCSReassign ? (
        <TicketSummary ticket={activeTicket} employees={activeEmployees} onClose={handleCloseActiveTicket} onEdit={()=>{}} onStatusUpdate={async (upd)=>{ try{ if(upd.reassignmentStatus){ const nid=Number(String(activeTicket.ticket_ID||activeTicket.id).replace(/\D/g,'')); const act=upd.reassignmentStatus==='Approved'?'approve':'deny'; await respondReassignment({ticketId:nid, action:act}); } }catch(e){ console.warn(e);} }} />
      ) : (
        <CustomerTicketDetailModal ticket={activeTicket} onClose={handleCloseActiveTicket} onDiscard={null} onReopen={null} onResolve={null} allowReopen={false} customerName={activeTicket.customer} />
      );})()}

      {activeSecurityIncident && (
        <SecurityIncidentModal
          incident={activeSecurityIncident}
          onClose={() => setActiveSecurityIncident(null)}
          onNavigateAuditLogs={() => {
            setActiveSecurityIncident(null);
            navigate('/superadmin/audit-logs');
          }}
        />
      )}

      {activeTicketLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px]">
          <div className="bg-white rounded-xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full mx-4 border border-gray-100">
            <div className="w-10 h-10 border-4 border-[#252578]/10 border-t-[#252578] rounded-full animate-spin" />
            <p className="text-sm font-semibold text-[#252578]">Loading ticket...</p>
          </div>
        </div>
      )}
    </div>
  );
}
