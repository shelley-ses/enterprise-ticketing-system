import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useAuth } from '@/context/AuthContext';
import ForceChangePasswordModal from './ForceChangePasswordModal';

export default function CustomerLayout() {
  const { isFirstLogin } = useAuth();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="min-h-screen bg-[#f4f7fb] font-['Poppins'] flex flex-col">
      <Header collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      
      <Sidebar collapsed={collapsed} />

      <main className={`pt-24 pb-8 px-6 lg:px-12 flex-1 transition-all duration-300 ${collapsed ? 'ml-20' : 'ml-60'}`}>
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {isFirstLogin && <ForceChangePasswordModal />}
    </div>
  );
}

