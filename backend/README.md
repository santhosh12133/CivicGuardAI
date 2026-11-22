# CivicFix API

Node.js 18 / Express service that stores accounts, issues and photos in PostgreSQL, checks report evidence, and serves the admin portal and Android app.

## Quick start

```bash
cp .env.example .env        # set DATABASE_URL and JWT_SECRET
npm ci
npm run dev                 # http://localhost:5000
curl http://localhost:5000/health
```

Full setup, including a database in Docker: [Local development](../docs/getting-started/local-development.md).

## Commands

| Command | Does |
|---|---|
| `npm run dev` / `npm start` | Start with / without auto-reload |
| `npm test` | Unit + integration tests (needs `TEST_DATABASE_URL`, a **disposable** database) |
| `npm run test:unit` | Unit tests only |
| `npm run create-staff -- --email … --name "…" --role admin` | Create or reset a staff/admin account |
| `npm run view-users` | List accounts |
| `npm run prune-uploads [-- --delete]` | Find / delete unreferenced photos |
| `npm run check:connection [-- <url>]` | Check a running API |
| `npm run format` | Prettier |

All commands: [Scripts reference](../docs/reference/scripts.md).

## Layout

```text
server.js         start-up checks, database connection, schema sync, listen
src/app.js        middleware and routes (no listening; used by tests)
src/routes/       URLs + input validation
src/controllers/  request handlers
src/services/     sessions, one-time codes, email/SMS, Google, AWS signing
src/middleware/   auth, rate limits, uploads, errors
src/models/       Sequelize models
src/utils/        EXIF dates, pHash, geocoding, photo store
scripts/          maintenance commands
test/             unit/, integration/, e2e/seed.js, fixtures/
```

## Documentation

- [API reference](../docs/api/reference.md)
- [Architecture](../docs/architecture/overview.md), [Authentication](../docs/architecture/authentication.md), [Evidence validation](../docs/architecture/evidence-validation.md), [Data model](../docs/architecture/data-model.md)
- [Configuration](../docs/reference/configuration.md)
- [Testing](../docs/testing/strategy.md)

## Docker

```bash
docker build -t civicfix-api .
docker run --rm -p 5000:5000 --env-file .env civicfix-api
```

The image runs as the non-root `node` user and includes Amazon RDS's CA bundle at `/app/certs/rds-global-bundle.pem`.
