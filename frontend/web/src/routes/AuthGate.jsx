import React from 'react';
import { useAuth } from '@/context/AuthContext';
import ForceChangePasswordModal from '@/components/ForceChangePasswordModal';

export default function AuthGate({ children }) {
  const { isAuthenticated, isFirstLogin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          <p className="mt-4 text-slate-600 dark:text-slate-400 font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && isFirstLogin) {
    return <ForceChangePasswordModal />;
  }

  return children;
}
