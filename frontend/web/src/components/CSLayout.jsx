import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import SidebarCS from './SidebarCS';
import { CS_TICKET_REFRESH_EVENT } from '@/services/ticketService';

export default function CSLayout() {
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
      <Header />
      <div className="flex flex-1 gap-6 pt-24 pb-8 px-6 lg:px-12">
        <div className="w-[88px] flex-shrink-0 z-20">
          <SidebarCS />
        </div>

        <main className="flex-1 min-w-0">
          <div className="max-w-7xl mx-auto">
            <Outlet context={{ refreshKey }} />
          </div>
        </main>
      </div>
    </div>
  );
}
