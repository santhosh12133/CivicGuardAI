import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../ui/AuthLayout';
import { Banner, Button, Field } from '../ui/components';
import { colors, type } from '../ui/theme';

const SignupScreen = () => {
  const navigation = useNavigation();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignup = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedName || !trimmedEmail || !trimmedPassword)
      return setError('Fill in your name, email and a password.');
    if (!trimmedEmail.includes('@'))
      return setError('Enter a valid email address.');
    if (trimmedPassword.length < 8)
      return setError('Use at least 8 characters for your password.');
    if (trimmedPassword !== confirmPassword.trim())
      return setError('The two passwords do not match.');
    try {
      setLoading(true);
      setError(null);
      await register({
        name: trimmedName,
        email: trimmedEmail,
        password: trimmedPassword,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    return undefined;
  };

  const clear = (setter) => (value) => {
    setter(value);
    setError(null);
  };

  return (
    <AuthLayout
      back
      title="Create your account"
      subtitle="Report problems on your street and get updates as the city team works on them."
      footer={
        <View style={styles.footer}>
          <Text style={type.body}>Already have an account?</Text>
          <Pressable
            onPress={() => navigation.navigate('Login')}
            hitSlop={8}
            testID="go-to-login"
          >
            <Text style={styles.link}>Sign in</Text>
          </Pressable>
        </View>
      }
    >
      <Field
        label="Full name"
        testID="signup-name"
        value={name}
        onChangeText={clear(setName)}
        autoComplete="name"
      />
      <Field
        label="Email"
        testID="signup-email"
        value={email}
        onChangeText={clear(setEmail)}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Field
        label="Password"
        testID="signup-password"
        value={password}
        onChangeText={clear(setPassword)}
        secure
        autoComplete="new-password"
      />
      <Text style={[type.caption, styles.hint]}>At least 8 characters.</Text>
      <Field
        label="Confirm password"
        testID="signup-confirm"
        value={confirmPassword}
        onChangeText={clear(setConfirmPassword)}
        secure
        autoComplete="new-password"
        onSubmitEditing={handleSignup}
      />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button
        title="Create account"
        onPress={handleSignup}
        loading={loading}
        testID="signup-submit"
      />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  hint: { marginTop: -8 },
  footer: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  link: { fontSize: 15, fontWeight: '600', color: colors.brand },
});

export default SignupScreen;
