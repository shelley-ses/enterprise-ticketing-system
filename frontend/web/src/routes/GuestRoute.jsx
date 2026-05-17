import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/**
 * Guest-only routes (e.g. login). Redirects authenticated users away.
 */
export default function GuestRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

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
    return <Navigate to="/customer-dashboard" replace />;
  }

  return children;
}
