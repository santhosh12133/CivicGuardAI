# Release Management

## 1. Release philosophy

A release is a controlled change to application behavior, data, security posture, or infrastructure. The goal is not only to deploy code, but to preserve a traceable chain from change to verification.

```text
Change
  -> Review
  -> CI
  -> Staging verification
  -> Release decision
  -> Deployment
  -> Smoke test
  -> Observe
  -> Close / rollback
```

## 2. Release inputs

Every release should have:

- a known commit SHA;
- a summary of functional/security changes;
- migration impact assessment;
- environment/configuration changes;
- test evidence;
- deployment target;
- rollback procedure.

## 3. Pre-release gates

### Code

- [ ] Scope reviewed.
- [ ] No debug credentials or temporary endpoints.
- [ ] Secrets absent from source and artifacts.

### API

- [ ] Authentication and authorization tests pass.
- [ ] Validation tests pass.
- [ ] Error responses are safe.
- [ ] Health endpoint works.

### Evidence

- [ ] Upload limits verified.
- [ ] Representative EXIF/GPS fixtures pass.
- [ ] Duplicate detection behavior reviewed.

### Database

- [ ] Schema change reviewed.
- [ ] Migration order known.
- [ ] Backup/restore risk understood.

### Clients

- [ ] Admin build succeeds.
- [ ] Mobile configuration points to intended API environment.
- [ ] Deep links/navigation work where applicable.

The current CI validates backend installation/syntax, admin build, and Expo configuration; deeper integration/E2E coverage remains a required release improvement. fileciteturn262file0L2-L6

## 4. AI/heuristic release gate

Evidence heuristics such as EXIF, GPS, and pHash are safety-sensitive. A threshold change must record:

- old value;
- new value;
- expected behavior change;
- false-positive/negative analysis;
- representative fixtures;
- rollback plan.

## 5. Deployment

The current supported deployment model documents:

- backend: Docker + Render Blueprint + managed PostgreSQL;
- admin: Vite + Vercel;
- mobile: Expo EAS.

Follow `DEPLOYMENT.md` for environment-specific commands and post-deployment checks. fileciteturn255file0L2-L2

## 6. Post-deployment smoke test

At minimum:

1. `GET /health`.
2. Citizen registration/login.
3. Staff/admin login.
4. Valid issue creation.
5. Invalid JWT rejection.
6. Role-restricted update/delete checks.
7. Representative image upload.
8. Admin dashboard access.
9. Issue status update.

## 7. Rollback

Rollback when the release creates material instability, security exposure, or data-integrity risk and a safe forward fix is not faster.

Record:

```text
release SHA
rollback SHA
trigger
time detected
user impact
verification after rollback
follow-up corrective action
```

## 8. Hotfix policy

Hotfixes should remain narrowly scoped. Security and data-integrity fixes may bypass normal release timing, but must still receive targeted review, CI, deployment verification, and post-release documentation.

## 9. Release evidence

Store or link:

- CI run;
- release commit;
- migration result;
- staging smoke test;
- production smoke test;
- monitoring snapshot where appropriate;
- rollback evidence if used.

## 10. Release status language

Use precise status labels:

```text
Implemented       -> source code contains capability
CI Verified       -> automated checks pass
Staging Verified  -> deployed staging checks pass
Production Verified -> live production checks pass
```

Do not use “production ready” solely because source code and documentation look complete.
