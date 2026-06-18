import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Vite's BASE_URL is '/', '/ticketing/', or '/customer-ticketing/' depending on context.
const routerBasename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
import { AuthProvider, useAuth } from '@/context/AuthContext';
import PrivateRoute from '@/routes/PrivateRoute';
import GuestRoute from '@/routes/GuestRoute';
import AuthGate from '@/routes/AuthGate';
import Loginpage from './pages/Loginpage.jsx';
import LoginChoicePage from './pages/LoginChoicePage.jsx';
import CustomerLayout from './components/CustomerLayout.jsx';
import CustomerDashboard from './pages/CustomerDashboard.jsx';
import TicketCreation from './pages/TicketCreation.jsx';
import MyTickets from './pages/MyTickets.jsx';
import CustomerHistory from './pages/CustomerHistory.jsx';
import EmployeeLayout from './components/EmployeeLayout.jsx';
import EmployeeDashboard from './pages/EmployeeDashboard.jsx';
import EmployeeAssigned from './pages/EmployeeAssigned.jsx';
import EmployeeMachine from './pages/EmployeeMachine.jsx';
import EmployeeProgress from './pages/EmployeeProgress.jsx';
import EmployeeRegistration from './pages/EmployeeRegistration.jsx';
import EmployeeTicketUpdate from './pages/EmployeeTicketUpdate.jsx';
import EmployeeHistoryDetail from './pages/EmployeeHistoryDetail.jsx';
import EmployeeMyTickets from './pages/EmployeeMyTickets.jsx';
import CSLayout from './components/CSLayout.jsx';
import CSDashboard from './pages/CSDashboard.jsx';
import CSIncoming from './pages/CSIncoming.jsx';
import CSAssigned from './pages/CSAssigned.jsx';
import Notifications from './pages/Notifications.jsx';
import SuperAdminLayout from './components/SuperAdminLayout.jsx';
import SuperAdminTicketConfig from './pages/SuperAdminTicketConfig.jsx';
import SuperAdminAuditLogs from './pages/SuperAdminAuditLogs.jsx';
import SuperAdminHistory from './pages/SuperAdminHistory.jsx';
import SuperAdminDevLogin from './pages/SuperAdminDevLogin.jsx';

function App() {
  return (
    <AuthProvider>
      <Router basename={routerBasename}>
        <AuthGate>
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

            {/* /superadmin/dev-login — dev-only mock login (no backend required) */}
            <Route
              path="/superadmin/dev-login"
              element={
                <GuestRoute>
                  <SuperAdminDevLogin />
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
            <Route path="incoming" element={<EmployeeAssigned />} />
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

          {/* SuperAdmin Routes */}
          <Route
            path="/superadmin"
            element={
              <PrivateRoute role="superadmin">
                <SuperAdminLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="ticket-config" replace />} />
            <Route path="ticket-config" element={<SuperAdminTicketConfig />} />
            <Route path="audit-logs" element={<SuperAdminAuditLogs />} />
            <Route path="history" element={<SuperAdminHistory />} />
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
        </AuthGate>
      </Router>
    </AuthProvider>
  );
}

export default App;

