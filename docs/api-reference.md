# API Reference

## 1. API contract

Base path:

```text
/api
```

Current route groups:

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/issues
GET    /api/issues/:id
POST   /api/issues
PUT    /api/issues/:id
DELETE /api/issues/:id
```

The issue router currently permits public reads, authenticated issue creation, staff/admin updates, and admin-only deletion. UUID, coordinate, status, and optional URL fields are validated server-side. fileciteturn258file0L2-L6

## 2. Authentication

Protected endpoints use:

```http
Authorization: Bearer <access token>
```

Every successful sign-in returns two tokens:

| Token | Lifetime | Use |
|---|---|---|
| `token` (access) | `ACCESS_TOKEN_TTL`, default 15 minutes | Sent on every request |
| `refreshToken` | `REFRESH_TOKEN_DAYS`, default 30 days | Sent only to `POST /api/auth/refresh` to get a new pair |

Each access token belongs to a server-side session. Signing out, changing or resetting a password, or an admin resetting it ends sessions immediately; a token of an ended session gets `401` with `code: "SESSION_ENDED"`. An expired access token gets `401` with `code: "TOKEN_EXPIRED"` — the admin portal and app then call `/refresh` once and retry. Refresh tokens rotate: each one works once. Presenting an already-used refresh token is treated as theft and ends every session of that account.

Five wrong passwords in a row lock the account for 15 minutes (`429`, `code: "ACCOUNT_LOCKED"`). Sign-in, code and reset endpoints are limited to `AUTH_RATE_LIMIT_MAX` requests per minute per IP.

## 3. Authentication endpoints

### GET `/api/auth/providers`

Public. Which sign-in methods this server has switched on, so clients only show working buttons:

```json
{ "password": true, "google": false, "phone": true, "passwordReset": true }
```

### POST `/api/auth/register`

Creates a citizen account. Body `{ name, email, password }` (password 8+ characters). `201 { user, token, refreshToken }`; `409` if the email is taken. Staff and admin accounts cannot be self-registered.

### POST `/api/auth/login`

Body `{ email, password }` (email is case-insensitive). `200 { user, token, refreshToken }`; `401` for a wrong email or password (same message for both); `429 ACCOUNT_LOCKED` after five wrong passwords.

`user` is `{ id, name, email, phone, role, has_password }`.

### POST `/api/auth/refresh`

Body `{ refreshToken }`. Returns a new `{ user, token, refreshToken }`; the old refresh token stops working. `401` if it is unknown, expired, revoked or reused.

### POST `/api/auth/logout`

Body `{ refreshToken }` (or just the `Authorization` header). Ends that one session. Always `200`.

### POST `/api/auth/logout-all`

Signed in. Ends every session of the account, on every device. Returns `{ sessions: <number ended> }`.

### Forgot password

| Method and path | Body | Result |
|---|---|---|
| `POST /api/auth/password/forgot` | `{ email }` | Always the same `200` message, whether or not the account exists. If it does, a 6-digit code valid for 15 minutes is emailed. `503` if email is not configured |
| `POST /api/auth/password/reset` | `{ email, code, newPassword }` | `200`; signs out every device. `400` for a wrong or expired code (5 tries per code) |

### Sign in with phone number

| Method and path | Body | Result |
|---|---|---|
| `POST /api/auth/otp/request` | `{ phone }` in international form, e.g. `+919876543210` | `200`; a 6-digit SMS code valid for 10 minutes. `429` if asked again within 60 seconds or more than 5 times an hour |
| `POST /api/auth/otp/verify` | `{ phone, code, name? }` | `200 { user, token, refreshToken }` for an existing number. For a new number `name` is required (`400 NAME_REQUIRED` first, without using up the code) and the response is `201` with a new citizen account |

### Sign in with Google

1. The browser or app opens `GET /api/auth/google/start?client=admin` (or `client=app`). It redirects to Google.
2. Google returns to `GET /api/auth/google/callback`. The API checks Google's signed ID token (signature, issuer, audience, expiry, nonce, verified email), finds or creates the account by Google ID or email, and redirects to `<ADMIN_URL>/login?google_code=…` or `civicfix://auth?google_code=…`.
3. The client sends `POST /api/auth/google/exchange` with `{ code }` and gets `{ user, token, refreshToken }`. The code works once, for 2 minutes.

New Google users become citizens. Through the admin portal only existing staff and admin accounts can sign in (`error=not_staff` otherwise). Errors come back as `?error=` on the same redirect.

### GET `/api/auth/me`

