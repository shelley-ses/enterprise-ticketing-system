import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import tokenStore from '@/auth/tokenStore';

// Private Route

const checkIsCS = (role = '') => {
  const r = role.toLowerCase();
  return r.includes('customer service') || r.includes('customer-service') || r === 'cs';
};

const checkIsEmployee = (role = '') => {
  const r = role.toLowerCase();
  if (checkIsCS(r)) return false;
  return r === 'employee' || r.includes('service') || r.includes('engineer');
};

export default function PrivateRoute({ children, role }) {
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

  if (!isAuthenticated || !tokenStore.getToken()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role) {
    const userRole = (user?.role || 'customer').toString().toLowerCase();
    const normalizedRole = role.toLowerCase();

    if (normalizedRole === 'employee') {
      const isEmployee = checkIsEmployee(userRole);
      if (!isEmployee) {
        const isCS = checkIsCS(userRole);
        return <Navigate to={isCS ? '/cs/dashboard' : '/customer-dashboard'} replace />;
      }
    } else if (normalizedRole === 'customer service' || normalizedRole === 'customer-service' || normalizedRole === 'cs') {
      const isCS = checkIsCS(userRole);
      if (!isCS) {
        const isEmployee = checkIsEmployee(userRole);
        return <Navigate to={isEmployee ? '/employee/dashboard' : '/customer-dashboard'} replace />;
      }
    } else if (normalizedRole === 'customer') {
      const isCustomer = !checkIsCS(userRole) && !checkIsEmployee(userRole);
      if (!isCustomer) {
        const isEmployee = checkIsEmployee(userRole);
        return <Navigate to={isEmployee ? '/employee/dashboard' : '/cs/dashboard'} replace />;
      }
    }
  }

  return children;
}
