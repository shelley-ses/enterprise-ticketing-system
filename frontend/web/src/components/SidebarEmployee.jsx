import React from 'react';
import { LayoutDashboard, UserCheck, TrendingUp, ClipboardList, Clock } from 'lucide-react';
import SidebarBase from './SidebarBase';

export default function SidebarEmployee({ collapsed, onHoverChange }) {
  const navItems = [
    { name: 'Dashboard', path: '/employee/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Incoming', path: '/employee/assigned', icon: <UserCheck size={20} /> },
    { name: 'Assigned Ticket', path: '/employee/machine', icon: <TrendingUp size={20} /> },
    { name: 'History', path: '/employee/progress', icon: <Clock size={20} /> },
  ];

  const bottomItems = [
    { name: 'My Tickets', path: '/employee/my-tickets', icon: <ClipboardList size={20} /> },
  ];

  return <SidebarBase navItems={navItems} bottomItems={bottomItems} collapsed={collapsed} onHoverChange={onHoverChange} />;
}
