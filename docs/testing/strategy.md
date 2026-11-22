# Testing

How CivicFix is tested, what each suite covers, and how to run it.

## Test pyramid

| Layer | Tool | Where | Runs | Needs |
|---|---|---|---|---|
| Static checks | `node --check`, ESLint, `expo config`, `cfn-lint`, `actionlint` | CI `ci.yml` | Every push / PR | — |
| Unit | `node:test` | `apps/api/test/unit/` | Every push / PR | Nothing |
| API integration | `node:test` + `fetch` against a real server | `apps/api/test/integration/` | Every push / PR | Disposable PostgreSQL |
| Container | `docker build` + start check | CI `infra` job | Every push / PR | Docker |
| Admin portal end-to-end | Playwright (Chromium) | `e2e/admin/` | Every PR | API + PostgreSQL |
| Android end-to-end | Maestro on an API 34 emulator | `e2e/mobile/` | Every PR | API + PostgreSQL + emulator |
| APK launch test | `adb` on an emulator | `android-apk.yml` | Every APK build | Emulator |
| Deployment smoke test | `curl` health, sign-in, CORS | `deploy-aws.yml` | Every deploy | Deployed API |

The API tests use only Node's built-in test runner and `fetch`: no Jest/Mocha, no mocks of the database. Integration tests start the real Express app on a random port against a real PostgreSQL database.

## Running the API tests

```bash
cd apps/api
npm run test:unit                      # no database needed

# Integration tests need a DISPOSABLE database; every table is dropped and recreated.
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=civicguard_test postgres:17
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/civicguard_test npm test
```

Safety: integration tests read `TEST_DATABASE_URL` only, never `DATABASE_URL`, so a developer's `.env` database cannot be wiped by accident. They set `GEOCODING_ENABLED=false` (no calls to Nominatim), the `log` email/SMS providers (no messages sent) and a high auth rate limit. Each integration file resets the database, so files run one after another (`scripts/run-tests.js`).

### What the suites cover

| Suite | File | Covers |
|---|---|---|
| Unit | `rateLimiter.test.js` | Limit, `429` + `Retry-After`, per-IP buckets, window reset, separate limiter budgets |
| Unit | `errorHandler.test.js` | 5xx message hiding in production, 4xx passthrough |
| Unit | `authMiddleware.test.js` | Valid, missing, expired, forged and `alg=none` tokens; role checks |
| Unit | `photoDate.test.js` | Capture-date tag order, ignoring filesystem dates, 24 h / future / unknown-timezone rules |
| Unit | `phash.test.js` | Hamming distance, similarity threshold, hashing the fixtures |
| Unit | `dbConfig.test.js` | Connection URL vs separate values, TLS options, CA bundle, `sslmode` handling |
| Unit | `awsSigV4.test.js` | Request signing against AWS's published example signature |
| Integration | `app.test.js` | Health, security headers, CORS allow/deny, body limits |
| Integration | `auth.test.js` | Registration, privileged-role rejection, sign-in, staff management |
| Integration | `sessions.test.js` | Refresh rotation, reuse detection, sign-out, sign-out everywhere, password change ending other sessions, lockout |
| Integration | `signin-methods.test.js` | Forgot/reset password, phone codes (expiry, attempts, cooldown, new accounts), Google sign-in against a fake provider with real RS256 tokens, including wrong audience, issuer, nonce, expiry and signature |
| Integration | `issues.test.js` | Issue CRUD, validation boundaries, citizen/staff/admin/anonymous access |
| Integration | `features.test.js` | Categories, My Reports, reporter visibility, timeline, statistics |
| Integration | `evidence.test.js` | Metadata presence, capture-date rules, 200 m GPS check in all hemispheres, pHash duplicates, upload limits, resolution photos, removal of rejected uploads, orphan pruning |
| Integration | `schema.test.js` | Upgrading a database created by an older version |

Evidence tests stamp the fixture images in `test/fixtures/` with EXIF dates and GPS at run time using ExifTool, so photo age is always relative to the current clock.

## End-to-end tests

`.github/workflows/e2e.yml` runs on every pull request. Both jobs start the real API on a fresh PostgreSQL database and seed it through the public API with `apps/api/test/e2e/seed.js` (two citizens, three issues in different categories, one with a real camera-stamped photo, and a staff note).

**Admin portal** (`e2e/admin`, Playwright, Chromium): citizen and wrong-password sign-in refused; Overview statistics and links into filtered lists; issue list category/reporter columns, filters, search and needs-review; deep-link refresh; issue page reporter, photo and timeline; status, category and note updates; resolving with a resolution photo; statistics updating; adding staff with a one-time password; a staff member's restricted view and password change; role changes and password reset; deleting issues; forgot password with the emailed code (read from the API log); a session renewing itself after the access token expires (`ACCESS_TOKEN_TTL=30s`); sign-out ending the server session; account lockout after five wrong passwords; sign-out.

