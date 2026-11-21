import React, { useState } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { Avatar, Button, Text, Divider, Snackbar, TextInput, HelperText } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const ChangePassword = ({ onDone }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (next.length < 8) return setError('The new password must be at least 8 characters.');
    if (next !== confirm) return setError('The new passwords do not match.');
    try {
      setSaving(true);
      setError(null);
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      onDone('Password changed');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <View>
      <TextInput label="Current password" value={current} onChangeText={setCurrent} secureTextEntry mode="outlined" style={styles.input} />
      <TextInput label="New password" value={next} onChangeText={setNext} secureTextEntry mode="outlined" style={styles.input} />
      <TextInput label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry mode="outlined" style={styles.input} />
      {error && <HelperText type="error">{error}</HelperText>}
      <Button mode="outlined" onPress={save} loading={saving} disabled={saving || !current || !next}>
        Save new password
      </Button>
    </View>
  );
};

const ProfileScreen = () => {
  const { user, logout, serverUrl } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await logout();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Avatar.Text size={80} label={user?.name?.[0]?.toUpperCase() || '?'} style={styles.avatar} />
        <Text variant="headlineSmall" style={styles.name}>
          {user?.name}
        </Text>
        <Text variant="bodyMedium" style={styles.email}>
          {user?.email}
        </Text>
        <Text variant="bodySmall" style={styles.role}>
          Role · {user?.role || 'citizen'}
        </Text>
      </View>

      <Divider style={styles.divider} />

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Password
        </Text>
        {changingPassword ? (
          <ChangePassword
            onDone={(text) => {
              setChangingPassword(false);
              setMessage(text);
            }}
          />
        ) : (
          <Button mode="outlined" onPress={() => setChangingPassword(true)}>
            Change password
          </Button>
        )}
      </View>

      <View style={styles.section}>
        <Button mode="contained" onPress={handleLogout} loading={loading} style={styles.button}>
          Sign Out
        </Button>
        <Text variant="bodySmall" style={styles.caption}>
          Connected to {serverUrl ? serverUrl.replace(/^https?:\/\//, '') : 'no server'}
        </Text>
      </View>

      <Snackbar visible={!!message} onDismiss={() => setMessage('')} duration={3000}>
        {message}
      </Snackbar>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingHorizontal: 24, paddingTop: 80, paddingBottom: 48 },
  header: { alignItems: 'center', gap: 8, marginBottom: 24 },
  avatar: { backgroundColor: '#2563eb' },
  name: { fontWeight: '700' },
  email: { color: '#64748b' },
  role: { color: '#94a3b8', textTransform: 'capitalize' },
  divider: { marginBottom: 24 },
  section: { marginBottom: 24, gap: 12 },
  sectionTitle: { fontWeight: '600' },
  input: { marginBottom: 8 },
  button: { marginTop: 4 },
  caption: { color: '#94a3b8', textAlign: 'center' },
});

export default ProfileScreen;
