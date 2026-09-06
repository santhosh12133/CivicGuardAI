# CivicFix Project

CivicFix is a civic issue reporting platform built around three applications:

- `backend/` — Node.js + Express API for authentication, authorization, issue management, and PostgreSQL/PostGIS persistence.
- `admin/` — web-based administration dashboard for managing civic issues and users.
- `mobile/` — React Native (Expo) application for citizens to authenticate and report civic issues.

## Architecture Overview

```text
Citizen Mobile App / Admin Dashboard
                |
                | HTTP + JSON
                | Authorization: Bearer <JWT>
                v
        Node.js + Express API
                |
        +-------+--------+
        |                |
   Auth Middleware   Issue Routes
        |                |
        +-------+--------+
                |
          PostgreSQL / PostGIS
```

The backend exposes the `/api/auth` and `/api/issues` route groups. Authentication uses JSON Web Tokens (JWT), while passwords are hashed with `bcryptjs` before storage. Role-based authorization is enforced by backend middleware rather than by the client applications.

## Authentication & Authorization

### Authentication components

The authentication implementation is split across the following components:

| Component | Responsibility |
|---|---|
| `backend/src/routes/authRoutes.js` | Defines registration, login, and admin-only user-list endpoints and validates incoming fields. |
| `backend/src/controllers/authController.js` | Hashes passwords during registration, verifies passwords during login, creates JWTs, and returns a sanitized user object. |
| `backend/src/middleware/authMiddleware.js` | Reads the `Authorization` header, verifies the JWT signature/expiry, attaches the decoded claims to `req.user`, and enforces roles. |
| `mobile/src/context/AuthContext.js` | Manages the mobile login/register/logout lifecycle and persists the session locally. |
| `mobile/src/utils/api.js` | Configures Axios and adds the JWT as a Bearer token to authenticated API requests. |
| `backend/server.js` | Registers the authentication route group under `/api/auth` and enables the `Authorization` header through CORS. |

### Credentials and password handling

Passwords are **not stored as plaintext**. During registration, the backend hashes the supplied password with `bcrypt.hash(password, 10)` and stores the resulting hash. During login, the supplied password is checked with `bcrypt.compare(...)`.

Registration is intentionally limited to the `citizen` role. Although the request validator recognizes `citizen`, `staff`, and `admin`, the controller rejects non-citizen registrations on the public registration route.

The backend also rejects duplicate email addresses and returns a generic `Invalid credentials` response when login fails, avoiding separate messages for an unknown user versus an incorrect password.

### JWT creation

After a successful registration or login, the backend creates a JWT containing:

```text
{
  userId,
  role
}
```

The token is signed with the server-side `JWT_SECRET` environment variable and configured to expire after **12 hours**. The secret itself should never be committed to source control or exposed to clients.

### Request flow

```text
1. User enters email/password
        |
        v
2. Mobile app calls POST /api/auth/login
        |
        v
3. authController finds the user by email
        |
        v
4. bcrypt.compare() verifies the password hash
        |
        v
5. Backend signs a JWT containing userId + role
        |
        v
6. Backend returns { user, token }
        |
        v
7. Mobile AuthContext stores the session
        |
        v
8. api.js sets Authorization: Bearer <token>
        |
        v
9. Protected backend routes verify the JWT
        |
        v
10. Role middleware allows/denies the operation
```

The mobile application restores the stored token on startup and re-applies it to the Axios client. Logout clears the local token and user state and removes the authorization header.

### Protected routes and roles

Authentication and authorization are enforced at the API layer:

| Endpoint | Access |
|---|---|
| `POST /api/auth/register` | Public; citizen registration only |
| `POST /api/auth/login` | Public |
| `GET /api/auth/users` | `admin` only |
| `POST /api/issues` | Authenticated user |
| `GET /api/issues` | Public |
| `GET /api/issues/:id` | Public |
| `PUT /api/issues/:id` | `staff` or `admin` |
| `DELETE /api/issues/:id` | `admin` only |

Protected requests must include:

```http
Authorization: Bearer <JWT_TOKEN>
```

The middleware first checks that the header exists and starts with `Bearer `. It then verifies the token using `JWT_SECRET`. A missing token returns `401`, an invalid/expired token returns `401`, and an authenticated user without the required role returns `403`.

