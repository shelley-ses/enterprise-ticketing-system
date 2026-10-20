import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import SidebarEmployee from './SidebarEmployee';
import { useAuth } from '@/context/AuthContext';
import ForceChangePasswordModal from './ForceChangePasswordModal';
import MaintenanceGate from './MaintenanceGate';

export default function EmployeeLayout() {
  const { isFirstLogin } = useAuth();
  const [sidebarHovered, setSidebarHovered] = useState(false);

  return (
    <div className="min-h-screen bg-page font-sans flex flex-col text-dark-slate">
      <Header sidebarHovered={sidebarHovered} />
      <SidebarEmployee collapsed={true} onHoverChange={setSidebarHovered} />

      <main className="pt-24 pb-8 px-6 lg:px-12 flex-1 sm:ml-20 ml-0">
        <div className="max-w-7xl mx-auto">
          <MaintenanceGate>
            <Outlet />
          </MaintenanceGate>
        </div>
      </main>

      {/* SKIPPED: {isFirstLogin && <ForceChangePasswordModal />} */}
    </div>
  );
}

