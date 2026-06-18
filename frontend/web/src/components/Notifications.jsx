import React from 'react';
import { useNavigate } from 'react-router-dom';

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

export default function Notifications({ notifications = [] }) {
  const navigate = useNavigate();
  const unreadCount = notifications.filter(n => {
    if (n.unread !== undefined) return n.unread;
    return !n.is_read;
  }).length;

  const handleNotificationClick = (n) => {
    let path = null;
    if (n.data) {
      try {
        const parsed = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
        if (parsed.link) {
          const url = new URL(parsed.link);
          path = url.pathname;
        }
      } catch { }
    }
    if (!path && n.ticket_id) {
      path = `/tickets/${n.ticket_id}`;
    }
    if (path) {
      navigate(path);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Notifications</h2>
            <p className="text-xs text-gray-500">Recent Updates</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <div className="bg-blue-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
            {unreadCount}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {notifications.length > 0 ? (
          notifications.map((notification, idx) => {
            const title = notification.title;
            const description = notification.message || notification.desc;
            const time = formatTimeAgo(notification.created_at) || notification.time;
            const isUnread = notification.unread !== undefined ? notification.unread : !notification.is_read;

            return (
              <div key={idx} onClick={() => handleNotificationClick(notification)} className="flex gap-3 p-4 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer border border-transparent hover:border-gray-200">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isUnread ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-sm font-bold text-gray-800 truncate leading-snug">{title}</h3>
                    <span className="text-xs font-medium text-gray-400 whitespace-nowrap ml-2">{time}</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed font-semibold">{description}</p>
                </div>
                {isUnread && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
