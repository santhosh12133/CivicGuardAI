import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
  Avatar,
  Banner,
  Button,
  Field,
  ListRow,
  ScreenHeader,
  SectionTitle,
  StatusBarBackdrop,
} from '../ui/components';
import { colors, radius, space, type } from '../ui/theme';

const APP_VERSION = require('../../app.json').expo.version;

const ChangePassword = ({ onDone, onCancel, hasPassword }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (hasPassword && !current)
      return setError('Enter your current password.');
    if (next.length < 8)
      return setError('Use at least 8 characters for the new password.');
    if (next !== confirm)
      return setError('The two new passwords do not match.');
    try {
      setSaving(true);
      setError(null);
      await api.post(
        '/api/auth/change-password',
        hasPassword
          ? { currentPassword: current, newPassword: next }
          : { newPassword: next }
      );
      onDone(
        hasPassword
          ? 'Password changed. Your other devices were signed out.'
          : 'Password set. You can now also sign in with your email and password.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <View style={styles.passwordForm}>
      {hasPassword ? (
        <Field
          testID="password-current"
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          secure
          autoComplete="password"
        />
      ) : null}
      <Field
        testID="password-new"
        label="New password"
        value={next}
        onChangeText={setNext}
        secure
        autoComplete="new-password"
      />
      <Field
        testID="password-confirm"
        label="Confirm new password"
        value={confirm}
        onChangeText={setConfirm}
        secure
        autoComplete="new-password"
      />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <View style={styles.formButtons}>
        <Button
          variant="secondary"
          title="Cancel"
          onPress={onCancel}
          style={styles.formButton}
          disabled={saving}
        />
        <Button
          testID="password-save"
          title="Save password"
          onPress={save}
          loading={saving}
          disabled={!next}
          style={styles.formButton}
        />
      </View>
    </View>
  );
};

const ProfileScreen = () => {
  const { user, logout, logoutEverywhere, refreshUser, serverUrl } = useAuth();
  const hasPassword = user?.has_password !== false;
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const run = async (action) => {
    try {
      setSigningOut(true);
      await action();
    } catch (error) {
      setMessage(error.message);
      setSigningOut(false);
    }
  };

  const contact = [user?.email, user?.phone].filter(Boolean);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Profile" />

        <View style={styles.body}>
          <View style={styles.identity}>
            <Avatar name={user?.name} size={64} />
            <View style={styles.identityText}>
              <Text style={type.title} numberOfLines={1}>
                {user?.name}
              </Text>
              {contact.map((line) => (
                <Text key={line} style={type.body} numberOfLines={1}>
                  {line}
                </Text>
              ))}
            </View>
          </View>

          <View>
            <SectionTitle>Security</SectionTitle>
            <View style={styles.group}>
              {changingPassword ? (
                <View style={styles.groupPadding}>
                  <Text style={[type.heading, styles.formTitle]}>
                    {hasPassword ? 'Change password' : 'Set a password'}
                  </Text>
                  <ChangePassword
                    hasPassword={hasPassword}
                    onCancel={() => setChangingPassword(false)}
                    onDone={(text) => {
                      setChangingPassword(false);
                      setMessage(text);
                      refreshUser().catch(() => {});
                    }}
                  />
                </View>
              ) : (
                <ListRow
                  icon="lock-outline"
                  title={hasPassword ? 'Change password' : 'Set a password'}
                  subtitle={
                    hasPassword
                      ? 'Signs you out on your other devices'
                      : 'So you can also sign in with email'
                  }
                  onPress={() => setChangingPassword(true)}
                  testID="change-password"
                />
              )}
              <ListRow
                icon="cellphone-link-off"
                title="Sign out on all devices"
                subtitle="Use this if you lost a phone"
                onPress={() => run(logoutEverywhere)}
                testID="sign-out-everywhere"
                last
              />
            </View>
          </View>

          <View>
            <SectionTitle>App</SectionTitle>
            <View style={styles.group}>
              <ListRow
                icon="server-network"
                title="Server"
                subtitle={
                  serverUrl ? serverUrl.replace(/^https?:\/\//, '') : 'Not set'
                }
                right={null}
                last
              />
            </View>
          </View>

          <Button
            variant="secondary"
            icon="logout"
            title="Sign out"
            onPress={() => run(logout)}
            loading={signingOut}
            testID="sign-out"
          />
          <Text style={[type.micro, styles.version]}>
            CivicFix {APP_VERSION}
          </Text>
        </View>
      </ScrollView>
      <StatusBarBackdrop />
      <Snackbar
        visible={!!message}
        onDismiss={() => setMessage('')}
        duration={3500}
      >
        {message}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: space.xxxl },
  body: { paddingHorizontal: space.lg, gap: space.xxl },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
  },
  identityText: { flex: 1, gap: 2 },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  groupPadding: {
    padding: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lineStrong,
  },
  formTitle: { marginBottom: space.md },
  passwordForm: { gap: space.md },
  formButtons: { flexDirection: 'row', gap: space.sm },
  formButton: { flex: 1 },
  version: { textAlign: 'center', fontWeight: '400' },
});

export default ProfileScreen;
