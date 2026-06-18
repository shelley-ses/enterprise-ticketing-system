import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import SidebarCS from './SidebarCS';
import { CS_TICKET_REFRESH_EVENT } from '@/services/ticketService';
import { useAuth } from '@/context/AuthContext';
import ForceChangePasswordModal from './ForceChangePasswordModal';

export default function CSLayout() {
  const { isFirstLogin } = useAuth();
  const [collapsed, setCollapsed] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handleTicketRefresh = () => {
      setRefreshKey((current) => current + 1);
    };

    window.addEventListener(CS_TICKET_REFRESH_EVENT, handleTicketRefresh);

    return () => {
      window.removeEventListener(CS_TICKET_REFRESH_EVENT, handleTicketRefresh);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f7fb] font-['Poppins'] flex flex-col">
      <Header collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <SidebarCS collapsed={collapsed} />

      <main className={`pt-24 pb-8 px-6 lg:px-12 flex-1 transition-all duration-300 ${collapsed ? 'ml-20' : 'ml-60'}`}>
        <div className="max-w-7xl mx-auto">
          <Outlet context={{ refreshKey }} />
        </div>
      </main>

      {isFirstLogin && <ForceChangePasswordModal />}
    </div>
  );
}

