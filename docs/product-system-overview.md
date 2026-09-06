# Product and System Overview

## 1. Purpose

CivicGuardAI (CivicFix) is a civic issue reporting and resolution platform that connects citizens with authorized civic staff through a mobile application, an administrative web portal, and a Node.js API backed by PostgreSQL.

The core product loop is:

```text
Observe civic problem
        |
        v
Capture evidence + location
        |
        v
Validate evidence server-side
        |
        v
Persist report
        |
        v
Route to staff/admin
        |
        v
Investigate and update status
        |
        v
Record resolution evidence
```

## 2. Actors

| Actor | Responsibilities | Trust level |
|---|---|---|
| Citizen | Register, authenticate, submit reports, provide location/evidence | Low / untrusted client |
| Staff | Review reports and update operational status | Privileged application user |
| Admin | Staff capabilities plus administrative operations such as deletion | Highly privileged application user |
| API service | Authentication, validation, geospatial/evidence checks, persistence | Trusted application component |
| PostgreSQL | Source of truth for users/issues | Trusted infrastructure |
| Geocoding provider | Converts coordinates into an address | External dependency |

## 3. Product boundaries

### In scope

- Civic issue submission.
- Photo and evidence validation.
- GPS/EXIF consistency checks.
- Reverse geocoding.
- Duplicate-image similarity detection.
- Role-based staff/admin workflows.
- Resolution evidence.
- Issue status management.

### Explicitly out of scope

- Guaranteed physical verification of every report.
- Proof that EXIF data has never been modified.
- Automatic determination that an issue is legally actionable.
- Fully autonomous government workflow.
- Long-term archival object storage in the current filesystem-based implementation.

## 4. Business lifecycle

The canonical issue statuses are:

```text
Open --> In Progress --> Resolved
```

The current API also permits authorized staff/admin users to set any valid status directly. Status is an operational state, not a fraud verdict.

The `needs_review` signal identifies reports that require additional human inspection, for example duplicate-image similarity or a remote photo URL without local evidence metadata.

## 5. Evidence lifecycle

A submitted image passes through several controls:

```text
Upload
  |
  +--> Extension/MIME/size checks
  |
  +--> EXIF inspection
  |
  +--> Photo-date validation
  |
  +--> Embedded GPS extraction/fallback handling
  |
  +--> Distance check between embedded and reported location
  |
  +--> Perceptual hash computation
  |
  +--> Similar-image search
  |
  v
Issue persistence + review flags
```

The evidence pipeline is intentionally server-side. Client-side checks improve user experience but are not treated as authoritative.

## 6. Source-of-truth rules

PostgreSQL is the authoritative source for users, issue metadata, statuses, hashes, and review flags. Uploaded image files are referenced from issue records but the current deployment model stores bytes on the application filesystem.

Reverse geocoding is enrichment, not an authority over latitude/longitude. If geocoding fails, the coordinates remain the primary location evidence.

## 7. Failure philosophy

The platform follows a conservative approach for high-risk evidence decisions:

- Reject malformed or invalid evidence when the API cannot safely process it.
- Mark suspicious but potentially valid reports for human review instead of silently discarding them.
- Avoid exposing internal exception details in production responses.
- Keep authorization decisions server-side.
- Treat external services as failure-prone dependencies.

## 8. Non-functional objectives

The architecture should evolve toward:

- Strong authentication and least-privilege authorization.
- Predictable API contracts.
- Durable persistence and migration control.
- Observable failure modes.
- Reproducible deployments.
- Testable evidence-validation rules.
- Durable file storage for scaled environments.
- Shared rate limiting when horizontally scaled.

The repository must not claim these objectives are fully achieved unless runtime evidence supports the claim.

## 9. Current implementation facts

The repository contains three application surfaces: `mobile/`, `admin/`, and `backend/`. The API uses Express, Sequelize, PostgreSQL, JWT, bcryptjs, Multer, ExifTool, geolib, and image-hash. The CI workflow validates backend installation/syntax, admin builds, and Expo configuration. fileciteturn254file0L2-L4 fileciteturn262file0L2-L6

The API currently applies security headers, body limits, rate limiting, CORS controls, and production startup checks for `JWT_SECRET` and `CORS_ORIGINS`. fileciteturn257file0L2-L5

Issue routes expose authenticated creation, public reads, staff/admin updates, and admin-only deletion. UUID, coordinate, status, and selected URL fields are validated with `express-validator`. fileciteturn258file0L2-L6
