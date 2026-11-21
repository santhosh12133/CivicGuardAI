# Environment Reference

This file is the operational contract for configuration. Real secrets must never be committed.

## Backend variables

| Variable | Required | Example | Sensitive | Purpose |
|---|---|---|---|---|
| `NODE_ENV` | Production: yes | `production` | No | Selects production behavior |
| `PORT` | No | `5000` | No | HTTP listener port |
| `DATABASE_URL` | One of these | `postgres://...` | Yes | PostgreSQL connection string (Render, Neon, local) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | …or these | `civicfix-db.xxxx.rds.amazonaws.com` | `DB_PASSWORD`: Yes | Connection settings as separate values (used on AWS, where the password comes from Secrets Manager). Ignored when `DATABASE_URL` is set |
| `DATABASE_SSL_CA` | No | `/app/certs/rds-global-bundle.pem` | No | PEM file of certificate authorities used to verify the database's TLS certificate. The Docker image ships Amazon RDS's bundle at that path |
| `DATABASE_SSL` | External DBs | `true` | No | Use TLS for the database connection. Needed for Render's *external* URL, Neon, Supabase, etc. Also enabled by `sslmode=require` in the URL |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | No | `false` | No | Set to `false` only if the provider's certificate is not trusted by Node |
| `JWT_SECRET` | Yes | random 64+ char value | Yes | JWT signing/verification secret |
| `CORS_ORIGINS` | Production: yes | `https://admin.example.com` | No | Comma-separated browser origin allow-list. If empty in production the API still starts (the mobile app sends no `Origin`) but refuses every browser origin |
| `API_HOST` | No | `api.example.com` | No | Host used in photo URLs. Leave unset on Render (the request's public host is used); set it for a custom API domain |
| `API_PROTOCOL` | Production: yes | `https` | No | URL scheme used for generated URLs |
| `RATE_LIMIT_MAX` | No | `300` | No | Requests per minute allowed from one IP address (default 300). Staff behind one office connection share an IP |
| `GEOCODING_ENABLED` | No | `true` | No | Set to `false` to skip the Nominatim reverse-geocoding call and store a `Location (lat, lon)` label instead. Used by the test suite; also useful offline or during a provider outage |
| `ACCESS_TOKEN_TTL` | No | `15m` | No | Lifetime of an access token (default `15m`). Apps renew it silently with the refresh token |
| `REFRESH_TOKEN_DAYS` | No | `30` | No | How long a sign-in lasts without use (default 30 days). Each renewal replaces the refresh token |
| `AUTH_RATE_LIMIT_MAX` | No | `30` | No | Sign-in, code and reset requests per minute from one IP (default 30) |
| `EMAIL_PROVIDER` | For "Forgot password" | `ses` | No | `ses` sends reset codes with Amazon SES; `log` prints them to the API log (default outside production). Unset in production = password reset switched off |
| `EMAIL_FROM` | With `ses` | `no-reply@yourcity.gov.in` | No | Sender address; must be verified in SES |
| `SMS_PROVIDER` | For phone sign-in | `sns` | No | `sns` sends codes with Amazon SNS; `log` prints them (default outside production). Unset in production = phone sign-in switched off |
| `SMS_SENDER_ID`, `SMS_ENTITY_ID`, `SMS_TEMPLATE_ID` | India: yes | `CIVFIX` | No | Registered sender ID and DLT entity/template IDs, required by Indian carriers |
| `AWS_REGION` | With `ses`/`sns` | `ap-south-1` | No | Region for SES/SNS. Credentials come from the ECS task role (or `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` elsewhere) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | For Google sign-in | `1234-abc.apps.googleusercontent.com` | Secret: Yes | Google OAuth "Web application" client. Both unset = Google button hidden |
| `PUBLIC_API_URL` | No | `https://api.example.com` | No | Public address of the API, used for the Google redirect `<PUBLIC_API_URL>/api/auth/google/callback`. Defaults to the request's own host |
| `ADMIN_URL` | No | `https://admin.example.com` | No | Where staff return after Google sign-in. Defaults to the first `CORS_ORIGINS` entry |
| `APP_REDIRECT_URI` | No | `civicfix://auth` | No | Where the citizen app returns after Google sign-in |
| `TEST_OTP_PHONE`, `TEST_OTP_CODE` | Tests only | `+919999900001`, `246810` | No | A fixed SMS code for one test number (end-to-end tests). Never set in production |
| `TEST_DATABASE_URL` | Tests only | `postgres://postgres:postgres@localhost:5432/civicguard_test` | Yes | Disposable database for `npm test`. Integration tests drop and recreate every table, so never point this at real data |
| `DB_SYNC` | Transitional only | `false` | No | Explicit schema synchronization switch; do not rely on it for mature production migration management |

The current example file documents these variables and explicitly warns against committing real database credentials. fileciteturn260file0L2-L6

The API startup requires a JWT secret of at least 32 characters. Without `CORS_ORIGINS` in production it logs a warning and blocks all browser origins.

## Admin variables

Expected client-side configuration:

| Variable | Example | Sensitive | Purpose |
|---|---|---|---|
| `VITE_API_URL` | `https://api.example.com/api` | No | API base URL embedded into the Vite build |

Never place private credentials in a `VITE_*` variable because client-side Vite variables are shipped to the browser.

## Mobile variables

Expected Expo client configuration:

| Variable | Example | Sensitive | Purpose |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://api.example.com` | No | Backend root URL embedded into the mobile build |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps Android key | No (restrict it to the app's package + signing certificate) | Optional. Enables the map on the report screen; without it the app shows an "Open in Maps" link instead of crashing |
| `ANDROID_VERSION_CODE` | `42` | No | Build number; must increase for every APK you distribute. The APK workflow uses the GitHub run number |

Do not place secrets in `EXPO_PUBLIC_*` variables. The deployment guide requires the mobile value to omit `/api` because the client adds API paths itself. fileciteturn255file0L2-L2

## Configuration precedence

Use this precedence for deployment:

```text
Hosting platform / CI secrets
          > runtime environment variables
          > local .env
          > documented defaults
```

Never make source-code defaults silently override an explicitly supplied production variable.

## Secret-management rules

- Keep `.env` files out of Git.
- Rotate compromised secrets immediately.
- Use separate credentials for development, staging, and production.
- Do not print database URLs, JWT secrets, Authorization headers, or session material to logs.
- Do not put backend secrets in admin/mobile environment variables.

## Configuration validation checklist

Before release:

- [ ] Required variables are present.
- [ ] Production API uses HTTPS.
- [ ] CORS allow-list contains only trusted origins.
- [ ] JWT secret is randomly generated and long enough.
- [ ] Database points to the intended environment.
- [ ] Client API URLs do not reference a developer LAN address.
- [ ] No secrets appear in build artifacts or repository files.
