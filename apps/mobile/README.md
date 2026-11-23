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
| Home (all issues, status and category filters) | `HomeScreen` |
| My reports | `MyReportsScreen` (exported from `HomeScreen`) |
| Report an issue | `ReportScreen` |
| Issue detail and timeline | `IssueDetailScreen` |
| Profile (password, sign out, sign out everywhere) | `ProfileScreen` |

Sign-in state lives in `src/context/AuthContext.js`; HTTP, token renewal and the server address in `src/utils/api.js`. Tokens are stored in AsyncStorage. Google sign-in returns to the app through the `civicfix://auth` link.

## Design system

Every screen is built from `src/ui`, so new screens should be too:

| File | Contents |
|---|---|
| `theme.js` | Colours (brand blue from the app icon; status colours shared with the admin dashboard), spacing, radii, the type scale, and the Paper and navigation themes built from them |
| `components.js` | `Button`, `Field`, `Banner`, `StatusBadge`, `Tag`, `ProgressTrack`, `EmptyState`, `Skeleton`, `Card`, `ListRow`, `Avatar`, `Logo`, `ScreenHeader`, `StatusBarBackdrop`, `IconButton`, `PressableScale` |
| `AuthLayout.js` | The frame shared by the sign-in screens |
| `time.js` | `timeAgo`, `shortDate`, `dateTime` |

Guidelines: sentence case, no emoji in the interface, colours and sizes only from `theme.js`, safe-area insets rather than fixed top padding, and a `testID` on anything the [phone tests](../../e2e/mobile) tap.

## Configuration

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | API root without `/api`. Optional: without it the app asks on first launch |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional map on the report screen |
| `ANDROID_VERSION_CODE` | Build number for release APKs |

Package name `com.civicfix.app`, URL scheme `civicfix` (`app.json`).

## Building the APK

Release APKs are built, launch-tested on an emulator and published by GitHub Actions — see [Android app releases](../../docs/deployment/android-app.md). End-to-end flows: [`e2e/mobile`](../../e2e/README.md).
