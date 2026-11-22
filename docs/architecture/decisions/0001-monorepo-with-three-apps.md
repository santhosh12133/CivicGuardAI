# ADR 0001: Keep the API, admin portal and Android app in one repository

- **Status:** Accepted
- **Date:** recorded 2026-11; the decision predates this record

## Context

The three applications share one API contract and are released together by one small team. Changes such as a new issue field touch the API, the portal and the app at once.

## Decision

Keep `backend/`, `admin/` and `mobile/` in one repository, each with its own `package.json` and lock file (no npm workspaces). Shared concerns (CI, end-to-end tests, infrastructure, documentation) live at the top level.

## Alternatives considered

- Separate repositories per app: independent release cadence, but cross-cutting changes need coordinated pull requests.
- npm/Yarn workspaces: shared dependency hoisting, but Expo and React Native tooling is sensitive to hoisting.

## Consequences

One pull request can change the contract and every client, and the end-to-end tests run all of them together. Each app still installs and builds on its own, so a broken dependency in one does not block the others. CI filters by path where useful.
