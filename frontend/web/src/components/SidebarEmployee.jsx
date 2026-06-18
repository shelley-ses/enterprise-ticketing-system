import React from 'react';
import { LayoutDashboard, Inbox, UserCheck, TrendingUp, ClipboardList, Clock } from 'lucide-react';
import SidebarBase from './SidebarBase';

export default function SidebarEmployee({ collapsed }) {
  const navItems = [
    { name: 'Dashboard', path: '/employee/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Incoming', path: '/employee/incoming', icon: <Inbox size={20} /> },
    { name: 'Assigned', path: '/employee/assigned', icon: <UserCheck size={20} /> },
    { name: 'Progress', path: '/employee/machine', icon: <TrendingUp size={20} /> },
    { name: 'History', path: '/employee/progress', icon: <Clock size={20} /> },
  ];

  const bottomItems = [
    { name: 'My Tickets', path: '/employee/my-tickets', icon: <ClipboardList size={20} /> },
  ];

  return <SidebarBase navItems={navItems} bottomItems={bottomItems} collapsed={collapsed} />;
}
