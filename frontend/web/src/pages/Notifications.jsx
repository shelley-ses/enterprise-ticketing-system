import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
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
      if (role === 'customer') return '/my-tickets';
      if (role === 'employee') return '/employee/machine';
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
    const ticketId = n.ticket_id;
    if (!ticketId) {
      const path = getNotificationPath(n);
      if (path) navigate(path);
      return;
    }
    setActiveTicketLoading(true);
    setActiveNotificationId(n.id);
    try {
      const parsed = (() => { try { return typeof n.data === 'string' ? JSON.parse(n.data) : n.data || {}; } catch { return {}; } })();
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
      <div className="mb-6">
        <PageHeader
          pattern="B"
          title="Notifications & Alerts"
          subtitle="Stay updated with real-time ticket status updates and remarks."
          actions={
            notifications.filter(n => !n.is_read).length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-accent hover:text-accent"
              >
                Mark all as read
              </Button>
            ) : null
          }
        />
      </div>

      {success && (
        <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 p-4 text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle size={18} />
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
            <h2 className="text-lg font-bold text-slate-dark border-b border-border pb-2">Recent Notifications</h2>
            {notifications.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center shadow-xs">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-border text-slate-400">
                  <Bell size={28} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-dark">All caught up!</h3>
                <p className="text-sm text-slate-muted mt-1">There are no recent notifications.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`bg-card rounded-xl border border-border p-5 shadow-xs flex items-start gap-4 hover:border-slate-300 transition-all duration-200 cursor-pointer ${!n.is_read ? 'border-l-4 border-l-accent' : ''}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${!n.is_read ? 'bg-accent/10 text-accent' : 'bg-slate-100 text-slate-muted'}`}>
                      <Bell size={18} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1 gap-4">
                        <h3 className="text-sm font-bold text-slate-dark leading-snug">{n.title}</h3>
                        <span className="text-[10px] text-slate-muted font-semibold whitespace-nowrap">{formatDisplayDate(n.created_at)}</span>
                      </div>
                      <p className="text-xs text-slate-muted leading-relaxed font-medium">{n.message}</p>
                      {n.ticket_id && (
                        <span className="inline-block text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md mt-2">
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

      {activeTicket && (() => { const role = (()=>{ try{ return JSON.parse(localStorage.getItem('user')||'{}')?.role||'';}catch{return ''}})(); const isCSReassign = activeTicket.reassignmentRequested && role==='cs'; return isCSReassign ? (
        <TicketSummary ticket={activeTicket} employees={activeEmployees} onClose={handleCloseActiveTicket} onEdit={()=>{}} onStatusUpdate={async (upd)=>{ try{ if(upd.reassignmentStatus){ const nid=Number(String(activeTicket.ticket_ID||activeTicket.id).replace(/\D/g,'')); const act=upd.reassignmentStatus==='Approved'?'approve':'deny'; await respondReassignment({ticketId:nid, action:act}); } }catch(e){ console.warn(e);} }} />
      ) : (
        <CustomerTicketDetailModal ticket={activeTicket} onClose={handleCloseActiveTicket} onDiscard={null} onReopen={null} onResolve={null} allowReopen={false} customerName={activeTicket.customer} />
      );})()}

      {activeTicketLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px]">
          <div className="bg-card rounded-xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full mx-4 border border-border">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm font-semibold text-slate-dark">Loading ticket...</p>
          </div>
        </div>
      )}
    </div>
  );
}
