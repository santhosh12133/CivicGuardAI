# Testing Strategy

## Quality model

Testing follows a layered approach so failures are caught at the cheapest useful level.

```text
Static checks
   -> Unit rules
   -> API integration
   -> Security/authorization
   -> Client build/config
   -> End-to-end workflows
   -> Deployment smoke tests
   -> Recovery drills
```

## Current automated CI

The repository currently runs:

- backend dependency installation and `node --check server.js`;
- backend unit and integration tests (`npm test`) against a PostgreSQL 17 service container;
- admin dependency installation and production build;
- mobile dependency installation and `npx expo config --type public`.

These checks are defined in `.github/workflows/ci.yml`.

## Running the backend tests

The backend uses Node's built-in test runner (`node:test`) and `fetch`, so there are no extra test dependencies.

```bash
cd backend
npm run test:unit                      # no database needed

# Integration tests need a DISPOSABLE database; every table is dropped and recreated.
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=civicguard_test postgres:17
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/civicguard_test npm test
```

Integration tests read `TEST_DATABASE_URL` only, never `DATABASE_URL`, so a developer's `.env` database cannot be wiped by accident. They set `GEOCODING_ENABLED=false` so no request reaches Nominatim.

| Suite | File | Covers |
|---|---|---|
| Unit | `test/unit/rateLimiter.test.js` | limit, 429 + `Retry-After`, per-IP buckets, window reset |
| Unit | `test/unit/errorHandler.test.js` | 5xx message hiding in production, 4xx passthrough |
| Unit | `test/unit/authMiddleware.test.js` | valid/missing/expired/forged/`alg=none` tokens, role checks |
| Unit | `test/unit/photoDate.test.js` | capture-date tag order, ignoring filesystem dates, 24 h / future / unknown-timezone rules |
| Unit | `test/unit/phash.test.js` | Hamming distance, similarity threshold, hashing the fixtures |
| Integration | `test/integration/app.test.js` | health, security headers, CORS allow/deny, body limits |
| Integration | `test/integration/auth.test.js` | registration, privileged-role rejection, login, user listing by role |
| Integration | `test/integration/issues.test.js` | issue CRUD, validation boundaries, citizen/staff/admin/anonymous access |
| Integration | `test/integration/evidence.test.js` | EXIF presence, capture-date rules, 200 m GPS check in all hemispheres, pHash duplicates, upload limits, resolution photos, removal of rejected uploads, orphan-upload pruning |

Evidence tests stamp the fixture images in `test/fixtures/` with EXIF dates and GPS at run time using ExifTool, so photo age is always relative to the current clock.

### Evidence gaps closed by this suite

These were found by the first version of the suite and are now enforced by regular tests:

- New issues always start `Open`; any other `status` on create returns `400` (`issues.test.js`).
- Capture dates come only from embedded metadata, never `FileModifyDate`, so stripping `DateTimeOriginal` no longer bypasses the 24-hour rule (`evidence.test.js`, `photoDate.test.js`).
- Photos dated more than 15 minutes in the future are rejected (`evidence.test.js`, `photoDate.test.js`).
- Files from rejected requests are deleted from `uploads/`, and `npm run prune-uploads` removes files leaked by older versions (`evidence.test.js`).

## Backend test priorities

### Authentication

- valid registration/login;
- invalid password;
- expired JWT;
- missing/malformed bearer token;
- privileged-role registration rejection.

### Authorization

For every protected route, test:

```text
citizen
staff
admin
unauthenticated
```

Expected status must be explicit and stable.

### Issue validation

Test title, description, UUID, coordinates, status, image, and URL boundary conditions.

### Evidence processing

Use a fixture corpus rather than one happy-path image. Include:

- modern Android camera photo;
- iOS camera photo;
- gallery photo;
- missing EXIF;
- invalid EXIF;
- stale photo timestamp;
- embedded GPS matching reported coordinates;
- GPS mismatch > 200 m;
- duplicate/similar image;
- malformed file.

The current controller implements 24-hour photo-age and 200-meter location comparison rules and a 90% pHash review threshold. fileciteturn263file0L2-L2

## Contract testing

Every public endpoint should have documented:

- method/path;
- authentication requirement;
- role requirement;
- request shape;
- validation constraints;
- response shape;
- error status codes;
- idempotency expectations where applicable.

## E2E test journey

```text
Register citizen
  -> Login
  -> Obtain location
  -> Capture/select image
  -> Submit issue
  -> Verify persisted issue
  -> Staff login
  -> Update status
  -> Upload resolution evidence
  -> Verify resolved state
  -> Admin login
  -> Validate admin-only operation
```

## Performance testing

Measure p50/p95/p99 latency, throughput, database timings, and upload processing latency using repeatable datasets. Do not publish benchmark claims without the workload, hardware, concurrency, environment, and commit SHA.

## Security testing

Include negative tests for:

- role escalation;
- missing/invalid/expired JWT;
- malformed IDs;
- untrusted CORS origins;
- oversized/disallowed files;
- request-rate exhaustion;
- unsafe public data exposure.

## Operational testing

Before production release:

- health check;
- database connectivity;
- login;
- issue creation;
- image upload;
- role restrictions;
- admin operations;
- backup/restore;
- rollback procedure.

The deployment guide makes these runtime checks explicit. fileciteturn255file0L2-L2
