# CivicFix Mobile (Expo)

React Native (Expo) client for the CivicFix platform. Provides authentication, issue reporting, and a tabbed experience connected to the Node.js backend.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure the backend URL. The app reads `EXPO_PUBLIC_API_URL` first:
   ```bash
   EXPO_PUBLIC_API_URL=http://192.168.x.x:5000 npx expo start
   ```
   The URL should point to the backend root; the app adds endpoint paths such as `/health` and `/api/issues` itself.

   For a tunnel or deployed backend, use the corresponding HTTPS URL:
   ```bash
   EXPO_PUBLIC_API_URL=https://your-api.example.com npx expo start
   ```

3. Start the development server:
   ```bash
   npm start
   ```
4. Scan the QR code using Expo Go on your device. For a local LAN backend, the device and backend computer must be reachable from the same network.

## Features

- **Auth Flow** – Login & Signup screens with validation, JWT persistence, and Axios authentication.
- **Bottom Tabs** – Home (issue feed), Report (camera + location), Profile (account info).
- **Issue Reporting** – Capture a photo, obtain GPS location, and submit to `POST /api/issues`.
- **Issue Feed** – Fetch and render community issues with status chips and metadata.
- **Responsive UI** – Built with React Native Paper for fast theming and consistent styling.

## Folder Structure

```text
mobile/
├── App.js
├── app.json
├── src
│   ├── components
│   │   └── IssueCard.js
│   ├── context
│   │   └── AuthContext.js
│   ├── navigation
│   │   └── AppNavigator.js
│   ├── screens
│   │   ├── HomeScreen.js
│   │   ├── LoginScreen.js
│   │   ├── ProfileScreen.js
│   │   ├── ReportScreen.js
│   │   └── SignupScreen.js
│   └── utils
│       └── api.js
└── README.md
```

## Notes

- `EXPO_PUBLIC_API_URL` is the supported runtime configuration for the mobile API client.
- The app currently has a development LAN-IP fallback for backwards compatibility, but configuring `EXPO_PUBLIC_API_URL` is recommended so the app is not tied to one developer machine.
- Staff/Admin accounts must be provisioned through backend tools; public registration creates citizens only.
- The Report flow uploads selected images to the backend when an image is provided.
- Enable PostGIS in PostgreSQL when using the project's geospatial features.

## Troubleshooting

If the app cannot connect to the backend:

1. Confirm the backend is running on port `5000` (or the configured port).
2. Confirm `EXPO_PUBLIC_API_URL` points to a reachable backend URL.
3. Restart Expo after changing an `EXPO_PUBLIC_*` variable.
4. Check the app logs for the `[api] API_BASE_URL` message.
5. Verify the backend health endpoint at `<API_BASE_URL>/health`.

## Next Steps

- Add refresh-token/session rotation for long-lived authentication.
- Build filters and map views for issues.
- Expand profile management (notifications, saved locations, password reset).
- Hook Firebase Cloud Messaging for push notifications.
