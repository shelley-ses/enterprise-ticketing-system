import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import tokenStore from '@/auth/tokenStore';

// ─── Role helpers ─────────────────────────────────────────────────────────────
export const checkIsCS = (user) => {
  if (!user) return false;
  const dept = (user.department || user.profile?.department?.name || '').toLowerCase();
  const role = (user.role || user.profile?.role?.name || '').toLowerCase();
  if (dept.includes('customer service') || dept.includes('customer support') || dept === 'cs') return true;
  return role.includes('customer service') || role.includes('customer-service') || role === 'cs';
};

export const checkIsEmployee = (user) => {
  if (!user) return false;
  if (checkIsCS(user)) return false;
  const dept = (user.department || user.profile?.department?.name || '').toLowerCase();
  const role = (user.role || user.profile?.role?.name || '').toLowerCase();
  if (dept === 'service' || dept.includes('engineer')) return true;
  return role === 'employee' || role.includes('service') || role.includes('engineer');
};

// ─── Wrong Portal page ────────────────────────────────────────────────────────
function WrongPortal() {
  const { logout } = useAuth();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Wrong Portal</h1>
        <p className="text-gray-500 mb-6">
          This portal is for <strong>customers only</strong>.<br />
          Employees and Customer Service agents must log in through the main company portal.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="http://localhost:5173"
            className="inline-block px-6 py-3 bg-[#252578] text-white rounded-lg font-medium hover:bg-[#1a1a5e] transition-colors"
          >
            Go to Employee Portal
          </a>
          <button
            onClick={logout}
            className="inline-block px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Log Out & Switch User
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Private Route ────────────────────────────────────────────────────────────
// isCustomerSite: true when running as the customer-only container (port 5006)
const isCustomerSite = import.meta.env.VITE_APP_MODE === 'customer';

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

  // Not authenticated
  if (!isAuthenticated) {
    if (isCustomerSite) {
      // Customer portal: always go to /customer login
      return <Navigate to="/customer" replace state={{ from: location }} />;
    } else {
      // Employee/CS portal: redirect to auth-module root
      if (typeof window !== 'undefined') window.location.href = '/';
      return null;
    }
  }

  // Authenticated — check roles
  const isCS       = checkIsCS(user);
  const isEmployee = checkIsEmployee(user);
  const isCustomer = !isCS && !isEmployee;

  // ── Customer portal (port 5006) ──────────────────────────────────────────
  if (isCustomerSite) {
    // Only customers are allowed here
    if (!isCustomer) return <WrongPortal />;
    // Customers can access any customer route — fall through to render
  } else {
    // ── Employee/CS portal (port 5173/5005) ─────────────────────────────────
    if (isCustomer) {
      return <WrongPortal />;
    }

    // Role-specific route authorization
    if (role) {
      const normalizedRole = role.toLowerCase();
      if (normalizedRole === 'customer') {
        if (isCS)       return <Navigate to="/cs/dashboard" replace />;
        if (isEmployee) return <Navigate to="/employee/dashboard" replace />;
      }
      if (normalizedRole === 'employee' && !isEmployee) {
        return <Navigate to="/cs/dashboard" replace />;
      }
      if (
        (normalizedRole === 'cs' ||
          normalizedRole === 'customer service' ||
          normalizedRole === 'customer-service') &&
        !isCS
      ) {
        return <Navigate to="/employee/dashboard" replace />;
      }
    }
  }

  return children;
}
