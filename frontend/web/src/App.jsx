import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import PrivateRoute from '@/routes/PrivateRoute';
import GuestRoute from '@/routes/GuestRoute';
import Loginpage from './pages/Loginpage.jsx';
import LoginChoicePage from './pages/LoginChoicePage.jsx';
import CustomerLayout from './components/CustomerLayout.jsx';
import CustomerDashboard from './pages/CustomerDashboard.jsx';
import TicketCreation from './pages/TicketCreation.jsx';
import EmployeeLayout from './components/EmployeeLayout.jsx';
import EmployeeDashboard from './pages/EmployeeDashboard.jsx';
import EmployeeAssigned from './pages/EmployeeAssigned.jsx';
import EmployeeMachine from './pages/EmployeeMachine.jsx';
import EmployeeProgress from './pages/EmployeeProgress.jsx';
import EmployeeRegistration from './pages/EmployeeRegistration.jsx';
import CSLayout from './components/CSLayout.jsx';
import CSDashboard from './pages/CSDashboard.jsx';
import CSIncoming from './pages/CSIncoming.jsx';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginChoicePage />
              </GuestRoute>
            }
          />

          <Route
            path="/login/customer"
            element={
              <GuestRoute>
                <Loginpage mode="customer" />
              </GuestRoute>
            }
          />

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
              <PrivateRoute>
                <CustomerLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="customer-dashboard" replace />} />
            <Route path="customer-dashboard" element={<CustomerDashboard />} />
            <Route path="create-ticket" element={<TicketCreation />} />
            <Route path="my-tickets" element={<div className="p-8 text-center text-gray-500">My Tickets — coming soon.</div>} />
            <Route path="messages" element={<div className="p-8 text-center text-gray-500">Messages module coming soon...</div>} />
            <Route path="profile" element={<div className="p-8 text-center text-gray-500">Profile — coming soon.</div>} />
            <Route path="notifications" element={<div className="p-8 text-center text-gray-500">Notifications — coming soon.</div>} />
          </Route>

          {/* Employee Routes (kept separate) */}
          <Route path="/employee" element={<EmployeeLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<EmployeeDashboard />} />
            <Route path="assigned" element={<EmployeeAssigned />} />
            <Route path="machine" element={<EmployeeMachine />} />
            <Route path="progress" element={<EmployeeProgress />} />
            <Route path="registration" element={<EmployeeRegistration />} />
          </Route>

          <Route path="/employee-dashboard" element={<Navigate to="/employee/dashboard" replace />} />
          <Route path="/employee-assigned" element={<Navigate to="/employee/assigned" replace />} />
          <Route path="/employee-machine" element={<Navigate to="/employee/machine" replace />} />
          <Route path="/employee-progress" element={<Navigate to="/employee/progress" replace />} />
          <Route path="/employee-registration" element={<Navigate to="/employee/registration" replace />} />

          {/* Customer Service (CS) Routes */}
          <Route path="/cs" element={<CSLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CSDashboard />} />
            <Route path="incoming" element={<CSIncoming />} />
            <Route path="assigned" element={<div className="p-6 text-gray-500">CS Assigned — coming soon.</div>} />
            <Route path="analytics" element={<div className="p-6 text-gray-500">CS Analytics — coming soon.</div>} />
          </Route>

          <Route path="/employee-login" element={<Navigate to="/login/employee" replace />} />
          <Route path="/customer-login" element={<Navigate to="/login/customer" replace />} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
