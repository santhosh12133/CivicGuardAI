import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import IssueDetails from './pages/IssueDetails';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';

const ProtectedLayout = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem('admin_token');
  const storedUser = localStorage.getItem('admin_user');

  let user = null;
  try {
    user = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    localStorage.removeItem('admin_user');
  }

  const hasStaffAccess = ['staff', 'admin'].includes(user?.role);

  if (!token || !hasStaffAccess) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <Box sx={{ flexGrow: 1, overflow: 'auto', backgroundColor: '#f8f9fa' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

const ProtectedRoute = ({ element }) => <ProtectedLayout>{element}</ProtectedLayout>;

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute element={<Dashboard />} />} />
        <Route path="/issue/:id" element={<ProtectedRoute element={<IssueDetails />} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
