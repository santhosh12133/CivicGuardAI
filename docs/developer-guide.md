# Developer Guide

## 1. Repository map

```text
CivicGuardAI/
├── admin/                 # React + Vite staff/admin portal
├── backend/               # Node.js + Express API
├── mobile/                # React Native + Expo citizen app
├── docs/                  # Engineering documentation
├── .github/workflows/     # CI workflows
├── DEPLOYMENT.md          # Deployment runbook
├── PRODUCTION_READINESS.md# Production release gate
├── render.yaml            # Render infrastructure definition
└── README.md              # Project entry point
```

The repository is a monorepo containing three independently runnable application surfaces plus shared deployment/documentation assets. fileciteturn253file0L2-L2

## 2. Local prerequisites

Recommended baseline:

- Node.js 18.x for backend compatibility.
- Node.js 20.x for admin/mobile tooling.
- PostgreSQL.
- Expo CLI tooling for mobile development.
- Git.

Backend dependencies and engine constraints are defined in `backend/package.json`. fileciteturn254file0L2-L4

## 3. First-time setup

### Backend

```bash
cd backend
npm ci
cp .env.example .env
npm run dev
```

Configure a local PostgreSQL connection in `.env`.

### Admin

```bash
cd admin
npm ci
cp .env.example .env
npm run dev
```

Set `VITE_API_URL` to the backend API root.

### Mobile

```bash
cd mobile
npm ci
cp .env.example .env
npx expo start
```

Set `EXPO_PUBLIC_API_URL` to a URL reachable from the target device. The deployment guide notes that physical devices generally cannot reach the development computer through `localhost`. fileciteturn255file0L2-L2

## 4. Backend change workflow

Before modifying an API behavior:

1. Locate the route in `backend/src/routes`.
2. Locate the controller/service.
3. Locate the related Sequelize model.
4. Identify authorization middleware.
5. Identify validation rules.
6. Check frontend/mobile consumers.
7. Update API documentation.
8. Add/update tests.

The issue router is the primary entry point for issue CRUD and explicitly defines validation and role middleware. fileciteturn258file0L2-L6

## 5. Database changes

Do not rely on implicit schema synchronization as the long-term production mechanism. The deployment and readiness documents explicitly call for formal reviewed migrations before mature production operation. fileciteturn255file0L2-L2

Every schema change should include:

- schema definition/update;
- migration or migration-plan;
- data compatibility analysis;
- rollback strategy;
- persistence tests;
- Data Model documentation update.

## 6. Security changes

Treat every client value as untrusted. Client-side checks improve UX but do not establish security.

Security-sensitive changes require:

- authorization tests;
- negative tests;
- logging review;
- privacy review if user/location/image data changes;
- Threat Model update when a new attack surface is introduced.

## 7. Evidence-processing changes

When modifying EXIF, GPS, geocoding, pHash, or upload rules, document:

- exact current rule;
- rationale;
- false-positive/false-negative implications;
- representative fixtures;
- error behavior;
- impact on manual review.

The current evidence pipeline contains 24-hour photo-age and 200-meter GPS comparison rules plus pHash similarity review at 90%. fileciteturn263file0L2-L2

## 8. Logging standards

Prefer structured, redacted event logs. Never log passwords, tokens, authorization headers, database credentials, raw image content, or complete EXIF blobs.

## 9. Commit standards

Use commits that describe the engineering intent, for example:

```text
feat: add issue moderation audit trail
fix: reject invalid issue coordinates
security: harden upload validation
test: cover staff/admin authorization matrix
docs: document evidence-validation pipeline
```

## 10. Definition of done

A change is complete when:

- implementation is correct;
- authorization is reviewed;
- validation is server-side;
- tests cover success and failure paths;
- documentation is updated;
- configuration changes are documented;
- CI passes;
- deployment impact is understood;
- no secrets or sensitive sample data are committed.

## 11. Pull request checklist

```text
[ ] Scope is clear
[ ] API/data behavior documented
[ ] Security impact reviewed
[ ] Tests added/updated
[ ] CI passes
[ ] No secrets/sample personal data committed
[ ] Deployment/rollback impact documented
[ ] Production claims are backed by evidence
```
