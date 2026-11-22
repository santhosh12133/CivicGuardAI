# Project structure

```text
CivicGuardAI/
├── apps/
│   ├── api/                 API: Node.js 18, Express, Sequelize, PostgreSQL
│   │   ├── server.js        Entry point
│   │   ├── src/             Application code (see below)
│   │   ├── scripts/         Maintenance commands (create-staff, prune-uploads, …)
│   │   ├── test/            unit/, integration/, e2e/seed.js, fixtures/, helpers/
│   │   ├── Dockerfile       Production image (includes the RDS CA bundle)
│   │   └── .env.example     Configuration template
│   ├── admin/               Admin portal: React 19, Vite, MUI
│   │   ├── src/
│   │   │   ├── api/api.js   HTTP client, token storage and silent renewal
│   │   │   ├── pages/       Login, Overview, Dashboard (issue list), IssueDetails, Staff
│   │   │   └── components/  Sidebar, Topbar
│   │   ├── public/          favicon.svg
│   │   └── vercel.json      SPA routing for Vercel
│   └── mobile/              Android app: Expo SDK 54, React Native 0.81
│       ├── App.js, index.js Entry points
│       ├── app.json         Expo config (name, package com.civicfix.app, scheme civicfix)
│       ├── app.config.js    Build-time additions (version code, Maps key)
│       ├── assets/          App icon, adaptive icon, splash image
│       └── src/
│           ├── context/AuthContext.js   Sign-in state and methods
│           ├── navigation/  Tabs (Home, My Reports, Report, Profile) + auth stack
│           ├── screens/     One file per screen
│           └── utils/api.js HTTP client, token renewal, server address
├── e2e/
│   ├── admin/               Playwright tests for the portal
│   └── mobile/              Maestro flows for the Android app
├── infra/aws/               CloudFormation: bootstrap.yml, base.yml, api.yml
├── docs/                    Documentation (start at docs/README.md)
├── .github/
│   ├── workflows/           CI, end-to-end, deploy, APK, admin task
│   ├── scripts/             Emulator helpers used by workflows
│   ├── ISSUE_TEMPLATE/      Bug and feature forms
│   └── CODEOWNERS, dependabot.yml, pull_request_template.md
├── render.yaml              Render blueprint (must stay at the root)
├── package.json             Root scripts (install:all, dev:*, test, lint, …)
├── .prettierrc, .editorconfig, .gitattributes, .gitignore
└── README.md, CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md, CHANGELOG.md
```

Each app is independent: its own `package.json`, lock file, `.env.example` and README, installed and built on its own (no npm workspaces — Expo and React Native tooling is sensitive to hoisted dependencies; see [ADR 0001](../architecture/decisions/0001-monorepo-with-three-apps.md)). Shared concerns — tests across apps, infrastructure, CI and documentation — live at the top level.

## API source layout (`apps/api/src/`)

| Folder | Contains | Rule of thumb |
|---|---|---|
| `routes/` | URL definitions, `express-validator` rules, middleware per route | No business logic |
| `controllers/` | Request handlers (`authController`, `issueController`) | Read request → call models/services → shape response |
| `services/` | Reusable domain logic: sessions, one-time codes, email/SMS, Google, AWS signing | No `req`/`res` |
| `middleware/` | Auth and roles, rate limiting, uploads, error handler | Cross-cutting concerns |
| `models/` | Sequelize models; `index.js` defines associations | One model per table |
| `utils/` | Pure helpers: EXIF dates, pHash, geocoding, photo store, serialisers | Small and unit-tested |
| `config/` | Database connection and schema sync | |
| `constants/` | Issue categories | |

`src/app.js` builds the Express app without listening, so tests can start it on a random port; `server.js` adds configuration checks, the database connection and schema sync.

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| JavaScript files | camelCase (API), PascalCase for React components/screens | `photoStore.js`, `IssueDetails.jsx`, `ReportScreen.js` |
| Database tables and columns | snake_case, plural tables | `issue_updates.to_status` |
| API paths | lower case, kebab-case, plural resources | `/api/auth/change-password`, `/api/issues/:id` |
| Environment variables | UPPER_SNAKE_CASE; `VITE_`/`EXPO_PUBLIC_` prefixes only for public client values | `AUTH_RATE_LIMIT_MAX` |
| Tests | `<subject>.test.js`; Maestro flows numbered `NN-description.yaml` | `sessions.test.js`, `06-phone-sign-in.yaml` |
| Branches | `feat/…`, `fix/…`, `docs/…`, `chore/…` | `fix/android-upload` |
