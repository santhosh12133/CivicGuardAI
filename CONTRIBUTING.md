# Contributing to CivicFix

Thank you for helping. This guide covers how to propose a change and what a mergeable pull request looks like. By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Security problems go through [SECURITY.md](SECURITY.md), not public issues.

## Ways to contribute

- **Report a bug** or **suggest a feature** with the [issue forms](https://github.com/santhosh12133/CivicGuardAI/issues/new/choose).
- **Improve the docs** — anything unclear or out of date is a bug.
- **Fix an issue** — comment on it first so work isn't duplicated. For larger changes, open an issue to agree on the approach before writing code.

## Development setup

Follow [Local development](docs/getting-started/local-development.md). In short:

```bash
npm run install:all
# start PostgreSQL, configure backend/.env, then
npm run dev:api
npm run dev:admin
```

The layout and naming conventions are in [Project structure](docs/getting-started/project-structure.md).

## Workflow

1. Create a branch from `main`: `feat/…`, `fix/…`, `docs/…`, `test/…` or `chore/…`.
2. Make small, focused commits using [Conventional Commits](https://www.conventionalcommits.org):

   ```text
   feat(mobile): show the resolution photo in My Reports
   fix(api): reject photos dated in the future
   docs(runbook): add secret rotation steps
   ```

   Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `ci`. Scopes: `api`/`backend`, `admin`, `mobile`, `auth`, `evidence`, `infra`, `e2e`, …
3. Add or update tests and documentation in the same branch.
4. Run the checks locally (below), push, and open a pull request. Fill in the template.
5. CI and the end-to-end suites must pass; a maintainer reviews. Address comments with new commits; they are squashed or merged as one change.

## Checks before pushing

```bash
# API
cd backend
npm run test:unit
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/civicguard_test npm test

# Admin portal (if changed)
cd admin && npm run lint && VITE_API_URL=http://localhost:5000/api npm run build

# Android app (if changed)
cd mobile && npx expo config --type public
```

`TEST_DATABASE_URL` must be a disposable database — the tests erase it.

## Coding standards

### General

- Prefer clear code over clever code; comment *why*, not *what*.
- Keep functions small and side effects obvious. No dead code or commented-out blocks.
- Format with the project's Prettier settings (`npm run format` in `backend/`); ESLint must pass in `admin/`.
- Never commit secrets, `.env` files, keystores or real personal data.

### API (`backend/`)

- Validate every input in the route with `express-validator`; never trust the client, including the app.
- Check authorization in the route (`requireAuth`, `authorizeRoles`). Every new endpoint gets tests for anonymous, citizen, staff and admin.
- Catch errors in async handlers and pass them to `next(error)` so the error handler formats them; return `{ message }` with a correct 4xx status for client mistakes.
- Keep the response shape stable; add fields, don't rename or remove them (installed APKs depend on them).
- Never log passwords, tokens, codes or full request bodies.
- Database changes are additive only ([Data model → Schema changes](docs/architecture/data-model.md#schema-changes)).
- Evidence rules are security controls: changing one needs tests and, if it weakens a rule, an [ADR](docs/architecture/decisions/README.md).

### Admin portal and app

- Use the API client (`admin/src/api/api.js`, `mobile/src/utils/api.js`) so token renewal and errors are handled consistently.
- Show the API's error message to the user when it is meant for them (evidence rejections, lockout).
- Add accessible labels (portal) and `testID`s (app) to interactive elements so end-to-end tests can find them.
- Anything in `VITE_*` / `EXPO_PUBLIC_*` variables is public.

## Documentation

Update in the same pull request:

| If you change… | Update |
|---|---|
| An endpoint or response | [API reference](docs/api/reference.md) |
| A table or column | [Data model](docs/architecture/data-model.md) |
| An environment variable | [Configuration](docs/reference/configuration.md) and `backend/.env.example` |
| Authentication or authorization | [Authentication](docs/architecture/authentication.md), [Security overview](docs/security/overview.md) |
| Personal data collected or shared | [Privacy](docs/security/privacy.md) |
| A new risk or mitigation | [Threat model](docs/security/threat-model.md) |
| Deployment or operations | The relevant guide in [docs/deployment](docs/deployment/README.md) or [docs/operations](docs/operations/runbook.md) |
| A significant technical choice | A new [ADR](docs/architecture/decisions/README.md) |
| Anything user-visible | `CHANGELOG.md` under **Unreleased** |

## Definition of done

- [ ] The change does what the issue asked, and nothing unrelated
- [ ] Tests cover it at the lowest useful level; all checks pass
- [ ] Documentation and changelog updated
- [ ] No secrets or personal data in code, tests, logs or screenshots
- [ ] Deployment notes written if operators must do something

## Releases

Maintainers release as described in [Release process](docs/deployment/release-process.md).
