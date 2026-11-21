import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { Button, TextInput, Text, HelperText } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const LoginScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { login, serverUrl, providers, authNotice, setAuthNotice, signInWithGoogle } = useAuth();
  const notice = route.params?.notice;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    
    if (!trimmedEmail || !trimmedPassword) {
      setError('Email and password are required');
      return;
    }

    if (!trimmedEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login({ email: trimmedEmail, password: trimmedPassword });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text variant="headlineLarge" style={styles.title}>
          Welcome Back 👋
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Log in to report and track civic issues in your community.
        </Text>

        <TextInput
          label="Email"
          testID="login-email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          mode="outlined"
          style={styles.input}
        />

        <TextInput
          label="Password"
          testID="login-password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          mode="outlined"
          style={styles.input}
        />

        {notice && !error && <HelperText type="info" style={styles.notice}>{notice}</HelperText>}
        {authNotice && <HelperText type="error">{authNotice}</HelperText>}
        {error && <HelperText type="error">{error}</HelperText>}

        <Button mode="contained" onPress={handleLogin} loading={loading} style={styles.button} testID="login-submit">
          Sign In
        </Button>

        {providers.passwordReset && (
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} testID="go-to-forgot" style={styles.forgotRow}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        {(providers.phone || providers.google) && (
          <View style={styles.altSection}>
            <Text variant="bodySmall" style={styles.orText}>or</Text>
            {providers.phone && (
              <Button mode="outlined" icon="cellphone" onPress={() => navigation.navigate('PhoneLogin')} style={styles.altButton} testID="go-to-phone">
                Continue with phone number
              </Button>
            )}
            {providers.google && (
              <Button
                mode="outlined"
                icon="google"
                onPress={() => signInWithGoogle().catch((err) => setAuthNotice(err.message))}
                style={styles.altButton}
                testID="google-signin"
              >
                Continue with Google
              </Button>
            )}
          </View>
        )}

        <View style={styles.footerRow}>
          <Text>New here?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')} testID="go-to-signup">
            <Text style={styles.link}> Create an account</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Server')} style={styles.serverRow} testID="change-server">
          <Text variant="bodySmall" style={styles.serverText}>
            Server: {serverUrl ? serverUrl.replace(/^https?:\/\//, '') : 'not set'} · <Text style={styles.link}>Change</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  inner: {
    flexGrow: 1,
    paddingBottom: 32,
    paddingHorizontal: 24,
    paddingTop: 96,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 32,
    color: '#64748b',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    paddingVertical: 4,
  },
  footerRow: {
    flexDirection: 'row',
    marginTop: 24,
    justifyContent: 'center',
  },
  link: {
    color: '#2563eb',
    fontWeight: '600',
  },
  notice: {
    color: '#15803d',
  },
  forgotRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  altSection: {
    marginTop: 20,
    gap: 10,
  },
  orText: {
    textAlign: 'center',
    color: '#94a3b8',
  },
  altButton: {
    paddingVertical: 2,
  },
  serverRow: {
    marginTop: 32,
    alignItems: 'center',
  },
  serverText: {
    color: '#94a3b8',
  },
});

export default LoginScreen;

