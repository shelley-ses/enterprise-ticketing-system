import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// ─── Role helpers (shared) ────────────────────────────────────────────────────
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
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Wrong Portal</h1>
        <p className="text-gray-500 mb-6">
          This portal is for <strong>customers only</strong>.<br />
          Employees and Customer Service agents must log in through the main company portal.
        </p>
        <a
          href="http://localhost:5173"
          className="inline-block px-6 py-3 bg-[#252578] text-white rounded-lg font-medium hover:bg-[#1a1a5e] transition-colors"
        >
          Go to Employee Portal
        </a>
      </div>
    </div>
  );
}

// ─── Guest Route ──────────────────────────────────────────────────────────────
// isCustomerSite: true when running as the customer-only container (port 5006)
const isCustomerSite = import.meta.env.VITE_APP_MODE === 'customer';

export default function GuestRoute({ children }) {
  const { isAuthenticated, isLoading, user, isFirstLogin } = useAuth();

  console.log('[GuestRoute] render state:', { isAuthenticated, isFirstLogin, user });

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

  if (isAuthenticated && !isFirstLogin) {
    const isCS       = checkIsCS(user);
    const isEmployee = checkIsEmployee(user);
    const isCustomer = !isCS && !isEmployee;

    if (isCustomerSite) {
      // On the customer portal: employees/CS should NOT be here
      if (!isCustomer) return <WrongPortal />;
      // Customer already logged in → send to their dashboard
      return <Navigate to="/customer-dashboard" replace />;
    } else {
      // On the ticketing (employee/CS) portal
      if (isCS)       return <Navigate to="/cs/dashboard" replace />;
      if (isEmployee) return <Navigate to="/employee/dashboard" replace />;
      // A customer somehow on the employee portal → wrong portal
      return <WrongPortal />;
    }
  }

  return children;
}
