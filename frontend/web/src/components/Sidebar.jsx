import React from 'react';
import { LayoutDashboard, ClipboardList, Clock, MessageCircle } from 'lucide-react';
import SidebarBase from './SidebarBase';

export default function Sidebar({ collapsed, onHoverChange }) {
  const navItems = [
    { name: 'Dashboard', path: '/customer-dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'My Tickets', path: '/my-tickets', icon: <ClipboardList size={20} /> },
    { name: 'Messages', path: '/messages', icon: <MessageCircle size={20} /> },
    { name: 'History', path: '/history', icon: <Clock size={20} /> },
  ];

  return <SidebarBase navItems={navItems} collapsed={collapsed} onHoverChange={onHoverChange} />;
}
