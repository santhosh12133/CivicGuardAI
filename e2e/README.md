# End-to-end tests

Tests that drive the real admin portal and Android app against a real API and PostgreSQL database. They run on every pull request in [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml).

| Suite | Tool | Location | Covers |
|---|---|---|---|
| Admin portal | [Playwright](https://playwright.dev) (Chromium) | [`admin/`](admin) | Sign-in rules, statistics, issue list and filters, issue updates and resolution photos, staff management, forgot password, session renewal and sign-out, lockout |
| Android app | [Maestro](https://maestro.mobile.dev) on an API 34 emulator | [`mobile/`](mobile) | Sign-up and browsing, My Reports and timeline, reporting with a real photo, password change, server address, phone sign-in |

Test data is created through the public API by [`backend/test/e2e/seed.js`](../backend/test/e2e/seed.js): two citizens (Asha, Ravi), three issues in different categories (one with a real camera-stamped photo) and a staff note. It writes the accounts to a JSON file the suites read (`SEED_FILE`).

Running locally and adding tests: [Testing → End-to-end tests](../docs/testing/strategy.md#end-to-end-tests).

## Conventions

- Select elements by role and accessible name (Playwright) or `testID` (Maestro), not by layout.
- Each Playwright test may depend on earlier ones in the file (they run in order, sharing one seeded database); keep that order meaningful.
- Maestro flows run in file-name order (`01-…`, `02-…`); shared steps live in files starting with `_`.
- Never use real personal data; use `example.com` addresses and the `+91 99999 0000x` test numbers.
