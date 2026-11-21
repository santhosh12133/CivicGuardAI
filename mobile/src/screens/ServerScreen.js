import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, TextInput, Text, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

// Asks for the CivicFix server address. Shown on first launch of a build that
// has no address built in, and from the login screen to change it.
const ServerScreen = () => {
  const navigation = useNavigation();
  const { serverUrl, changeServer } = useAuth();
  const [address, setAddress] = useState(serverUrl || '');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    try {
      setChecking(true);
      setError(null);
      await changeServer(address);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text variant="headlineMedium" style={styles.title}>
          Connect to your CivicFix server
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Enter the server address you were given, for example
          https://civicfix-api.example.com
        </Text>

        <TextInput
          label="Server address"
          value={address}
          onChangeText={setAddress}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          mode="outlined"
          style={styles.input}
          onSubmitEditing={handleConnect}
        />

        {error && <HelperText type="error">{error}</HelperText>}

        <Button mode="contained" onPress={handleConnect} loading={checking} disabled={checking} style={styles.button}>
          {checking ? 'Checking…' : 'Connect'}
        </Button>
        {checking && (
          <Text variant="bodySmall" style={styles.hint}>
            A sleeping server can take up to a minute to answer.
          </Text>
        )}

        {Boolean(serverUrl) && navigation.canGoBack() && (
          <Button mode="text" onPress={() => navigation.goBack()} style={styles.cancel} disabled={checking}>
            Cancel
          </Button>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 120 },
  title: { fontWeight: '700' },
  subtitle: { marginTop: 8, marginBottom: 32, color: '#64748b' },
  input: { marginBottom: 8 },
  button: { marginTop: 8, paddingVertical: 4 },
  hint: { marginTop: 12, color: '#64748b', textAlign: 'center' },
  cancel: { marginTop: 16 },
});

export default ServerScreen;