Signed in. Returns `{ "user": { id, name, email, role } }` with the role as currently stored (roles can change after a token was issued; every authenticated request re-checks the account, so a removed account gets `401` and a changed role applies immediately).

### POST `/api/auth/change-password`

Signed in. Body `{ "currentPassword": "...", "newPassword": "..." }` (new: 8+ characters, different from the current one). `400` if the current password is wrong. Accounts created by phone or Google have no password yet (`has_password: false`) and may omit `currentPassword` to set one. Other devices are signed out; the response says how many (`signedOutSessions`).

### Account management (admin only)

| Method and path | Body | Result |
|---|---|---|
| `GET /api/auth/users?role=staff,admin` | | `{ users, count }`; `role` filter optional |
| `POST /api/auth/staff` | `{ name, email, role: "staff" \| "admin" }` | `201 { user, temporaryPassword }`; `409` if the email exists |
| `PATCH /api/auth/users/:id` | `{ role: "citizen" \| "staff" \| "admin" }` | `{ user }`; `400` for your own account |
| `POST /api/auth/users/:id/reset-password` | | `{ user, temporaryPassword }`; signs that person out everywhere |

Temporary passwords are shown once; the person should change them after signing in.

## 4. Issue endpoints

### Who sees what

Issue reads are public, but responses depend on who is asking (send the bearer token when signed in):

| Field | Anonymous / other citizens | The reporting citizen | Staff / admin |
|---|---|---|---|
| Issue, photos, category, status, timeline | ✓ | ✓ | ✓ |
| `is_mine` | `false` | `true` | `true` only for their own |
| `reporter` (`{ id, name, email }`) and `user_id` | — | — | ✓ |
| Timeline author name of a citizen | hidden (`null`) | ✓ (their own) | ✓ |
| Timeline author name of staff/admin | ✓ | ✓ | ✓ |

An invalid or expired token on these public endpoints is treated as anonymous.

### GET `/api/issues`

Returns an array of issues, newest first.

Query parameters (all optional):

| Parameter | Values | Effect |
|---|---|---|
| `status` | `Open`, `In Progress`, `Resolved` | Only that status |
| `category` | a category id | Only that category |
| `mine` | `true` | Only the signed-in user's reports (`401` when not signed in) |
| `needs_review` | `true` | Only issues flagged for manual review |

Unknown values return `400`.

### GET `/api/issues/categories`

Public. Returns `[{ "id": "pothole", "label": "Pothole" }, ...]`. Current ids: `pothole`, `road_damage`, `streetlight`, `garbage`, `water_supply`, `drainage`, `traffic_signal`, `fallen_tree`, `other`.

### GET `/api/issues/stats`

Staff and admin only (`401` without a token, `403` for citizens).

```json
{
  "total": 42,
  "byStatus": { "Open": 20, "In Progress": 12, "Resolved": 10 },
  "byCategory": { "pothole": 15, "streetlight": 9, "garbage": 8, "...": 0 },
  "needsReview": 4,
  "overdue": 6,
  "last7Days": { "reported": 11, "resolved": 5 },
  "avgResolutionHours": 51.3
}
```

`needsReview` counts unresolved flagged issues; `overdue` counts unresolved issues older than 7 days; `avgResolutionHours` is the mean time from report to first "Resolved" for issues resolved now (`null` if none).

### GET `/api/issues/:id`

Returns one issue by UUID, including its timeline:

```json
{
  "id": "…",
  "title": "Streetlight out near bus stop",
  "category": "streetlight",
  "status": "In Progress",
  "is_mine": true,
  "updates": [
    { "id": "…", "from_status": null, "to_status": "Open", "note": null, "photo_url": null,
      "created_at": "…", "author": { "role": "citizen", "name": "Asha", "is_me": true } },
    { "id": "…", "from_status": "Open", "to_status": "In Progress", "note": "Crew scheduled for Monday",
      "photo_url": null, "created_at": "…", "author": { "role": "staff", "name": "Ravi K", "is_me": false } }
  ]
}
```

`400` for a malformed id, `404` if it does not exist.

### POST `/api/issues`

Authentication: required for citizens/staff/admin as allowed by controller/business rules.

Content type:

```text
multipart/form-data
```

Form fields:

| Field | Type | Requirement | Notes |
|---|---|---|---|
| `title` | string | required | Non-empty after trimming |
| `description` | string | required | Non-empty after trimming |
| `latitude` | decimal | required | -90 to 90 |
| `longitude` | decimal | required | -180 to 180 |
| `status` | enum | optional | Only `Open` is accepted; any other value returns `400`. New issues always start `Open`, and only staff/admin can change status (via `PUT`) |
| `category` | string | optional | A category id; defaults to `other` |
| `image` | file | optional by route, strongly preferred | Validated by Multer/evidence pipeline |
| `photo_url` | URL | optional | Backward-compatible fallback |

