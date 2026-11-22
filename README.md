<div align="center">

# CivicFix

**Report a civic problem with one photo. Watch it get fixed.**

Citizens report potholes, broken streetlights, garbage and drainage problems from an Android app. Every photo is checked on the server: it must have been taken in the last 24 hours, at the reported spot. Municipal staff triage and resolve reports in a web portal, and citizens follow each report through a public timeline.

[![CI](https://github.com/santhosh12133/CivicGuardAI/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/santhosh12133/CivicGuardAI/actions/workflows/ci.yml)
[![End-to-end](https://github.com/santhosh12133/CivicGuardAI/actions/workflows/e2e.yml/badge.svg)](https://github.com/santhosh12133/CivicGuardAI/actions/workflows/e2e.yml)
![Node.js](https://img.shields.io/badge/node-18%20%7C%2020-339933?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo)

[Documentation](docs/README.md) · [Deploy](docs/deployment/README.md) · [API](docs/api/reference.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

</div>

---

## Features

| Citizens (Android app) | Staff and admins (web portal) |
|---|---|
| Sign in with email, phone number + SMS code, or Google | Queue of reports with status, category, reporter, search and filters |
| Report an issue: photo, category, location | Change status and category, post notes, upload a resolution photo |
| Follow **My Reports** and their timeline of updates | Overview: backlog, overdue, needs review, average time to resolve |
| Browse all issues by category | Add staff, change roles, reset passwords (admins) |

**Under the hood**

- **Evidence checks** — embedded capture date ≤ 24 h, photo GPS ≤ 200 m from the reporter, camera metadata required, perceptual-hash duplicate detection ([details](docs/architecture/evidence-validation.md)).
- **Secure sessions** — 15-minute access tokens, rotating refresh tokens with reuse detection, real sign-out and "sign out everywhere", account lockout ([details](docs/architecture/authentication.md)).
- **One-click AWS deployment** — CloudFormation + GitHub Actions with OpenID Connect: no AWS keys anywhere ([guide](docs/deployment/aws.md)).
- **Tested end to end** — API integration tests on PostgreSQL, Playwright for the portal and Maestro on an Android emulator on every pull request.

## Architecture

```mermaid
flowchart LR
  app["Android app<br/>Expo / React Native"] -- HTTPS --> api
  portal["Admin portal<br/>React + Vite"] -- HTTPS --> api
  api["CivicFix API<br/>Node.js + Express"] --> db[("PostgreSQL<br/>data + photos")]
  api -. optional .-> ext["SES · SNS · Google · Nominatim"]
```

| Part | Stack | Folder |
|---|---|---|
| API | Node.js 18, Express, Sequelize, ExifTool | [`apps/api/`](apps/api) |
| Admin portal | React 19, Vite, MUI | [`apps/admin/`](apps/admin) |
| Android app | Expo SDK 54, React Native 0.81, React Native Paper | [`apps/mobile/`](apps/mobile) |
| Infrastructure | AWS CloudFormation (ECS Express Mode, RDS, CloudFront) | [`infra/aws/`](infra/aws) |
| End-to-end tests | Playwright, Maestro | [`e2e/`](e2e) |

More: [Architecture overview](docs/architecture/overview.md) · [Project structure](docs/getting-started/project-structure.md).

## Quick start (local)

Requires Node.js 18/20 and Docker.

```bash
git clone https://github.com/santhosh12133/CivicGuardAI.git && cd CivicGuardAI
npm run install:all

docker run --name civicfix-db -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=civicfix postgres:17

cp apps/api/.env.example apps/api/.env     # set DATABASE_URL and JWT_SECRET
cp apps/admin/.env.example apps/admin/.env
npm run dev:api                        # http://localhost:5000
npm run dev:admin                      # http://localhost:5173
```

Create an admin account with `npm run create-staff --prefix apps/api -- --email you@example.com --name "You" --role admin`. To run the app on a phone, see [Local development](docs/getting-started/local-development.md).

## Deploy

| Option | For | Guide |
|---|---|---|
| **AWS** | Production: private database with backups, HTTPS, automatic deploys | [Deploy on AWS](docs/deployment/aws.md) |
| Render + Vercel | Free trial (database deleted after ~6 weeks) | [Deploy on Render + Vercel](docs/deployment/render-vercel.md) |

The Android APK is built, tested on an emulator and published to **Releases** by GitHub Actions ([Android app releases](docs/deployment/android-app.md)).

## Testing

```bash
npm run test:unit                                                    # no database
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/civicguard_test npm test
```

Integration tests **erase** the `TEST_DATABASE_URL` database. End-to-end suites run in CI on every pull request; see [Testing](docs/testing/strategy.md).

## Documentation

All documentation is in [`docs/`](docs/README.md):

- **Understand** — [Product](docs/product/overview.md) · [Architecture](docs/architecture/overview.md) · [Data model](docs/architecture/data-model.md) · [Decisions](docs/architecture/decisions/README.md)
- **Build** — [Local development](docs/getting-started/local-development.md) · [API reference](docs/api/reference.md) · [Configuration](docs/reference/configuration.md) · [Testing](docs/testing/strategy.md)
- **Run** — [Deployment](docs/deployment/README.md) · [Runbook](docs/operations/runbook.md) · [Monitoring](docs/operations/monitoring.md) · [Incident response](docs/operations/incident-response.md) · [Backup and recovery](docs/operations/backup-and-recovery.md)
- **Secure** — [Security overview](docs/security/overview.md) · [Threat model](docs/security/threat-model.md) · [Privacy](docs/security/privacy.md)

## Project status

The platform is feature-complete for a first municipal pilot and deployable to AWS. What remains before a public launch — operator setup such as branch protection, alarms and a restore drill, plus a few planned improvements — is tracked in [Production readiness](docs/operations/production-readiness.md). Changes are recorded in the [changelog](CHANGELOG.md).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and standards, and the [Code of Conduct](CODE_OF_CONDUCT.md). Report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

No license has been chosen yet, so all rights are reserved by the author. Add a `LICENSE` file before accepting outside contributions or reuse.
