# Local development

Run the API, admin portal and Android app on your own machine.

## Prerequisites

| Tool | Version | For |
|---|---|---|
| Node.js | 18 LTS for the API (matches the Docker image), 20 LTS for the admin portal and app | Everything |
| npm | 9+ (bundled with Node) | Installing dependencies |
| PostgreSQL | 15+ (17 in CI and on AWS), or Docker | The API's database |
| Android phone with [Expo Go](https://expo.dev/go), or Android Studio emulator | Android 10+ | The app |
| Docker (optional) | 24+ | Running PostgreSQL and building the API image |

ExifTool is bundled with the API's `exiftool-vendored` dependency; nothing to install.

## 1. Clone and install

```bash
git clone https://github.com/santhosh12133/CivicGuardAI.git
cd CivicGuardAI
npm run install:all          # npm ci in apps/api, apps/admin and apps/mobile
```

## 2. Database

The quickest way is Docker:

```bash
docker run --name civicfix-db -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=civicfix postgres:17
```

Tables are created automatically when the API starts in development.

## 3. API

```bash
cd apps/api
cp .env.example .env
```

Edit `.env`:

```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:5432/civicfix
JWT_SECRET=<output of: openssl rand -hex 32>
CORS_ORIGINS=http://localhost:5173
API_HOST=<your computer's LAN IP>:5000   # so photo URLs work on your phone
API_PROTOCOL=http
```

```bash
npm run dev                  # http://localhost:5000, restarts on changes
curl http://localhost:5000/health   # {"status":"ok","database":"ok"}
```

Create an admin account for the portal:

```bash
npm run create-staff -- --email admin@example.com --name "Local Admin" --role admin
```

Email and SMS codes (forgot password, phone sign-in) are printed in this terminal (`[notify:email] …`) instead of being sent. Google sign-in stays hidden unless you set `GOOGLE_CLIENT_ID`/`SECRET`.

## 4. Admin portal

```bash
cd apps/admin
cp .env.example .env         # VITE_API_URL=http://localhost:5000/api
npm run dev                  # http://localhost:5173
```

Sign in with the account from step 3.

## 5. Android app

```bash
cd apps/mobile
cp .env.example .env
# EXPO_PUBLIC_API_URL=http://<your computer's LAN IP>:5000   (not localhost: the phone can't reach it)
npm start
```

Scan the QR code with Expo Go (same Wi-Fi as your computer), or press `a` to open an Android emulator (the emulator reaches your computer at `http://10.0.2.2:5000`). You can also change the server inside the app from **Login → Server**.

To report an issue you need a photo **taken in the last 24 hours, near your current location** (that's the [evidence check](../architecture/evidence-validation.md)); use the camera button.

## 6. Tests

```bash
cd apps/api
npm run test:unit
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/civicguard_test npm test
```

`TEST_DATABASE_URL` must be a separate, disposable database: the integration tests drop every table. See [Testing](../testing/strategy.md) for the end-to-end suites.

## Everyday workflow

1. Branch from `main`: `git switch -c feat/short-description`.
2. Make the change with tests ([CONTRIBUTING.md](../../CONTRIBUTING.md)).
3. `npm test` in `apps/api/`; `npm run lint && npm run build` in `apps/admin/` if you touched it.
4. Push and open a pull request; CI and the end-to-end suites run automatically.

## Common problems

| Symptom | Fix |
|---|---|
| API exits with `JWT_SECRET must be configured with at least 32 characters` | Set a long `JWT_SECRET` in `apps/api/.env` |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL isn't running: `docker start civicfix-db` |
| Portal shows a CORS error | `CORS_ORIGINS` in `apps/api/.env` must be exactly `http://localhost:5173` |
| App says *Cannot connect to server* | Use your LAN IP, not `localhost`; phone and computer on the same network; firewall allows port 5000 |
| Photos don't load on the phone | Set `API_HOST` to `<LAN IP>:5000` and restart the API |
| *Photo is older than 24 hours* | Take a new photo with the camera |

More: [Troubleshooting](../operations/troubleshooting.md).
