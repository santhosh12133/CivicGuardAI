# System Architecture

## 1. Architecture summary

CivicGuardAI is a three-surface application:

```text
┌──────────────────────┐      HTTPS/JSON       ┌──────────────────────┐
│ React Native / Expo  │─────────────────────▶│                      │
│ Citizen Application │                      │                      │
└──────────────────────┘                      │                      │
                                              │  Node.js + Express   │
┌──────────────────────┐      HTTPS/JSON       │  CivicFix API        │
│ React + Vite         │─────────────────────▶│                      │
│ Admin Portal         │                      │  Auth / RBAC         │
└──────────────────────┘                      │  Validation          │
                                              │  Evidence Pipeline   │
                                              │  Issue Lifecycle     │
                                              └──────────┬───────────┘
                                                         │
                                    ┌────────────────────┼────────────────────┐
                                    │                    │                    │
                                    v                    v                    v
                             ┌────────────┐      ┌──────────────┐     ┌───────────────┐
                             │ PostgreSQL │      │ Local Upload │     │ Nominatim /   │
                             │ Source     │      │ Filesystem   │     │ Geocoding     │
                             │ of Truth   │      │              │     │ Provider      │
                             └────────────┘      └──────────────┘     └───────────────┘
```

The current deployment guide targets a Docker/Render backend, managed PostgreSQL, Vercel admin portal, and Expo EAS mobile builds. fileciteturn255file0L2-L2

## 2. Logical layers

### Presentation

`mobile/` and `admin/` own user experience, local session state, device permissions, form handling, navigation, and API consumption.

### Routing and middleware

`backend/server.js` configures Express, CORS, body limits, security headers, global rate limiting, static uploads, health checks, authentication routes, issue routes, and error handling. fileciteturn257file0L2-L5

### Domain/application logic

Controllers implement issue creation, reads, updates, deletion, reverse geocoding, EXIF/GPS validation, perceptual hashing, and review flags.

### Persistence

Sequelize models map application entities to PostgreSQL. The database is the transactional source of truth.

### External services

The geocoding layer is an external dependency. Its result enriches the issue with a human-readable address but does not replace submitted coordinates.

## 3. Request lifecycle

```text
HTTP request
   |
   v
CORS + body parser + security headers + rate limiter
   |
   v
Route matcher
   |
   +--> public read endpoint
   |
   +--> authenticateToken
   |       |
   |       +--> verify JWT
   |       +--> req.user
   |
   +--> authorizeRoles
   |
   v
express-validator
   |
   v
Controller
   |
   +--> external service calls
   +--> evidence processing
   +--> database transaction/work
   |
   v
HTTP response
   |
   v
Central error handler
```

## 4. Security boundaries

### Boundary A — device/browser to API

Client input is untrusted. All security-sensitive validation must be repeated by the API.

### Boundary B — API to database

The API is trusted to enforce access rules, but the database remains the authoritative persistence layer.

### Boundary C — API to uploaded file

Uploaded files are untrusted binary data. File type, size, metadata, and processing behavior must be constrained before business use.

### Boundary D — API to geocoding provider

Provider responses are external data and can fail, timeout, or be unavailable. They must never bypass authorization or input validation.

## 5. Authentication architecture

JWT bearer tokens are accepted by the API. `authenticateToken` verifies the token using `JWT_SECRET` and attaches the decoded identity to `req.user`. `authorizeRoles` applies role checks for protected operations. fileciteturn259file0L2-L5

Current roles:

```text
citizen
staff
admin
```

Registration is intended for citizens; staff/admin access is privileged and must not be provisioned through public registration. This is also an explicit production release requirement. fileciteturn256file0L2-L4

## 6. Evidence-processing architecture

The issue controller combines:

1. Request validation.
2. Coordinate parsing/range checks.
3. File handling and public URL creation.
4. Reverse geocoding.
5. EXIF metadata extraction through ExifTool.
6. Photo-date evaluation.
7. GPS coordinate extraction and comparison.
8. Perceptual hashing.
9. Similar-image detection.
10. Persistence of issue and review metadata.

The current implementation uses a 24-hour photo-age rule and a 200-meter EXIF-to-reported-location comparison for uploaded images. These are application rules and should be treated as configurable policy decisions in future iterations rather than hidden constants. fileciteturn263file0L2-L2

## 7. Storage architecture

### Current

Uploaded files are stored under `backend/uploads` and exposed through `/uploads/<filename>`. This is documented as a deployment limitation because ephemeral container filesystems are not a durable object store. fileciteturn255file0L2-L2

### Target

```text
API
 ├── PostgreSQL: issue metadata, users, states, hashes
 └── Object storage: original/resolution images
                         |
                         +--> private ACLs
                         +--> signed delivery URLs
                         +--> lifecycle/retention policy
```

## 8. Availability model

The API has a health endpoint that checks PostgreSQL connectivity and returns HTTP 503 when the database is unavailable. fileciteturn257file0L2-L5

For scaled deployment, add:

- multiple stateless API instances;
- shared rate limiting;
- durable object storage;
- managed PostgreSQL backups;
- external logs/metrics;
- uptime and dependency monitoring.

## 9. Architectural risks

| Risk | Current state | Target mitigation |
|---|---|---|
| Local filesystem uploads | Present | Durable object storage |
| Process-local rate limiter | Present | Redis/shared limiter |
| Schema bootstrap via sync helpers | Transitional | Versioned migrations |
| Browser token in localStorage | Current design | Secure cookie/session strategy |
| Verbose operational logging in controller | Present | Structured/redacted logging |
| External geocoder dependency | Present | Timeout, retry/backoff, caching, fallback |
| pHash full-table comparison | Present | Indexed/partitioned strategy as scale grows |

## 10. Architectural invariants

- Client-provided role claims are never trusted.
- Coordinates must remain within valid geographic ranges.
- Issue deletion is admin-only.
- Evidence review signals are not equivalent to proof of fraud.
- External enrichment must not override authoritative issue fields.
- Internal errors should not be exposed to clients in production.
- Production readiness is an operational evidence claim, not a documentation label.
