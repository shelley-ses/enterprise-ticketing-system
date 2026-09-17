import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, LogOut, User, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getNotifications, markNotificationRead, markNotificationsRead, getTicketDetails, getAssignableEmployees, getDepartments, respondReassignment } from '@/services/ticketService';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import CustomerTicketDetailModal from '@/components/CustomerTicketDetailModal';
import { TicketSummary } from '@/components/CSModals';

export default function Header({ sidebarHovered }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [activeNotificationId, setActiveNotificationId] = useState(null);
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [activeTicketLoading, setActiveTicketLoading] = useState(false);

  const basePath = location.pathname.startsWith('/cs')
    ? '/cs'
    : location.pathname.startsWith('/employee')
      ? '/employee'
      : location.pathname.startsWith('/superadmin')
        ? '/superadmin'
        : location.pathname.startsWith('/admin')
          ? '/admin'
          : '';

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setNotificationLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data.notifications || []);
      setNotificationCount(data.unread_count || 0);
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    } finally {
      setNotificationLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const handleNotificationsUpdated = () => {
      fetchNotifications();
    };
    window.addEventListener('notifications:updated', handleNotificationsUpdated);
    return () => {
      window.removeEventListener('notifications:updated', handleNotificationsUpdated);
    };
  }, [fetchNotifications]);

  useRealtimeRefresh({
    refresh: fetchNotifications,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 30000,
    deferRefresh: false,
  });

  const handleBellClick = () => {
    setNotificationDropdownOpen((prev) => {
      if (!prev) {
        fetchNotifications();
      }
      return !prev;
    });
  };

  const getNotificationPath = (n) => {
    if (n.data) {
      try {
        const parsed = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
        if (parsed.link) {
          return parsed.link.startsWith('http') ? new URL(parsed.link).pathname : parsed.link;
        }
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
      } catch {}
    }
    if (n.ticket_id) {
      const userStr = localStorage.getItem('user');
      let role = '';
      try { role = JSON.parse(userStr)?.role || ''; } catch {}
      if (role === 'customer') return '/my-tickets';
      if (role === 'employee') return '/employee/machine';
      if (role === 'cs') return '/cs/incoming';
      return `${basePath}/notifications`;
    }
    return `${basePath}/notifications`;
  };

  const handleCloseActiveTicket = useCallback(async () => {
    if (activeNotificationId) {
      const nid = activeNotificationId;
      setActiveNotificationId(null);
      setActiveTicket(null);
      try {
        await markNotificationRead(nid);
        setNotificationCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) => prev.map((item) => (item.id === nid ? { ...item, is_read: true, unread: false } : item)));
        window.dispatchEvent(new Event('notifications:updated'));
      } catch (err) {
        console.warn('Failed to mark notification as read on close:', err);
      }
    } else {
      setActiveTicket(null);
    }
  }, [activeNotificationId]);

  const handleNotificationClick = async (n) => {
    setNotificationDropdownOpen(false);
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

  const handleMarkAllRead = async () => {
    try {
      await markNotificationsRead();
      setNotificationCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, unread: false })));
      window.dispatchEvent(new Event('notifications:updated'));
    } catch (err) {
      console.warn('Failed to mark all as read:', err);
    }
  };

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogoutClick = () => {
    setDropdownOpen(false);
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      const isCustomer = user?.role === 'customer' || import.meta.env.VITE_APP_MODE === 'customer';
      await logout();
      const redirectUrl = isCustomer ? '/customer' : '/';
      window.location.replace(redirectUrl);
    } catch (err) {
      console.error('Logout failed:', err);
      setLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'U';

    return (
    <>
      <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-30 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="hidden sm:block w-20 shrink-0" aria-hidden="true" />

        <div className="flex items-center gap-6">
          <div className="relative flex items-center gap-3">
            <button
              data-notification-trigger="true"
              onClick={handleBellClick}
              className="relative p-2 text-[#252578] hover:bg-gray-100 rounded-full transition-colors"
              aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ''}`}
              aria-expanded={notificationDropdownOpen}
            >
              <Bell size={20} />
              {notificationCount > 0 && (
                <span className="absolute top-0 right-0 min-w-[1.25rem] h-5 px-1 bg-red-500 text-white rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                  {notificationCount}
                </span>
              )}
            </button>

            {notificationDropdownOpen && (
              <NotificationDropdown
                notifications={notifications}
                loading={notificationLoading}
                unreadCount={notificationCount}
                basePath={basePath}
                onNotificationClick={handleNotificationClick}
                onMarkAllRead={notificationCount > 0 ? handleMarkAllRead : null}
                onClose={() => setNotificationDropdownOpen(false)}
              />
            )}

            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#252578] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                {userInitial}
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-sm font-medium text-[#252578]">{user?.name || 'User'}</span>
                <span className="text-xs text-gray-500 capitalize">{user?.role || ''}</span>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-50">
                  <button
                    onClick={() => { setDropdownOpen(false); navigate(`${basePath}/profile`); }}
                    className="flex items-center w-full px-4 py-2.5 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <User size={16} className="mr-2.5" /> My Profile
                  </button>
                  {import.meta.env.VITE_APP_MODE !== 'customer' && (
                    <button
                      onClick={() => window.location.href = '/'}
                      className="flex items-center w-full px-4 py-2.5 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors cursor-pointer"
                    >
                      <Home size={16} className="mr-2.5" /> Home
                    </button>
                  )}
                  <div className="h-px bg-gray-100 my-1" />
                  <button
                    onClick={handleLogoutClick}
                    className="flex items-center w-full px-4 py-2.5 hover:bg-red-50 text-red-600 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <LogOut size={16} className="mr-2.5" /> Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {activeTicket && activeTicket.reassignmentRequested && (user?.role === 'cs' || (() => { try { return JSON.parse(localStorage.getItem('user')||'{}')?.role === 'cs'; } catch { return false; } })()) ? (
        <TicketSummary
          ticket={activeTicket}
          employees={activeEmployees}
          onClose={handleCloseActiveTicket}
          onEdit={() => {}}
          onStatusUpdate={async (updatedFields) => {
            try {
              if (updatedFields.reassignmentStatus) {
                const numericId = Number(String(activeTicket.ticket_ID || activeTicket.id).replace(/\D/g, ''));
                const action = updatedFields.reassignmentStatus === 'Approved' ? 'approve' : 'deny';
                await respondReassignment({ ticketId: numericId, action });
              }
            } catch (e) { console.warn(e); }
          }}
        />
      ) : activeTicket ? (
        <CustomerTicketDetailModal
          ticket={activeTicket}
          onClose={handleCloseActiveTicket}
          onDiscard={null}
          onReopen={null}
          onResolve={null}
          allowReopen={false}
          customerName={activeTicket.customer}
        />
      ) : null}

      {activeTicketLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px]">
          <div className="bg-white rounded-xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full mx-4 border border-gray-100">
            <div className="w-10 h-10 border-4 border-[#252578]/10 border-t-[#252578] rounded-full animate-spin" />
            <p className="text-sm font-semibold text-[#252578]">Loading ticket...</p>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 flex flex-col gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <LogOut size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Confirm Logout</h3>
              <p className="text-sm text-gray-500 mt-1">
                Are you sure you want to log out of your account?
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={loggingOut}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                disabled={loggingOut}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {loggingOut ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Logging out...
                  </>
                ) : (
                  'Logout'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

