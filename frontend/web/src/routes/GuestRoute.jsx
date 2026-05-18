import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// Guest route
export default function GuestRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    if (location.pathname.startsWith('/login/employee')) {
      const role = (user?.role || '').toString().toLowerCase();
      if (role.includes('customer service') || role.includes('customer-service') || role === 'cs') {
        return <Navigate to="/cs/dashboard" replace />;
      }
      return <Navigate to="/employee/dashboard" replace />;
    }

    return <Navigate to="/customer-dashboard" replace />;
  }

  return children;
}
