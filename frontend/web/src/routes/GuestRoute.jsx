import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// Guest route
const checkIsCS = (role = '') => {
  const r = role.toLowerCase();
  return r.includes('customer service') || r.includes('customer-service') || r === 'cs';
};

const checkIsEmployee = (role = '') => {
  const r = role.toLowerCase();
  if (checkIsCS(r)) return false;
  return r === 'employee' || r.includes('service') || r.includes('engineer');
};

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
    const role = (user?.role || 'customer').toString().toLowerCase();
    if (checkIsCS(role)) {
      return <Navigate to="/cs/dashboard" replace />;
    } else if (checkIsEmployee(role)) {
      return <Navigate to="/employee/dashboard" replace />;
    } else {
      return <Navigate to="/customer-dashboard" replace />;
    }
  }

  return children;
}
