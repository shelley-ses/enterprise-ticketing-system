import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Vite's BASE_URL is '/', '/ticketing/', or '/customer-ticketing/' depending on context.
const routerBasename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
import { AuthProvider, useAuth } from '@/context/AuthContext';
import PrivateRoute from '@/routes/PrivateRoute';
import GuestRoute from '@/routes/GuestRoute';
import AuthGate from '@/routes/AuthGate';
import SkeletonLoader from '@/components/SkeletonLoader.jsx';

// Lazy loaded page and layout components
const Loginpage = React.lazy(() => import('./pages/Loginpage.jsx'));
const LoginChoicePage = React.lazy(() => import('./pages/LoginChoicePage.jsx'));
const CustomerLayout = React.lazy(() => import('./components/CustomerLayout.jsx'));
const CustomerDashboard = React.lazy(() => import('./pages/CustomerDashboard.jsx'));
const TicketCreation = React.lazy(() => import('./pages/TicketCreation.jsx'));
const MyTickets = React.lazy(() => import('./pages/MyTickets.jsx'));
const CustomerHistory = React.lazy(() => import('./pages/CustomerHistory.jsx'));
const EmployeeLayout = React.lazy(() => import('./components/EmployeeLayout.jsx'));
const EmployeeDashboard = React.lazy(() => import('./pages/EmployeeDashboard.jsx'));
const EmployeeAssigned = React.lazy(() => import('./pages/EmployeeAssigned.jsx'));
const EmployeeMachine = React.lazy(() => import('./pages/EmployeeMachine.jsx'));
const EmployeeProgress = React.lazy(() => import('./pages/EmployeeProgress.jsx'));
const EmployeeRegistration = React.lazy(() => import('./pages/EmployeeRegistration.jsx'));
const EmployeeTicketUpdate = React.lazy(() => import('./pages/EmployeeTicketUpdate.jsx'));
const EmployeeHistoryDetail = React.lazy(() => import('./pages/EmployeeHistoryDetail.jsx'));
const EmployeeMyTickets = React.lazy(() => import('./pages/EmployeeMyTickets.jsx'));
const CSLayout = React.lazy(() => import('./components/CSLayout.jsx'));
const CSDashboard = React.lazy(() => import('./pages/CSDashboard.jsx'));
const CSIncoming = React.lazy(() => import('./pages/CSIncoming.jsx'));
const CSAssigned = React.lazy(() => import('./pages/CSAssigned.jsx'));
const Notifications = React.lazy(() => import('./pages/Notifications.jsx'));

function App() {
  return (
    <AuthProvider>
      <Router basename={routerBasename}>
        <AuthGate>
          <Suspense fallback={
            <div className="min-h-screen flex flex-col justify-start p-8 bg-gray-50/50 space-y-6">
              <div className="flex justify-between items-center w-full max-w-7xl mx-auto mb-4">
                <SkeletonLoader className="h-10 w-48" />
                <SkeletonLoader className="h-10 w-24 rounded-full" />
              </div>
              <div className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
                <SkeletonLoader className="h-32 rounded-2xl" variant="default" />
                <SkeletonLoader className="h-32 rounded-2xl" variant="default" />
                <SkeletonLoader className="h-32 rounded-2xl" variant="default" />
                <SkeletonLoader className="h-32 rounded-2xl" variant="default" />
              </div>
              <div className="w-full max-w-7xl mx-auto bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <div className="space-y-4">
                  <SkeletonLoader className="h-8 w-1/3 mb-6" />
                  <div className="space-y-3">
                    <SkeletonLoader className="h-12 w-full rounded-xl" />
                    <SkeletonLoader className="h-12 w-full rounded-xl" />
                    <SkeletonLoader className="h-12 w-full rounded-xl" />
                    <SkeletonLoader className="h-12 w-full rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          }>
            <Routes>
              {/* /customer — primary customer login (does NOT touch auth-module) */}
              <Route
                path="/customer"
                element={
                  <GuestRoute>
                    <Loginpage mode="customer" />
                  </GuestRoute>
                }
              />

              {/* /login — redirects to auth-module (employee/CS only) */}
              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <LoginChoicePage />
                  </GuestRoute>
                }
              />

              {/* Aliases — keep old URLs working */}
              <Route path="/login/customer" element={<Navigate to="/customer" replace />} />

              <Route
                path="/login/employee"
                element={
                  <GuestRoute>
                    <Loginpage mode="employee" />
                  </GuestRoute>
                }
              />

            {/* Protected Customer Routes */}
            <Route
              path="/"
              element={
                <PrivateRoute role="customer">
                  <CustomerLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="customer-dashboard" replace />} />
              <Route path="customer-dashboard" element={<CustomerDashboard />} />
              <Route path="create-ticket" element={<TicketCreation />} />
              <Route path="my-tickets" element={<MyTickets />} />
              <Route path="history" element={<CustomerHistory />} />
              <Route path="messages" element={<div className="p-8 text-center text-gray-500">Messages module coming soon...</div>} />
              <Route path="profile" element={<div className="p-8 text-center text-gray-500">Profile — coming soon.</div>} />
              <Route path="notifications" element={<Notifications />} />
            </Route>

            {/* Employee Routes (kept separate) */}
            <Route
              path="/employee"
              element={
                <PrivateRoute role="employee">
                  <EmployeeLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<EmployeeDashboard />} />
              <Route path="assigned" element={<EmployeeAssigned />} />
              <Route path="machine" element={<EmployeeMachine />} />
              <Route path="progress" element={<EmployeeProgress />} />
              <Route path="my-tickets" element={<EmployeeMyTickets />} />
              <Route path="history/:ticketId" element={<EmployeeHistoryDetail />} />
              <Route path="ticket-update" element={<EmployeeTicketUpdate />} />
              <Route path="registration" element={<EmployeeRegistration />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>

              <Route path="/employee-dashboard" element={<Navigate to="/employee/dashboard" replace />} />
              <Route path="/employee-assigned" element={<Navigate to="/employee/assigned" replace />} />
              <Route path="/employee-machine" element={<Navigate to="/employee/machine" replace />} />
              <Route path="/employee-progress" element={<Navigate to="/employee/progress" replace />} />
              <Route path="/employee-registration" element={<Navigate to="/employee/registration" replace />} />

            {/* Customer Service (CS) Routes */}
            <Route
              path="/cs"
              element={
                <PrivateRoute role="cs">
                  <CSLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<CSDashboard />} />
              <Route path="incoming" element={<CSIncoming />} />
              <Route path="assigned" element={<CSAssigned />} />
              <Route path="my-tickets" element={<EmployeeMyTickets roleContext="cs" />} />
              <Route path="analytics" element={<div className="p-6 text-gray-500">CS Analytics — coming soon.</div>} />
              <Route path="notifications" element={<Notifications />} />
            </Route>

              <Route path="/employee-login" element={<Navigate to="/login/employee" replace />} />
              <Route path="/customer-login" element={<Navigate to="/customer" replace />} />

              <Route
                path="*"
                element={
                  <Navigate
                    to={import.meta.env.VITE_APP_MODE === 'customer' ? '/customer' : '/login'}
                    replace
                  />
                }
              />
            </Routes>
          </Suspense>
        </AuthGate>
      </Router>
    </AuthProvider>
  );
}

export default App;

