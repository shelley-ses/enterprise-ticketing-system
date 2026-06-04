import React from 'react';
import { NavLink } from 'react-router-dom';
import dashIcon from '@/assets/cs-dashboard.png';
import incomingIcon from '@/assets/cs-incomingtix.png';
import assignedTixIcon from '@/assets/cs-assignedtix.png';
import progressIcon from '@/assets/progress.png';
import registrationIcon from '@/assets/registration.png';
import ticketIcon from '@/assets/ticket.png';

export default function SidebarEmployee() {
  const navItems = [
    { name: 'Dashboard', path: '/employee/dashboard', icon: dashIcon },
    { name: 'Assigned', path: '/employee/assigned', icon: incomingIcon },
    { name: 'Progress', path: '/employee/machine', icon: assignedTixIcon },
    { name: 'My Tickets', path: '/employee/my-tickets', icon: ticketIcon },
    { name: 'History', path: '/employee/progress', icon: progressIcon },
    { name: 'Registration', path: '/employee/registration', icon: registrationIcon },
  ];

  return (
    <aside className="sticky top-0 h-screen w-[88px] hover:w-64 bg-[#252578] text-white transition-all duration-300 ease-in-out rounded-3xl shadow-[0_8px_30px_rgba(37,37,120,0.2)] flex flex-col overflow-hidden group">
      <nav className="flex flex-col gap-4 mt-24 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            state={item.state}
            className={({ isActive }) =>
              `flex items-center gap-4 px-5 py-3 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'bg-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                  : 'hover:bg-white/10'
              } w-full`
            }
          >
            <img src={item.icon} alt="" className="w-6 h-6 object-contain filter brightness-0 invert flex-shrink-0" />
            <span className="font-semibold text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
