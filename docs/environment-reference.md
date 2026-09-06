# Environment Reference

This file is the operational contract for configuration. Real secrets must never be committed.

## Backend variables

| Variable | Required | Example | Sensitive | Purpose |
|---|---|---|---|---|
| `NODE_ENV` | Production: yes | `production` | No | Selects production behavior |
| `PORT` | No | `5000` | No | HTTP listener port |
| `DATABASE_URL` | Yes | `postgres://...` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | random 64+ char value | Yes | JWT signing/verification secret |
| `CORS_ORIGINS` | Production: yes | `https://admin.example.com` | No | Comma-separated browser origin allow-list |
| `API_HOST` | Recommended | `api.example.com` | No | Host used when constructing image URLs |
| `API_PROTOCOL` | Production: yes | `https` | No | URL scheme used for generated URLs |
| `DB_SYNC` | Transitional only | `false` | No | Explicit schema synchronization switch; do not rely on it for mature production migration management |

The current example file documents these variables and explicitly warns against committing real database credentials. fileciteturn260file0L2-L6

The API startup requires a JWT secret of at least 32 characters and requires `CORS_ORIGINS` in production. fileciteturn257file0L2-L5

## Admin variables

Expected client-side configuration:

| Variable | Example | Sensitive | Purpose |
|---|---|---|---|
| `VITE_API_URL` | `https://api.example.com/api` | No | API base URL embedded into the Vite build |

Never place private credentials in a `VITE_*` variable because client-side Vite variables are shipped to the browser.

## Mobile variables

Expected Expo client configuration:

| Variable | Example | Sensitive | Purpose |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://api.example.com` | No | Backend root URL embedded into the mobile build |

Do not place secrets in `EXPO_PUBLIC_*` variables. The deployment guide requires the mobile value to omit `/api` because the client adds API paths itself. fileciteturn255file0L2-L2

## Configuration precedence

Use this precedence for deployment:

```text
Hosting platform / CI secrets
          > runtime environment variables
          > local .env
          > documented defaults
```

Never make source-code defaults silently override an explicitly supplied production variable.

## Secret-management rules

- Keep `.env` files out of Git.
- Rotate compromised secrets immediately.
- Use separate credentials for development, staging, and production.
- Do not print database URLs, JWT secrets, Authorization headers, or session material to logs.
- Do not put backend secrets in admin/mobile environment variables.

## Configuration validation checklist

Before release:

- [ ] Required variables are present.
- [ ] Production API uses HTTPS.
- [ ] CORS allow-list contains only trusted origins.
- [ ] JWT secret is randomly generated and long enough.
- [ ] Database points to the intended environment.
- [ ] Client API URLs do not reference a developer LAN address.
- [ ] No secrets appear in build artifacts or repository files.
