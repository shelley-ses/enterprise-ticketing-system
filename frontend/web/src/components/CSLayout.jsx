import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import SidebarCS from './SidebarCS';
import { CS_TICKET_REFRESH_EVENT } from '@/services/ticketService';
import { useAuth } from '@/context/AuthContext';
import ForceChangePasswordModal from './ForceChangePasswordModal';

export default function CSLayout() {
  const { isFirstLogin } = useAuth();
  const [sidebarHovered, setSidebarHovered] = useState(false);
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
      <Header sidebarHovered={sidebarHovered} />
      <SidebarCS collapsed={true} onHoverChange={setSidebarHovered} />

      <main className={`pt-24 pb-8 px-6 lg:px-12 flex-1 transition-all duration-300 ${sidebarHovered ? 'ml-60' : 'ml-20'}`}>
        <div className="max-w-7xl mx-auto">
          <Outlet context={{ refreshKey }} />
        </div>
      </main>

      {/* SKIPPED: {isFirstLogin && <ForceChangePasswordModal />} */}
    </div>
  );
}

