import React from 'react';
import { Settings, History, ClipboardList } from 'lucide-react';
import SidebarBase from './SidebarBase';

export default function SidebarSuperAdmin({ collapsed }) {
  const navItems = [
    { name: 'Ticket Configuration', path: '/superadmin/ticket-config', icon: <Settings size={20} /> },
    { name: 'Audit Logs', path: '/superadmin/audit-logs', icon: <ClipboardList size={20} /> },
    { name: 'History', path: '/superadmin/history', icon: <History size={20} /> },
  ];

  return <SidebarBase navItems={navItems} collapsed={collapsed} />;
}
