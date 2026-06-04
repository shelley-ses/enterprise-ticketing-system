import React from 'react';
import { NavLink } from 'react-router-dom';
import dashIcon from '@/assets/cs-dashboard.png';
import incomingIcon from '@/assets/cs-incomingtix.png';
import assignedIcon from '@/assets/cs-assignedtix.png';
import analyticsIcon from '@/assets/cs-analytics.png';
import ticketIcon from '@/assets/ticket.png';

export default function SidebarCS() {
  const navItems = [
    { name: 'Dashboard', path: '/cs/dashboard', icon: dashIcon },
    { name: 'Incoming', path: '/cs/incoming', icon: incomingIcon },
    { name: 'Assigned', path: '/cs/assigned', icon: assignedIcon },
    { name: 'My Tickets', path: '/cs/my-tickets', icon: ticketIcon },
    { name: 'Analytics', path: '/cs/analytics', icon: analyticsIcon },
  ];

  return (
    <aside className="sticky top-0 h-screen w-[88px] hover:w-64 bg-[#252578] text-white transition-all duration-300 ease-in-out rounded-3xl shadow-[0_8px_30px_rgba(37,37,120,0.2)] flex flex-col overflow-hidden group">
      <nav className="flex flex-col gap-4 mt-24 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-4 px-5 py-3 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'bg-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                  : 'hover:bg-white/10'
              } w-full`
            }
          >
            <img src={item.icon} alt={item.name} className="w-6 h-6 object-contain filter brightness-0 invert flex-shrink-0" />
            <span className="font-semibold text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
