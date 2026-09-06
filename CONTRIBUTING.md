# Contributing to CivicGuardAI

## Engineering standard

Contributions should improve the product without weakening security, correctness, maintainability, or operational clarity.

## Before making a change

- Read the relevant documentation.
- Identify the affected application (`backend`, `admin`, or `mobile`).
- Check existing validation and authorization paths.
- Check whether database schema changes are involved.
- Identify user/location/image privacy implications.

## Backend changes

For API changes:

1. Update route validation.
2. Update controller/service logic.
3. Verify authorization.
4. Update API Reference.
5. Add positive and negative tests.
6. Consider rate limiting and error behavior.

The current issue router validates UUIDs, coordinates, status enums, and selected URLs and applies role middleware to mutations. fileciteturn258file0L2-L6

## Database changes

Schema changes require:

- migration strategy;
- compatibility assessment;
- persistence tests;
- Data Model update;
- rollback consideration.

Do not introduce production dependencies on ad-hoc schema synchronization. The repository's deployment/readiness documentation explicitly identifies formal migrations as a remaining production hardening requirement. fileciteturn255file0L2-L2

## Security changes

Any authentication, authorization, upload, public-data, or location-data change requires review against:

- `docs/security.md`;
- `docs/security-threat-model.md`;
- `docs/privacy-data-governance.md`.

## Evidence changes

Any change to EXIF, GPS, geocoding, pHash, or photo-age logic must include representative test cases and update `docs/evidence-validation.md`.

## Documentation requirements

Update documentation in the same change for:

| Change | Required documentation |
|---|---|
| API contract | API Reference |
| Schema | Data Model |
| Security behavior | Security + Threat Model |
| Evidence rule | Evidence Validation |
| Config | Environment Reference |
| Operations | Observability / Runbook |
| Architecture | ADR |

## Pull request checklist

```text
[ ] Clear title and scope
[ ] Correct application layer identified
[ ] Tests added/updated
[ ] Authorization reviewed
[ ] Sensitive-data handling reviewed
[ ] Documentation updated
[ ] CI passes
[ ] No secrets committed
[ ] No real personal data committed as fixtures
[ ] Deployment impact understood
```

## Test commands

Backend:

```bash
cd backend
npm ci
node --check server.js
```

Admin:

```bash
cd admin
npm ci
npm run build
```

Mobile:

```bash
cd mobile
npm ci
npx expo config --type public
```

These are aligned with the current CI workflow. fileciteturn262file0L2-L6

## Commit style

Use intent-focused messages:

```text
feat: add issue review audit trail
fix: reject invalid GPS coordinates
security: harden upload validation
test: cover role authorization matrix
docs: document deployment recovery
```

## Definition of done

A change is complete only when implementation, security, tests, documentation, CI, and deployment implications have been considered.
