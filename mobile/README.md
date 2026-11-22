# CivicFix Android app

Expo SDK 54 / React Native 0.81 app for citizens: sign up, report an issue with a photo and location, and follow its progress.

## Quick start

```bash
cp .env.example .env        # EXPO_PUBLIC_API_URL=http://<your LAN IP>:5000
npm ci
npm start                   # scan the QR code with Expo Go, or press "a" for an emulator
```

Use your computer's LAN IP, not `localhost` (the phone cannot reach it); the Android emulator reaches your computer at `http://10.0.2.2:5000`. The server can also be changed in the app: **Login → Server**.

## Screens

| Screen | File |
|---|---|
| Sign in (email, phone, Google), forgot password, sign up, server address | `LoginScreen`, `PhoneLoginScreen`, `ForgotPasswordScreen`, `SignupScreen`, `ServerScreen` |
| Home (all issues, category filter) | `HomeScreen` |
| My Reports | `MyReportsScreen` (exported from `HomeScreen`) |
| Report an issue | `ReportScreen` |
| Issue detail and timeline | `IssueDetailScreen` |
| Profile (password, sign out, sign out everywhere) | `ProfileScreen` |

Sign-in state lives in `src/context/AuthContext.js`; HTTP, token renewal and the server address in `src/utils/api.js`. Tokens are stored in AsyncStorage. Google sign-in returns to the app through the `civicfix://auth` link.

## Configuration

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | API root without `/api`. Optional: without it the app asks on first launch |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional map on the report screen |
| `ANDROID_VERSION_CODE` | Build number for release APKs |

Package name `com.civicfix.app`, URL scheme `civicfix` (`app.json`).

## Building the APK

Release APKs are built, launch-tested on an emulator and published by GitHub Actions — see [Android app releases](../docs/deployment/android-app.md). End-to-end flows: [`e2e/mobile`](../e2e/README.md).
