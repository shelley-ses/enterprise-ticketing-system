import React from 'react';
import { LayoutDashboard, ClipboardList, AlertTriangle, MessageCircle, Clock } from 'lucide-react';
import SidebarBase from './SidebarBase';

export default function SidebarITManager({ collapsed, onHoverChange }) {
  const navItems = [
    { name: 'SLA Overview', path: '/it-manager/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'IT Ticket Queue', path: '/it-manager/tickets', icon: <ClipboardList size={20} /> },
    { name: 'Breached SLA', path: '/it-manager/breached', icon: <AlertTriangle size={20} /> },
  ];

  const bottomItems = [
    { name: 'Messages', path: '/it-manager/messages', icon: <MessageCircle size={20} /> },
  ];

  return (
    <SidebarBase
      navItems={navItems}
      bottomItems={bottomItems}
      collapsed={collapsed}
      onHoverChange={onHoverChange}
    />
  );
}

