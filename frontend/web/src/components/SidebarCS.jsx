import React from 'react';
import { LayoutDashboard, Inbox, UserCheck, ClipboardList, Clock, MessageCircle } from 'lucide-react';
import SidebarBase from './SidebarBase';

export default function SidebarCS({ collapsed, onHoverChange }) {
  const navItems = [
    { name: 'Dashboard', path: '/cs/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Incoming', path: '/cs/incoming', icon: <Inbox size={20} /> },
    { name: 'Assigned', path: '/cs/assigned', icon: <UserCheck size={20} /> },
    { name: 'History', path: '/cs/history', icon: <Clock size={20} /> },
  ];

  const bottomItems = [
    { name: 'My Tickets', path: '/cs/my-tickets', icon: <ClipboardList size={20} /> },
    { name: 'Messages', path: '/cs/messages', icon: <MessageCircle size={20} /> },
  ];

  return <SidebarBase navItems={navItems} bottomItems={bottomItems} collapsed={collapsed} onHoverChange={onHoverChange} />;
}
