# Security Policy

CivicFix handles citizens' accounts, phone numbers, locations and photos. We take reports about its security seriously.

## Reporting a vulnerability

**Do not open a public issue.** Report privately through GitHub:

1. Go to the repository's **Security** tab → **Report a vulnerability**
   ([direct link](https://github.com/santhosh12133/CivicGuardAI/security/advisories/new)).
2. Describe the problem, the affected component (API, admin portal, Android app, infrastructure), how to reproduce it, and the impact you expect.

Please do not access other people's data, run denial-of-service tests, or test against a production deployment you do not operate.

### What to expect

| Step | Target time |
|---|---|
| Acknowledgement of your report | 3 working days |
| Initial assessment and severity | 7 working days |
| Fix or mitigation for critical and high issues | 30 days |

We will keep you updated, credit you in the release notes if you want, and coordinate the disclosure date with you.

## Supported versions

Only the latest release on `main` receives security fixes. Deployments should update to it; the Android app should be updated to the latest APK under **Releases**.

## Scope

In scope: the code in this repository — the API (`apps/api/`), admin portal (`apps/admin/`), Android app (`apps/mobile/`), infrastructure templates (`infra/`) and CI workflows (`.github/`).

Out of scope: third-party services (AWS, Google, SMS carriers, OpenStreetMap Nominatim) and deployments operated by others; report those to their owners.

## Security design

How authentication, authorization, evidence checks and secrets work is documented in [docs/security/overview.md](docs/security/overview.md) and the [threat model](docs/security/threat-model.md).
