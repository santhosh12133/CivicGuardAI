import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import { useLocation } from 'react-router-dom';
import { useColorMode } from '../theme/ColorMode';
import { authAPI } from '../api/api';

const ChangePasswordDialog = ({ open, onClose }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError('');
    setDone(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const save = async () => {
    if (next.length < 8) return setError('The new password must be at least 8 characters.');
    if (next !== confirm) return setError('The new passwords do not match.');
    try {
      setSaving(true);
      setError('');
      await authAPI.changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Could not change the password');
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>Change password</DialogTitle>
      <DialogContent>
        {done ? (
          <Alert severity="success" sx={{ mt: 1 }}>Your password has been changed.</Alert>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
            <TextField label="Current password" type="password" fullWidth margin="dense"
              value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            <TextField label="New password" type="password" fullWidth margin="dense"
              value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password"
              helperText="At least 8 characters" />
            <TextField label="Confirm new password" type="password" fullWidth margin="dense"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>{done ? 'Close' : 'Cancel'}</Button>
        {!done && (
          <Button variant="contained" onClick={save} disabled={saving || !current || !next}>
            Save password
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

const PAGE_TITLES = [
  ['/issue/', 'Issue'],
  ['/issues', 'Issues'],
  ['/map', 'Map'],
  ['/staff', 'Staff'],
  ['/', 'Overview'],
];

const Topbar = ({ user, onMenuClick }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { mode, toggle } = useColorMode();
  const { pathname } = useLocation();
  const title = (PAGE_TITLES.find(([prefix]) => (prefix === '/' ? pathname === '/' : pathname.startsWith(prefix))) || [])[1];
  const name = user?.name || user?.email || 'Officer';
  const nextMode = mode === 'dark' ? 'light' : 'dark';

  return (
    <AppBar
      position="static"
      color="inherit"
      elevation={0}
      sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <IconButton edge="start" onClick={onMenuClick} aria-label="Open menu" sx={{ display: { md: 'none' } }}>
          <MenuIcon />
        </IconButton>
        <Typography variant="subtitle1" component="div" sx={{ flexGrow: 1, fontWeight: 600, color: 'text.secondary' }}>
          {title}
        </Typography>
        <Tooltip title={`Switch to ${nextMode} mode`}>
          <IconButton onClick={toggle} aria-label={`Switch to ${nextMode} mode`}>
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Tooltip>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, ml: 1 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700 }}>
            {name.trim()[0]?.toUpperCase() || '?'}
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1.2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{name}</Typography>
            {user?.role && <Chip size="small" label={user.role} sx={{ height: 18, fontSize: 11, textTransform: 'capitalize' }} />}
          </Box>
          <Button size="small" onClick={() => setDialogOpen(true)}>Change password</Button>
        </Box>
      </Toolbar>
      <ChangePasswordDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </AppBar>
  );
};

export default Topbar;
