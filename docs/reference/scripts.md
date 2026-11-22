# Scripts reference

## Repository root

Convenience wrappers; each app keeps its own `package.json` and lock file.

| Command | Does |
|---|---|
| `npm run install:all` | `npm ci` in `backend/`, `admin/` and `mobile/` |
| `npm run dev:api` | API with auto-reload on <http://localhost:5000> |
| `npm run dev:admin` | Admin portal on <http://localhost:5173> |
| `npm run dev:mobile` | Expo dev server for the Android app |
| `npm test` | Backend unit + integration tests (needs `TEST_DATABASE_URL`) |
| `npm run test:unit` | Backend unit tests only (no database) |
| `npm run lint` | ESLint on the admin portal |
| `npm run build:admin` | Production build of the admin portal (needs `VITE_API_URL`) |
| `npm run e2e:admin` | Playwright suite (needs a running API and built portal, see [Testing](../testing/strategy.md#running-end-to-end-tests-locally)) |

## API (`backend/`)

| Command | Does |
|---|---|
| `npm start` | Start the API (`node server.js`) |
| `npm run dev` | Start with `nodemon` (restarts on file changes) |
| `npm test` | Unit + integration tests |
| `npm run test:unit` / `test:integration` | One suite |
| `npm run format` | Prettier on `src/` and `server.js` |
| `npm run create-staff -- --email <e> --name "<n>" --role staff\|admin` | Create a staff/admin account, or reset its password and role if the email exists. Prints a generated password once (or uses `STAFF_PASSWORD`). On AWS use the **AWS admin task** workflow instead |
| `npm run view-users` | List accounts (id, name, email, role, dates) |
| `npm run prune-uploads` | List photos no issue references (dry run) |
| `npm run prune-uploads -- --delete` | Delete them. Files changed in the last hour are skipped, so it is safe while the API runs |
| `npm run check:connection [-- <API URL>]` | Call `/health` and an API route on a running server and print what it finds (default `http://localhost:5000`) |
| `npm run check:geocoding` | Try reverse geocoding a few coordinates and show cache behaviour |

All database scripts use the same settings as the API (`DATABASE_URL` or `DB_*`, `DATABASE_SSL`). To run one against a hosted database from your computer, prefix the command, e.g.

```bash
DATABASE_URL="<external URL>" DATABASE_SSL=true npm run view-users
```

## Admin portal (`admin/`)

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint |

## Android app (`mobile/`)

| Command | Does |
|---|---|
| `npm start` | Expo dev server (scan the QR code with Expo Go, or press `a` for an emulator) |
| `npm run android` | Start and open on a connected device/emulator |
| `npx expo config --type public` | Print the resolved app configuration (what CI validates) |

Release APKs are built by the **Android APK** workflow, not locally; see [Android app releases](../deployment/android-app.md).
