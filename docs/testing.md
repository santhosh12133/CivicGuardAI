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
- admin dependency installation and production build;
- mobile dependency installation and `npx expo config --type public`.

These checks are defined in `.github/workflows/ci.yml`. fileciteturn262file0L2-L6

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
