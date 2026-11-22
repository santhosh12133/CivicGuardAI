# CivicFix admin portal

React 19 + Vite + MUI web app for municipal staff and administrators: triage reports, update status and category, post notes and resolution photos, see statistics, and manage staff accounts.

## Quick start

```bash
cp .env.example .env        # VITE_API_URL=http://localhost:5000/api
npm ci
npm run dev                 # http://localhost:5173
```

Sign in with a staff or admin account (`npm run create-staff` in `backend/`). Citizen accounts are refused.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build into `dist/` (requires `VITE_API_URL` ending in `/api`) |
| `npm run preview` | Serve `dist/` locally |
| `npm run lint` | ESLint |

## Layout

```text
src/
├── api/api.js        axios client: token storage, silent refresh, sign-out on expiry
├── pages/            Login, Overview (stats), Dashboard (issue list), IssueDetails, Staff
├── components/       Sidebar, Topbar
├── categories.js     category labels
└── App.jsx           routes and the protected layout
```

| Route | Page | Access |
|---|---|---|
| `/login` | Sign in, forgot password, Google | Public |
| `/` | Overview statistics | Staff, admin |
| `/issues` | Issue list with filters and search | Staff, admin |
| `/issue/:id` | Issue detail and updates | Staff, admin |
| `/staff` | Staff management | Admin |

## Deployment

A static site: on AWS it is built and uploaded to S3 + CloudFront by the deploy workflow; on Vercel set the root directory to `admin` and `VITE_API_URL`. See [Deployment](../docs/deployment/README.md). The portal's origin must be in the API's `CORS_ORIGINS`.

End-to-end tests: [`e2e/admin`](../e2e/README.md).
