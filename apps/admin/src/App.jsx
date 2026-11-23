import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Box } from "@mui/material";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Dashboard from "./pages/Dashboard";
import IssueDetails from "./pages/IssueDetails";
import MapView from "./pages/MapView";
import Staff from "./pages/Staff";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { authAPI, session } from "./api/api";
import { currentUser } from "./categories";

const clearSession = () => session.clear();

const ProtectedLayout = ({ children, adminOnly = false }) => {
  const location = useLocation();
  const token = session.token();
  const [user, setUser] = useState(currentUser);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Re-check the account with the server so a role change applies at once.
  useEffect(() => {
    if (!token) return;
    authAPI
      .me()
      .then((fresh) => {
        localStorage.setItem("admin_user", JSON.stringify(fresh));
        setUser(fresh);
      })
      .catch(() => {});
  }, [token, location.pathname]);

  // Close the mobile menu after navigating.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const hasStaffAccess = ["staff", "admin"].includes(user?.role);

  if (!token || !hasStaffAccess) {
    clearSession();
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <Box sx={{ display: "flex", height: "100vh", bgcolor: "background.default" }}>
      <Sidebar user={user} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar user={user} onMenuClick={() => setMobileOpen(true)} />
        <Box component="main" sx={{ flexGrow: 1, overflow: "auto" }}>
          <Box sx={{ maxWidth: 1440, mx: "auto" }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedLayout><Overview /></ProtectedLayout>} />
        <Route path="/issues" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
        <Route path="/map" element={<ProtectedLayout><MapView /></ProtectedLayout>} />
        <Route path="/issue/:id" element={<ProtectedLayout><IssueDetails /></ProtectedLayout>} />
        <Route path="/staff" element={<ProtectedLayout adminOnly><Staff /></ProtectedLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
