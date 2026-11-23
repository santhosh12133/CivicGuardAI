import React from "react";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import OverviewIcon from "@mui/icons-material/SpaceDashboardOutlined";
import IssuesIcon from "@mui/icons-material/ListAlt";
import MapIcon from "@mui/icons-material/MapOutlined";
import StaffIcon from "@mui/icons-material/GroupOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate, useLocation } from "react-router-dom";
import { adminAuth } from "../api/api";
import Logo from "./Logo";

export const DRAWER_WIDTH = 248;

const Sidebar = ({ user, mobileOpen, onMobileClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));

  // Ends the session on the server too, so the tokens stop working.
  const handleLogout = async () => {
    await adminAuth.logout();
    navigate("/login");
  };

  const isActive = (path) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path) || (path === "/issues" && location.pathname.startsWith("/issue/"));

  const menuItems = [
    { text: "Overview", icon: <OverviewIcon />, path: "/" },
    { text: "Issues", icon: <IssuesIcon />, path: "/issues" },
    { text: "Map", icon: <MapIcon />, path: "/map" },
    ...(user?.role === "admin" ? [{ text: "Staff", icon: <StaffIcon />, path: "/staff" }] : []),
  ];

  const content = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", p: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1, py: 1.5, mb: 1 }}>
        <Logo />
        <Box>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.01em" }}>CivicFix</Typography>
          <Typography variant="caption" color="text.secondary">Admin portal</Typography>
        </Box>
      </Box>
      <List component="nav" aria-label="Main" sx={{ flexGrow: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton selected={isActive(item.path)} onClick={() => navigate(item.path)}>
              <ListItemIcon sx={{ minWidth: 38 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon sx={{ minWidth: 38 }}><LogoutIcon /></ListItemIcon>
            <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  const paperSx = { width: DRAWER_WIDTH, boxSizing: "border-box", borderRight: 1, borderColor: "divider", bgcolor: "background.paper" };

  return desktop ? (
    <Drawer variant="permanent" sx={{ width: DRAWER_WIDTH, flexShrink: 0, "& .MuiDrawer-paper": paperSx }}>
      {content}
    </Drawer>
  ) : (
    <Drawer variant="temporary" open={mobileOpen} onClose={onMobileClose} ModalProps={{ keepMounted: true }} sx={{ "& .MuiDrawer-paper": paperSx }}>
      {content}
    </Drawer>
  );
};

export default Sidebar;
