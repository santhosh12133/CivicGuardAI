import React, { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, TextInput, Text, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

// Email -> code from the email + new password.
const ForgotPasswordScreen = () => {
  const navigation = useNavigation();
  const { forgotPassword, resetPassword } = useAuth();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const sendCode = async () => {
    try {
      setBusy(true);
      setError(null);
      const result = await forgotPassword(email.trim());
      setInfo(result.message);
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (password.length < 8) return setError('The new password must be at least 8 characters.');
    if (password !== confirm) return setError('The new passwords do not match.');
    try {
      setBusy(true);
      setError(null);
      const result = await resetPassword({ email: email.trim(), code: code.trim(), newPassword: password });
      navigation.navigate('Login', { notice: result.message });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text variant="headlineMedium" style={styles.title}>
          Reset your password
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {step === 'email'
            ? "Enter your account's email and we'll send you a code."
            : info || 'Enter the code from the email and choose a new password.'}
        </Text>

        <TextInput testID="forgot-email" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none"
          keyboardType="email-address" mode="outlined" style={styles.input} disabled={step === 'code'} />
        {step === 'code' && (
          <>
            <TextInput testID="forgot-code" label="Code from the email" value={code} onChangeText={setCode}
              keyboardType="number-pad" maxLength={6} mode="outlined" style={styles.input} />
            <TextInput testID="forgot-password" label="New password" value={password} onChangeText={setPassword}
              secureTextEntry mode="outlined" style={styles.input} />
            <TextInput testID="forgot-confirm" label="Confirm new password" value={confirm} onChangeText={setConfirm}
              secureTextEntry mode="outlined" style={styles.input} />
          </>
        )}

        {error && <HelperText type="error">{error}</HelperText>}

        <Button testID="forgot-submit" mode="contained" onPress={step === 'email' ? sendCode : reset} loading={busy}
          disabled={busy || !email.trim()} style={styles.button}>
          {step === 'email' ? 'Send reset code' : 'Set new password'}
        </Button>
        <Button mode="text" onPress={() => navigation.goBack()} style={styles.secondary}>
          Back to sign in
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { paddingHorizontal: 24, paddingTop: 100, paddingBottom: 48 },
  title: { fontWeight: '700' },
  subtitle: { marginTop: 8, marginBottom: 32, color: '#64748b' },
  input: { marginBottom: 16 },
  button: { marginTop: 8, paddingVertical: 4 },
  secondary: { marginTop: 8 },
});

export default ForgotPasswordScreen;
