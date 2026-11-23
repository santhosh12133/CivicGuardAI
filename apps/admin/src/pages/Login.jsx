import React, { useEffect, useState } from "react";
import {
  Box,
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
import Logo from "../components/Logo";
import { STATUS_HEX } from "../theme/theme";

const STAFF_ROLES = ["staff", "admin"];

const GOOGLE_ERRORS = {
  not_staff: "That Google account is not a CivicFix staff account. Ask an administrator to add you, then try again.",
  cancelled: "Google sign-in was cancelled.",
  google_failed: "Google sign-in did not work. Please try again.",
};

const errorText = (err, fallback) =>
  err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || err.message || fallback;

const NAVY = "#0f1b2d";

// A map pin whose tip sits at (0, 0).
const PIN = "M0 0C-2-7-12-12-12-23a12 12 0 1 1 24 0C12-12 2-7 0 0z";

const Pin = ({ x, y, color, scale = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d={PIN} fill={color} />
    <circle cy="-23" r="4.5" fill={NAVY} />
  </g>
);

// A quiet street plan with a few reports on it, in the status colours used
// across the dashboard.
const StreetPlan = () => (
  <Box
    component="svg"
    viewBox="0 0 600 800"
    preserveAspectRatio="xMidYMin slice"
    aria-hidden
    sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
  >
    <rect x="172" y="226" width="92" height="104" rx="4" fill="#16a34a" opacity="0.07" />
    <path d="M-20 70C110 120 90 250 250 290S450 430 640 400" fill="none" stroke="#3b82f6" strokeOpacity="0.13" strokeWidth="24" />
    <g stroke="#94a3b8" strokeOpacity="0.09" strokeWidth="3">
      {[90, 150, 290, 360, 440, 610, 690, 760].map((y) => <line key={`h${y}`} x1="0" x2="600" y1={y} y2={y} />)}
      {[60, 250, 330, 500, 560].map((x) => <line key={`v${x}`} y1="0" y2="800" x1={x} x2={x} />)}
    </g>
    <g stroke="#94a3b8" strokeOpacity="0.16" strokeWidth="9" strokeLinecap="round">
      <line x1="0" x2="600" y1="220" y2="220" />
      <line x1="0" x2="600" y1="530" y2="530" />
      <line x1="165" x2="165" y1="0" y2="800" />
      <line x1="420" x2="420" y1="0" y2="800" />
      <line x1="0" x2="600" y1="720" y2="330" />
    </g>
    <Pin x={165} y={140} color={STATUS_HEX.Open} />
    <Pin x={500} y={160} color={STATUS_HEX.Resolved} scale={0.85} />
    <Pin x={330} y={220} color={STATUS_HEX.Resolved} />
    <Pin x={60} y={290} color={STATUS_HEX["In Progress"]} scale={0.85} />
    <Pin x={420} y={300} color={STATUS_HEX["In Progress"]} />
    <Pin x={250} y={360} color={STATUS_HEX.Open} scale={0.85} />
  </Box>
);

const LEGEND = [
  ["Open", STATUS_HEX.Open],
  ["In progress", STATUS_HEX["In Progress"]],
  ["Resolved", STATUS_HEX.Resolved],
];

// The left half on wide screens: what this portal is for.
const BrandPanel = () => (
  <Box
    sx={{
      display: { xs: "none", md: "flex" },
      position: "relative",
      overflow: "hidden",
      flexDirection: "column",
      width: { md: "46%", lg: "44%" },
      maxWidth: 680,
      bgcolor: NAVY,
      color: "#fff",
      p: { md: 5, lg: 6 },
    }}
  >
    <StreetPlan />
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(to bottom, ${NAVY}00 30%, ${NAVY} 62%)`,
      }}
    />

    <Box sx={{ position: "relative", display: "flex", alignItems: "center", gap: 1.5 }}>
      <Logo size={36} />
      <Typography sx={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" }}>CivicFix</Typography>
    </Box>

    <Box sx={{ position: "relative", maxWidth: 460, mt: "auto", mb: 5 }}>
      <Typography component="p" sx={{ fontSize: { md: 26, lg: 30 }, fontWeight: 600, lineHeight: 1.25, letterSpacing: "-0.02em", mb: 2 }}>
        Every problem residents report in the CivicFix app comes here to be checked, assigned and fixed.
      </Typography>
      <Typography sx={{ color: "#a8b3c7", fontSize: 15, lineHeight: 1.6, mb: 4 }}>
        Potholes, broken streetlights, garbage, drainage and water supply problems, each with the photo and location the resident sent.
      </Typography>
      <Box component="ul" aria-label="Status colours" sx={{ display: "flex", gap: 3, listStyle: "none", m: 0, p: 0 }}>
        {LEGEND.map(([label, color]) => (
          <Box component="li" key={label} sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 14, color: "#cbd5e1" }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color }} />
            {label}
          </Box>
        ))}
      </Box>
    </Box>

    <Typography sx={{ position: "relative", color: "#7c8aa3", fontSize: 13 }}>
      &copy; {new Date().getFullYear()} CivicFix
    </Typography>
  </Box>
);

const submitSx = { py: 1.25, fontSize: 15 };

const headingSx = { fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, mb: 1 };

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
      <Typography component="h1" sx={headingSx}>Reset your password</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {step === "email"
          ? "Enter the email address of your staff account and we will send you a 6-digit code."
          : "Enter the code from the email and choose a new password."}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {info && step === "code" && <Alert severity="info" sx={{ mb: 2 }}>{info}</Alert>}
      <TextField fullWidth label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        required disabled={step === "code" || busy} sx={{ mb: 2 }} />
      {step === "code" && (
        <>
          <TextField fullWidth label="Code from the email" value={code} onChange={(e) => setCode(e.target.value)}
            required inputProps={{ inputMode: "numeric", maxLength: 6 }} sx={{ mb: 2 }} />
          <TextField fullWidth label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required autoComplete="new-password" helperText="At least 8 characters" sx={{ mb: 2 }} />
          <TextField fullWidth label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            required autoComplete="new-password" sx={{ mb: 2 }} />
        </>
      )}
      <Button type="submit" fullWidth variant="contained" size="large" disabled={busy} sx={submitSx}>
        {busy ? <CircularProgress size={24} /> : step === "email" ? "Send reset code" : "Set new password"}
      </Button>
      <Button fullWidth onClick={() => onDone("", email)} sx={{ mt: 1 }}>
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

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.paper" }}>
      <BrandPanel />

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", px: { xs: 3, sm: 6 }, py: { xs: 3, sm: 5 } }}>
        <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1.25 }}>
          <Logo size={32} />
          <Typography sx={{ fontSize: 17, fontWeight: 700 }}>CivicFix</Typography>
        </Box>

        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", py: 4 }}>
          <Box sx={{ width: "100%", maxWidth: 380 }}>
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
                <Typography component="h1" sx={headingSx}>Sign in</Typography>
                <Typography color="text.secondary" sx={{ mb: 3.5 }}>
                  Use your CivicFix staff account.
                </Typography>

                {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <form onSubmit={handleSubmit}>
                  <TextField fullWidth label="Email Address" name="email" type="email" value={formData.email}
                    onChange={handleChange} required sx={{ mb: 2 }} disabled={loading} autoComplete="username" autoFocus />
                  <TextField fullWidth label="Password" name="password" type="password" value={formData.password}
                    onChange={handleChange} required sx={{ mb: providers.passwordReset ? 1 : 3 }} disabled={loading}
                    autoComplete="current-password" />
                  {providers.passwordReset && (
                    <Box sx={{ textAlign: "right", mb: 2.5 }}>
                      <Link component="button" type="button" variant="body2" underline="hover" onClick={() => setForgot(true)}>
                        Forgot password?
                      </Link>
                    </Box>
                  )}
                  <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={submitSx}>
                    {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In"}
                  </Button>
                </form>

                {providers.google && (
                  <>
                    <Divider sx={{ my: 3, color: "text.secondary", fontSize: 13 }}>or</Divider>
                    <Button fullWidth variant="outlined" size="large" color="inherit" startIcon={<GoogleIcon />}
                      href={adminAuth.googleStartUrl()} disabled={loading}
                      sx={{ ...submitSx, borderColor: "divider", fontWeight: 600 }}>
                      Sign in with Google
                    </Button>
                  </>
                )}
              </>
            )}
          </Box>
        </Box>

        <Box sx={{ maxWidth: 380, width: "100%", mx: "auto" }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Only staff and administrator accounts can sign in here. Residents report problems with the CivicFix
            app on their phone.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