**Android app** (`e2e/mobile`, Maestro, API 34 emulator): sign-up and browsing with category filter and issue details; My Reports with the "Your report" badge and the staff timeline; reporting an issue with a category and a gallery photo through the real evidence checks; changing password (old one refused, new one works); server-address validation; phone-number sign-in with an SMS code (a fixed test code via `TEST_OTP_PHONE`/`TEST_OTP_CODE`), creating an account by phone and signing out everywhere.

Failures upload screenshots, traces, device logs and the API log as workflow artifacts.

### Defects found by the end-to-end tests

- **Android photo uploads always failed** with "Cannot connect to server". axios labelled the report's `FormData` as `application/x-www-form-urlencoded`, and React Native's Android networking refused to encode it (`multipart != application/x-www-form-urlencoded`). Fixed in `apps/mobile/src/utils/api.js`; the emulator flow `03-report-issue` now submits a real gallery photo through the evidence checks.
- **The rate limit (120 requests/minute per IP) was too low** for several staff sharing an office connection; it is now 300 and configurable (`RATE_LIMIT_MAX`).

### Evidence gaps closed by this suite

These were found by the first version of the suite and are now enforced by regular tests:

- New issues always start `Open`; any other `status` on create returns `400` (`issues.test.js`).
- Capture dates come only from embedded metadata, never `FileModifyDate`, so stripping `DateTimeOriginal` no longer bypasses the 24-hour rule (`evidence.test.js`, `photoDate.test.js`).
- Photos dated more than 15 minutes in the future are rejected (`evidence.test.js`, `photoDate.test.js`).
- Files from rejected requests are deleted from `uploads/`, and `npm run prune-uploads` removes files leaked by older versions (`evidence.test.js`).

### Running end-to-end tests locally

`.github/workflows/e2e.yml` is the reference; this reproduces the admin portal job on your machine (with a disposable PostgreSQL on port 5432 as above):

```bash
# Same settings as the workflow's env block
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/civicguard_test
export JWT_SECRET=e2e-only-secret-0123456789abcdef0123456789abcdef
export ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=admin-e2e-password-123
export GEOCODING_ENABLED=false RATE_LIMIT_MAX=100000 AUTH_RATE_LIMIT_MAX=100000
export EMAIL_PROVIDER=log SMS_PROVIDER=log ACCESS_TOKEN_TTL=30s
export TEST_OTP_PHONE=+919999900001 TEST_OTP_CODE=246810

# 1. API (production mode, like CI), admin account and seed data
cd apps/api && npm ci
STAFF_PASSWORD="$ADMIN_PASSWORD" node scripts/create-staff-user.js --email "$ADMIN_EMAIL" --name "E2E Admin" --role admin
NODE_ENV=production DB_SYNC=true CORS_ORIGINS=http://localhost:4173 node server.js > /tmp/api.log 2>&1 &
API_URL=http://localhost:5000 SEED_OUT=/tmp/seed.json node test/e2e/seed.js

# 2. Admin portal
cd ../admin && npm ci && VITE_API_URL=http://localhost:5000/api npm run build
npx vite preview --port 4173 --strictPort &

# 3. Playwright
cd ../../e2e/admin && npm ci && npx playwright install chromium
SEED_FILE=/tmp/seed.json API_LOG=/tmp/api.log npm test
```

Use a fresh database for every run: the suite changes passwords and deletes issues. For the Android flows, install [Maestro](https://maestro.mobile.dev), start an emulator, build a debug APK pointed at `http://10.0.2.2:5000`, and run `.github/scripts/mobile-e2e.sh <apk> <photo.jpg> /tmp/seed.json <output-dir>`.

## Writing tests

- **Every bug fix gets a test** that fails before the fix.
- **New endpoints** need integration tests for success, validation errors, and each role (anonymous, citizen, staff, admin).
- **New user journeys** (a screen, a button that changes data) get an end-to-end step. Use `testID` (app) and accessible labels/roles (portal) as selectors, not text that may change.
- **Evidence rules**: add a fixture case to `evidence.test.js`; never weaken an existing case without an ADR.
- Keep tests independent of the clock and network: stamp dates relative to now, keep geocoding off.
- Do not mock the database; use the disposable one.

## Quality gates

A pull request can be merged when:

- [ ] CI (`apps/api`, `apps/admin`, `apps/mobile`, `infra`) and End-to-end (`admin-portal`, `mobile-app`) pass
- [ ] New behaviour has tests at the lowest layer that can catch it
- [ ] The documentation listed in the pull request template is updated

Before a release, also run the [launch checklist](../deployment/README.md#launch-checklist) against the deployed environment.