### Example authenticated request

```bash
curl http://localhost:5000/api/auth/users \
  -H "Authorization: Bearer <admin_token>"
```

An admin token is required because `/api/auth/users` is protected by both `authenticateToken` and `authorizeRoles('admin')`.

## Environment & Secret Management

The backend expects configuration through environment variables. At minimum:

```env
PORT=5000
DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database>
JWT_SECRET=<strong-random-secret>
```

Keep production secrets outside the repository. Do not place real passwords, JWT secrets, database credentials, or other sensitive values in README files, source code, or client-side bundles.

## Development Setup

### Backend

Prerequisites:

- Node.js 18+
- PostgreSQL
- PostGIS extension (used by the project for geospatial data)
- npm

Start the backend:

```bash
cd backend
npm install
npm run dev
```

The API runs on port `5000` by default.

### Mobile app with local backend

When testing the Expo application against a backend running on your computer, the mobile device must be able to reach that backend.

1. Find the computer's local IPv4 address with:

```sh
ipconfig
```

2. Update `mobile/src/utils/api.js` with the current development backend host when using the local-IP configuration.
3. Keep the mobile device and development computer on the same network.
4. Restart the Expo development server after changing the API endpoint.

The mobile API client centralizes the backend base URL and authentication header configuration.

### Localtunnel option

The backend README also documents using Localtunnel to expose the development API for mobile testing. The tunnel URL is temporary and should be treated as a development convenience, not as a production deployment architecture.

## Troubleshooting

### Authentication token problems

If a protected request starts returning `401 Invalid or expired token`, log out and sign in again to obtain a fresh JWT. The server validates the token on every protected request and does not provide a refresh-token endpoint in the current implementation.

### Role/permission problems

A valid token is not enough for staff/admin operations. The JWT role claim must match the role required by the route. For example, issue deletion requires `admin`, while issue updates require `staff` or `admin`.

### Network problems

The mobile client contains diagnostics for backend connectivity, including timeout, network, and HTTP error handling. Check that the backend is running and that the mobile device is using a reachable API URL.

## Issue Validation & Photo Requirements

The backend validates civic issue fields such as title, description, latitude, longitude, and status. Issue creation is authenticated, while staff/admin permissions are required for updates and admin permission is required for deletion.

The existing project also validates uploaded photos for security/authenticity and includes GPS/EXIF-related checks as described in the original troubleshooting guidance.

## API Summary

### Authentication

- `POST /api/auth/register` — register a citizen and receive a JWT.
- `POST /api/auth/login` — authenticate and receive a JWT.
- `GET /api/auth/users` — list users; admin only.

### Civic issues

- `POST /api/issues` — create an issue; authentication required.
- `GET /api/issues` — list issues.
- `GET /api/issues/:id` — retrieve one issue.
- `PUT /api/issues/:id` — update an issue; staff/admin only.
- `DELETE /api/issues/:id` — delete an issue; admin only.

### Health

- `GET /health` — basic backend health probe.

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

## Security Notes

- Passwords are bcrypt-hashed before persistence.
- JWTs are signed server-side with `JWT_SECRET` and expire after 12 hours.
- Protected endpoints require a Bearer token.
- Role checks are performed on the backend, so client-side UI restrictions are not the security boundary.
- Never expose `JWT_SECRET` or database credentials in client code or version control.
- For production, serve the API over HTTPS so credentials and tokens are not transported over plaintext HTTP.
- The current backend enables CORS with `origin: '*'`; production deployments should restrict allowed origins to trusted applications.

## Current Authentication Limitations

The current implementation is intentionally simple and suitable for a student/project environment, but it can be strengthened for production with:

- refresh-token or short-lived access-token rotation
- email verification
- password reset flows
- account lockout/rate limiting for repeated failed logins
- stricter production CORS configuration
- HTTPS-only deployment
- secure platform storage for mobile tokens
- audit logging for privileged admin/staff actions

## Testing the Backend

Health check:

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{"status":"ok"}
```

Authenticated admin endpoint:

```bash
curl http://localhost:5000/api/auth/users \
  -H "Authorization: Bearer <admin_token>"
```

---

## Development Notes

When switching Wi-Fi networks during local mobile development, the computer's local IP can change. Update the mobile API configuration accordingly before retesting connectivity.
