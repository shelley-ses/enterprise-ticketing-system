import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import SidebarEmployee from './SidebarEmployee';
import { useAuth } from '@/context/AuthContext';
import ForceChangePasswordModal from './ForceChangePasswordModal';

export default function EmployeeLayout() {
  const { isFirstLogin } = useAuth();

  return (
    <div className="min-h-screen bg-[#f4f7fb] font-['Poppins'] flex flex-col">
      <Header />
      <div className="flex flex-1 gap-6 pt-24 pb-8 px-6 lg:px-12">
        <div className="w-[88px] hover:w-64 flex-shrink-0 z-20 transition-all duration-300 ease-in-out">
          <SidebarEmployee />
        </div>
        <main className="flex-1 min-w-0">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {isFirstLogin && <ForceChangePasswordModal />}
    </div>
  );
}

