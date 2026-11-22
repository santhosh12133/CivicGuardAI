# Production readiness

Where CivicFix stands against a production launch checklist. ✅ done and verified by automated tests or the deploy workflow · 🟡 partly done, or needs the operator to act · ⬜ not done yet.

Last reviewed: 2026-11.

## Application

| Area | Status | Evidence / next step |
|---|---|---|
| Authentication: hashed passwords, lockout, rate limits | ✅ | `auth.test.js`, `sessions.test.js` |
| Revocable sessions, refresh rotation, sign-out everywhere | ✅ | `sessions.test.js`, Playwright session tests |
| Password reset, phone and Google sign-in | 🟡 | Implemented and tested; operator must configure SES, SNS (DLT) and Google ([Sign-in providers](../deployment/sign-in-providers.md)) |
| Role-based access for every endpoint | ✅ | `issues.test.js`, `features.test.js` |
| Input validation and upload limits | ✅ | `app.test.js`, `evidence.test.js` |
| Evidence checks (date, GPS, metadata, duplicates) | ✅ | `evidence.test.js`, Android flow `03-report-issue` |
| Photos survive restarts and redeploys | ✅ | Stored in PostgreSQL ([ADR 0003](../architecture/decisions/0003-store-photos-in-postgresql.md)) |
| Schema upgrades on existing databases | ✅ | `schema.test.js`; additive-only rule |
| Audit log of admin account actions | ⬜ | [Threat model T20](../security/threat-model.md) |
| Self-service account deletion | ⬜ | Manual process in [Privacy](../security/privacy.md#requests-from-individuals) |
| Photo metadata stripped before publishing | ⬜ | [Threat model](../security/threat-model.md#prioritised-improvements) |

## Infrastructure (AWS)

| Area | Status | Evidence / next step |
|---|---|---|
| Infrastructure as code | ✅ | `infra/aws/*.yml`, linted in CI |
| HTTPS for API and portal | ✅ | ECS Express Mode endpoint, CloudFront |
| Private, encrypted database with TLS | ✅ | `base.yml`; TLS verified against the RDS CA |
| Automated backups and point-in-time restore | ✅ | 7 days by default |
| Restore drill performed | ⬜ | Run the [restore drill](backup-and-recovery.md#restore-drill) once and record the time taken |
| Secrets in Secrets Manager, no long-lived AWS keys | ✅ | OIDC deploy role; task role limited to SES/SNS |
| Multi-AZ database | ⬜ | Optional; doubles database cost |
| WAF / shared rate limiting | ⬜ | Before heavy public use ([ADR 0006](../architecture/decisions/0006-in-process-rate-limiting.md)) |
| Custom domain names | ⬜ | Not automated by the templates yet; the default `*.on.aws` and `*.cloudfront.net` HTTPS addresses work |

## Delivery

| Area | Status | Evidence / next step |
|---|---|---|
| CI on every change | ✅ | `ci.yml` |
| End-to-end tests on every PR | ✅ | `e2e.yml` (19 portal tests, 6 Android flows) |
| Automated deploy with health gate | ✅ | `deploy-aws.yml` |
| Signed Android releases | 🟡 | Workflow ready; operator adds the signing secrets |
| Branch protection on `main` | 🟡 | Operator enables it ([CI/CD](../reference/ci-cd.md#recommended-branch-protection-for-main)) |
| Dependency updates | ✅ | Dependabot |
| Versioned releases and changelog | ✅ | [Release process](../deployment/release-process.md), `CHANGELOG.md` |

## Operations

| Area | Status | Evidence / next step |
|---|---|---|
| Centralised logs | ✅ | CloudWatch `/civicfix/api`, 30 days |
| Health endpoint | ✅ | `/health` checks the database |
| Alarms and uptime monitoring | 🟡 | Recommended alarms in [Monitoring](monitoring.md#recommended-alarms); operator creates them |
| Error tracking (e.g. Sentry) | ⬜ | Optional |
| Budget alert | 🟡 | Operator sets it in AWS Billing |
| Incident response and runbooks | ✅ | [Incident response](incident-response.md), [Runbook](runbook.md) |

## Go-live sign-off

Before announcing the service to citizens:

- [ ] All 🟡 items above are done
- [ ] [Launch checklist](../deployment/README.md#launch-checklist) passed on the production deployment
- [ ] Restore drill done
- [ ] A privacy notice is published ([Privacy](../security/privacy.md))
- [ ] Named people for on-call and for admin account approvals
