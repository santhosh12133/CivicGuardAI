import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import AccountCircle from '@mui/icons-material/AccountCircle';
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

const Topbar = ({ user }) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{ backgroundColor: 'white', color: 'text.primary', borderBottom: '1px solid #e5e7eb' }}
    >
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
          CivicFix Officer Panel
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AccountCircle sx={{ color: 'primary.main' }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {user?.name || user?.email || 'Officer'}
          </Typography>
          {user?.role && <Chip size="small" label={user.role} />}
          <Button size="small" onClick={() => setDialogOpen(true)}>Change password</Button>
        </Box>
      </Toolbar>
      <ChangePasswordDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </AppBar>
  );
};

export default Topbar;
