import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Link,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import { useNavigate, useSearchParams } from "react-router-dom";
import { adminAuth, session } from "../api/api";

const STAFF_ROLES = ["staff", "admin"];

const GOOGLE_ERRORS = {
  not_staff: "That Google account is not a CivicFix staff account. Ask an administrator to add you, then try again.",
  cancelled: "Google sign-in was cancelled.",
  google_failed: "Google sign-in did not work. Please try again.",
};

const errorText = (err, fallback) =>
  err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || err.message || fallback;

const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 2 } };

// "Forgot password?": email -> code from the email + new password.
const ForgotPassword = ({ initialEmail, onDone }) => {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState(initialEmail || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const sendCode = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError("");
      const result = await adminAuth.forgotPassword(email.trim());
      setInfo(result.message);
      setStep("code");
    } catch (err) {
      setError(errorText(err, "Could not send the code"));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    if (password.length < 8) return setError("The new password must be at least 8 characters.");
    if (password !== confirm) return setError("The new passwords do not match.");
    try {
      setBusy(true);
      setError("");
      const result = await adminAuth.resetPassword(email.trim(), code.trim(), password);
      onDone(result.message, email.trim());
    } catch (err) {
      setError(errorText(err, "Could not reset the password"));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Box component="form" onSubmit={step === "email" ? sendCode : reset} aria-label="Reset password">
      <Typography variant="h6" gutterBottom>Reset your password</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {info && step === "code" && <Alert severity="info" sx={{ mb: 2 }}>{info}</Alert>}
      <TextField fullWidth label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        required disabled={step === "code" || busy} sx={{ mb: 2, ...fieldSx }} />
      {step === "code" && (
        <>
          <TextField fullWidth label="Code from the email" value={code} onChange={(e) => setCode(e.target.value)}
            required inputProps={{ inputMode: "numeric", maxLength: 6 }} sx={{ mb: 2, ...fieldSx }} />
          <TextField fullWidth label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required autoComplete="new-password" helperText="At least 8 characters" sx={{ mb: 2, ...fieldSx }} />
          <TextField fullWidth label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            required autoComplete="new-password" sx={{ mb: 2, ...fieldSx }} />
        </>
      )}
      <Button type="submit" fullWidth variant="contained" size="large" disabled={busy} sx={{ py: 1.25, borderRadius: 2, textTransform: "none" }}>
        {busy ? <CircularProgress size={24} /> : step === "email" ? "Send reset code" : "Set new password"}
      </Button>
      <Button fullWidth onClick={() => onDone("", email)} sx={{ mt: 1, textTransform: "none" }}>
        Back to sign in
      </Button>
    </Box>
  );
};

const Login = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [providers, setProviders] = useState({ google: false, passwordReset: false });
  const [forgot, setForgot] = useState(false);

  const finishSignIn = (data) => {
    if (!data.user || !STAFF_ROLES.includes(data.user.role)) {
      adminAuth.endSession(data.refreshToken);
      throw new Error("This portal is restricted to staff and admin accounts.");
    }
    session.save(data);
    navigate("/", { replace: true });
  };

  useEffect(() => {
    adminAuth.providers().then(setProviders).catch(() => {});

    // Back from Google: swap the one-time code for a session.
    const googleCode = searchParams.get("google_code");
    const googleError = searchParams.get("error");
    if (googleCode || googleError) setSearchParams({}, { replace: true });
    if (googleError) setError(GOOGLE_ERRORS[googleError] || GOOGLE_ERRORS.google_failed);
    if (googleCode) {
      setLoading(true);
      adminAuth
        .googleExchange(googleCode)
        .then(finishSignIn)
        .catch((err) => setError(errorText(err, "Google sign-in did not work. Please try again.")))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      finishSignIn(await adminAuth.login(formData.email.trim(), formData.password));
    } catch (err) {
      setError(errorText(err, "Login failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const gradientStyle = {
    background: "linear-gradient(-45deg, #1976d2, #2196f3, #64b5f6, #42a5f5)",
    backgroundSize: "400% 400%",
    animation: "gradient 15s ease infinite",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <Box sx={gradientStyle}>
      <Card sx={{ maxWidth: 420, width: "100%", mx: 2, borderRadius: 2, boxShadow: "0 8px 32px rgba(0,0,0,0.1)", background: "rgba(255,255,255,0.95)" }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, color: "primary.main" }}>
              Welcome Back
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
              CivicFix Officer Portal
            </Typography>
          </Box>

          {forgot ? (
            <ForgotPassword
              initialEmail={formData.email}
              onDone={(message, email) => {
                setForgot(false);
                setNotice(message);
                setFormData({ email: email || formData.email, password: "" });
              }}
            />
          ) : (
            <>
              {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <form onSubmit={handleSubmit}>
                <TextField fullWidth label="Email Address" name="email" type="email" value={formData.email}
                  onChange={handleChange} required sx={{ mb: 2, ...fieldSx }} disabled={loading} autoComplete="username" />
                <TextField fullWidth label="Password" name="password" type="password" value={formData.password}
                  onChange={handleChange} required sx={{ mb: 1, ...fieldSx }} disabled={loading} autoComplete="current-password" />
                {providers.passwordReset && (
                  <Box sx={{ textAlign: "right", mb: 2 }}>
                    <Link component="button" type="button" variant="body2" onClick={() => setForgot(true)}>
                      Forgot password?
                    </Link>
                  </Box>
                )}
                <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
                  sx={{ py: 1.5, mt: providers.passwordReset ? 0 : 1, borderRadius: 2, textTransform: "none", fontSize: "1.1rem", fontWeight: 600 }}>
                  {loading ? <CircularProgress size={24} /> : "Sign In"}
                </Button>
              </form>

              {providers.google && (
                <>
                  <Divider sx={{ my: 2.5 }}>or</Divider>
                  <Button fullWidth variant="outlined" size="large" startIcon={<GoogleIcon />} href={adminAuth.googleStartUrl()}
                    disabled={loading} sx={{ py: 1.25, borderRadius: 2, textTransform: "none" }}>
                    Sign in with Google
                  </Button>
                </>
              )}
            </>
          )}

          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 3, fontStyle: "italic" }}>
            Secure access for authorized personnel only
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;
