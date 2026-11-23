import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Stack,
  Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/PersonAdd";
import { usersAPI } from "../api/api";
import { currentUser } from "../categories";

const errorMessage = (err, fallback) =>
  err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || err.message || fallback;

// Shows a one-time password once, so the admin can pass it on.
const PasswordNotice = ({ email, password }) => (
  <Alert severity="success" sx={{ mt: 1 }}>
    Give <strong>{email}</strong> this one-time password and ask them to change it after signing in
    (Change password, top right). It will not be shown again.
    <Box
      component="code"
      data-testid="temporary-password"
      sx={{ display: "block", mt: 1, p: 1, bgcolor: "grey.100", borderRadius: 1, fontSize: 16, userSelect: "all" }}
    >
      {password}
    </Box>
  </Alert>
);

const AddStaffDialog = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ name: "", email: "", role: "staff" });
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setForm({ name: "", email: "", role: "staff" });
    setError("");
    setResult(null);
    onClose();
  };

  const create = async () => {
    try {
      setSaving(true);
      setError("");
      const created = await usersAPI.createStaff(form);
      setResult(created);
      onCreated();
    } catch (err) {
      setError(errorMessage(err, "Could not create the account"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Add staff account</DialogTitle>
      <DialogContent>
        {result ? (
          <PasswordNotice email={result.user.email} password={result.temporaryPassword} />
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
            <TextField label="Full name" fullWidth margin="dense" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField label="Email" type="email" fullWidth margin="dense" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value.trim() })} />
            <TextField select label="Role" fullWidth margin="dense" value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              helperText="Staff update issues. Admins can also delete issues and manage accounts.">
              <MenuItem value="staff">Staff</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </TextField>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>{result ? "Done" : "Cancel"}</Button>
        {!result && (
          <Button variant="contained" onClick={create} disabled={saving || !form.name || !form.email}>
            Create account
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

const Staff = () => {
  const me = currentUser();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [reset, setReset] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setUsers(await usersAPI.listStaff());
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Failed to load staff"));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const changeRole = async (user, role) => {
    if (role === user.role) return;
    if (role === "citizen" && !window.confirm(`Remove ${user.name}'s staff access? They keep a citizen account.`)) return;
    try {
      setBusyId(user.id);
      await usersAPI.updateRole(user.id, role);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not change the role"));
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (user) => {
    if (!window.confirm(`Give ${user.name} a new one-time password? Their current password stops working.`)) return;
    try {
      setBusyId(user.id);
      const result = await usersAPI.resetPassword(user.id);
      setReset({ email: user.email, password: result.temporaryPassword });
    } catch (err) {
      setError(errorMessage(err, "Could not reset the password"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4" component="h1">Staff</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add staff
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
      {reset && (
        <Box sx={{ mb: 2 }}>
          <PasswordNotice email={reset.email} password={reset.password} />
          <Button size="small" onClick={() => setReset(null)} sx={{ mt: 1 }}>Dismiss</Button>
        </Box>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        {!users ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
        ) : (
          <Table aria-label="Staff accounts">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Added</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => {
                const isMe = user.id === me?.id;
                return (
                  <TableRow key={user.id} data-testid={`staff-row-${user.email}`}>
                    <TableCell>
                      {user.name} {isMe && <Chip size="small" label="You" sx={{ ml: 1 }} />}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell sx={{ minWidth: 170 }}>
                      <TextField
                        select
                        size="small"
                        value={user.role}
                        onChange={(e) => changeRole(user, e.target.value)}
                        disabled={isMe || busyId === user.id}
                        inputProps={{ "aria-label": `Role for ${user.email}` }}
                      >
                        <MenuItem value="staff">Staff</MenuItem>
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="citizen">Remove staff access</MenuItem>
                      </TextField>
                    </TableCell>
                    <TableCell>{new Date(user.created_at || user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => resetPassword(user)} disabled={isMe || busyId === user.id}>
                        Reset password
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      <AddStaffDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
    </Box>
  );
};

export default Staff;
