# CivicFix Project

CivicFix is a civic issue reporting platform built with a React Native mobile app, a web admin dashboard, and a Node.js/Express API backed by PostgreSQL/PostGIS.

## Architecture

```text
Citizen Mobile App / Admin Dashboard
                |
                | HTTP + JSON
                | Authorization: Bearer <JWT>
                v
        Node.js + Express API
          |             |
     Auth/RBAC      Issue APIs
          |             |
          +------ PostgreSQL/PostGIS
```

### Main components

- `backend/` — authentication, role-based authorization, issue APIs, image upload handling, geocoding, and database access.
- `admin/` — React/Vite officer portal for viewing, updating, and deleting issues.
- `mobile/` — React Native/Expo citizen application for authentication, location, photo capture, and issue reporting.

## Authentication

CivicFix uses JWT-based authentication.

### Registration

`POST /api/auth/register` accepts a name, email, and password. Public registration is restricted to the `citizen` role. Passwords are hashed with `bcryptjs` before they are stored.

### Login

`POST /api/auth/login` verifies the supplied password against the stored bcrypt hash and returns:

```json
{
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "citizen"
  },
  "token": "<JWT>"
}
```

The JWT contains `userId` and `role` and expires after 12 hours. It is signed with the server-side `JWT_SECRET`.

### Protected requests

```http
Authorization: Bearer <JWT_TOKEN>
```

`backend/src/middleware/authMiddleware.js` verifies the JWT and places the decoded claims on `req.user`. Role checks then enforce permissions.

| Endpoint | Access |
|---|---|
| `POST /api/auth/register` | Public; citizen registration |
| `POST /api/auth/login` | Public |
| `GET /api/auth/users` | Admin |
| `POST /api/issues` | Authenticated user |
| `GET /api/issues` | Public |
| `GET /api/issues/:id` | Public |
| `PUT /api/issues/:id` | Staff/Admin |
| `DELETE /api/issues/:id` | Admin |

### Mobile session flow

`mobile/src/context/AuthContext.js` stores the JWT and user session in AsyncStorage, restores the session when the app starts, and configures Axios with the Bearer token. Logout removes the stored session.

### Admin session flow

The admin portal stores its JWT and user role in browser storage. Only `staff` and `admin` accounts are allowed into the officer portal. A `401` response clears the stored session and returns the user to `/login`.

## Environment Variables

### Backend

Create `backend/.env`:

```env
PORT=5000
DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database>
JWT_SECRET=<strong-random-secret>
```

Never commit real secrets or database credentials.

### Admin

Create `admin/.env` from `admin/.env.example`:

```env
VITE_API_URL=http://localhost:5000/api
```

### Mobile

Configure the API with Expo's public environment variable:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:5000
```

The mobile client prefers `EXPO_PUBLIC_API_URL` and keeps a development LAN-IP fallback for compatibility.

## Development Setup

### Backend

```bash
cd backend
npm install
npm run dev
```

The API runs on port `5000` by default.

### Admin

```bash
cd admin
npm install
npm run dev
```

### Mobile

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://192.168.x.x:5000 npx expo start
```

For a local backend, make sure the phone/emulator can reach the development computer.

## Issue Reporting

A mobile issue submission can include:

- title and description
- GPS latitude/longitude
- an uploaded image
- reverse-geocoded address
- photo metadata validation
- perceptual-hash duplicate detection

Issue creation requires authentication. Staff/admin users can update issues, while only admins can delete them.

## Security Notes

- Passwords are bcrypt-hashed; plaintext passwords are not stored.
- JWTs are signed with `JWT_SECRET` and expire after 12 hours.
- Authorization is enforced by the backend, not only by client-side UI checks.
- Production deployments should use HTTPS.
- Production CORS should restrict trusted origins instead of allowing `*`.
- Mobile tokens are currently persisted with AsyncStorage; a production app should consider platform-secure storage for sensitive credentials.
- Add rate limiting, refresh-token rotation, email verification, and password reset before production deployment.

## Project Structure

```text
CivicGuardAI/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── utils/
│   └── server.js
├── admin/
│   └── src/
└── mobile/
    └── src/
```

## Health Check

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{"status":"ok"}
```

## Troubleshooting

If authentication fails, log in again to obtain a fresh JWT. If the admin portal shows permission errors, confirm the account has `staff` or `admin` role. If the mobile app cannot connect, verify `EXPO_PUBLIC_API_URL` and the backend `/health` endpoint.
