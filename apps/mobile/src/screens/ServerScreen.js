import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../ui/AuthLayout';
import { Banner, Button, Field } from '../ui/components';
import { type } from '../ui/theme';

// Asks for the CivicFix server address. Shown on first launch of a build that
// has no address built in, and from the login screen to change it.
const ServerScreen = () => {
  const navigation = useNavigation();
  const { serverUrl, changeServer } = useAuth();
  const [address, setAddress] = useState(serverUrl || '');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);
  const canGoBack = Boolean(serverUrl) && navigation.canGoBack();

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
    <AuthLayout
      back={canGoBack}
      title="Connect to your CivicFix server"
      subtitle="Enter the address your city or organisation gave you, for example https://civicfix.example.com"
    >
      <Field
        label="Server address"
        testID="server-address"
        value={address}
        onChangeText={(value) => {
          setAddress(value);
          setError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        onSubmitEditing={handleConnect}
      />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button
        title={checking ? 'Checking' : 'Connect'}
        onPress={handleConnect}
        loading={checking}
        testID="server-connect"
      />
      {checking ? (
        <Text style={[type.caption, styles.center]}>
          A server that has been idle can take up to a minute to answer.
        </Text>
      ) : null}
      {canGoBack ? (
        <Button
          variant="ghost"
          title="Cancel"
          onPress={() => navigation.goBack()}
          disabled={checking}
        />
      ) : null}
    </AuthLayout>
  );
};

const styles = StyleSheet.create({ center: { textAlign: 'center' } });

export default ServerScreen;
