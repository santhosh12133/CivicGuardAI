import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
} from '@mui/material';
import {
  Insights as OverviewIcon,
  ListAlt as IssuesIcon,
  Group as StaffIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 250;

const Sidebar = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/login');
  };

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path) ||
      (path === '/issues' && location.pathname.startsWith('/issue/'));

  const menuItems = [
    { text: 'Overview', icon: <OverviewIcon />, path: '/' },
    { text: 'Issues', icon: <IssuesIcon />, path: '/issues' },
    ...(user?.role === 'admin' ? [{ text: 'Staff', icon: <StaffIcon />, path: '/staff' }] : []),
    { text: 'Logout', icon: <LogoutIcon />, action: handleLogout },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: '#f8f9fa',
        },
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
          CivicFix Admin
        </Typography>
      </Toolbar>
      <Divider />
      <List component="nav" aria-label="Main">
        {menuItems.map((item) => {
          const selected = item.path ? isActive(item.path) : false;
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                onClick={item.action || (() => navigate(item.path))}
                selected={selected}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': { backgroundColor: 'primary.dark' },
                  },
                }}
              >
                <ListItemIcon sx={{ color: selected ? 'white' : 'inherit' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Drawer>
  );
};

export default Sidebar;
