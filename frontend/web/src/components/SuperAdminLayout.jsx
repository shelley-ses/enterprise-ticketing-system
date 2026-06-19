import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import SidebarSuperAdmin from './SidebarSuperAdmin';

export default function SuperAdminLayout() {
  const [sidebarHovered, setSidebarHovered] = useState(false);

  return (
    <div className="min-h-screen bg-[#f4f7fb] font-['Poppins'] flex flex-col">
      <Header sidebarHovered={sidebarHovered} />

      <SidebarSuperAdmin collapsed={true} onHoverChange={setSidebarHovered} />

      <main className={`pt-24 pb-8 px-6 lg:px-12 flex-1 transition-all duration-300 ${sidebarHovered ? 'ml-60' : 'ml-20'}`}>
        <div className="w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
