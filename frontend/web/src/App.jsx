import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Loginpage from './pages/Loginpage.jsx';
import CustomerLayout from './components/CustomerLayout.jsx';
import CustomerDashboard from './pages/CustomerDashboard.jsx';
import TicketCreation from './pages/TicketCreation.jsx';
import MyTickets from './pages/MyTickets.jsx';
import Profile from './pages/Profile.jsx';
import Notifications from './pages/Notifications.jsx';
import CSLayout from './components/CSLayout.jsx';
import CSDashboard from './pages/CSDashboard.jsx';
import CSIncoming from './pages/CSIncoming.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Loginpage />} />
        
        {/* Protected Customer Routes */}
        <Route path="/" element={<CustomerLayout />}>
          <Route path="customer-dashboard" element={<CustomerDashboard />} />
          <Route path="create-ticket" element={<TicketCreation />} />
          <Route path="my-tickets" element={<MyTickets />} />
          <Route path="messages" element={<div className="p-8 text-center text-gray-500">Messages module coming soon...</div>} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        
        {/* Customer Service Routes */}
        <Route path="/cs" element={<CSLayout />}> 
          <Route path="dashboard" element={<CSDashboard />} />
          <Route path="incoming" element={<CSIncoming />} />
          <Route path="assigned" element={<div className="p-8 text-center text-gray-500">Assigned tickets coming soon...</div>} />
          <Route path="analytics" element={<div className="p-8 text-center text-gray-500">Analytics module coming soon...</div>} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
