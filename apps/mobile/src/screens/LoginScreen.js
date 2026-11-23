import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../ui/AuthLayout";
import { Banner, Button, Field, Icon } from "../ui/components";
import { colors, space, type } from "../ui/theme";

const LoginScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { login, serverUrl, providers, authNotice, setAuthNotice, signInWithGoogle } = useAuth();
  const notice = route.params?.notice;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) return setError("Enter your email and password.");
    if (!trimmedEmail.includes("@")) return setError("Enter a valid email address.");
    try {
      setLoading(true);
      setError(null);
      setAuthNotice(null);
      await login({ email: trimmedEmail, password: trimmedPassword });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    return undefined;
  };

  const host = serverUrl ? serverUrl.replace(/^https?:\/\//, "") : "not set";

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to report problems in your area and follow them until they are fixed."
      footer={
        <View style={styles.footer}>
          <View style={styles.signupRow}>
            <Text style={type.body}>New to CivicFix?</Text>
            <Pressable onPress={() => navigation.navigate("Signup")} testID="go-to-signup" hitSlop={8}>
              <Text style={styles.link}>Create an account</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => navigation.navigate("Server")} style={styles.serverRow} testID="change-server" hitSlop={6}>
            <Icon name="server-network" size={14} color={colors.faint} />
            <Text style={styles.serverText} numberOfLines={1}>Server: {host}</Text>
            <Text style={styles.serverLink}>Change</Text>
          </Pressable>
        </View>
      }
    >
      <Field
        label="Email"
        testID="login-email"
        value={email}
        onChangeText={(value) => { setEmail(value); setError(null); }}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
      />
      <Field
        label="Password"
        testID="login-password"
        value={password}
        onChangeText={(value) => { setPassword(value); setError(null); }}
        secure
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
      />
      {providers.passwordReset ? (
        <Pressable onPress={() => navigation.navigate("ForgotPassword")} testID="go-to-forgot" style={styles.forgot} hitSlop={8}>
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
      ) : null}

      {notice && !error ? <Banner tone="success">{notice}</Banner> : null}
      {authNotice ? <Banner tone="error">{authNotice}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      <Button title="Sign in" onPress={handleLogin} loading={loading} testID="login-submit" style={styles.submit} />

      {providers.phone || providers.google ? (
        <>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={type.caption}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          {providers.phone ? (
            <Button
              variant="secondary"
              icon="cellphone"
              title="Continue with phone number"
              onPress={() => navigation.navigate("PhoneLogin")}
              testID="go-to-phone"
            />
          ) : null}
          {providers.google ? (
            <Button
              variant="secondary"
              icon="google"
              title="Continue with Google"
              onPress={() => signInWithGoogle().catch((err) => setAuthNotice(err.message))}
              testID="google-signin"
            />
          ) : null}
        </>
      ) : null}
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  link: { fontSize: 15, fontWeight: "600", color: colors.brand },
  forgot: { alignSelf: "flex-end", marginTop: -space.xs },
  submit: { marginTop: space.xs },
  divider: { flexDirection: "row", alignItems: "center", gap: space.md, marginVertical: space.xs },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong },
  footer: { gap: space.xl, alignItems: "center" },
  signupRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  serverRow: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  serverText: { ...type.micro, flexShrink: 1 },
  serverLink: { ...type.micro, color: colors.brand, fontWeight: "600" },
});

export default LoginScreen;
