# CivicGuardAI (CivicFix)

> A full-stack civic issue reporting and resolution platform connecting citizens with authorized civic staff through a React Native mobile application, a React/Vite administrative portal, and a Node.js/Express API backed by PostgreSQL.

[![CI](https://img.shields.io/github/actions/workflow/status/santhosh12133/CivicGuardAI/ci.yml?branch=main&label=CI)](https://github.com/santhosh12133/CivicGuardAI/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-see%20repository-lightgrey)](https://github.com/santhosh12133/CivicGuardAI)

## What problem it solves

CivicGuardAI turns a citizen's observation into a structured, evidence-backed civic report:

```text
Capture problem
    ↓
Attach photo + location
    ↓
Server-side evidence validation
    ↓
Persist issue
    ↓
Staff/admin review
    ↓
Status progression
    ↓
Resolution evidence
```

The platform is designed around **evidence validation, role-based workflows, and auditable operations** rather than simply storing a complaint form.

## Current architecture

```text
┌──────────────────────┐      HTTPS       ┌──────────────────────┐
│ React Native + Expo  │────────────────▶│                      │
│ Citizen Mobile App   │                 │                      │
└──────────────────────┘                 │ Node.js + Express API │
                                         │                      │
┌──────────────────────┐      HTTPS       │ JWT / RBAC            │
│ React + Vite         │────────────────▶│ Validation             │
│ Admin Portal         │                 │ EXIF / GPS / pHash    │
└──────────────────────┘                 │ Issue Lifecycle        │
                                         └──────────┬───────────┘
                                                    │
                                      ┌─────────────┼─────────────┐
                                      ▼             ▼             ▼
                                PostgreSQL     File storage   Geocoder
```

## Key capabilities

- Citizen registration and authentication.
- Staff/admin role-based access.
- Civic issue creation and lifecycle management.
- Image upload controls.
- EXIF metadata validation.
- Photo-date validation.
- GPS consistency checks.
- Reverse geocoding.
- Perceptual-hash duplicate detection.
- Manual-review signals for suspicious evidence.
- Resolution image upload.
- Admin-only deletion.
- API health monitoring.
- Global request rate limiting.
- Production security headers and CORS configuration.
- Docker/Render deployment configuration.
- Vercel admin deployment configuration.
- Expo EAS mobile deployment configuration.
- GitHub Actions CI for backend/admin/mobile baseline verification.

## Technology stack

| Area | Technology |
|---|---|
| Mobile | React Native, Expo |
| Admin | React, Vite, Material UI |
| API | Node.js, Express |
| ORM | Sequelize |
| Database | PostgreSQL |
| Authentication | JWT, bcryptjs |
| Validation | express-validator |
| Uploads | Multer |
| Metadata | ExifTool |
| Geospatial | geolib + reverse geocoding provider |
| Image similarity | perceptual hashing (`image-hash`) |
| Deployment | Docker, Render, Vercel, Expo EAS |
| CI | GitHub Actions |

The backend package defines Node 18.x compatibility and the main runtime dependencies above. fileciteturn254file0L2-L4

## Repository structure

```text
CivicGuardAI/
├── admin/                  # React/Vite admin portal
├── backend/                # Express API
├── mobile/                 # Expo/React Native app
├── docs/                   # Engineering documentation
├── .github/workflows/      # CI
├── DEPLOYMENT.md           # Deployment runbook
├── PRODUCTION_READINESS.md # Release readiness gate
├── render.yaml             # Render infrastructure definition
└── README.md
```

## Documentation

The detailed engineering documentation lives in [`docs/README.md`](docs/README.md).

Recommended entry points:

- [Product & System Overview](docs/product-system-overview.md)
- [System Architecture](docs/system-architecture.md)
- [API Reference](docs/api-reference.md)
- [Data Model](docs/data-model.md)
- [Evidence Validation](docs/evidence-validation.md)
- [Security Architecture](docs/security.md)
- [Threat Model](docs/security-threat-model.md)
- [Privacy & Data Governance](docs/privacy-data-governance.md)
- [Testing Strategy](docs/testing.md)
- [Testing Matrix](docs/testing-matrix.md)
- [Observability](docs/observability.md)
- [Incident Response](docs/incident-response.md)
- [Disaster Recovery](docs/disaster-recovery.md)
- [Developer Guide](docs/developer-guide.md)
- [Release Management](docs/release-management.md)
- [Architecture Decision Records](docs/architecture-decision-records.md)
- [Environment Reference](docs/environment-reference.md)
- [Glossary](docs/glossary.md)

## Application flows

### Citizen report flow

```text
Login/Register
    ↓
Request location permission
    ↓
Capture/select image
    ↓
Review coordinates on map
    ↓
Submit multipart request
    ↓
API authenticates user
    ↓
Validate request + evidence
    ↓
Reverse geocode
    ↓
Compute pHash / detect similarity
    ↓
Persist issue
```

### Staff/admin flow

```text
Login
  ↓
Protected dashboard
  ↓
List/filter issues
  ↓
Open issue details
  ↓
Review evidence / review flags
  ↓
Update status
  ↓
Upload resolution evidence
  ↓
Resolved
```

## Security model

The API uses JWT bearer authentication and role-based authorization. Current protected issue routes require staff/admin for updates and admin for deletion. The API also applies CORS controls, request-body limits, upload limits, security headers, and a process-local rate limiter. fileciteturn258file0L2-L6 fileciteturn257file0L2-L5

Security architecture and residual risks are documented in:

- [Security Architecture](docs/security.md)
- [Threat Model](docs/security-threat-model.md)
- [Privacy & Data Governance](docs/privacy-data-governance.md)

## Evidence validation

Uploaded evidence is treated as untrusted. The current implementation validates file limits/type, reads EXIF metadata, evaluates photo timestamps, compares available GPS coordinates, reverse-geocodes submitted coordinates, computes a perceptual hash, and flags highly similar images for manual review. fileciteturn263file0L2-L2

Important current application rules include:

- maximum image upload size: 10 MB;
- photo-age threshold: 24 hours;
- EXIF/device location comparison threshold: 200 m;
- pHash similarity review threshold: 90%.

These are implementation rules, not claims of perfect fraud detection. Metadata and perceptual similarity are heuristics and can produce false positives/negatives.

## API

Base API path:

```text
/api
```

Core endpoints:

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/issues
GET    /api/issues/:id
POST   /api/issues
PUT    /api/issues/:id
DELETE /api/issues/:id
GET    /health
```

See [API Reference](docs/api-reference.md) for authentication, examples, validation, and error semantics.

## Local development

### Backend

```bash
cd backend
npm ci
cp .env.example .env
npm run dev
```

### Admin

```bash
cd admin
npm ci
cp .env.example .env
npm run dev
```

### Mobile

```bash
cd mobile
npm ci
cp .env.example .env
npx expo start
```

See [Developer Guide](docs/developer-guide.md) and [Environment Reference](docs/environment-reference.md) for configuration details.

## CI

The current GitHub Actions workflow:

- installs backend dependencies and runs `node --check server.js`;
- installs/builds the admin portal;
- installs mobile dependencies and validates Expo configuration.

See `.github/workflows/ci.yml`. fileciteturn262file0L2-L6

CI passing is necessary but does not by itself prove end-to-end production readiness.

## Deployment

Supported deployment documentation covers:

- Backend: Docker + Render + managed PostgreSQL.
- Admin: Vite + Vercel.
- Mobile: Expo EAS.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the operational deployment procedure. The current deployment model also documents important production caveats, including local filesystem uploads, process-local rate limiting, migration maturity, and the need for centralized observability and restore testing. fileciteturn255file0L2-L2

## Production readiness

The project should be described as **production-oriented**, not automatically “production ready”. Production sign-off requires runtime evidence for:

- PostgreSQL integration;
- representative Android/iOS photo validation;
- authentication and authorization;
- upload processing;
- target object-storage architecture;
- backup/restore;
- monitoring/alerting;
- performance under expected workload;
- rollback/recovery.

See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for the current release gate. fileciteturn256file0L2-L4

## Engineering standards

Changes should follow the documentation and contribution rules:

- API changes -> update API Reference + tests.
- Database changes -> update Data Model + migration strategy + tests.
- Evidence changes -> update Evidence Validation + representative fixtures.
- Security changes -> update Security/Threat Model + negative tests.
- Configuration changes -> update Environment Reference.
- Deployment changes -> update Deployment/Release docs.
- Major architecture changes -> add/update an ADR.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Known production hardening items

The repository explicitly tracks these as remaining work rather than hiding them:

1. Move uploaded images from local filesystem to durable object storage.
2. Replace the process-local limiter with distributed/shared rate limiting for multiple replicas.
3. Introduce a formal migration runner for production schema changes.
4. Harden browser authentication/session storage.
5. Add broader backend integration/security/E2E tests.
6. Add centralized logs, metrics, error tracking, and alerting.
7. Run and record backup/restore drills.
8. Reduce verbose controller logging and enforce redaction.
9. Review public issue reads and exact geolocation exposure as a privacy/product decision.

These caveats are also reflected in the deployment and production-readiness documentation. fileciteturn255file0L2-L2

## Documentation principle

The repository distinguishes:

```text
Source
  → Automated verification
  → Staging verification
  → Production verification
```

A feature being implemented in source is not the same as the feature being proven in production.

## Project status

CivicGuardAI is a portfolio-grade, production-oriented full-stack system with a substantial evidence-validation workflow and separate mobile/admin/API surfaces. The next stage is operational hardening and runtime verification rather than adding claims that are not yet measured.
