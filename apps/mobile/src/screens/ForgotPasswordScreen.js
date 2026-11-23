import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../ui/AuthLayout";
import { Banner, Button, Field } from "../ui/components";

// Email -> code from the email + new password.
const ForgotPasswordScreen = () => {
  const navigation = useNavigation();
  const { forgotPassword, resetPassword } = useAuth();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const sendCode = async () => {
    try {
      setBusy(true);
      setError(null);
      const result = await forgotPassword(email.trim());
      setInfo(result.message);
      setStep("code");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (password.length < 8) return setError("Use at least 8 characters for the new password.");
    if (password !== confirm) return setError("The two passwords do not match.");
    try {
      setBusy(true);
      setError(null);
      const result = await resetPassword({ email: email.trim(), code: code.trim(), newPassword: password });
      navigation.navigate("Login", { notice: result.message });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <AuthLayout
      back
      title="Reset your password"
      subtitle={
        step === "email"
          ? "Enter the email address of your account and we will send you a 6-digit code."
          : "Enter the code from the email and choose a new password."
      }
    >
      <Field
        testID="forgot-email"
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        disabled={step === "code"}
      />
      {step === "code" ? (
        <>
          {info ? <Banner tone="info">{info}</Banner> : null}
          <Field testID="forgot-code" label="Code from the email" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
          <Field testID="forgot-password" label="New password" value={password} onChangeText={setPassword} secure autoComplete="new-password" />
          <Field testID="forgot-confirm" label="Confirm new password" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" />
        </>
      ) : null}

      {error ? <Banner tone="error">{error}</Banner> : null}

      <Button
        testID="forgot-submit"
        title={step === "email" ? "Send reset code" : "Set new password"}
        onPress={step === "email" ? sendCode : reset}
        loading={busy}
        disabled={!email.trim()}
      />
    </AuthLayout>
  );
};

export default ForgotPasswordScreen;
