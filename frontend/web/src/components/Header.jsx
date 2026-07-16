import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, LogOut, User, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getNotifications, markNotificationRead, markNotificationsRead } from '@/services/ticketService';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';

export default function Header({ sidebarHovered }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);

  const basePath = location.pathname.startsWith('/cs')
    ? '/cs'
    : location.pathname.startsWith('/employee')
      ? '/employee'
      : location.pathname.startsWith('/superadmin')
        ? '/superadmin'
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

  const handleNotificationClick = async (n) => {
    const isUnread = n.unread !== undefined ? n.unread : !n.is_read;
    if (isUnread) {
      try {
        await markNotificationRead(n.id);
        setNotificationCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true, unread: false } : item))
        );
        window.dispatchEvent(new Event('notifications:updated'));
      } catch (err) {
        console.warn('Failed to mark notification as read:', err);
      }
    }
    setNotificationDropdownOpen(false);
    const path = getNotificationPath(n);
    if (path) {
      navigate(path, { state: { focusTicketId: n.ticket_id, openNotificationType: true } });
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

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    if (import.meta.env.VITE_APP_MODE === 'customer') {
      window.location.href = '/customer-service/';
    } else {
      window.location.href = '/';
    }
  };

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className={`transition-all duration-300 ${sidebarHovered ? 'ml-60' : 'ml-20'}`} />

      <div className="flex items-center gap-6">
        <div className="relative flex items-center gap-3">
          <button
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
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotificationDropdownOpen(false)} />
              <NotificationDropdown
                notifications={notifications}
                loading={notificationLoading}
                unreadCount={notificationCount}
                basePath={basePath}
                onNotificationClick={handleNotificationClick}
                onMarkAllRead={notificationCount > 0 ? handleMarkAllRead : null}
                onClose={() => setNotificationDropdownOpen(false)}
              />
            </>
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
                  className="flex items-center w-full px-4 py-2.5 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                >
                  <User size={16} className="mr-2.5" /> My Profile
                </button>
                {import.meta.env.VITE_APP_MODE !== 'customer' && (
                  <button
                    onClick={() => window.location.href = '/'}
                    className="flex items-center w-full px-4 py-2.5 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                  >
                    <Home size={16} className="mr-2.5" /> Home
                  </button>
                )}
                <div className="h-px bg-gray-100 my-1" />
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-2.5 hover:bg-red-50 text-red-600 text-sm font-medium transition-colors"
                >
                  <LogOut size={16} className="mr-2.5" /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
