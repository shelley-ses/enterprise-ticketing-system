import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, LogOut, User, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getNotifications } from '@/services/ticketService';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';

export default function Header({ sidebarHovered }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);

  const basePath = location.pathname.startsWith('/cs')
    ? '/cs'
    : location.pathname.startsWith('/employee')
      ? '/employee'
      : '';

  const fetchNotificationCount = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getNotifications();
      setNotificationCount(data.unread_count || 0);
    } catch (err) {
      console.warn('Failed to fetch notifications count:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchNotificationCount();
  }, [fetchNotificationCount]);

  useEffect(() => {
    const handleNotificationsUpdated = () => {
      fetchNotificationCount();
    };
    window.addEventListener('notifications:updated', handleNotificationsUpdated);
    return () => {
      window.removeEventListener('notifications:updated', handleNotificationsUpdated);
    };
  }, [fetchNotificationCount]);

  useRealtimeRefresh({
    refresh: fetchNotificationCount,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 30000,
    deferRefresh: false,
  });

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
            onClick={() => navigate(`${basePath}/notifications`)}
            className="relative p-2 text-[#252578] hover:bg-gray-100 rounded-full transition-colors"
          >
            <Bell size={20} />
            {notificationCount > 0 && (
              <span className="absolute top-0 right-0 min-w-[1.25rem] h-5 px-1 bg-red-500 text-white rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                {notificationCount}
              </span>
            )}
          </button>

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
