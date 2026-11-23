import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../ui/AuthLayout';
import { Banner, Button, Field } from '../ui/components';

// Sign in (or sign up) with a phone number and a 6-digit SMS code.
const PhoneLoginScreen = () => {
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
    <AuthLayout
      back
      title="Sign in with your phone"
      subtitle={
        step === 'phone'
          ? 'We will text you a 6-digit code. If you are new, we create your account.'
          : `Enter the code we sent to ${phone}.`
      }
    >
      <View style={styles.phoneRow}>
        <Field
          testID="phone-country"
          label="Code"
          value={countryCode}
          onChangeText={setCountryCode}
          keyboardType="phone-pad"
          style={styles.country}
          disabled={step === 'code'}
        />
        <Field
          testID="phone-number"
          label="Mobile number"
          value={number}
          onChangeText={setNumber}
          keyboardType="phone-pad"
          autoComplete="tel"
          style={styles.number}
          disabled={step === 'code'}
        />
      </View>

      {step === 'code' ? (
        <>
          <Field
            testID="phone-code"
            label="6-digit code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={6}
          />
          <Field
            testID="phone-name"
            label={needsName ? 'Your name' : 'Your name (first time only)'}
            value={name}
            onChangeText={setName}
            autoComplete="name"
          />
        </>
      ) : null}

      {error ? <Banner tone="error">{error}</Banner> : null}

      {step === 'phone' ? (
        <Button
          testID="phone-send"
          title="Send code"
          onPress={sendCode}
          loading={busy}
          disabled={number.replace(/\D/g, '').length < 6}
        />
      ) : (
        <>
          <Button
            testID="phone-verify"
            title="Sign in"
            onPress={verify}
            loading={busy}
            disabled={code.trim().length !== 6}
          />
          <View style={styles.secondaryRow}>
            <Button
              variant="ghost"
              compact
              title={resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
              onPress={sendCode}
              disabled={busy || resendIn > 0}
              style={styles.secondary}
            />
            <Button
              variant="ghost"
              compact
              title="Change number"
              onPress={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
              style={styles.secondary}
            />
          </View>
        </>
      )}
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  phoneRow: { flexDirection: 'row', gap: 10 },
  country: { width: 92 },
  number: { flex: 1 },
  secondaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  secondary: { flex: 1 },
});

export default PhoneLoginScreen;