Example cURL:

```bash
curl -X POST "$API_URL/api/issues" \
  -H "Authorization: Bearer $TOKEN" \
  -F "title=Broken street light" \
  -F "description=Street light is not functioning near the bus stop" \
  -F "latitude=12.971599" \
  -F "longitude=77.594566" \
  -F "image=@./street-light.jpg"
```

Processing includes coordinate validation, optional reverse geocoding, EXIF inspection, photo-date checks, GPS consistency checks, pHash computation, and similar-image detection. fileciteturn263file0L2-L2

Returns `201` with the issue (as in `GET /api/issues/:id`). The report is linked to the signed-in user and its timeline starts with a "reported" entry.

### PUT `/api/issues/:id`

Authentication: required.

Roles:

```text
staff, admin
```

Optional fields include:

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "latitude": 12.971599,
  "longitude": 77.594566,
  "status": "In Progress",
  "category": "drainage",
  "note": "Crew scheduled for Monday",
  "photo_url": "https://example.com/resolution.jpg"
}
```

`note` (up to 1000 characters) is shown to citizens in the timeline; a note on its own is a valid update. A status change, note or uploaded photo each add a timeline entry. An optional multipart `image` is stored as the resolution photo when the issue is (or becomes) `Resolved`, otherwise as the issue photo; earlier photos stay in the timeline.

Returns the updated issue with its timeline.

### DELETE `/api/issues/:id`

Authentication: required.

Role:

```text
admin
```

This endpoint must reject authenticated citizens and staff. It also deletes the issue's timeline and photos.

## 5. Validation contract

### Geographic coordinates

```text
Latitude:  -90 <= latitude <= 90
Longitude: -180 <= longitude <= 180
```

### Status

```text
Open
In Progress
Resolved
```

### UUID

Issue identifiers are validated as UUIDs before controller execution. fileciteturn258file0L2-L6

### Uploads

The API limits multipart uploads to one file and 10 MB and restricts accepted image MIME types. fileciteturn256file0L2-L4

- A file larger than 10 MB returns `413` with `Image must be 10 MB or smaller`.
- A file that is not JPEG, PNG, GIF, or WebP returns `400`.
- Other multipart mistakes (more than one file, unexpected field name) return `400`.

## 6. Error model

Canonical categories:

| Status | Meaning | Client action |
|---:|---|---|
| 400 | Invalid request/evidence | Correct request or evidence |
| 401 | Missing/invalid/expired JWT | Re-authenticate |
| 403 | Authenticated but not authorized | Do not retry with same role |
| 404 | Issue/resource not found | Refresh or report missing resource |
| 409 | Resource conflict | Resolve duplicate/conflict |
| 413 | Upload or request body too large | Send a smaller image (10 MB max) or body (1 MB max) |
| 429 | Rate limited | Back off and retry later |
| 500 | Unexpected server failure | Show generic error; inspect server logs |
| 503 | Dependency/unavailable service | Retry using backoff after service recovery |

Production responses must not expose internal exception messages. This is an explicit production hardening requirement. fileciteturn256file0L2-L4

## 7. Request limits and CORS

The API configures JSON and URL-encoded body limits at 1 MB and a global process-local rate limiter. CORS is origin allow-listed in production using `CORS_ORIGINS`. fileciteturn257file0L2-L5

A browser request from an origin that is not on the allow-list receives `403` (`Origin not allowed by CORS`). Requests without an `Origin` header, such as those from the mobile app or `curl`, are not affected.

The rate limiter is process-local; horizontally scaled deployments require a shared limiter. fileciteturn256file0L2-L4

## 8. Health endpoint

### GET `/health`

Success:

```json
{
  "status": "ok",
  "database": "ok"
}
```

If PostgreSQL cannot be authenticated, the API returns HTTP 503 with a degraded/unavailable database indication. fileciteturn257file0L2-L5

## 9. API compatibility rules

When changing an endpoint:

1. Update validation and controller behavior together.
2. Update this API reference and frontend/mobile call sites in the same change.
3. Preserve backward compatibility unless the change is explicitly versioned or intentionally breaking.
4. Add or update integration tests.
5. Document error semantics, authorization, and request limits.
6. Never rely on frontend validation as the security control.
