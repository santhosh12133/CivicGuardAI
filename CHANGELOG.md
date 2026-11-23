# Changelog

All notable changes to CivicFix are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org) (see [Release process](docs/deployment/release-process.md)).

## [Unreleased]

### Added

- **Docker Compose deployment** for a shared server (`docker-compose.yml`, `deploy/docker-compose.prod.yml`, `deploy/setup-server.sh`, `deploy/backup.sh`), served through another app's Caddy over the `caddy-shared` network; admin portal Docker image. Tested on x86_64 and arm64 in CI.
- **Sign-in:** phone number + SMS code (Amazon SNS, India DLT), Sign in with Google, and "Forgot password" with an emailed code (Amazon SES), in both the admin portal and the app. Each method switches on only when configured (`GET /api/auth/providers`).
- **Secure sessions:** 15-minute access tokens, rotating refresh tokens with reuse detection, server-side sign-out, "sign out everywhere", other devices signed out after a password change, account lockout after five wrong passwords, stricter rate limit on sign-in endpoints.
- **Features:** issue categories with filters; My Reports; reporter shown to staff; public updates timeline with staff notes and resolution photos; admin overview statistics; staff management (add with one-time password, change role, reset password); change password in portal and app; server address setting in the app.
- **AWS deployment:** CloudFormation templates and GitHub Actions workflows (OIDC, no keys) for RDS, ECS Express Mode and S3 + CloudFront; admin task workflow for creating staff and pruning photos; API task role limited to sending email and SMS.
- **Android releases:** signed APK built, launch-tested on an emulator and published to GitHub Releases.
- **Tests:** backend unit and integration suites on PostgreSQL; Playwright (admin portal) and Maestro (Android) end-to-end suites on every pull request.
- **Repository:** structured documentation in `docs/` (architecture, ADRs, API, deployment, operations, security, testing, reference); `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue forms, CODEOWNERS, Dependabot, EditorConfig; root convenience scripts; admin lint in CI.

### Changed

- **Repository layout:** the apps moved to `apps/api` (was `backend/`), `apps/admin` (was `admin/`) and `apps/mobile` (was `mobile/`); packages renamed `civicfix-api`, `civicfix-admin`, `civicfix-mobile`. Prettier config moved to the root.
- Replaced the placeholder app icons and the portal's Vite icon with a CivicFix icon.
- Report creation no longer logs request bodies, coordinates or EXIF details.
- Photos are stored in PostgreSQL, so they survive restarts and redeploys.
- Default rate limit raised to 300 requests/minute per IP and made configurable (`RATE_LIMIT_MAX`).
- Emails are case-insensitive for sign-in.
- JWT verification accepts only HS256.
- Maintenance scripts renamed: `test:connection` → `check:connection`, `test-geocoding` → `check:geocoding`.

### Fixed

- New issues can no longer be created with a status other than `Open`.
- The 24-hour photo rule could be bypassed by removing `DateTimeOriginal` (filesystem dates were used); only embedded dates count now.
- Photos dated in the future were accepted.
- Rejected photos stayed in `uploads/` and could be viewed; they are now deleted.
- Android photo uploads always failed ("Network Error") because of a multipart `Content-Type` problem.
- Database TLS settings were lost when `DATABASE_URL` contained `sslmode`.

### Removed

- One-off column migration scripts (`add-*-column`, `fix-address-column`) and image-hash probes; schema upgrades happen automatically at start-up.
- `backend/PHOTO_UPLOAD_SETUP.md`, `backend/TROUBLESHOOTING.md`, `backend/VIEW_USERS.md`, root `DEPLOYMENT.md` and `PRODUCTION_READINESS.md` (content moved into `docs/`).

### Security

- The old `create-officers.js` script, which created admins with a fixed password, was removed earlier; change any accounts it created.

### Operational

- If you configured Vercel or Render by hand, change the root directory to `apps/admin` (Vercel) and the Dockerfile path to `apps/api/Dockerfile` (Render; `render.yaml` is already updated).
- New optional configuration for email, SMS and Google sign-in ([Sign-in providers](docs/deployment/sign-in-providers.md)). Existing deployments keep working without it.
- New tables `sessions` and `otp_codes`, and new `users` columns, are created automatically on start-up (`DB_SYNC=true`). Existing signed-in users must sign in again once after upgrading.
