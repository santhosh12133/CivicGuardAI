import React, { useEffect, useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, TextInput, Text, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

// Sign in (or sign up) with a phone number and a 6-digit SMS code.
const PhoneLoginScreen = () => {
  const navigation = useNavigation();
  const { requestPhoneCode, loginWithPhone } = useAuth();
  const [countryCode, setCountryCode] = useState('+91');
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [needsName, setNeedsName] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const phone = `${countryCode.trim().startsWith('+') ? countryCode.trim() : `+${countryCode.trim()}`}${number.replace(/\D/g, '')}`;

  const sendCode = async () => {
    try {
      setBusy(true);
      setError(null);
      await requestPhoneCode(phone);
      setStep('code');
      setResendIn(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    try {
      setBusy(true);
      setError(null);
      await loginWithPhone({ phone, code: code.trim(), name: name.trim() });
    } catch (err) {
      if (/name/i.test(err.message)) setNeedsName(true);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text variant="headlineMedium" style={styles.title}>
          Sign in with your phone
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          We'll text you a 6-digit code. New here? An account is created for you.
        </Text>

        <View style={styles.phoneRow}>
          <TextInput
            testID="phone-country"
            label="Code"
            value={countryCode}
            onChangeText={setCountryCode}
            keyboardType="phone-pad"
            mode="outlined"
            style={styles.country}
            disabled={step === 'code'}
          />
          <TextInput
            testID="phone-number"
            label="Mobile number"
            value={number}
            onChangeText={setNumber}
            keyboardType="phone-pad"
            mode="outlined"
            style={styles.number}
            disabled={step === 'code'}
          />
        </View>

        {step === 'code' && (
          <>
            <TextInput
              testID="phone-code"
              label="6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              testID="phone-name"
              label={needsName ? 'Your name' : 'Your name (first time only)'}
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
            />
          </>
        )}

        {error && <HelperText type="error">{error}</HelperText>}

        {step === 'phone' ? (
          <Button testID="phone-send" mode="contained" onPress={sendCode} loading={busy} disabled={busy || number.replace(/\D/g, '').length < 6} style={styles.button}>
            Send code
          </Button>
        ) : (
          <>
            <Button testID="phone-verify" mode="contained" onPress={verify} loading={busy} disabled={busy || code.trim().length !== 6} style={styles.button}>
              Sign in
            </Button>
            <Button mode="text" onPress={sendCode} disabled={busy || resendIn > 0} style={styles.secondary}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </Button>
            <Button mode="text" onPress={() => { setStep('phone'); setCode(''); setError(null); }} style={styles.secondary}>
              Use a different number
            </Button>
          </>
        )}

        <Button mode="text" onPress={() => navigation.goBack()} style={styles.secondary}>
          Back
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
  phoneRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  country: { width: 90 },
  number: { flex: 1 },
  input: { marginBottom: 16 },
  button: { marginTop: 8, paddingVertical: 4 },
  secondary: { marginTop: 8 },
});

export default PhoneLoginScreen;
