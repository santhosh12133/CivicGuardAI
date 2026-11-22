# CivicFix documentation

Start with the section that matches what you want to do.

## Get started

| Document | For |
|---|---|
| [Product overview](product/overview.md) | What CivicFix does, for whom, and its features |
| [Local development](getting-started/local-development.md) | Run the API, portal and app on your machine |
| [Project structure](getting-started/project-structure.md) | Where code lives and naming conventions |
| [Contributing](../CONTRIBUTING.md) | Workflow, coding standards, pull requests |

## Architecture

| Document | Covers |
|---|---|
| [Architecture overview](architecture/overview.md) | Components, request pipeline, key flows, AWS topology, scaling |
| [Authentication and sessions](architecture/authentication.md) | Roles, tokens, refresh rotation, password / phone / Google sign-in |
| [Evidence validation](architecture/evidence-validation.md) | How report photos are checked (date, GPS, duplicates) |
| [Data model](architecture/data-model.md) | Tables, relationships, schema changes, retention |
| [Architecture decisions](architecture/decisions/README.md) | Why the main technical choices were made (ADRs) |

## API

| Document | Covers |
|---|---|
| [API reference](api/reference.md) | Every endpoint, access rules, errors, limits |

## Deploy

| Document | Covers |
|---|---|
| [Deployment overview](deployment/README.md) | Hosting options, launch checklist, rollback |
| [Deploy on AWS](deployment/aws.md) | Recommended production setup with GitHub Actions |
| [Deploy on Render + Vercel](deployment/render-vercel.md) | Free trial setup |
| [Android app releases](deployment/android-app.md) | Signing, building and publishing the APK |
| [Sign-in providers](deployment/sign-in-providers.md) | Email (SES), SMS (SNS) and Google sign-in setup |
| [Release process](deployment/release-process.md) | Versioning, changelog, hotfixes |

## Operate

| Document | Covers |
|---|---|
| [Runbook](operations/runbook.md) | Routine tasks: accounts, deploys, secrets, housekeeping |
| [Monitoring](operations/monitoring.md) | Signals, service objectives, recommended alarms |
| [Incident response](operations/incident-response.md) | Severity, process, playbooks, postmortem template |
| [Backup and recovery](operations/backup-and-recovery.md) | Point-in-time restore, drills, manual backups |
| [Troubleshooting](operations/troubleshooting.md) | Symptoms and fixes for API, sign-in, portal, app, deploys |
| [Production readiness](operations/production-readiness.md) | What is done and what remains before launch |

## Security

| Document | Covers |
|---|---|
| [Security overview](security/overview.md) | Implemented controls and operator responsibilities |
| [Threat model](security/threat-model.md) | Assets, actors, STRIDE threats, residual risks |
| [Privacy and personal data](security/privacy.md) | Data inventory, processors, retention, individual requests |
| [Security policy](../SECURITY.md) | How to report a vulnerability |

## Quality

| Document | Covers |
|---|---|
| [Testing](testing/strategy.md) | Test layers, suites, running them, writing tests |

## Reference

| Document | Covers |
|---|---|
| [Configuration](reference/configuration.md) | Every environment variable, repository variable and secret |
| [Scripts](reference/scripts.md) | npm scripts and maintenance commands |
| [CI/CD](reference/ci-cd.md) | What each GitHub Actions workflow does |
| [Glossary](reference/glossary.md) | Terms used across the docs |

## Writing documentation

- Docs are Markdown in this folder, reviewed in pull requests like code. Diagrams use [Mermaid](https://mermaid.js.org), which GitHub renders.
- Update docs in the same pull request as the behaviour they describe; the pull request template lists which ones.
- Describe what the system does today. Plans go in the roadmap section of the [product overview](product/overview.md) or in issues, and known gaps in the threat model or production readiness.
- Use relative links, so they work on GitHub and in clones.
