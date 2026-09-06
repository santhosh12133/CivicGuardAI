# CivicGuardAI Production Readiness

This document defines the production deployment requirements for CivicGuardAI.

## Implemented hardening

- JWT secret is required at startup and must contain at least 32 characters.
- Production startup requires `CORS_ORIGINS`.
- Express fingerprinting is disabled.
- Security response headers are applied.
- HSTS is enabled when `NODE_ENV=production`.
- JSON/form request bodies are limited to 1 MB.
- Multipart uploads are limited to one file and 10 MB.
- Upload filenames are generated server-side with cryptographically secure random bytes.
- Only JPEG, PNG, GIF, and WebP MIME types are accepted by the upload middleware.
- Global request rate limiting is enabled.
- Production application startup does not run `sequelize.sync()`.
- Production errors do not expose internal exception messages for 5xx responses.
- Public registration is restricted to citizen accounts.
- Admin routes require JWT authentication and role authorization.

## Required production environment

Set these values in the hosting platform's secret/environment configuration. Never commit them.

```text
NODE_ENV=production
PORT=5000
DATABASE_URL=<managed-postgresql-connection-string>
JWT_SECRET=<long-random-secret>
CORS_ORIGINS=https://<admin-domain>
API_HOST=<api-domain>
API_PROTOCOL=https
```

## Database

Do not use `sequelize.sync()` in production. Apply schema changes through reviewed, versioned migrations before deploying application code.

The application currently has migration helper scripts in `backend/scripts/`; these should be consolidated into a proper migration system before a production launch with an existing database.

## File storage

The current implementation stores uploads on the application filesystem. This is suitable for local development or a single persistent server, but is **not the recommended production architecture** for ephemeral/container/serverless deployments.

For production, use:

```text
Mobile/Admin
    |
    v
API
    |
    +---- PostgreSQL
    |
    +---- Object Storage (S3/R2/GCS/Azure Blob)
                 |
                 v
               CDN
```

Uploaded files should use private/object-storage policies where possible, with controlled public delivery URLs or signed URLs.

## Rate limiting

The included limiter is process-local. It protects a single application instance, but counters are not shared between replicas. A multi-instance deployment must replace it with a shared Redis-backed or equivalent distributed limiter.

## HTTPS

Terminate TLS at the production load balancer/platform and set `API_PROTOCOL=https`. Mobile and admin clients must use HTTPS endpoints in production.

## Observability

Before launch, configure centralized logs, uptime monitoring, database monitoring, and error tracking. Do not log passwords, JWTs, authorization headers, or complete EXIF payloads.

## Required release tests

Before each production release, verify:

1. Citizen registration cannot create staff/admin accounts.
2. Invalid and expired JWTs return 401.
3. Citizens cannot update or delete issues.
4. Staff can update issues but cannot delete them.
5. Admins can update and delete issues.
6. Invalid UUIDs are rejected.
7. Invalid coordinates are rejected.
8. Oversized/non-image uploads are rejected.
9. EXIF/date/GPS validation behaves correctly on representative Android and iOS photos.
10. Duplicate-image detection marks appropriate reports for review.
11. Resolution images are stored separately from original issue images.
12. Database backup and restore have been tested.
13. API, admin portal, and mobile app all use production HTTPS URLs.
14. No secrets or `.env` files are present in Git history or deployment artifacts.

## Current release caveats

A full production sign-off still requires runtime integration tests against a real PostgreSQL instance, representative mobile photos, the deployed object-storage strategy, and the target hosting platform. Source-code hardening alone cannot prove operational readiness.
