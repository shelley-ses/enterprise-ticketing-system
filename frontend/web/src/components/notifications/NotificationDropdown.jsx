import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationItem from './NotificationItem';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';

export default function NotificationDropdown({
  notifications = [],
  loading = false,
  unreadCount = 0,
  basePath = '',
  onNotificationClick,
  onMarkAllRead,
  onClose,
}) {
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleViewAll = () => {
    onClose();
    navigate(`${basePath}/notifications`);
  };

  const handleItemClick = (notification) => {
    onNotificationClick(notification);
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-[22rem] sm:w-96 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 animate-fade-slide-in overflow-hidden"
      role="menu"
      aria-label="Notifications"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-gray-800">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && onMarkAllRead && (
          <button
            onClick={onMarkAllRead}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-[440px] overflow-y-auto overscroll-contain">
        {loading ? (
          <LoadingState />
        ) : notifications.length === 0 ? (
          <EmptyState />
        ) : (
          notifications.map((n, idx) => (
            <NotificationItem
              key={n.id || idx}
              notification={n}
              onClick={handleItemClick}
              isLast={idx === notifications.length - 1}
            />
          ))
        )}
      </div>

      <div className="border-t border-gray-100 px-4 py-2.5">
        <button
          onClick={handleViewAll}
          className="w-full text-center text-xs font-bold text-gray-600 hover:text-[#252578] transition-colors py-1"
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}
